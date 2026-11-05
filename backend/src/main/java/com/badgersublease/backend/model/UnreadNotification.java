package com.badgersublease.backend.model;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class UnreadNotification {
    private String content;   // latest message content (encrypted)
    private Long senderID;
    private LocalDateTime sentAt;
    private Long conversationID;
    private Long requesterID;
    private Long listerID;
    private String listingTitle;
    private String listingPublicId;
    private int messageCount;
}
