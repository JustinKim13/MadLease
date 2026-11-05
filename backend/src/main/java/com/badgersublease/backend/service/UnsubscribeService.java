package com.badgersublease.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;

// Signs/verifies unsubscribe links so a link only works for the email it was issued to.
@Service
public class UnsubscribeService {

    @Value("${madlease.unsubscribe.secret}")
    private String secret;

    public String generateToken(String email) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(email.toLowerCase().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate unsubscribe token", e);
        }
    }

    public boolean isValidToken(String email, String token) {
        if (email == null || token == null) return false;
        String expected = generateToken(email);
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                token.getBytes(StandardCharsets.UTF_8)
        );
    }

    public String buildUnsubscribeUrl(String email) {
        String encodedEmail = Base64.getUrlEncoder().withoutPadding().encodeToString(email.getBytes(StandardCharsets.UTF_8));
        return "https://madlease-backend-87f26c5ebdc0.herokuapp.com/api/unsubscribe?email=" + encodedEmail + "&token=" + generateToken(email);
    }
}
