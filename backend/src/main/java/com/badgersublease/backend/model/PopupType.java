package com.badgersublease.backend.model;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class PopupType {
    private Integer popupId;
    private String popupPurpose;
    private LocalDateTime createdAt;
}
