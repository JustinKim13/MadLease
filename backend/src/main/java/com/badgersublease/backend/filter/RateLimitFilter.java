package com.badgersublease.backend.filter;

import com.badgersublease.backend.service.RateLimitService;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import org.springframework.beans.factory.annotation.Value;

import java.io.IOException;
import java.util.Base64;

/**
 * Filter that enforces rate limiting on all API requests.
 *
 * Runs before any controller code executes. This means:
 * - Rejected requests don't waste resources on business logic
 * - Every request (allowed or not) gets rate limit headers
 *
 * Identification strategy:
 * 1. Try to extract Firebase UID from JWT in Authorization header (without full verification)
 * 2. Fall back to client IP address if no valid token
 *
 * Why not verify the token fully?
 * - Full verification adds latency to every request
 * - For rate limiting, the worst case is someone spoofs a UID and gets their own bucket
 * - They still get rate limited, just under a fake identity
 * - The actual controller endpoints still do full Firebase verification
 */
@Component
@Order(1) // Run early in the filter chain (before any controller code executes)
public class RateLimitFilter extends OncePerRequestFilter {

    private final RateLimitService rateLimitService;

    @Value("${cors.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;

    public RateLimitFilter(RateLimitService rateLimitService) {
        this.rateLimitService = rateLimitService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        // Determine the rate limit key (Firebase UID or IP)
        String key = resolveKey(request);

        // Try to consume a token
        ConsumptionProbe probe = rateLimitService.tryConsume(key);

        // Always add remaining tokens header (useful for clients to self-throttle)
        response.addHeader("X-Rate-Limit-Remaining", String.valueOf(probe.getRemainingTokens()));

        if (probe.isConsumed()) {
            // Request allowed - continue to controller
            filterChain.doFilter(request, response);
        } else {
            // Request rejected - bucket is empty
            long waitTimeSeconds = probe.getNanosToWaitForRefill() / 1_000_000_000;

            // Add CORS headers for 429 responses (since we're bypassing the normal filter chain)
            String origin = request.getHeader("Origin");
            if (origin != null && isAllowedOrigin(origin)) {
                response.addHeader("Access-Control-Allow-Origin", origin);
                response.addHeader("Access-Control-Allow-Credentials", "true");
            }

            response.setStatus(429); // Too Many Requests
            response.addHeader("Retry-After", String.valueOf(waitTimeSeconds));
            response.setContentType("application/json");
            response.getWriter().write("{\"error\": \"Rate limit exceeded. Try again in " + waitTimeSeconds + " seconds.\"}");
        }
    }

    /**
     * Determines the identifier for rate limiting.
     *
     * Priority:
     * 1. Firebase UID from JWT (if Authorization header present and valid format)
     * 2. Client IP address (fallback)
     */
    private String resolveKey(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String uid = extractUidFromJwt(authHeader.substring(7));
            if (uid != null) {
                return "uid:" + uid; // Prefix to distinguish from IPs
            }
        }

        // Fall back to IP address
        return "ip:" + getClientIp(request);
    }

    /**
     * Extracts the Firebase UID from a JWT without full verification.
     *
     * JWT structure: header.payload.signature (base64 encoded, dot-separated)
     * The payload contains a "sub" (subject) claim which is the Firebase UID.
     *
     * We decode the payload and extract "sub" without verifying the signature.
     * This is safe for rate limiting purposes - see class javadoc.
     */
    private String extractUidFromJwt(String token) {
        try {
            // JWT has 3 parts separated by dots
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                return null;
            }

            // Decode the payload (middle part)
            // Firebase uses URL-safe base64, so we need the URL decoder
            String payload = new String(Base64.getUrlDecoder().decode(parts[1]));

            // Simple extraction of "sub" claim (the Firebase UID)
            // Format: ..."sub":"<uid>"...
            // We avoid pulling in a JSON library just for this
            int subIndex = payload.indexOf("\"sub\"");
            if (subIndex == -1) {
                // Try "user_id" as fallback (some Firebase tokens use this)
                subIndex = payload.indexOf("\"user_id\"");
                if (subIndex == -1) {
                    return null;
                }
            }

            // Find the value after "sub": or "user_id":
            int colonIndex = payload.indexOf(":", subIndex);
            int startQuote = payload.indexOf("\"", colonIndex + 1);
            int endQuote = payload.indexOf("\"", startQuote + 1);

            if (startQuote == -1 || endQuote == -1) {
                return null;
            }

            return payload.substring(startQuote + 1, endQuote);

        } catch (Exception e) {
            // Any parsing error - fall back to IP
            return null;
        }
    }

    /**
     * Checks if the origin is in the allowed origins list.
     */
    private boolean isAllowedOrigin(String origin) {
        for (String allowed : allowedOrigins.split(",")) {
            if (allowed.trim().equals(origin)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Gets the real client IP address.
     *
     * On Heroku (and behind most reverse proxies/load balancers),
     * the direct connection comes from the proxy, not the client.
     * The real client IP is in the X-Forwarded-For header.
     *
     * X-Forwarded-For format: client, proxy1, proxy2, ...
     * We want the first value (the original client).
     */
    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");

        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            // Take the first IP (original client) and trim whitespace
            return xForwardedFor.split(",")[0].trim();
        }

        // Fallback for direct connections (local dev)
        return request.getRemoteAddr();
    }
}
