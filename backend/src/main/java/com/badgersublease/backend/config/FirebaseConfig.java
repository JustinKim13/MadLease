package com.badgersublease.backend.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;

import javax.annotation.PostConstruct;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Base64;

@Configuration
public class FirebaseConfig {

    @Value("${firebase.service-account.base64}")
    private String firebaseServiceAccountBase64;

    @PostConstruct
    public void initialize() {
        try {
            if (FirebaseApp.getApps().isEmpty()) {
                GoogleCredentials credentials;
                
                if (firebaseServiceAccountBase64.equals("local")) {
                    // if local, create credentials from the firebase-service-account.json file
                    credentials = GoogleCredentials.fromStream(
                            new ClassPathResource("firebase-service-account.json").getInputStream());
                } else { // if not local, decode the base64 string
                    byte[] decodedBytes = Base64.getDecoder().decode(firebaseServiceAccountBase64);
                    InputStream inputStream = new ByteArrayInputStream(decodedBytes);
                    credentials = GoogleCredentials.fromStream(inputStream);
                }
                
                // create options for the Firebase app
                FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(credentials)
                    .build();
                
                // initialize the Firebase app with the options
                FirebaseApp.initializeApp(options);
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to initialize Firebase", e);
        }
    }
} 