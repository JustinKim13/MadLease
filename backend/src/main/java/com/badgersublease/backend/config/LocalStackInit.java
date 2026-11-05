package com.badgersublease.backend.config;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.util.List;

@Component
@Profile("local")
public class LocalStackInit {

    private final S3Client s3Client;

    @Value("${aws.s3.bucket}")
    private String bucketName;

    public LocalStackInit(S3Client s3Client) {
        this.s3Client = s3Client;
    }

    @PostConstruct
    public void init() {
        ensureBucketExists();
        configureBucketCors();
    }

    private void ensureBucketExists() {
        try {
            s3Client.headBucket(r -> r.bucket(bucketName));
        } catch (NoSuchBucketException e) {
            s3Client.createBucket(r -> r.bucket(bucketName));
        }
    }

    private void configureBucketCors() {
        CORSRule rule = CORSRule.builder()
                .allowedOrigins("*")
                .allowedMethods("PUT", "GET", "HEAD", "POST", "DELETE")
                .allowedHeaders("*")
                .exposeHeaders("ETag")
                .maxAgeSeconds(3600)
                .build();

        s3Client.putBucketCors(r -> r
                .bucket(bucketName)
                .corsConfiguration(CORSConfiguration.builder().corsRules(List.of(rule)).build())
        );
    }
}
