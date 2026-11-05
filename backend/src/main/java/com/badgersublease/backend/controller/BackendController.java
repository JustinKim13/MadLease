package com.badgersublease.backend.controller;

import com.badgersublease.backend.exceptions.BadRequestException;
import com.badgersublease.backend.model.*;
import com.badgersublease.backend.service.*;
import com.badgersublease.backend.types.Status;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.resend.core.exception.ResendException;

import jakarta.validation.Valid;


import java.util.*;


@RestController // tells Spring this class will handle HTTP requests and return JSON
@RequestMapping("/api")
public class BackendController {
    private static final Logger log = LoggerFactory.getLogger(BackendController.class);

    private final UserService userService; // dependency injection
    private final ListingService listingService;
    private final AuthService authService;
    private final MessageService messageService;
    private final EmailService emailService;
    private final BlockService blockService;
    private final PopupService popupService;
    private final UnsubscribeService unsubscribeService;
    private final com.badgersublease.backend.mapper.EmailOptOutMapper emailOptOutMapper;

    @Autowired // allows Spring to resolve and inject collaborating beans into our bean -- finds the UserService and ListingService objects it manages, and auto pass them into our controller when created
    BackendController(UserService userService, ListingService listingService, AuthService authService, MessageService messageService, EmailService emailService, BlockService blockService, PopupService popupService, UnsubscribeService unsubscribeService, com.badgersublease.backend.mapper.EmailOptOutMapper emailOptOutMapper) {
        this.userService = userService;
        this.listingService = listingService;
        this.authService = authService;
        this.messageService = messageService;
        this.emailService = emailService;
        this.blockService = blockService;
        this.popupService = popupService;
        this.unsubscribeService = unsubscribeService;
        this.emailOptOutMapper = emailOptOutMapper;
    }

    // Canonical auth-check helper: resolves the authenticated User from a Bearer
    // Authorization header, or returns null if the header is missing, malformed, or the
    // token fails verification. Every endpoint that requires authentication goes through
    // this instead of calling userService.getOrCreateUserFromToken(...) directly, so a
    // missing/malformed header always produces a clean 401, never a bare 500.
    private User requireUser(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        try {
            return userService.getOrCreateUserFromToken(authHeader.substring(7));
        } catch (Exception e) {
            return null;
        }
    }

    // generally @PathVariable for get/delete, @RequestBody is post/update
    // @PathVariable: grab the value from the URL path and use it as a param for this method

    // get user info, presumably logged in
    @GetMapping("/user")
    public ResponseEntity<User> getCurrentUser(@RequestHeader(value = "Authorization", required = false) String authHeader){
        User user = requireUser(authHeader);
        if (user == null) {
            return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        }
        return new ResponseEntity<>(user, HttpStatus.OK);
    }

    // No longer need to update user profile in backend - Firebase is the source of truth
    @PutMapping("/user")
    public ResponseEntity<Map<String, String>> updateUser(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                                          @RequestBody User userUpdate){
        User user = requireUser(authHeader);
        if (user == null) {
            return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        }

        Map<String, String> response = new HashMap<>();
        response.put("message", "Profile update acknowledged - Firebase is the source of truth");
        return new ResponseEntity<>(response, HttpStatus.OK);
    }

    // get all listings under a user
    @GetMapping("/user/listings")
    public ResponseEntity<List<Listing>> getUserListings(@RequestHeader(value = "Authorization", required = false) String authHeader){
        User user = requireUser(authHeader);
        if (user == null) {
            return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        }
        try {
            return new ResponseEntity<>(listingService.getUserListings(user.getUserID()), HttpStatus.OK);
        }
        catch (Exception e){
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // get ALL the listings
    @GetMapping("/listings")
    public ResponseEntity<List<Listing>> getListings(
            @RequestParam(required = false) Integer minRent,
            @RequestParam(required = false) Integer maxRent,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) Integer roommates,
            @RequestParam(required = false) Integer bedrooms,
            @RequestParam(required = false) List<String> amenities,
            @RequestParam(required = false) Boolean parkingIncluded,
            @RequestParam(required = false) String listingType,
            @RequestParam(required = false) String seed) {
        try{
            return new ResponseEntity<>(listingService.getFilteredListings(minRent, maxRent, startDate, endDate, roommates, bedrooms, amenities, parkingIncluded, listingType, seed), HttpStatus.OK);
        } catch (BadRequestException e) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (Exception e) {
            log.error("Error fetching filtered listings", e);
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    // get trending listings by composite score (views * 0.6 + saves * 0.4)
    @GetMapping("/listings/trending")
    public ResponseEntity<List<Listing>> getTrendingListings(
            @RequestParam(defaultValue = "5") int limit) {
        try {
            int safeLimit = Math.min(Math.max(limit, 1), 20);
            return new ResponseEntity<>(listingService.getTrendingListings(safeLimit), HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    //used to validate listing by public UUID
    @GetMapping("/listings/{listingId}")
    public ResponseEntity<Boolean> validateListing(@PathVariable String listingId) {
        try {
            return new ResponseEntity<>(listingService.doesListingExistByPublicId(listingId),
                    HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(false, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // get a single listing with images by public UUID and fresh profile data
    @GetMapping("/listings/{listingId}/details")
    public ResponseEntity<ListingDetails> getListingDetails(
            @PathVariable String listingId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(required = false, defaultValue = "true") boolean track) {
        try {
            Long requesterId = null;
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                try {
                    User requester = userService.getOrCreateUserFromToken(authHeader.substring(7));
                    requesterId = requester.getUserID();
                } catch (Exception ignored) {}
            }

            ListingDetails details = listingService.getListingDetails(listingId, requesterId, track);
            if (details == null) {
                return new ResponseEntity<>(HttpStatus.NOT_FOUND);
            }
            return new ResponseEntity<>(details, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // get view and save counts for a listing (by public UUID)
    @GetMapping("/listings/{listingId}/counts")
    public ResponseEntity<Map<String, Integer>> getListingCounts(@PathVariable String listingId) {
        try {
            Long internalId = listingService.getListingIdByPublicId(listingId);
            if (internalId == null) {
                return new ResponseEntity<>(HttpStatus.NOT_FOUND);
            }
            Map<String, Integer> response = new HashMap<>();
            response.put("viewCount", Integer.valueOf(listingService.getViewCount(internalId)));
            response.put("saveCount", Integer.valueOf(listingService.getSaveCount(internalId)));
            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // get all saved listings for current user
    @GetMapping("/user/saved-listings")
    public ResponseEntity<List<Listing>> getAllSavedListings(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = requireUser(authHeader);
        if (user == null) {
            return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        }
        try {
            List<Listing> savedListings = listingService.getAllSavedListings(user.getUserID());
            return new ResponseEntity<>(savedListings, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // post a listing under current user
    @PostMapping(
            value = "/listing",
            produces = "application/json", // response will be json
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE // request must be form data
    )
    public ResponseEntity<ListingCreated> addListing(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                                  @Valid @RequestPart("listing") Listing listing,
                                                  @RequestParam("images") List<String> fileNames,
                                                  @RequestPart(required = false) @Valid ListingParking parking,
                                                  @RequestParam(required = false) String parkingImageName) {
        User user = requireUser(authHeader);
        if (user == null) {
            ListingCreated errorResponse = new ListingCreated();
            errorResponse.setError("Unauthorized");
            return new ResponseEntity<>(errorResponse, HttpStatus.UNAUTHORIZED);
        }
        try {
            listing.setUserID(user.getUserID());
            ListingCreated result = listingService.addListing(listing, fileNames, parking, parkingImageName);
            return new ResponseEntity<>(result, HttpStatus.ACCEPTED);
        } catch (BadRequestException e) {
            ListingCreated errorResponse = new ListingCreated();
            errorResponse.setError(e.getMessage());
            return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
        } catch (Exception e) {
            ListingCreated errorResponse = new ListingCreated();
            errorResponse.setError("error adding listing");
            errorResponse.setPublicId(null);
            errorResponse.setPresignedUrls(null);
            return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // save a listing for current user (by public UUID)
    @PostMapping("/saved-listings/{listingId}")
    public ResponseEntity<Map<String, String>> saveListing(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("listingId") String listingId
    ) {
        User user = requireUser(authHeader);
        if (user == null) {
            return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        }
        try {
            // Resolve public UUID to internal ID
            Long internalListingId = listingService.getListingIdByPublicId(listingId);
            if (internalListingId == null) {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("error", "Listing not found");
                return new ResponseEntity<>(errorResponse, HttpStatus.NOT_FOUND);
            }
            listingService.saveListing(user.getUserID(), internalListingId);
            Map<String, String> response = new HashMap<>();
            response.put("message", "Listing saved successfully");
            return new ResponseEntity<>(response, HttpStatus.CREATED);
        } catch (BadRequestException e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", e.getMessage());
            return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", "An unexpected error occurred");
            return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // unsave a listing for current user (by public UUID)
    @DeleteMapping("/saved-listings/{listingId}")
    public ResponseEntity<Map<String, String>> unsaveListing(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable("listingId") String listingId
    ) {
        User user = requireUser(authHeader);
        if (user == null) {
            return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        }
        try {
            // Resolve public UUID to internal ID
            Long internalListingId = listingService.getListingIdByPublicId(listingId);
            if (internalListingId == null) {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("error", "Listing not found");
                return new ResponseEntity<>(errorResponse, HttpStatus.NOT_FOUND);
            }
            listingService.unsaveListing(user.getUserID(), internalListingId);
            Map<String, String> response = new HashMap<>();
            response.put("message", "Listing unsaved successfully");
            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", "An unexpected error occurred");
            return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // delete current user
    @DeleteMapping("/user")
    public ResponseEntity<String> deleteUser(@RequestHeader(value = "Authorization", required = false) String authHeader){
        User user = requireUser(authHeader);
        if (user == null) {
            return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        }
        try {
            userService.deleteUserById(user.getUserID());
            return new ResponseEntity<String>("User deleted!", HttpStatus.ACCEPTED);
        } catch (Exception e) {
            log.error("Error deleting user", e);
            return new ResponseEntity<String>("An unexpected error occurred", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    //delete a listing (by public UUID)
    @DeleteMapping("/listings/{listingId}")
    public ResponseEntity<String> deleteListing(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                               @PathVariable String listingId){
        User user = requireUser(authHeader);
        if (user == null) {
            return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        }
        try{
            // Security check: Verify the user owns this listing
            Listing existingListing = listingService.getListingByPublicId(listingId);
            if (existingListing == null) {
                return new ResponseEntity<>("Listing not found", HttpStatus.NOT_FOUND);
            }
            if (existingListing.getUserID() != user.getUserID().longValue()) {
                return new ResponseEntity<>("You can only delete your own listings", HttpStatus.FORBIDDEN);
            }

            listingService.deleteListing(existingListing.getListingID());
            return new ResponseEntity<String>("Listing deleted!", HttpStatus.ACCEPTED);
        } catch (Exception e) {
            return new ResponseEntity<String>("An unexpected error occurred", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // updating listings
    @PutMapping(
            value = "/listing",
            produces = "application/json", //json response
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE // form data request
    )
    public ResponseEntity<ListingCreated> updateListing(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                                     @Valid @RequestPart Listing listing,
                                                     @RequestPart(required = false) List<String> deleteFileNames,
                                                     @RequestPart(required = false) List<String> imageOrder,
                                                     @RequestPart(required = false) @Valid ListingParking parking,
                                                     @RequestParam(required = false) String parkingImageName,
                                                     @RequestParam(required = false) Boolean removeParkingImage) {
        User user = requireUser(authHeader);
        if (user == null) {
            return new ResponseEntity<>(new ListingCreated(), HttpStatus.UNAUTHORIZED);
        }
        try{
            ListingCreated result = listingService.updateListing(
                listing,
                user.getUserID(),
                deleteFileNames != null ? deleteFileNames : new ArrayList<>(),
                imageOrder != null ? imageOrder : new ArrayList<>(),
                parking,
                parkingImageName,
                removeParkingImage
            );
            return new ResponseEntity<>(result, HttpStatus.ACCEPTED);
        } catch (BadRequestException e) {
            ListingCreated errorResponse = new ListingCreated();
            errorResponse.setError(e.getMessage());
            return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
        } catch (Exception e) {
            return new ResponseEntity<>(new ListingCreated(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // MESSAGING ENDPOINTS

    // get user's conversations
    @GetMapping("/user/conversations")
    public ResponseEntity<List<Conversation>> getUserConversations(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = requireUser(authHeader);
        if (user == null) {
            return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        }
        try {
            List<Conversation> conversations = messageService.getUserConversations(user.getUserID());
            return new ResponseEntity<>(conversations, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // get messages in a conversation
    @GetMapping("/conversations/{conversationId}/messages")
    public ResponseEntity<List<Message>> getConversationMessages(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long conversationId) {
        User user = requireUser(authHeader);
        if (user == null) {
            return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        }
        try {
            List<Message> messages = messageService.getConversationMessages(conversationId, user.getUserID());
            return new ResponseEntity<>(messages, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // send a message (by public UUID)
    @PostMapping("/listings/{listingId}/message")
    public ResponseEntity<Message> sendMessage(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable String listingId,
            @RequestBody Map<String, String> messageData) {
        User user = requireUser(authHeader);
        if (user == null) {
            return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        }
        try {
            Message message = messageService.sendMessage(listingId, user.getUserID(), messageData.get("content"));
            return new ResponseEntity<>(message, HttpStatus.CREATED);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (Exception e) {
            log.error("Error sending message", e);
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // reply to a conversation
    @PostMapping("/conversations/{conversationId}/reply")
    public ResponseEntity<Message> replyToConversation(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long conversationId,
            @RequestBody Map<String, String> messageData) {
        User user = requireUser(authHeader);
        if (user == null) {
            return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        }
        try {
            Message message = messageService.replyToConversation(conversationId, user.getUserID(), messageData.get("content"));
            return new ResponseEntity<>(message, HttpStatus.CREATED);
        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        } catch (Exception e) {
            log.error("Error replying to conversation", e);
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // find or create conversation without sending message (by public UUID)
    @PostMapping("/listings/{listingId}/conversation")
    public ResponseEntity<Conversation> findOrCreateConversation(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable String listingId) {
        User user = requireUser(authHeader);
        if (user == null) {
            return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        }
        try {
            Conversation conversation = messageService.findOrCreateConversation(listingId, user.getUserID());
            return new ResponseEntity<>(conversation, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // delete conversation for current user only
    @DeleteMapping("/conversations/{conversationId}")
    public ResponseEntity<Map<String, String>> deleteConversation(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @PathVariable Long conversationId) {
        User user = requireUser(authHeader);
        if (user == null) {
            return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        }
        try {
            messageService.deleteConversationForUser(conversationId, user.getUserID());
            Map<String, String> response = new HashMap<>();
            response.put("message", "Conversation deleted successfully");
            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", "An unexpected error occurred");
            return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // submit a report for a listing
    @PostMapping("/report")
    public ResponseEntity<Map<String, String>> submitReport(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Report report) {
        User user = requireUser(authHeader);
        if (user == null) {
            return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        }
        try {
            listingService.submitReport(report, user);
            Map<String, String> response = new HashMap<>();
            response.put("message", "Report submitted successfully");
            return new ResponseEntity<>(response, HttpStatus.CREATED);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error submitting report");
            return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // Report a user (from messaging)
    @PostMapping("/users/{userId}/report")
    public ResponseEntity<Map<String, String>> reportUser(
            @PathVariable Long userId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Map<String, String> body) {
        User user = requireUser(authHeader);
        if (user == null) return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        try {
            String reason = body.getOrDefault("reason", "No reason provided");
            String details = body.getOrDefault("details", "");

            Report report = new Report();
            report.setUserId(user.getUserID());
            report.setReportedUserId(userId);
            report.setReason(reason);
            report.setReportMessage(details);
            userService.submitUserReport(report);
            
            Map<String, String> response = new HashMap<>();
            response.put("message", "Report submitted successfully");
            return new ResponseEntity<>(response, HttpStatus.CREATED);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error submitting report");
            return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // Block a user
    @PostMapping("/users/{userId}/block")
    public ResponseEntity<Map<String, String>> blockUser(
            @PathVariable Long userId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = requireUser(authHeader);
        if (user == null) return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        try {
            blockService.blockUser(user, userId);
            Map<String, String> response = new HashMap<>();
            response.put("message", "User blocked");
            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", e.getMessage());
            return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error blocking user");
            return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // Unblock a user
    @DeleteMapping("/users/{userId}/block")
    public ResponseEntity<Map<String, String>> unblockUser(
            @PathVariable Long userId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = requireUser(authHeader);
        if (user == null) return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        try {
            blockService.unblockUser(user, userId);
            Map<String, String> response = new HashMap<>();
            response.put("message", "User unblocked");
            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", e.getMessage());
            return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error unblocking user");
            return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // List users the current user has blocked
    @GetMapping("/user/blocked")
    public ResponseEntity<?> getBlockedUsers(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        User user = requireUser(authHeader);
        if (user == null) return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);
        try {
            return new ResponseEntity<>(blockService.getBlockedUsers(user), HttpStatus.OK);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error fetching blocked users");
            return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PatchMapping("/listings/{publicId}/status")
    public ResponseEntity<Map<String, String>> updateListingStatus(
            @PathVariable String publicId,
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        try {
            User user = requireUser(authHeader);
            if (user == null) return new ResponseEntity<>(HttpStatus.UNAUTHORIZED);

            String statusStr = body.get("status");
            if (statusStr == null) {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("error", "status is required");
                return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
            }

            Status newStatus;
            try {
                newStatus = Status.valueOf(statusStr.toUpperCase());
            } catch (IllegalArgumentException e) {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("error", "Invalid status value: " + statusStr);
                return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
            }

            // Security check: verify the listing exists and the user owns it
            Listing existingListing = listingService.getListingByPublicId(publicId);
            if (existingListing == null) {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("error", "Listing not found");
                return new ResponseEntity<>(errorResponse, HttpStatus.NOT_FOUND);
            }
            if (existingListing.getUserID() != user.getUserID().longValue()) {
                Map<String, String> errorResponse = new HashMap<>();
                errorResponse.put("error", "You can only update status on your own listings");
                return new ResponseEntity<>(errorResponse, HttpStatus.FORBIDDEN);
            }

            listingService.updateListingStatus(publicId, user.getUserID(), newStatus);
            Map<String, String> response = new HashMap<>();
            response.put("status", newStatus.name());
            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (BadRequestException e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", e.getMessage());
            return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
        } catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/email")
    public ResponseEntity<Map<String,String>> sendEmail(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody Email email){
        //need user to be signed in to send a report
        User user = requireUser(authHeader);
        if (user == null) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error sending email");
            return new ResponseEntity<>(errorResponse, HttpStatus.UNAUTHORIZED);
        }
        try{
            emailService.sendInquiryEmail(email);

            Map<String, String> response = new HashMap<>();
            response.put("message", "Email sent");
            return new ResponseEntity<>(response,HttpStatus.CREATED);
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", "Error sending email");
            return new ResponseEntity<>(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // get the next popup to show the caller (auth optional - anon users always get shown)
    @GetMapping("/popups/feedback")
    public ResponseEntity<PopupType> getFeedbackPopup(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        try{
                PopupType popup = popupService.getFeedbackPopup(authHeader);
                if (popup == null) {
                    return new ResponseEntity<>(HttpStatus.NO_CONTENT);
                }
                return new ResponseEntity<>(popup, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
        

    }

    // record a user's reaction to a popup (auth optional - anon interactions stored with NULL UserID)
    @PostMapping("/popups/{popupId}/interactions")
    public ResponseEntity<Void> recordPopupInteraction(
            @PathVariable int popupId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody @Valid PopupInteractionRequest request) {
        popupService.recordInteraction(popupId, request, authHeader);
        return new ResponseEntity<>(HttpStatus.CREATED);
    }

    // public unsubscribe link clicked from a promotional email - no auth, but token-gated so only
    // the holder of a given email's link can unsubscribe it
    @GetMapping(value = "/unsubscribe", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> unsubscribe(
            @RequestParam String email,
            @RequestParam String token) {
        String decodedEmail;
        try {
            decodedEmail = new String(Base64.getUrlDecoder().decode(email), java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            return new ResponseEntity<>("<p>Invalid unsubscribe link.</p>", HttpStatus.BAD_REQUEST);
        }

        if (!unsubscribeService.isValidToken(decodedEmail, token)) {
            return new ResponseEntity<>("<p>Invalid unsubscribe link.</p>", HttpStatus.BAD_REQUEST);
        }

        emailOptOutMapper.insertOptOut(decodedEmail);
        String html = "<div style=\"font-family:sans-serif;max-width:480px;margin:60px auto;padding:24px;color:#111;text-align:center;\">" +
                "<p style=\"font-size:17px;font-weight:700;color:#c5050c;\">MadLease</p>" +
                "<p>You've been unsubscribed from MadLease promotional emails. You'll still receive account and listing-related emails.</p>" +
                "</div>";
        return new ResponseEntity<>(html, HttpStatus.OK);
    }

}
