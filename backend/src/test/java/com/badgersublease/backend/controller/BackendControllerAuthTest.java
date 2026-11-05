package com.badgersublease.backend.controller;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for BackendController's canonical auth-check helper (requireUser).
 *
 * Before this fix, roughly half of BackendController's endpoints called
 * userService.getOrCreateUserFromToken(authHeader.substring(7)) directly, with no
 * null-check on authHeader first. A missing/malformed Authorization header would throw
 * (NPE on .substring(7), or a Spring MissingRequestHeaderException intercepted by
 * GlobalExceptionHandler's catch-all) and fall through to a bare 500, instead of a clean
 * 401. These tests exercise the auth path only -- no real DB or Firebase token
 * verification is involved, since a missing/malformed header short-circuits before any
 * service call is made.
 */
class BackendControllerAuthTest {

    /**
     * All service dependencies are null: the auth-check path never reaches them when the
     * header is missing or malformed, since requireUser() short-circuits first (same
     * pattern as ListingServiceFileValidationTest's reflection-based private-method tests).
     */
    private BackendController newController() {
        return new BackendController(null, null, null, null, null, null, null, null, null);
    }

    private Object invokeRequireUser(String authHeader) throws Exception {
        BackendController controller = newController();
        Method method = BackendController.class.getDeclaredMethod("requireUser", String.class);
        method.setAccessible(true);
        return method.invoke(controller, authHeader);
    }

    // ===== requireUser() helper: missing/malformed header never throws, always returns null =====

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {
        "",
        "not-a-bearer-token",
        "Basic dXNlcjpwYXNz",
        "Bearer" // missing the required trailing space before the token
    })
    void requireUserReturnsNullForMissingOrMalformedHeader(String authHeader) throws Exception {
        assertNull(invokeRequireUser(authHeader));
    }

    @Test
    void requireUserReturnsNullWhenTokenVerificationThrows() throws Exception {
        // "Bearer " passes the prefix check, so requireUser proceeds to call
        // userService.getOrCreateUserFromToken(...) -- but userService is null here, so
        // that call throws an NPE internally. requireUser must catch it and return null
        // (never propagate), so callers consistently get a clean 401 instead of a 500.
        assertNull(invokeRequireUser("Bearer sometoken"));
    }

    // ===== Endpoints: a missing Authorization header must yield 401, never 500 =====

    @Test
    void getCurrentUserReturns401NotServerErrorWhenHeaderMissing() {
        BackendController controller = newController();
        ResponseEntity<?> response = controller.getCurrentUser(null);
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    void getUserListingsReturns401NotServerErrorWhenHeaderMissing() {
        BackendController controller = newController();
        ResponseEntity<?> response = controller.getUserListings(null);
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    void getAllSavedListingsReturns401NotServerErrorWhenHeaderMissing() {
        BackendController controller = newController();
        ResponseEntity<?> response = controller.getAllSavedListings(null);
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    void deleteUserReturns401NotServerErrorWhenHeaderMalformed() {
        BackendController controller = newController();
        ResponseEntity<?> response = controller.deleteUser("not-a-bearer-token");
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    void getUserConversationsReturns401NotServerErrorWhenHeaderMissing() {
        BackendController controller = newController();
        ResponseEntity<?> response = controller.getUserConversations(null);
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }
}
