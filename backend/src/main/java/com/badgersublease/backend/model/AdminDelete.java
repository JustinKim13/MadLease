package com.badgersublease.backend.model;

import lombok.Data;

import java.util.List;

@Data
public class AdminDelete {
    private List<Long> ids;

    private String password;
}
