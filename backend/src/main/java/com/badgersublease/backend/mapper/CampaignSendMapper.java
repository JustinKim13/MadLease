package com.badgersublease.backend.mapper;

import org.apache.ibatis.annotations.*;

@Mapper
public interface CampaignSendMapper {

    // Claims the right to send this campaign right now. Returns 0 (no rows affected) if the
    // campaign was already claimed within the last hour, 1 otherwise.
    @Insert("INSERT INTO CampaignSends (CampaignKey, LastSentAt) VALUES (#{campaignKey}, NOW()) " +
            "ON CONFLICT (CampaignKey) DO UPDATE SET LastSentAt = EXCLUDED.LastSentAt " +
            "WHERE CampaignSends.LastSentAt < NOW() - INTERVAL '1 hour'")
    int tryClaim(@Param("campaignKey") String campaignKey);
}
