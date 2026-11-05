package com.badgersublease.backend.model;

import com.badgersublease.backend.types.ListingType;
import com.badgersublease.backend.types.Status;
import lombok.Data;

import jakarta.validation.constraints.*;
import java.util.Date;
import java.util.List;

@Data
public class Listing {
    private Long listingID;
    private String publicId;

    @NotBlank(message = "Title is required")
    @Size(min = 5, max = 50, message = "Title must be 5-50 characters")
    private String title;

    @NotBlank(message = "Description is required")
    @Size(min = 20, max = 750, message = "Description must be 20-750 characters")
    private String description;

    private boolean boosted;

    @NotBlank(message = "Street is required")
    @Size(max = 255, message = "Street must be under 255 characters")
    private String street;

    @NotBlank(message = "State is required")
    @Size(max = 100, message = "State must be under 100 characters")
    private String state;

    private int zipcode;

    @NotBlank(message = "City is required")
    @Size(max = 100, message = "City must be under 100 characters")
    private String city;

    private Integer rent;

    private long userID;
    private int aptnumber;
    private Status status;

    @NotNull(message = "Listing type is required")
    private ListingType listingType;

    private Date createdAt;

    @NotNull(message = "Start date is required")
    private Date startDate;

    @NotNull(message = "End date is required")
    private Date endDate;

    // Boxed (not primitive) so a missing value fails validation in
    // ListingService.validateListingShape instead of silently defaulting to 0.0f
    // and skewing the distance-based trending/relevance score. See docs/KNOWN_ISSUES.md.
    private Float lat;
    private Float lon;
    private List<String> amenities;
    private List<String> listingImageFileNames;

    private Integer bedrooms;

    private Integer bathrooms;

    private Integer squareFeet;

    @Min(value = 0, message = "Roommates cannot be negative")
    private int roommates;

    // system-set, not user input — no validation needed
    private int viewCount;

    // Meant for returns to frontend, gives the presigned URLs
    private List<String> preSignedGetUrls;
    
    private ListingParking parking; // null if no parking included

    private Double score;
}
