package com.badgersublease.backend.model;

import lombok.Data;

@Data
public class Report {
    private Long reportId;
    private String firebaseId;
    private String listingId;
    private String reason;
    private String reportMessage;

    private Long userId;
    private Long internalListingId;
    private Long reportedUserId;
}
