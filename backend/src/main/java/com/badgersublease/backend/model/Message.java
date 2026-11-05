package com.badgersublease.backend.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class Message {
    private Long messageID;
    private Long conversationID;
    private Long senderID;
    @NotBlank(message = "Message cannot be empty")
    @Size(max = 5000, message = "Message must be under 5000 characters")
    private String content;
    private LocalDateTime sentAt;
    private boolean isRead;
    
    // Additional fields for joined data
    private String senderName;
    private String senderProfilePictureUrl;
} 