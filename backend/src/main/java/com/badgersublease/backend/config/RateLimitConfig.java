package com.badgersublease.backend.config;

import org.springframework.context.annotation.Configuration;

/**
 * Configuration for API rate limiting.
 *
 * Uses the token bucket algorithm:
 * - Each user/IP gets a bucket with 'capacity' tokens
 * - Tokens refill at 'refillTokens' per 'refillPeriodMinutes'
 * - Each request consumes 1 token
 * - When bucket is empty, requests are rejected with 429
 */
@Configuration
public class RateLimitConfig {

    // Maximum tokens in bucket (allows bursting up to this amount)
    // 50 allows quick page loads (each page might make 3-5 API calls)
    private int capacity = 50;

    // Number of tokens added each refill period
    // 30/min = 0.5/sec sustained rate - plenty for normal browsing
    private int refillTokens = 30;

    // How often tokens refill (in minutes)
    private int refillPeriodMinutes = 1;

    public int getCapacity() {
        return capacity;
    }

    public void setCapacity(int capacity) {
        this.capacity = capacity;
    }

    public int getRefillTokens() {
        return refillTokens;
    }

    public void setRefillTokens(int refillTokens) {
        this.refillTokens = refillTokens;
    }

    public int getRefillPeriodMinutes() {
        return refillPeriodMinutes;
    }

    public void setRefillPeriodMinutes(int refillPeriodMinutes) {
        this.refillPeriodMinutes = refillPeriodMinutes;
    }
}
