package com.badgersublease.backend.model;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class PopupInteraction {
    private Long popupInteractionsId;
    private Long userId;
    private Integer popupId;
    private String interactionType;
    private LocalDateTime createdAt;
}
