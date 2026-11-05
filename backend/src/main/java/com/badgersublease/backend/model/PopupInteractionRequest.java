package com.badgersublease.backend.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PopupInteractionRequest {
    @NotBlank(message = "interactionType is required")
    private String interactionType;

    @Valid
    private Feedback feedback;
}
