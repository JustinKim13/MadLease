package com.badgersublease.backend.service;

import com.badgersublease.backend.exceptions.BadRequestException;
import com.badgersublease.backend.model.Listing;
import com.badgersublease.backend.model.ListingParking;
import com.badgersublease.backend.types.ListingType;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Date;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for Listing/ListingParking numeric field validation in ListingService.
 *
 * Covers the lat/lon and ListingParking spots/price boxed-type fix: a missing or
 * out-of-range value must produce a clean validation error instead of a silent
 * 0.0f primitive default (lat/lon) or a pre-@Min Jackson deserialization 500
 * (spots/price).
 */
class ListingServiceValidationTest {

    /**
     * Helper to invoke the private validateListingShape(Listing, ListingParking) method via reflection.
     */
    private void invokeValidateListingShape(Listing listing, ListingParking parking) throws Exception {
        ListingService service = new ListingService(null, null, null, null, null, null, null);
        Method method = ListingService.class.getDeclaredMethod("validateListingShape", Listing.class, ListingParking.class);
        method.setAccessible(true);
        try {
            method.invoke(service, listing, parking);
        } catch (java.lang.reflect.InvocationTargetException e) {
            if (e.getCause() instanceof BadRequestException) {
                throw (BadRequestException) e.getCause();
            }
            throw e;
        }
    }

    /**
     * Builds a minimally-valid HOUSING listing (all fields validateListingShape requires
     * for the needsHousing branch), so each test only needs to perturb the field it's
     * exercising.
     */
    private Listing validHousingListing() {
        Listing listing = new Listing();
        listing.setListingType(ListingType.HOUSING);
        listing.setRent(1500);
        listing.setBedrooms(2);
        listing.setBathrooms(1);
        listing.setSquareFeet(800);
        listing.setStartDate(new Date());
        listing.setEndDate(new Date());
        listing.setLat(43.0731f);
        listing.setLon(-89.4012f);
        return listing;
    }

    // ===== lat/lon null handling =====

    @Test
    void shouldRejectNullLat() throws Exception {
        Listing listing = validHousingListing();
        listing.setLat(null);
        BadRequestException exception = assertThrows(BadRequestException.class,
            () -> invokeValidateListingShape(listing, null));
        assertTrue(exception.getMessage().toLowerCase().contains("lat"));
    }

    @Test
    void shouldRejectNullLon() throws Exception {
        Listing listing = validHousingListing();
        listing.setLon(null);
        BadRequestException exception = assertThrows(BadRequestException.class,
            () -> invokeValidateListingShape(listing, null));
        assertTrue(exception.getMessage().toLowerCase().contains("lon"));
    }

    @Test
    void shouldRejectNullLatAndLon() throws Exception {
        Listing listing = validHousingListing();
        listing.setLat(null);
        listing.setLon(null);
        assertThrows(BadRequestException.class,
            () -> invokeValidateListingShape(listing, null));
    }

    // ===== lat/lon range handling =====

    @Test
    void shouldRejectLatAboveNinety() throws Exception {
        Listing listing = validHousingListing();
        listing.setLat(90.5f);
        BadRequestException exception = assertThrows(BadRequestException.class,
            () -> invokeValidateListingShape(listing, null));
        assertTrue(exception.getMessage().toLowerCase().contains("latitude"));
    }

    @Test
    void shouldRejectLatBelowNegativeNinety() throws Exception {
        Listing listing = validHousingListing();
        listing.setLat(-90.5f);
        assertThrows(BadRequestException.class,
            () -> invokeValidateListingShape(listing, null));
    }

    @Test
    void shouldRejectLonAboveOneEighty() throws Exception {
        Listing listing = validHousingListing();
        listing.setLon(180.5f);
        BadRequestException exception = assertThrows(BadRequestException.class,
            () -> invokeValidateListingShape(listing, null));
        assertTrue(exception.getMessage().toLowerCase().contains("longitude"));
    }

    @Test
    void shouldRejectLonBelowNegativeOneEighty() throws Exception {
        Listing listing = validHousingListing();
        listing.setLon(-180.5f);
        assertThrows(BadRequestException.class,
            () -> invokeValidateListingShape(listing, null));
    }

    @Test
    void shouldAcceptBoundaryLatLonValues() throws Exception {
        Listing listing = validHousingListing();
        listing.setLat(90f);
        listing.setLon(-180f);
        assertDoesNotThrow(() -> invokeValidateListingShape(listing, null));
    }

    @Test
    void shouldAcceptValidLatLonForHousingListing() throws Exception {
        Listing listing = validHousingListing();
        assertDoesNotThrow(() -> invokeValidateListingShape(listing, null));
    }

    @Test
    void shouldRejectNullLatEvenForParkingOnlyListing() throws Exception {
        // lat/lon are geocoded from the address for every listing type, not just HOUSING,
        // so the check must fire before the needsHousing/needsParking branching.
        Listing listing = new Listing();
        listing.setListingType(ListingType.PARKING);
        listing.setLat(null);
        listing.setLon(-89.4012f);

        ListingParking parking = new ListingParking();
        parking.setParkingType("SURFACE_LOT");
        parking.setSpots(2);
        parking.setPrice(50);

        assertThrows(BadRequestException.class,
            () -> invokeValidateListingShape(listing, parking));
    }

    // ===== ListingParking.spots / price bean validation =====
    // These run through jakarta.validation directly (the same mechanism Spring's
    // @Valid on the controller's @RequestPart ListingParking uses), since
    // validateListingShape doesn't re-check them -- they're declared on the model.

    private Set<ConstraintViolation<ListingParking>> validate(ListingParking parking) {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            Validator validator = factory.getValidator();
            return validator.validate(parking);
        }
    }

    private ListingParking validParking() {
        ListingParking parking = new ListingParking();
        parking.setParkingType("SURFACE_LOT");
        parking.setSpots(2);
        parking.setPrice(50);
        return parking;
    }

    @Test
    void shouldRejectNullSpots() {
        ListingParking parking = validParking();
        parking.setSpots(null);
        Set<ConstraintViolation<ListingParking>> violations = validate(parking);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("spots")));
    }

    @Test
    void shouldRejectSpotsBelowOne() {
        ListingParking parking = validParking();
        parking.setSpots(0);
        Set<ConstraintViolation<ListingParking>> violations = validate(parking);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("spots")));
    }

    @Test
    void shouldRejectNullPrice() {
        ListingParking parking = validParking();
        parking.setPrice(null);
        Set<ConstraintViolation<ListingParking>> violations = validate(parking);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("price")));
    }

    @Test
    void shouldRejectNegativePrice() {
        ListingParking parking = validParking();
        parking.setPrice(-10);
        Set<ConstraintViolation<ListingParking>> violations = validate(parking);
        assertFalse(violations.isEmpty());
        assertTrue(violations.stream().anyMatch(v -> v.getPropertyPath().toString().equals("price")));
    }

    @Test
    void shouldAcceptValidParking() {
        ListingParking parking = validParking();
        assertTrue(validate(parking).isEmpty());
    }
}
