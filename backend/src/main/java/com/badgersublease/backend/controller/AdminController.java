package com.badgersublease.backend.controller;

import com.badgersublease.backend.model.AdminDelete;
import com.badgersublease.backend.model.Listing;
import com.badgersublease.backend.model.Report;
import com.badgersublease.backend.model.ReportWithUserInfo;
import com.badgersublease.backend.model.User;
import com.badgersublease.backend.service.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController // tells Spring this class will handle HTTP requests and return JSON
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.OPTIONS})
@RequestMapping("/admin")
public class AdminController {

    private static final Logger log = LoggerFactory.getLogger(AdminController.class);

    @Value("${ADMIN_UID}")
    private String adminuid;

    @Value("${ADMIN_PASSWORD}")
    private String adminPassword;

    private final UserService userService;
    private final ListingService listingService;
    private final AuthService authService;
    private final MessageService messageService;
    private final EmailService emailService;
    private final CampaignService campaignService;
    @Autowired
    AdminController(UserService userService, ListingService listingService, AuthService authService, MessageService messageService, EmailService emailService, CampaignService campaignService) {
        this.userService = userService;
        this.listingService = listingService;
        this.authService = authService;
        this.messageService = messageService;
        this.emailService = emailService;
        this.campaignService = campaignService;
    }

    // Helper method to extract Firebase UID from Authorization header
    private String getFirebaseUidFromToken(String authHeader) {

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new RuntimeException("Missing or invalid Authorization header");
        }
        String idToken = authHeader.substring(7);
        try {
            String uid = authService.verifyTokenAndGetUid(idToken);
            return uid;
        } catch (Exception e) {
            log.warn("Token verification failed", e);
            throw e;
        }
    }

    @GetMapping("")
    public ResponseEntity<Boolean> isAdmin(@RequestHeader("Authorization") String authHeader) {
        try {
            //extract uid from request and verify
            String firebaseUid = getFirebaseUidFromToken(authHeader);
//            System.out.println(firebaseUid);
            //check to make sure its valid and user is in database
            User user = userService.getOrCreateUserFromToken(authHeader.substring(7));
//            System.out.println("fire base UID: " + firebaseUid + " user: " + user + " isAdmin" + firebaseUid.equals(adminuid));
            if(firebaseUid.equals(adminuid)) {
                return new ResponseEntity<>(true, HttpStatus.OK);
            }
            else{
                return new ResponseEntity<>(false, HttpStatus.FORBIDDEN);
            }
        }catch (Exception e) {
            log.warn("Admin login check failed", e);
            return new ResponseEntity<>(false, HttpStatus.INTERNAL_SERVER_ERROR);
        }

    }

    @GetMapping("/listings")
    public ResponseEntity<List<Map<String, Object>>> getListings(@RequestHeader("Authorization") String authHeader) {
        try {
            String firebaseUid = getFirebaseUidFromToken(authHeader);
            userService.getOrCreateUserFromToken(authHeader.substring(7));
            if(firebaseUid.equals(adminuid)) {
                return new ResponseEntity<>(listingService.getListingsWithOwnerInfo(), HttpStatus.OK);
            }
            else{
                return new ResponseEntity<>(HttpStatus.FORBIDDEN);
            }
        }catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }

    }

    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> getUsers(@RequestHeader("Authorization") String authHeader) {
        try {
            String firebaseUid = getFirebaseUidFromToken(authHeader);
            userService.getOrCreateUserFromToken(authHeader.substring(7));
            if(firebaseUid.equals(adminuid)) {
                return new ResponseEntity<>(userService.getAllUsersWithFirebaseInfo(), HttpStatus.OK);
            }
            else{
                return new ResponseEntity<>(HttpStatus.FORBIDDEN);
            }
        }catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }

    }

    @DeleteMapping("/users")
    public ResponseEntity<Boolean> deleteUsers(@RequestHeader("Authorization") String authHeader,
                                               @RequestBody AdminDelete deleteInformation) {
        try {
            //extract uid from request and verify
            String firebaseUid = getFirebaseUidFromToken(authHeader);
            //check to make sure its valid and user is in database


            User user = userService.getOrCreateUserFromToken(authHeader.substring(7));
            if(firebaseUid.equals(adminuid) && adminPassword.equals(deleteInformation.getPassword())) {
                    userService.deleteUsers(deleteInformation.getIds());
                    return new ResponseEntity<>(true, HttpStatus.OK);
            }
            else{
                return new ResponseEntity<>(false,HttpStatus.FORBIDDEN);
            }
        }catch (Exception e) {
            log.error("User deletion failed", e);
            return new ResponseEntity<>(false,HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @DeleteMapping("/listings")
    public ResponseEntity<Boolean> deleteListings(@RequestHeader("Authorization") String authHeader,
                                                  @RequestBody AdminDelete deleteInformation) {
        try {


            //extract uid from request and verify
            String firebaseUid = getFirebaseUidFromToken(authHeader);
            //check to make sure its valid and user is in database
            User user = userService.getOrCreateUserFromToken(authHeader.substring(7));
            if(firebaseUid.equals(adminuid) && adminPassword.equals(deleteInformation.getPassword())) {
                listingService.deleteListings(deleteInformation.getIds(), true);
                return new ResponseEntity<>(true, HttpStatus.OK);
            }
            else{
                return new ResponseEntity<>(false,HttpStatus.FORBIDDEN);
            }
        }catch (Exception e) {
            log.error("Listing deletion failed", e);
            return new ResponseEntity<>(false,HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // One-off, manually-triggered promotional campaign send (not scheduled - admin hits this once when ready)
    @PostMapping("/campaigns/sublease-reminder")
    public ResponseEntity<Map<String, Object>> sendSubleaseReminderCampaign(@RequestHeader("Authorization") String authHeader,
                                                                  @RequestBody Map<String, String> request) {
        try {
            String firebaseUid = getFirebaseUidFromToken(authHeader);
            if (firebaseUid.equals(adminuid) && adminPassword.equals(request.get("password"))) {
                Map<String, Object> result = campaignService.sendSubleaseReminderCampaign();
                return new ResponseEntity<>(result, HttpStatus.OK);
            } else {
                return new ResponseEntity<>(Map.of("error", "Forbidden"), HttpStatus.FORBIDDEN);
            }
        } catch (IllegalStateException e) {
            return new ResponseEntity<>(Map.of("error", e.getMessage()), HttpStatus.CONFLICT);
        } catch (Exception e) {
            log.error("Sublease reminder campaign failed", e);
            return new ResponseEntity<>(Map.of("error", "Internal error"), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping("/reports")
    public ResponseEntity<List<ReportWithUserInfo>> getAllReports(@RequestHeader("Authorization") String authHeader) {
        try {
            String firebaseUid = getFirebaseUidFromToken(authHeader);
            userService.getOrCreateUserFromToken(authHeader.substring(7));
            if(firebaseUid.equals(adminuid)) {
                return new ResponseEntity<>(listingService.getAllReportsWithUserInfo(), HttpStatus.OK);
            }
            else{
                return new ResponseEntity<>(HttpStatus.FORBIDDEN);
            }
        }catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping("/reports/listing/{listingId}")
    public ResponseEntity<List<ReportWithUserInfo>> getReportsByListing(
            @RequestHeader("Authorization") String authHeader,
            @PathVariable String listingId) {
        try {
            String firebaseUid = getFirebaseUidFromToken(authHeader);
            userService.getOrCreateUserFromToken(authHeader.substring(7));
            if(firebaseUid.equals(adminuid)) {
                Long internalListingId = listingService.getListingIdByPublicId(listingId);
                if (internalListingId == null) {
                    return new ResponseEntity<>(HttpStatus.NOT_FOUND);
                }
                return new ResponseEntity<>(listingService.getReportsByListingIdWithUserInfo(internalListingId), HttpStatus.OK);
            }
            else{
                return new ResponseEntity<>(HttpStatus.FORBIDDEN);
            }
        }catch (Exception e) {
            return new ResponseEntity<>(HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

}
