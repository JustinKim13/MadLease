package com.badgersublease.backend.model;

import lombok.Data;
import jakarta.validation.constraints.*;

@Data
public class ListingParking {
    private long parkingId;
    private long listingId;

    @NotBlank(message = "Parking type is required")
    private String parkingType; // COVERED_GARAGE | SURFACE_LOT | STREET | DRIVEWAY

    @NotNull(message = "Spots is required")
    @Min(value = 1, message = "Spots must be at least 1")
    private Integer spots;

    @NotNull(message = "Price is required")
    @Min(value = 0, message = "Price cannot be negative")
    private Integer price;

    @Size(max = 500, message = "Notes cannot exceed 500 characters")
    private String notes;

    private String imageKey;  // S3 key — stored in DB
    private String imageUrl;  // computed in service — NOT stored
}
