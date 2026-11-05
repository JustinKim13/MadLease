package com.badgersublease.backend.service;

import com.badgersublease.backend.config.RateLimitConfig;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service that manages rate limit buckets for each user/IP.
 *
 * Uses ConcurrentHashMap for thread-safety since multiple requests
 * can arrive simultaneously and access the same bucket.
 */
@Service
public class RateLimitService {

    private final RateLimitConfig config;

    // Map of identifier (Firebase UID or IP) -> their token bucket
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public RateLimitService(RateLimitConfig config) {
        this.config = config;
    }

    /**
     * Gets existing bucket for the key, or creates a new one if none exists.
     *
     * computeIfAbsent is atomic - ensures we don't accidentally create
     * multiple buckets for the same key under concurrent access.
     */
    public Bucket resolveBucket(String key) {
        return buckets.computeIfAbsent(key, this::createNewBucket);
    }

    /**
     * Attempts to consume one token from the bucket.
     *
     * Returns a ConsumptionProbe containing:
     * - isConsumed(): whether the request is allowed
     * - getRemainingTokens(): tokens left after this request
     * - getNanosToWaitForRefill(): how long until bucket refills (if rejected)
     */
    public ConsumptionProbe tryConsume(String key) {
        Bucket bucket = resolveBucket(key);
        return bucket.tryConsumeAndReturnRemaining(1);
    }

    /**
     * Creates a new bucket with the configured limits.
     *
     * Bandwidth.builder() creates a bucket where:
     * - capacity: max tokens the bucket can hold
     * - refillGreedy(): tokens are added as soon as possible
     *   (vs refillIntervally() which waits for full period)
     */
    private Bucket createNewBucket(String key) {
        Bandwidth limit = Bandwidth.builder()
                .capacity(config.getCapacity())
                .refillGreedy(config.getRefillTokens(), Duration.ofMinutes(config.getRefillPeriodMinutes()))
                .build();

        return Bucket.builder()
                .addLimit(limit)
                .build();
    }

    /**
     * Returns the current number of available tokens for a key.
     * Useful for debugging or monitoring.
     */
    public long getAvailableTokens(String key) {
        return resolveBucket(key).getAvailableTokens();
    }
}
