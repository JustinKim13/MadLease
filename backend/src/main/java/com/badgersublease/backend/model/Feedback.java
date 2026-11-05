package com.badgersublease.backend.model;

import jakarta.validation.constraints.Size;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class Feedback {
    private Long feedbackId;
    private Long userId;
    private String feedbackType;
    @Size(max = 2000, message = "Feedback message must be under 2000 characters")
    private String feedbackMessage;
    private LocalDateTime createdAt;
}
