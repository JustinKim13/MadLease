package com.badgersublease.backend.model;

import lombok.Data;

@Data
public class Email {
    private String name;
    private String email;
    private String inquiryType;
    private String message;

    // Unread message notification fields
    private String senderName;
    private String listingTitle;
    private String conversationUrl;
    private int messageCount;

    // Listing lifecycle email fields
    private String listingUrl;
    private String expiryDate;

    // Campaign email fields
    private String unsubscribeUrl;
}
