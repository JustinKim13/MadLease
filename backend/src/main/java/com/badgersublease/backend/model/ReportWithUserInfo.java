package com.badgersublease.backend.model;

import lombok.Data;
import lombok.EqualsAndHashCode;

import org.springframework.beans.BeanUtils;

@Data
@EqualsAndHashCode(callSuper = true)
public class ReportWithUserInfo  extends Report{

    private String reporterName;
    private String reporterEmail;
    private String reporterProfilePictureUrl;
    private boolean reporterIsVerified;

    private String reportedUserName;
    private String reportedUserEmail;

    public ReportWithUserInfo(Report report) {
        BeanUtils.copyProperties(report, this);
    }
}
