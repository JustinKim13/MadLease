package com.badgersublease.backend.service;

import com.badgersublease.backend.mapper.ConversationMapper;
import com.badgersublease.backend.mapper.ListingMapper;
import com.badgersublease.backend.mapper.MessageMapper;
import com.badgersublease.backend.model.Report;
import com.badgersublease.backend.model.Email;

import com.badgersublease.backend.model.Listing;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.google.firebase.auth.UserRecord;
import com.badgersublease.backend.mapper.UserMapper;
import com.badgersublease.backend.model.User;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionCallbackWithoutResult;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class UserService {

    private final UserMapper userMapper;
    private final ListingMapper listingMapper;
    private final ConversationMapper conversationMapper;
    private final MessageMapper messageMapper;
    private final AuthService authService;
    private final ListingService listingService;
    private final TransactionTemplate transactionTemplate;
    private final EmailService emailService;
    private final SlackService slackService;

    private final S3Service s3Service;

    @Autowired
    public UserService(UserMapper userMapper, ListingMapper listingMapper,
                       ConversationMapper conversationMapper, MessageMapper messageMapper,
                       AuthService authService, S3Service s3Service,
                       TransactionTemplate transactionTemplate, EmailService emailService,
                       ListingService listingService, SlackService slackService) {
        this.userMapper = userMapper;
        this.listingMapper = listingMapper;
        this.conversationMapper = conversationMapper;
        this.messageMapper = messageMapper;
        this.authService = authService;
        this.listingService = listingService;
        this.transactionTemplate = transactionTemplate;
        this.emailService = emailService;
        this.s3Service = s3Service;
        this.slackService = slackService;
    }

    public User getUserById(Long userId){
        return userMapper.getUserById(userId);
    }

    public User getUserByFirebaseUid(String firebaseUid) {
        return userMapper.getUserByFirebaseUid(firebaseUid);
    }

    public User getOrCreateUserFromToken(String idToken) {
        FirebaseToken token = authService.verifyToken(idToken); 
        String firebaseUid = token.getUid();
        return getOrCreateUserByUid(firebaseUid);
    }

    // Method that takes a Firebase UID directly (already verified)
    public User getOrCreateUserByUid(String firebaseUid) {
        User user = userMapper.getUserByFirebaseUid(firebaseUid);

        // Check if email is a wisc.edu email for verification status
        boolean isWiscEmail = false;
        try {
            var firebaseUser = authService.getUserByUid(firebaseUid);
            String email = firebaseUser.getEmail();
            if (email != null && email.toLowerCase().endsWith("wisc.edu")) {
                isWiscEmail = true;
            }
        } catch (Exception e) {
            // Could not fetch Firebase user, proceed without verification
        }

        if (user == null) {
            // Create new user with firebase UID and verification status
            user = new User();
            user.setFirebaseUid(firebaseUid);
            user.setVerified(isWiscEmail);
            userMapper.createUser(user);
            user = userMapper.getUserByFirebaseUid(firebaseUid);
        } else if (user.isVerified() != isWiscEmail) {
            // Update verification status if it changed (e.g., user changed email)
            userMapper.updateUserVerification(firebaseUid, isWiscEmail);
            user.setVerified(isWiscEmail);
        }

        return user;
    }

    /**
     * Deletes a user and all associated data (cascade delete).
     * Order of deletion respects foreign key constraints.
     * Also removes the Firebase account and sends a confirmation email (both best-effort).
     */
    @Transactional
    public void deleteUserById(Long userId) {
        // Capture Firebase contact info before the DB record is gone
        User user = userMapper.getUserById(userId);
        String firebaseUid = user != null ? user.getFirebaseUid() : null;
        String userEmail = null;
        String userName = null;
        if (firebaseUid != null) {
            try {
                UserRecord firebaseUser = authService.getUserByUid(firebaseUid);
                userEmail = firebaseUser.getEmail();
                userName = firebaseUser.getDisplayName();
            } catch (Exception ignored) {}
        }

        // 1. Get all user's listings to delete their photos from S3
        List<Listing> userListings = listingMapper.getUserListings(userId);

        // 2. For each listing, archive non-PII data, delete S3 files and DB records
        for (Listing listing : userListings) {
            // Archive listing before deletion
            listingMapper.archiveListing(listing.getListingID());
            // Delete photos from S3
            if (listing.getListingImageFileNames() != null) {
                for (String fileName : listing.getListingImageFileNames()) {
                    try {
                        s3Service.deleteFile(fileName);
                    } catch (Exception e) {
                        // Log but continue - don't fail the whole deletion for S3 issues
                    }
                }
            }

            // Delete listing photos from DB
            listingMapper.deleteAllListingPhotos(listing.getListingID());

            // Delete saved listing links for this listing (other users who saved it)
            listingMapper.deleteSavedListingLinksByListingId(listing.getListingID());

            // Delete saved listing entry for this listing
            listingMapper.deleteSavedListingsByListingId(listing.getListingID());
        }

        // 3. Delete user's own saved listing links (listings they saved)
        listingMapper.deleteAllSavedListingLinksByUser(userId);

        // 4. Delete messages in conversations involving this user
        messageMapper.deleteMessagesForUser(userId);

        // 5. Delete DeletedConversations records for conversations involving this user
        conversationMapper.deleteDeletedConversationsForUserConversations(userId);

        // 6. Delete any DeletedConversations records where this user deleted a conversation
        conversationMapper.deleteDeletedConversationsForUser(userId);

        // 7. Delete conversations where user is requester or lister
        conversationMapper.deleteConversationsForUser(userId);

        // 8. Delete all user's listings
        listingMapper.deleteAllListingsByUser(userId);

        // 9. Finally delete the user
        userMapper.deleteUserById(userId);

        if (firebaseUid != null) {
            try {
                authService.deleteUserByUid(firebaseUid);
            } catch (Exception ignored) {}
        }

        if (userEmail != null) {
            try {
                Email email = new Email();
                email.setEmail(userEmail);
                email.setName(userName);
                emailService.sendDeletedAccountsEmail(email);
            } catch (Exception ignored) {}
            try {
                slackService.notifyUserDeleted(userEmail, userName);
            } catch (Exception ignored) {}
        }
    }

    // report: userId, reportedUserId, reason, reportMessage
    public void submitUserReport(Report report) {
        userMapper.submitUserReport(report);
        slackService.notifyUserReportSubmitted(report);
    }

    public void deleteUsers(List<Long> userIds) {
        //TODO at some point maybe need to update sql db for on delete cascade
        //it would simplify logic by not making us also loop through users listings

        // Gather Firebase profile info BEFORE any deletion so we can email users after commit
        record PendingDeletion(Long userId, String firebaseUid, String email, String name, List<Long> listingIds) {}
        List<PendingDeletion> pending = new ArrayList<>();
        for (Long userId : userIds) {
            User user = getUserById(userId);
            List<Long> listingIds = listingService.getUserListings(userId).stream()
                    .map(Listing::getListingID).collect(Collectors.toList());
            String email = null;
            String name = null;
            try {
                UserRecord userRecord = FirebaseAuth.getInstance().getUser(user.getFirebaseUid());
                email = userRecord.getEmail();
                name = userRecord.getDisplayName();
            } catch (Exception e) {
                // Firebase user may already be gone; proceed without contact info
            }
            pending.add(new PendingDeletion(userId, user.getFirebaseUid(), email, name, listingIds));
        }

        // DB deletions as a single atomic transaction. Any failure rolls back and aborts
        // before we touch Firebase or send emails.
        transactionTemplate.execute(new TransactionCallbackWithoutResult() {
            protected void doInTransactionWithoutResult(TransactionStatus status) {
                for (PendingDeletion p : pending) {
                    listingService.deleteListings(p.listingIds(), false);
                    deleteUserById(p.userId());
                }
            }
        });

    }

    public void updateUserVerification(String firebaseUid, boolean isVerified) {
        userMapper.updateUserVerification(firebaseUid, isVerified);
    }

    public List<Map<String, Object>> getAllUsersWithFirebaseInfo() {
        List<User> users = userMapper.getAllUsers();
        List<Map<String, Object>> result = new ArrayList<>();

        for (User user : users) {
            Map<String, Object> userInfo = new HashMap<>();
            userInfo.put("userID", user.getUserID());
            userInfo.put("firebaseUid", user.getFirebaseUid());
            userInfo.put("isVerified", user.isVerified());

            try {
                UserRecord record = FirebaseAuth.getInstance().getUser(user.getFirebaseUid());
                userInfo.put("name", record.getDisplayName());
                userInfo.put("email", record.getEmail());
                userInfo.put("profilePictureUrl", record.getPhotoUrl());
                if (record.getUserMetadata() != null) {
                    userInfo.put("createdAt", new Date(record.getUserMetadata().getCreationTimestamp()));
                    userInfo.put("lastSignIn", new Date(record.getUserMetadata().getLastSignInTimestamp()));
                }
            } catch (Exception e) {
                userInfo.put("name", "Unknown");
                userInfo.put("email", "Unknown");
                userInfo.put("profilePictureUrl", null);
            }

            result.add(userInfo);
        }

        return result;
    }
}
