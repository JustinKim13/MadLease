package com.badgersublease.backend.model;

import lombok.Data;
import java.time.LocalDateTime;

@Data // lombok annotation to generate getters, setters, equals, hashCode, and toString
public class Conversation {
    private Long conversationID;
    private Long listingID;
    private Long requesterID;
    private Long listerID;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // Additional fields for joined data
    private String listingTitle;
    private String listingPublicId;
    private String requesterName;
    private String requesterProfilePictureUrl;
    private String listerName;
    private String listerProfilePictureUrl;
    private String lastMessageContent;
    private LocalDateTime lastMessageTime;
    private int unreadCount;
} 