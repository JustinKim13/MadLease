package com.badgersublease.backend.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.beans.BeanUtils;

import java.util.Date;

@Data
@EqualsAndHashCode(callSuper = true)
public class ListingDetails extends Listing {

    @JsonProperty("isOwner")
    private boolean isOwner;

    private String name;
    private String email;
    private String profilePictureUrl;

    @JsonProperty("isVerified")
    private boolean isVerified;

    private Date userCreatedAt;

    public ListingDetails(Listing listing, boolean isOwner) {
        BeanUtils.copyProperties(listing, this);
        this.isOwner = isOwner;
        this.name = "Unknown User";
        this.email = "No email provided";
        this.isVerified = false;
        this.userCreatedAt = new Date();
    }

    public void setPosterInfo(String name, String email, String profilePictureUrl, boolean isVerified, Date userCreatedAt) {
        this.name = name != null ? name : "Unknown User";
        this.email = email != null ? email : "No email provided";
        this.profilePictureUrl = profilePictureUrl;
        this.isVerified = isVerified;
        this.userCreatedAt = userCreatedAt != null ? userCreatedAt : new Date();
    }
}
