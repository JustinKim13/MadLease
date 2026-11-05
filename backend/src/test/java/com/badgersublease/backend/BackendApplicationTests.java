package com.badgersublease.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import software.amazon.awssdk.services.s3.S3Client;

@SpringBootTest
class BackendApplicationTests {

    // The "local" profile wires up a LocalStackInit bean whose @PostConstruct
    // makes a real network call (headBucket/putBucketCors) against a LocalStack
    // S3 endpoint. That endpoint isn't running in the test environment, so the
    // real S3Client bean is replaced with a mock here purely to let the Spring
    // context load without reaching out to AWS/LocalStack over the network.
    @MockitoBean
    private S3Client s3Client;

    @Test
    void contextLoads() {
    }

}
