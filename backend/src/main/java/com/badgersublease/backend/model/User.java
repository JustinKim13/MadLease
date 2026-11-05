package com.badgersublease.backend.model;


import lombok.Data;
import java.util.Date;

@Data
public class User {
    private Long userID;
    private String firebaseUid;
    private boolean isVerified;
}

