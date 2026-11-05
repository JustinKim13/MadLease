package com.badgersublease.backend.model;

import java.util.List;
import lombok.Data;

@Data
public class ListingCreated {
    private String publicId;
    private List<String> presignedUrls;

    private String error;
    private String parkingImagePresignedUrl;

}
