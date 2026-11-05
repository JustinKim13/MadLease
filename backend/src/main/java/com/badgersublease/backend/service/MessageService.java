package com.badgersublease.backend.service;

import com.badgersublease.backend.mapper.BlockedUserMapper;
import com.badgersublease.backend.mapper.ConversationMapper;
import com.badgersublease.backend.mapper.MessageMapper;
import com.badgersublease.backend.mapper.ListingMapper;
import com.badgersublease.backend.mapper.UserMapper;
import com.badgersublease.backend.model.Conversation;
import com.badgersublease.backend.model.Message;
import com.badgersublease.backend.model.Listing;
import com.badgersublease.backend.model.Email;
import org.springframework.scheduling.annotation.Scheduled;
import com.badgersublease.backend.model.UnreadNotification;
import com.badgersublease.backend.model.User;
import com.badgersublease.backend.util.EncryptionUtil;
import com.google.firebase.auth.UserRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Set;
import java.util.HashSet;
import java.util.Map;
import java.util.HashMap;

@Service
public class MessageService {

    private static final Logger log = LoggerFactory.getLogger(MessageService.class);

    private final ConversationMapper conversationMapper;
    private final MessageMapper messageMapper;
    private final ListingMapper listingMapper;
    private final UserMapper userMapper;
    private final AuthService authService;
    private final EncryptionUtil encryptionUtil;
    private final EmailService emailService;
    private final BlockedUserMapper blockedUserMapper;
    private final SlackService slackService;

    @Autowired
    public MessageService(ConversationMapper conversationMapper, MessageMapper messageMapper, ListingMapper listingMapper, UserMapper userMapper, AuthService authService, EncryptionUtil encryptionUtil, EmailService emailService, BlockedUserMapper blockedUserMapper, SlackService slackService) {
        this.conversationMapper = conversationMapper;
        this.messageMapper = messageMapper;
        this.listingMapper = listingMapper;
        this.userMapper = userMapper;
        this.authService = authService;
        this.encryptionUtil = encryptionUtil;
        this.emailService = emailService;
        this.blockedUserMapper = blockedUserMapper;
        this.slackService = slackService;
    }

    public List<Conversation> getUserConversations(Long userId) {
        List<Conversation> conversations = conversationMapper.getUserConversations(userId);

        // Drop conversations with any user this user has blocked,
        // or any user who has blocked this user.
        conversations.removeIf(c -> {
            Long otherId = userId.equals(c.getRequesterID()) ? c.getListerID() : c.getRequesterID();
            return blockedUserMapper.isBlocked(userId, otherId)
                || blockedUserMapper.isBlocked(otherId, userId);
        });

        // Collect all unique user IDs that we need Firebase data for
        Set<Long> userIds = new HashSet<>();
        for (Conversation conversation : conversations) {
            userIds.add(conversation.getRequesterID());
            userIds.add(conversation.getListerID());
        }

        // Fetch Firebase user data for all unique users
        Map<Long, UserRecord> firebaseUserData = new HashMap<>();
        for (Long userIdToFetch : userIds) {
            try {
                User user = userMapper.getUserById(userIdToFetch);
                if (user != null && user.getFirebaseUid() != null) {
                    UserRecord firebaseUser = authService.getUserByUid(user.getFirebaseUid());
                    firebaseUserData.put(userIdToFetch, firebaseUser);
                }
            } catch (Exception e) {
                // Failed to fetch Firebase data for user, will use placeholder
            }
        }

        // Decrypt last message content and populate user data for conversation previews
        for (Conversation conversation : conversations) {
            // Decrypt last message content
            if (conversation.getLastMessageContent() != null) {
                try {
                    conversation.setLastMessageContent(encryptionUtil.decrypt(conversation.getLastMessageContent()));
                } catch (Exception e) {
                    // Could not decrypt, assuming unencrypted legacy message
                }
            }

            // Populate requester data
            UserRecord requesterData = firebaseUserData.get(conversation.getRequesterID());
            if (requesterData != null) {
                conversation.setRequesterName(requesterData.getDisplayName() != null ? requesterData.getDisplayName() : "Unknown User");
                conversation.setRequesterProfilePictureUrl(requesterData.getPhotoUrl());
            } else {
                conversation.setRequesterName("Unknown User");
                conversation.setRequesterProfilePictureUrl(null);
            }

            // Populate lister data
            UserRecord listerData = firebaseUserData.get(conversation.getListerID());
            if (listerData != null) {
                conversation.setListerName(listerData.getDisplayName() != null ? listerData.getDisplayName() : "Unknown User");
                conversation.setListerProfilePictureUrl(listerData.getPhotoUrl());
            } else {
                conversation.setListerName("Unknown User");
                conversation.setListerProfilePictureUrl(null);
            }
        }
        
        return conversations;
    }

    public List<Message> getConversationMessages(Long conversationId, Long userId) {
        // Verify user is part of this conversation before accessing messages
        Conversation conversation = conversationMapper.getConversationById(conversationId);
        if (conversation == null) {
            throw new RuntimeException("Conversation not found");
        }
        if (!userId.equals(conversation.getRequesterID()) && !userId.equals(conversation.getListerID())) {
            throw new RuntimeException("User not part of this conversation");
        }

        // Mark messages as read when user views them
        messageMapper.markMessagesAsRead(conversationId, userId);
        List<Message> messages = messageMapper.getMessagesByConversation(conversationId);
        
        // Collect all unique sender IDs that we need Firebase data for
        Set<Long> senderIds = new HashSet<>();
        for (Message message : messages) {
            senderIds.add(message.getSenderID());
        }

        // Fetch Firebase user data for all unique senders
        Map<Long, UserRecord> firebaseUserData = new HashMap<>();
        for (Long senderIdToFetch : senderIds) {
            try {
                User user = userMapper.getUserById(senderIdToFetch);
                if (user != null && user.getFirebaseUid() != null) {
                    UserRecord firebaseUser = authService.getUserByUid(user.getFirebaseUid());
                    firebaseUserData.put(senderIdToFetch, firebaseUser);
                }
            } catch (Exception e) {
                // Failed to fetch Firebase data for sender, will use placeholder
            }
        }

        // Decrypt message content and populate sender data
        for (Message message : messages) {
            // Decrypt message content
            if (message.getContent() != null) {
                try {
                    message.setContent(encryptionUtil.decrypt(message.getContent()));
                } catch (Exception e) {
                    // Could not decrypt, assuming unencrypted legacy message
                }
            }

            // Populate sender data from Firebase
            UserRecord senderData = firebaseUserData.get(message.getSenderID());
            if (senderData != null) {
                message.setSenderName(senderData.getDisplayName() != null ? senderData.getDisplayName() : "Unknown User");
                message.setSenderProfilePictureUrl(senderData.getPhotoUrl());
            } else {
                message.setSenderName("Unknown User");
                message.setSenderProfilePictureUrl(null);
            }
        }
        
        return messages;
    }

    public Message sendMessage(String publicListingId, Long senderId, String content) {
        if (content == null || content.trim().isEmpty()) {
            throw new IllegalArgumentException("Message cannot be empty");
        }
        if (content.length() > 5000) {
            throw new IllegalArgumentException("Message must be under 5000 characters");
        }

        Long listingId = listingMapper.getListingIdByPublicId(publicListingId);
        if (listingId == null) {
            throw new RuntimeException("Listing not found");
        }

        // Get the listing to find the lister
        Listing listing = listingMapper.getListingById(listingId);
        if (listing == null) {
            throw new RuntimeException("Listing not found");
        }

        Long listerUserId = listing.getUserID();
        Long requesterUserId = senderId;
        
        // If sender is the lister, they're responding to a requester
        if (senderId.equals(listerUserId)) {
            throw new RuntimeException("Cannot start conversation with yourself");
        }

        // Silent block: if the lister has blocked the sender, fake a success
        // response without creating the conversation or persisting the message.
        if (blockedUserMapper.isBlocked(listerUserId, senderId)) {
            Message fake = new Message();
            fake.setSenderID(senderId);
            fake.setContent(content);
            return fake;
        }

        // Find or create conversation
        Conversation conversation = conversationMapper.getConversationByListingAndRequester(listingId, requesterUserId);
        if (conversation == null) {
            conversation = new Conversation();
            conversation.setListingID(listingId);
            conversation.setRequesterID(requesterUserId);
            conversation.setListerID(listerUserId);
            conversationMapper.createConversation(conversation);
        }

        // Create message with encrypted content
        Message message = new Message();
        message.setConversationID(conversation.getConversationID());
        message.setSenderID(senderId);
        message.setContent(encryptionUtil.encrypt(content));
        messageMapper.createMessage(message);

        // Update conversation timestamp
        conversationMapper.updateConversationTime(conversation.getConversationID());

        // Remove any deletion records - conversation should reappear for users who deleted it
        conversationMapper.undeleteConversation(conversation.getConversationID());

        return message;
    }

    public Message replyToConversation(Long conversationId, Long senderId, String content) {
        if (content == null || content.trim().isEmpty()) {
            throw new IllegalArgumentException("Message cannot be empty");
        }
        if (content.length() > 5000) {
            throw new IllegalArgumentException("Message must be under 5000 characters");
        }

        // Get conversation to validate it exists
        Conversation conversation = conversationMapper.getConversationById(conversationId);
        if (conversation == null) {
            throw new RuntimeException("Conversation not found");
        }

        // Verify sender is part of this conversation
        if (!senderId.equals(conversation.getRequesterID()) && !senderId.equals(conversation.getListerID())) {
            throw new RuntimeException("User not part of this conversation");
        }

        // Silent block: if the recipient has blocked the sender, fake success
        // so the sender's UI shows the message, but never persist it.
        Long recipientId = senderId.equals(conversation.getRequesterID())
                ? conversation.getListerID()
                : conversation.getRequesterID();
        if (blockedUserMapper.isBlocked(recipientId, senderId)) {
            Message fake = new Message();
            fake.setConversationID(conversationId);
            fake.setSenderID(senderId);
            fake.setContent(content);
            return fake;
        }

        // Create message with encrypted content
        Message message = new Message();
        message.setConversationID(conversationId);
        message.setSenderID(senderId);
        message.setContent(encryptionUtil.encrypt(content));
        messageMapper.createMessage(message);

        // Update conversation timestamp
        conversationMapper.updateConversationTime(conversationId);

        // Remove any deletion records - conversation should reappear for users who deleted it
        conversationMapper.undeleteConversation(conversationId);

        return message;
    }

    public Conversation findOrCreateConversation(String publicListingId, Long requesterUserId) {
        Long listingId = listingMapper.getListingIdByPublicId(publicListingId);
        if (listingId == null) {
            throw new RuntimeException("Listing not found");
        }

        // Get listing to find the lister
        Listing listing = listingMapper.getListingById(listingId);
        if (listing == null) {
            throw new RuntimeException("Listing not found");
        }

        Long listerUserId = listing.getUserID();

        // Prevent users from starting conversations with themselves
        if (requesterUserId.equals(listerUserId)) {
            throw new RuntimeException("Cannot start conversation with yourself");
        }

        // Find or create conversation
        Conversation conversation = conversationMapper.getConversationByListingAndRequester(listingId, requesterUserId);
        if (conversation != null) {
            return conversation;
        }

        conversation = new Conversation();
        conversation.setListingID(listingId);
        conversation.setRequesterID(requesterUserId);
        conversation.setListerID(listerUserId);
        conversationMapper.createConversation(conversation);
        slackService.notifyFirstMessage(listing.getTitle(), listing.getPublicId(), requesterUserId, listerUserId);

        return conversation;
    }

    @Scheduled(fixedDelay = 3600000)
    public void sendUnreadNotifications() {
        //get messages eligible for notification
        List<UnreadNotification> eligible = messageMapper.getMessagesEligibleForNotification();
        log.info("Unread notification job: {} eligible message(s)", eligible.size());

        for (UnreadNotification msg : eligible) {
            try {
                //get recipient user id(if sender is requester, recipient is lister, if sender is lister, recipient is requester)
                Long recipientUserId = msg.getSenderID().equals(msg.getRequesterID())
                        ? msg.getListerID()
                        : msg.getRequesterID();

                //get recipient user firebase info
                User recipientUser = userMapper.getUserById(recipientUserId);
                if (recipientUser == null || recipientUser.getFirebaseUid() == null) {
                    log.warn("Skipping conversation={} sender={}: recipient user not found", msg.getConversationID(), msg.getSenderID());
                    messageMapper.markConversationNotificationsSent(msg.getConversationID(), msg.getSenderID());
                    continue;
                }

                UserRecord recipientRecord = authService.getUserByUid(recipientUser.getFirebaseUid());
                String recipientEmail = recipientRecord.getEmail();
                String recipientName = recipientRecord.getDisplayName() != null ? recipientRecord.getDisplayName() : "there";

                if (recipientEmail == null) {
                    log.warn("Skipping conversation={} sender={}: recipient has no email", msg.getConversationID(), msg.getSenderID());
                    messageMapper.markConversationNotificationsSent(msg.getConversationID(), msg.getSenderID());
                    continue;
                }

                //get sender user info
                User senderUser = userMapper.getUserById(msg.getSenderID());
                String senderName = "Someone";
                if (senderUser != null && senderUser.getFirebaseUid() != null) {
                    try {
                        UserRecord senderRecord = authService.getUserByUid(senderUser.getFirebaseUid());
                        if (senderRecord.getDisplayName() != null) {
                            senderName = senderRecord.getDisplayName();
                        }
                    } catch (Exception e) {
                        log.warn("Could not fetch sender Firebase record for conversation={}", msg.getConversationID());
                    }
                }

                String decrypted;
                try {
                    decrypted = encryptionUtil.decrypt(msg.getContent());
                } catch (Exception e) {
                    decrypted = msg.getContent();
                }
                String preview = decrypted.length() > 150 ? decrypted.substring(0, 150) + "..." : decrypted;

                String conversationUrl = "https://madlease.net/messages/" + msg.getConversationID();

                //send email notification
                Email notification = new Email();
                notification.setEmail(recipientEmail);
                notification.setName(recipientName);
                notification.setSenderName(senderName);
                notification.setListingTitle(msg.getListingTitle());
                notification.setMessage(preview);
                notification.setMessageCount(msg.getMessageCount());
                notification.setConversationUrl(conversationUrl);
                emailService.sendUnreadMessageNotification(notification);
                messageMapper.markConversationNotificationsSent(msg.getConversationID(), msg.getSenderID());
                log.info("Sent unread notification for conversation={} sender={} ({} messages) to userId={}", msg.getConversationID(), msg.getSenderID(), msg.getMessageCount(), recipientUserId);

            } catch (Exception e) {
                log.error("Failed to send unread notification for conversation={} sender={}: {}", msg.getConversationID(), msg.getSenderID(), e.getMessage());
                //mark as sent anyway to avoid infinite retries
                messageMapper.markConversationNotificationsSent(msg.getConversationID(), msg.getSenderID());
            }
        }
    }

    @Scheduled(cron = "0 0 10 * * *", zone = "America/Chicago")
    public void sendUnreadReminders() {
        //get messages still unread 3+ days after the first notification was sent
        List<UnreadNotification> eligible = messageMapper.getMessagesEligibleForReminder();
        log.info("Unread reminder job: {} eligible message(s)", eligible.size());

        for (UnreadNotification msg : eligible) {
            try {
                Long recipientUserId = msg.getSenderID().equals(msg.getRequesterID())
                        ? msg.getListerID()
                        : msg.getRequesterID();

                User recipientUser = userMapper.getUserById(recipientUserId);
                if (recipientUser == null || recipientUser.getFirebaseUid() == null) {
                    log.warn("Skipping reminder conversation={} sender={}: recipient user not found", msg.getConversationID(), msg.getSenderID());
                    messageMapper.markConversationRemindersSent(msg.getConversationID(), msg.getSenderID());
                    continue;
                }

                UserRecord recipientRecord = authService.getUserByUid(recipientUser.getFirebaseUid());
                String recipientEmail = recipientRecord.getEmail();
                String recipientName = recipientRecord.getDisplayName() != null ? recipientRecord.getDisplayName() : "there";

                if (recipientEmail == null) {
                    log.warn("Skipping reminder conversation={} sender={}: recipient has no email", msg.getConversationID(), msg.getSenderID());
                    messageMapper.markConversationRemindersSent(msg.getConversationID(), msg.getSenderID());
                    continue;
                }

                User senderUser = userMapper.getUserById(msg.getSenderID());
                String senderName = "Someone";
                if (senderUser != null && senderUser.getFirebaseUid() != null) {
                    try {
                        UserRecord senderRecord = authService.getUserByUid(senderUser.getFirebaseUid());
                        if (senderRecord.getDisplayName() != null) {
                            senderName = senderRecord.getDisplayName();
                        }
                    } catch (Exception e) {
                        log.warn("Could not fetch sender Firebase record for reminder conversation={}", msg.getConversationID());
                    }
                }

                String decrypted;
                try {
                    decrypted = encryptionUtil.decrypt(msg.getContent());
                } catch (Exception e) {
                    decrypted = msg.getContent();
                }
                String preview = decrypted.length() > 150 ? decrypted.substring(0, 150) + "..." : decrypted;

                String conversationUrl = "https://madlease.net/messages/" + msg.getConversationID();

                Email notification = new Email();
                notification.setEmail(recipientEmail);
                notification.setName(recipientName);
                notification.setSenderName(senderName);
                notification.setListingTitle(msg.getListingTitle());
                notification.setMessage(preview);
                notification.setMessageCount(msg.getMessageCount());
                notification.setConversationUrl(conversationUrl);
                emailService.sendUnreadReminderEmail(notification);
                messageMapper.markConversationRemindersSent(msg.getConversationID(), msg.getSenderID());
                log.info("Sent unread reminder for conversation={} sender={} ({} messages) to userId={}", msg.getConversationID(), msg.getSenderID(), msg.getMessageCount(), recipientUserId);

            } catch (Exception e) {
                log.error("Failed to send unread reminder for conversation={} sender={}: {}", msg.getConversationID(), msg.getSenderID(), e.getMessage());
                //mark as sent anyway to avoid infinite retries
                messageMapper.markConversationRemindersSent(msg.getConversationID(), msg.getSenderID());
            }
        }
    }

    public void deleteConversationForUser(Long conversationId, Long userId) {
        // Get conversation to validate it exists and user is part of it
        Conversation conversation = conversationMapper.getConversationById(conversationId);
        if (conversation == null) {
            throw new RuntimeException("Conversation not found");
        }

        // Verify user is part of this conversation
        if (!userId.equals(conversation.getRequesterID()) && !userId.equals(conversation.getListerID())) {
            throw new RuntimeException("User not part of this conversation");
        }

        // Mark conversation as deleted for this user
        conversationMapper.deleteConversationForUser(conversationId, userId);
    }
} 