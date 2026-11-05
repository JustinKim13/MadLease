package com.badgersublease.backend.service;

import com.badgersublease.backend.exceptions.BadRequestException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for file validation in ListingService
 */
class ListingServiceFileValidationTest {

    /**
     * Helper to invoke the private validateFileName method via reflection
     */
    private void invokeValidateFileName(String fileName) throws Exception {
        ListingService service = new ListingService(null, null, null, null, null, null, null);
        Method method = ListingService.class.getDeclaredMethod("validateFileName", String.class);
        method.setAccessible(true);
        try {
            method.invoke(service, fileName);
        } catch (java.lang.reflect.InvocationTargetException e) {
            if (e.getCause() instanceof BadRequestException) {
                throw (BadRequestException) e.getCause();
            }
            throw e;
        }
    }

    // ===== VALID FILE NAMES =====

    @ParameterizedTest
    @ValueSource(strings = {
        "photo.jpg",
        "photo.jpeg",
        "image.png",
        "animation.gif",
        "modern.webp",
        "bitmap.bmp",
        "iphone.heic",
        "iphone.heif",
        "new-format.avif",
        "UPPERCASE.JPG",
        "MixedCase.PNG",
        "photo with spaces.jpg",
        "photo-with-dashes.png",
        "photo_with_underscores.jpeg"
    })
    void shouldAcceptValidImageFiles(String fileName) throws Exception {
        assertDoesNotThrow(() -> invokeValidateFileName(fileName));
    }

    // ===== INVALID FILE EXTENSIONS =====

    @ParameterizedTest
    @ValueSource(strings = {
        "malicious.exe",
        "script.js",
        "document.pdf",
        "archive.zip",
        "code.java",
        "shell.sh",
        "noextension",
        "fake.jpg.exe",
        "image.txt"
    })
    void shouldRejectInvalidFileExtensions(String fileName) throws Exception {
        BadRequestException exception = assertThrows(BadRequestException.class,
            () -> invokeValidateFileName(fileName));
        assertTrue(exception.getMessage().contains("Invalid file type"));
    }

    // ===== PATH TRAVERSAL ATTACKS =====

    @ParameterizedTest
    @ValueSource(strings = {
        "../etc/passwd",
        "..\\windows\\system32",
        "images/../../../etc/passwd",
        "/etc/passwd",
        "\\windows\\system32",
        "valid.jpg/../malicious.exe"
    })
    void shouldRejectPathTraversalAttempts(String fileName) throws Exception {
        BadRequestException exception = assertThrows(BadRequestException.class,
            () -> invokeValidateFileName(fileName));
        assertTrue(exception.getMessage().contains("path traversal") ||
                   exception.getMessage().contains("Invalid file"));
    }

    // ===== NULL BYTE INJECTION =====

    @Test
    void shouldRejectNullByteInjection() throws Exception {
        BadRequestException exception = assertThrows(BadRequestException.class,
            () -> invokeValidateFileName("image.jpg\0.exe"));
        assertTrue(exception.getMessage().contains("illegal characters"));
    }

    // ===== EMPTY/NULL FILE NAMES =====

    @Test
    void shouldRejectNullFileName() throws Exception {
        BadRequestException exception = assertThrows(BadRequestException.class,
            () -> invokeValidateFileName(null));
        assertTrue(exception.getMessage().contains("cannot be empty"));
    }

    @Test
    void shouldRejectEmptyFileName() throws Exception {
        BadRequestException exception = assertThrows(BadRequestException.class,
            () -> invokeValidateFileName(""));
        assertTrue(exception.getMessage().contains("cannot be empty"));
    }

    @Test
    void shouldRejectBlankFileName() throws Exception {
        BadRequestException exception = assertThrows(BadRequestException.class,
            () -> invokeValidateFileName("   "));
        assertTrue(exception.getMessage().contains("cannot be empty"));
    }
}
