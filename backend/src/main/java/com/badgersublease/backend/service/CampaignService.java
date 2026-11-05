package com.badgersublease.backend.service;

import com.badgersublease.backend.mapper.CampaignSendMapper;
import com.badgersublease.backend.mapper.EmailOptOutMapper;
import com.badgersublease.backend.model.Email;
import com.google.firebase.auth.ExportedUserRecord;
import com.google.firebase.auth.FirebaseAuth;
import com.resend.services.emails.model.CreateEmailOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// One-off, manually-triggered promotional email campaigns (not scheduled, unlike the lifecycle emails).
@Service
public class CampaignService {

    private static final Logger log = LoggerFactory.getLogger(CampaignService.class);
    private static final int DORMANT_MONTHS = 12;
    private static final int BATCH_SIZE = 100; // Resend's batch send limit per call
    private static final String SUBLEASE_REMINDER_KEY = "sublease-reminder";

    private final EmailService emailService;
    private final UnsubscribeService unsubscribeService;
    private final EmailOptOutMapper emailOptOutMapper;
    private final CampaignSendMapper campaignSendMapper;
    private final SlackService slackService;

    public CampaignService(EmailService emailService, UnsubscribeService unsubscribeService,
                            EmailOptOutMapper emailOptOutMapper, CampaignSendMapper campaignSendMapper,
                            SlackService slackService) {
        this.emailService = emailService;
        this.unsubscribeService = unsubscribeService;
        this.emailOptOutMapper = emailOptOutMapper;
        this.campaignSendMapper = campaignSendMapper;
        this.slackService = slackService;
    }

    public Map<String, Object> sendSubleaseReminderCampaign() throws Exception {
        if (campaignSendMapper.tryClaim(SUBLEASE_REMINDER_KEY) == 0) {
            throw new IllegalStateException("This campaign was already triggered in the last hour. Wait before resending.");
        }

        long dormantCutoffMs = Instant.now().minus(DORMANT_MONTHS * 30L, ChronoUnit.DAYS).toEpochMilli();

        int sent = 0, skippedOptedOut = 0, skippedDormant = 0, skippedNoEmail = 0;
        List<CreateEmailOptions> batch = new ArrayList<>();

        for (ExportedUserRecord user : FirebaseAuth.getInstance().listUsers(null).iterateAll()) {
            String email = user.getEmail();
            if (email == null || email.isBlank()) {
                skippedNoEmail++;
                continue;
            }
            if (user.getUserMetadata().getLastSignInTimestamp() < dormantCutoffMs) {
                skippedDormant++;
                continue;
            }
            if (emailOptOutMapper.isOptedOut(email)) {
                skippedOptedOut++;
                continue;
            }

            Email campaignEmail = new Email();
            campaignEmail.setEmail(email);
            campaignEmail.setName(user.getDisplayName());
            campaignEmail.setUnsubscribeUrl(unsubscribeService.buildUnsubscribeUrl(email));
            batch.add(emailService.buildSubleaseReminderCampaignOptions(campaignEmail));
            sent++;

            if (batch.size() == BATCH_SIZE) {
                emailService.sendCampaignBatch(batch);
                batch = new ArrayList<>();
            }
        }

        if (!batch.isEmpty()) {
            emailService.sendCampaignBatch(batch);
        }

        log.info("Sublease reminder campaign: sent={} skippedOptedOut={} skippedDormant={} skippedNoEmail={}",
                sent, skippedOptedOut, skippedDormant, skippedNoEmail);
        slackService.notifyCampaignSent("Leaving Madison in December?", sent, skippedOptedOut, skippedDormant, skippedNoEmail);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sent", sent);
        result.put("skippedOptedOut", skippedOptedOut);
        result.put("skippedDormant", skippedDormant);
        result.put("skippedNoEmail", skippedNoEmail);
        return result;
    }
}
