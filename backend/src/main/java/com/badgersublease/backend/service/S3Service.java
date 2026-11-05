package com.badgersublease.backend.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.util.UriUtils;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.nio.charset.StandardCharsets;

@Service
public class S3Service {

    private final S3Client s3;
    private final S3Presigner s3Presigner;
    @Value("${aws.s3.bucket}")
    private String bucketName;

    @Value("${aws.cloudfront.domain}")
    private String cloudFrontUrl;

    @Autowired
    public S3Service(S3Client s3, S3Presigner s3Presigner) {
        this.s3 = s3;
        this.s3Presigner = s3Presigner;
    }

    public String generatePresignedUrlPut(String filePath){
        String contentType = getContentTypeFromFileName(filePath);

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(filePath)
                .contentType(contentType)
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(30))
                .putObjectRequest(putObjectRequest)
                .build();

        PresignedPutObjectRequest presignedPutObjectRequest = s3Presigner.presignPutObject(presignRequest);

        return presignedPutObjectRequest.url().toString();
    }

    public String getImageUrl(String fileName) {
        String encodedPath = UriUtils.encodePath(fileName, StandardCharsets.UTF_8)
                .replace("+", "%2B");
        return String.format("%s/%s", cloudFrontUrl, encodedPath);
    }

    private String getContentTypeFromFileName(String fileName) {
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return "image/jpeg";
        } else if (lower.endsWith(".png")) {
            return "image/png";
        } else if (lower.endsWith(".gif")) {
            return "image/gif";
        } else if (lower.endsWith(".webp")) {
            return "image/webp";
        } else if (lower.endsWith(".bmp")) {
            return "image/bmp";
        } else if (lower.endsWith(".svg")) {
            return "image/svg+xml";
        } else if (lower.endsWith(".heic") || lower.endsWith(".heif")) {
            return "image/heic";
        } else if (lower.endsWith(".avif")) {
            return "image/avif";
        } else if (lower.endsWith(".tiff") || lower.endsWith(".tif")) {
            return "image/tiff";
        }
        // Default fallback for unknown extensions
        return "image/jpeg";
    }


    public String generatePresignedUrlGet(String filePath){
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(filePath)
                .build();
        //essentially like metadata of our request
        GetObjectPresignRequest getObjectPresignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(60))
                .getObjectRequest(getObjectRequest)
                .build();
        //our actual presigned request
        PresignedGetObjectRequest presignedGetObjectRequest = s3Presigner.presignGetObject(getObjectPresignRequest);
        return presignedGetObjectRequest.url().toString();
    }

    public void  deleteFile(String filePath){
        DeleteObjectRequest deleteObjectRequest =  DeleteObjectRequest.builder()
                .bucket(bucketName)
                .key(filePath)
                .build();
        s3.deleteObject(deleteObjectRequest);
    }

}
