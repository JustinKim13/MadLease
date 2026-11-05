package com.badgersublease.backend.service;

import com.badgersublease.backend.mapper.ListingMapper;
import com.badgersublease.backend.model.Email;
import com.badgersublease.backend.model.Listing;
import com.badgersublease.backend.model.ListingCreated;
import com.badgersublease.backend.model.ListingDetails;
import com.badgersublease.backend.model.ListingParking;
import com.badgersublease.backend.model.Report;
import com.badgersublease.backend.model.ReportWithUserInfo;
import com.badgersublease.backend.model.User;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.UserRecord;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;

import com.badgersublease.backend.mapper.UserMapper;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallbackWithoutResult;
import org.springframework.transaction.support.TransactionTemplate;

import com.badgersublease.backend.exceptions.BadRequestException;
import com.badgersublease.backend.types.ListingType;
import com.badgersublease.backend.types.Status;


import java.security.SecureRandom;
import java.util.Random;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ListingService {

    @Autowired
    private Environment env;

    private final ListingMapper listingMapper;
    private final TransactionTemplate transactionTemplate;
    private final S3Service s3Service;
    private final EmailService emailService;
    private final SlackService slackService;
    private final IndexNowService indexNowService;
    private final UserMapper userMapper;
    private static final String ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();


    @Autowired
    public ListingService(ListingMapper listingMapper, PlatformTransactionManager transactionManager,
                          S3Service s3Service, EmailService emailService, SlackService slackService,
                          IndexNowService indexNowService, UserMapper userMapper) {
        this.listingMapper = listingMapper;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
        this.s3Service = s3Service;
        this.emailService = emailService;
        this.slackService = slackService;
        this.indexNowService = indexNowService;
        this.userMapper = userMapper;
    }

    private String generateUniquePublicId() {
        int maxAttempts = 10;
        for (int attempt = 0; attempt < maxAttempts; attempt++) {
            StringBuilder sb = new StringBuilder(8);
            for (int i = 0; i < 8; i++) {
                sb.append(ALPHANUMERIC.charAt(RANDOM.nextInt(ALPHANUMERIC.length())));
            }
            String publicId = sb.toString();

            if (!listingMapper.doesListingExistByPublicId(publicId)) {
                return publicId;
            }
        }
        throw new RuntimeException("Failed to generate unique public ID after " + maxAttempts + " attempts");
    }

    public List<Listing> getUserListings(long userId){
        List<Listing> listings = listingMapper.getUserListings(userId);
        for(Listing listing : listings){
            listing.setPreSignedGetUrls(getImageUrls(listing.getListingImageFileNames()));
            if (listing.getParking() != null) {      
                listing.getParking().setImageUrl(getParkingImageUrl(listing.getParking().getImageKey()));                        
            } 
        }
        return listings;
    }

    public List<Listing> getListings(){
        List<Listing> listings = listingMapper.getListings();
        for(Listing listing : listings){
            listing.setPreSignedGetUrls(getImageUrls(listing.getListingImageFileNames()));
            if (listing.getParking() != null) {      
                listing.getParking().setImageUrl(getParkingImageUrl(listing.getParking().getImageKey()));                        
            } 

        }
        return listings;
    }

    public List<Listing> getFilteredListings(Integer minRent, Integer maxRent,
        String startDate, String endDate, Integer roommates,
        Integer bedrooms, List<String> amenities, Boolean parkingIncluded,
        String listingType, String seed) {

        Map<String, Object> params = new HashMap<>();
        if (minRent != null) params.put("minRent", minRent);
        if (maxRent != null) params.put("maxRent", maxRent);
        if (startDate != null) params.put("startDate", startDate);
        if (endDate != null) params.put("endDate", endDate);
        if (roommates != null) params.put("roommates", roommates);
        if (bedrooms != null) params.put("bedrooms", bedrooms);
        if (amenities != null && !amenities.isEmpty()) params.put("amenities", amenities);
        if (parkingIncluded != null && parkingIncluded) params.put("parkingIncluded", true);
        if (listingType != null && !listingType.isBlank()) {
            String normalized = listingType.trim().toUpperCase(Locale.ROOT);
            // Keep browse filtering strict so typos don't silently become "ALL".
            if (!Set.of("ALL", "HOUSING", "PARKING", "BOTH").contains(normalized)) {
                throw new BadRequestException("Invalid listingType: " + listingType);
            }
            if (!"ALL".equals(normalized)) {
                params.put("listingType", normalized);
            }
        }

        List<Listing> listings = listingMapper.getFilteredListings(params); // call our mapper with our updated params
        if(seed != null) {
            //only get top 5(by score) if we have more than 15 listings
            if(listings.size() > 15) {
                Random random = new Random(Long.parseLong(seed));
                listings.sort(Comparator.comparingDouble(Listing::getScore).reversed());
                //get top 10
                List<Listing> topFiveRandom = new ArrayList<>(listings.subList(0, 10));
                //shuffle top 10 randomly
                Collections.shuffle(topFiveRandom, random);
                topFiveRandom = topFiveRandom.subList(0, 5);
                
                Set<Long> topFiveRandomIds = topFiveRandom.stream().map(Listing::getListingID).collect(Collectors.toSet());
                List<Listing> rest = listings.stream().filter(listing -> !topFiveRandomIds.contains(listing.getListingID())).collect(Collectors.toList());

                Collections.shuffle(rest, random);

                List<Listing> result = new ArrayList<>();
                result.addAll(topFiveRandom);
                result.addAll(rest);
                listings = result;
            }
        }
        

        // generate presigned URLs for images (same as getListings())
        for (Listing listing : listings) {

            listing.setPreSignedGetUrls(getImageUrls(listing.getListingImageFileNames()));
            if (listing.getParking() != null) {      
                listing.getParking().setImageUrl(getParkingImageUrl(listing.getParking().getImageKey()));                        
            } 
        }
        return listings;
    }


    public Listing getListingById(long listingId) {
        Listing listing = listingMapper.getListingById(listingId);
        if (listing != null) {
            listing.setPreSignedGetUrls(getImageUrls(listing.getListingImageFileNames()));
            if (listing.getParking() != null) {
                listing.getParking().setImageUrl(getParkingImageUrl(listing.getParking().getImageKey()));
            }
        }
        return listing;
    }

    public Listing getListingByPublicId(String publicId) {
        Listing listing = listingMapper.getListingByPublicId(publicId);
        if (listing != null) {
            listing.setPreSignedGetUrls(getImageUrls(listing.getListingImageFileNames()));
            if (listing.getParking() != null) {
                listing.getParking().setImageUrl(getParkingImageUrl(listing.getParking().getImageKey()));
            }
        }
        return listing;
    }

    public ListingDetails getListingDetails(String publicId, Long requesterId, boolean track) {
        Listing listing = getListingByPublicId(publicId);
        if (listing == null) {
            return null;
        }

        boolean isOwner = requesterId != null && requesterId.equals(listing.getUserID());

        // Expired and completed listings are only visible to their owner
        // (expired so they can be reactivated)
        if (!isOwner && (listing.getStatus() == Status.EXPIRED || listing.getStatus() == Status.COMPLETED)) {
            return null;
        }

        if (!isOwner && track) {
            incrementViewCount(listing.getListingID());
        }

        ListingDetails details = new ListingDetails(listing, isOwner);

        User user = userMapper.getUserById(listing.getUserID());
        if (user != null && user.getFirebaseUid() != null) {
            try {
                UserRecord userRecord = FirebaseAuth.getInstance().getUser(user.getFirebaseUid());

                Date createdAt = null;
                if (userRecord.getUserMetadata() != null && userRecord.getUserMetadata().getCreationTimestamp() != 0) {
                    createdAt = new Date(userRecord.getUserMetadata().getCreationTimestamp());
                }

                details.setPosterInfo(
                    userRecord.getDisplayName(),
                    userRecord.getEmail(),
                    userRecord.getPhotoUrl(),
                    user.isVerified(),
                    createdAt
                );
            } catch (Exception e) {
                details.setPosterInfo(null, null, null, user.isVerified(), null);
            }
        }

        return details;
    }

    public Long getListingIdByPublicId(String publicId) {
        return listingMapper.getListingIdByPublicId(publicId);
    }

    public boolean doesListingExistByPublicId(String publicId) {
        return listingMapper.doesListingExistByPublicId(publicId);
    }

    public List<Listing> getAllSavedListings(long userId) {
        List<Listing> savedListings = listingMapper.getAllSavedListings(userId);
        for (Listing listing : savedListings) {
            if (listing != null && listing.getListingImageFileNames() != null) {
                listing.setPreSignedGetUrls(getImageUrls(listing.getListingImageFileNames()));
                if (listing.getParking() != null) {      
                    listing.getParking().setImageUrl(getParkingImageUrl(listing.getParking().getImageKey()));                        
                } 
            }
        }
        return savedListings;
    }

    public void saveListing(long userId, long listingId) {
        // Check if listing exists
        if (!listingMapper.doesListingExist(listingId)) {
            throw new RuntimeException("Listing not found");
        }

        // Expired and completed listings can't be saved
        Status status = listingMapper.getListingById(listingId).getStatus();
        if (status == Status.EXPIRED || status == Status.COMPLETED) {
            throw new BadRequestException("This listing is no longer available");
        }

        // Check if already saved
        if (listingMapper.isListingSaved(userId, listingId)) {
            throw new RuntimeException("Listing already saved");
        }

        // Check if a SavedListing entry already exists for this listing
        Long savedListingId = listingMapper.getSavedListingId(listingId);
        
        if (savedListingId == null) {
            // Create a new SavedListing entry using Map approach
            Map<String, Object> params = new HashMap<>();
            params.put("listingId", listingId);
            listingMapper.createSavedListing(params);
            // Fix the casting issue - MyBatis returns Integer, not Long
            Object savedListingIdObj = params.get("SavedListingID");
            if (savedListingIdObj instanceof Integer) {
                savedListingId = ((Integer) savedListingIdObj).longValue();
            } else if (savedListingIdObj instanceof Long) {
                savedListingId = (Long) savedListingIdObj;
            } else {
                throw new RuntimeException("Unexpected type for SavedListingID: " + savedListingIdObj.getClass());
            }
        }
        
        // Create the SavedListingLink
        listingMapper.createSavedListingLink(userId, savedListingId);
    }

    public void unsaveListing(long userId, long listingId) {

        listingMapper.unsaveListing(userId, listingId);
    }

    // Enforces the required shape of a Listing based on its ListingType.
    // HOUSING/BOTH must have rent + bedrooms + bathrooms + squareFeet populated.
    // PARKING must have a ListingParking payload and housing fields are forced null.
    // Called from both addListing and updateListing before hitting the mapper.
    private void validateListingShape(Listing listing, ListingParking parking) {
        ListingType type = listing.getListingType();
        if (type == null) {
            throw new BadRequestException("listingType is required");
        }

        // lat/lon are geocoded from the address on the frontend for every listing type
        // (not just HOUSING), so they're validated unconditionally here. A null here
        // (instead of a silent 0.0f primitive default) means geocoding failed or the
        // value was dropped in transit -- reject it rather than letting it corrupt the
        // distance-based trending/relevance score.
        if (listing.getLat() == null || listing.getLon() == null) {
            throw new BadRequestException("Listing location (lat/lon) is required");
        }
        if (listing.getLat() < -90 || listing.getLat() > 90) {
            throw new BadRequestException("Latitude must be between -90 and 90");
        }
        if (listing.getLon() < -180 || listing.getLon() > 180) {
            throw new BadRequestException("Longitude must be between -180 and 180");
        }

        boolean needsHousing = (type == ListingType.HOUSING || type == ListingType.BOTH);
        boolean needsParking = (type == ListingType.PARKING || type == ListingType.BOTH);

        if (needsHousing) {
            if (listing.getRent() == null || listing.getRent() < 1)
                throw new BadRequestException("Rent is required for housing listings");
            if (listing.getBedrooms() == null || listing.getBedrooms() < 1)
                throw new BadRequestException("Bedrooms is required for housing listings");
            if (listing.getBathrooms() == null || listing.getBathrooms() < 1)
                throw new BadRequestException("Bathrooms is required for housing listings");
            if (listing.getSquareFeet() == null || listing.getSquareFeet() < 1)
                throw new BadRequestException("Square feet is required for housing listings");
        } else {
            // PARKING-only: null housing fields so they never leak into the row
            listing.setRent(null);
            listing.setBedrooms(null);
            listing.setBathrooms(null);
            listing.setSquareFeet(null);
            listing.setRoommates(0);
        }

        if (needsParking && parking == null) {
            throw new BadRequestException("Parking details are required for parking listings");
        }
        if (!needsParking && parking != null) {
            throw new BadRequestException("Parking details not allowed on a HOUSING listing");
        }
    }

    public ListingCreated addListing(Listing listing, List<String> fileNames, ListingParking parking, String parkingImageName) throws Exception{

        validateListingShape(listing, parking);

        // Status is server-controlled; ignore whatever the client sent
        listing.setStatus(Status.AVAILABLE);

        //for transactions

        List<String> preSignedUrls = new ArrayList<>();
        String[] parkingPresignedUrl = {null};
        transactionTemplate.execute(new TransactionCallbackWithoutResult() {
            protected void doInTransactionWithoutResult(TransactionStatus status) {
                try{
                    // Validate file names before processing
                    for (String fileName : fileNames) {

                        validateFileName(fileName);
                    }

                    // Generate a unique public ID for the listing
                    listing.setPublicId(generateUniquePublicId());
                    listingMapper.addListing(listing);
                    for(String fileName : fileNames){
                        String dateStampedFileName = generateFileName(fileName, listing.getPublicId());
                        String preSignedUrl = s3Service.generatePresignedUrlPut(dateStampedFileName);
                        preSignedUrls.add(preSignedUrl);
                        listingMapper.addListingPhotos(listing.getListingID(), dateStampedFileName);
                    }

                    if (parking != null) {
                        parking.setListingId(listing.getListingID());
                        if (parkingImageName != null && !parkingImageName.isBlank()) {
                            validateFileName(parkingImageName);
                            String parkingKey = buildParkingImageKey(listing.getPublicId(), parkingImageName);
                            parking.setImageKey(parkingKey);
                            parkingPresignedUrl[0] = s3Service.generatePresignedUrlPut(parkingKey);
                        }
                        listingMapper.addListingParking(parking);
                    }

                }catch (Exception e){
                    status.setRollbackOnly();
                    throw new RuntimeException(e);
                }
            }
        }) ;

        // notify Slack about the new listing asynchronously
        // Attach parking payload so Slack can show parking price/type.
        listing.setParking(parking);
        slackService.notifyNewListing(listing);

        // Notify IndexNow search engines about the new listing
        indexNowService.notifyListingChanged(listing.getPublicId());

        // best-effort confirmation email to the owner; a failure here shouldn't fail listing creation
        try {
            User owner = userMapper.getUserById(listing.getUserID());
            if (owner != null && owner.getFirebaseUid() != null) {
                UserRecord ownerRecord = FirebaseAuth.getInstance().getUser(owner.getFirebaseUid());
                if (ownerRecord.getEmail() != null) {
                    Email confirmation = new Email();
                    confirmation.setEmail(ownerRecord.getEmail());
                    confirmation.setName(ownerRecord.getDisplayName() != null ? ownerRecord.getDisplayName() : "there");
                    confirmation.setListingTitle(listing.getTitle());
                    confirmation.setListingUrl("https://madlease.net/listings/" + listing.getPublicId());
                    emailService.sendListingConfirmedEmail(confirmation);
                }
            }
        } catch (Exception ignored) {}

        // Return both publicId and presigned URLs for client-side error handling
        ListingCreated listingCreated = new ListingCreated();
        listingCreated.setPublicId(listing.getPublicId());
        listingCreated.setPresignedUrls(preSignedUrls);
        listingCreated.setParkingImagePresignedUrl(parkingPresignedUrl[0]);

        return listingCreated;
    }


    public ListingCreated updateListing(Listing listing, long userID, List<String> deleteFileNames, List<String> imageOrder, ListingParking parking, String parkingImageName, Boolean removeParkingImage) throws Exception{


        Listing existingListing = listingMapper.getListingById(listing.getListingID());
        // Check if listing exists
        if (existingListing == null) {
            throw new BadRequestException("Listing not found");
        }
        if (userID != existingListing.getUserID()) {
            throw new BadRequestException("You can only edit your own listings");
        }

        if (listing.getListingType() != null
                && !listing.getListingType().equals(existingListing.getListingType())) {
            throw new BadRequestException(
                    "Listing type cannot be changed. Create a new listing to use a different type.");
        }

        validateListingShape(listing, parking);

        // Status is server-controlled; ignore whatever the client sent.
        // An expired listing is reactivated only when its end date is still in the future.
        if (existingListing.getStatus() == Status.EXPIRED) {
            if (listing.getEndDate() == null || !listing.getEndDate().after(new Date())) {
                throw new BadRequestException("Set an end date in the future to reactivate this listing");
            }
            listing.setStatus(Status.AVAILABLE);
        } else {
            listing.setStatus(existingListing.getStatus());
        }

        List<String> preSignedUrls = new ArrayList<>();
        String[] parkingPresignedUrl = {null};
        // Map to track original filename -> date-stamped filename for new uploads
        Map<String, String> newFileNameMap = new HashMap<>();

        String publicId = existingListing.getPublicId();

        // Snapshot this listing's current photos for validation
        Set<String> ownedPhotos = new HashSet<>(listingMapper.getListingImageFileNames(listing.getListingID()));

        for (String deleteFileName : deleteFileNames) {
            if (!ownedPhotos.contains(deleteFileName)) {
                throw new BadRequestException("Cannot delete file that does not belong to this listing");
            }
        }

        // Validate imageOrder and pre-generate S3 filenames for NEW: entries
        if (imageOrder != null) {
            Set<String> photosAfterDelete = new HashSet<>(ownedPhotos);
            photosAfterDelete.removeAll(deleteFileNames);

            for (String entry : imageOrder) {
                if (entry.startsWith("NEW:")) {
                    String[] parts = entry.split(":", 3);
                    if (parts.length >= 3) {
                        String originalFileName = parts[2];
                        validateFileName(originalFileName);
                        // Pre-generate date-stamped filename for new uploads
                        newFileNameMap.put(originalFileName, generateFileName(originalFileName, publicId));
                    }
                } else {
                    if (!photosAfterDelete.contains(entry)) {
                        throw new BadRequestException("Invalid image reference: does not belong to this listing");
                    }
                }
            }
        }

        transactionTemplate.execute(new TransactionCallbackWithoutResult() {
            protected void doInTransactionWithoutResult(TransactionStatus status) {
                try{
                    listingMapper.updateListing(listing);

                    for(String deleteFileName : deleteFileNames){
                        int deleted = listingMapper.deleteListingPhoto(listing.getListingID(), deleteFileName);
                        if(deleted == 1){
                            s3Service.deleteFile(deleteFileName);
                        }
                    }

                    // Handle image reordering with support for new images in any position
                    if (imageOrder != null && !imageOrder.isEmpty()) {
                        // Delete all existing photo records (not from S3, just the DB order)
                        listingMapper.deleteAllListingPhotos(listing.getListingID());

                        // Re-insert in the new order, handling both existing and new images
                        // TODO: improve efficiency of this by using a single query to insert all photos at once
                        for (String entry : imageOrder) {
                            if (entry.startsWith("NEW:")) {
                                // New image: format is "NEW:index:originalFilename"
                                String[] parts = entry.split(":", 3);
                                if (parts.length >= 3) {
                                    String originalFileName = parts[2];
                                    String dateStampedFileName = newFileNameMap.get(originalFileName);
                                    if (dateStampedFileName != null) {
                                        listingMapper.addListingPhotos(listing.getListingID(), dateStampedFileName);
                                        preSignedUrls.add(s3Service.generatePresignedUrlPut(dateStampedFileName));
                                    }
                                }
                            } else {
                                // Existing image: just the filename
                                listingMapper.addListingPhotos(listing.getListingID(), entry);
                            }
                        }
                    }

                    // Handle parking: upsert or delete
                    ListingParking existingParking = listingMapper.getListingParkingByListingId(listing.getListingID());
                    if (parking != null) {
                        parking.setListingId(listing.getListingID());
                        if (Boolean.TRUE.equals(removeParkingImage) && existingParking != null && existingParking.getImageKey() != null) {
                            // User explicitly removed parking image — delete from S3, clear key
                            s3Service.deleteFile(existingParking.getImageKey());
                            parking.setImageKey(null);
                        } else if (parkingImageName != null && !parkingImageName.isBlank()) {
                            // New parking image uploaded — delete old one if exists, generate new key
                            if (existingParking != null && existingParking.getImageKey() != null) {
                                s3Service.deleteFile(existingParking.getImageKey());
                            }
                            validateFileName(parkingImageName);
                            String parkingKey = buildParkingImageKey(publicId, parkingImageName);
                            parking.setImageKey(parkingKey);
                            parkingPresignedUrl[0] = s3Service.generatePresignedUrlPut(parkingKey);
                        } else {
                            // No image change — keep existing key
                            parking.setImageKey(existingParking != null ? existingParking.getImageKey() : null);
                        }
                        if (existingParking != null) listingMapper.updateListingParking(parking);
                        else listingMapper.addListingParking(parking);
                    } else {
                        // Parking toggled off — delete row and S3 image if they exist
                        if (existingParking != null) {
                            if (existingParking.getImageKey() != null) s3Service.deleteFile(existingParking.getImageKey());
                            listingMapper.deleteListingParking(listing.getListingID());
                        }
                    }
                }catch (Exception e){
                    status.setRollbackOnly();
                    throw new RuntimeException(e);
                }
            }
        }) ;

        // Notify IndexNow search engines about the updated listing
        indexNowService.notifyListingChanged(publicId);

        ListingCreated result = new ListingCreated();
        result.setPresignedUrls(preSignedUrls);
        result.setParkingImagePresignedUrl(parkingPresignedUrl[0]);
        return result;
    }

    public void updateListingStatus(String publicId, long requesterId, Status newStatus) {
        Listing existing = listingMapper.getListingByPublicId(publicId);

        Status current = existing.getStatus();

        // COMPLETED is a one-way door
        if (current == Status.COMPLETED) {
            throw new BadRequestException("A completed listing cannot be changed");
        }

        // Validate allowed transitions:
        // AVAILABLE → PENDING, AVAILABLE → COMPLETED
        // PENDING → AVAILABLE, PENDING → COMPLETED
        boolean valid = switch (current) {
            case AVAILABLE -> newStatus == Status.PENDING || newStatus == Status.COMPLETED;
            case PENDING -> newStatus == Status.AVAILABLE || newStatus == Status.COMPLETED;
            case EXPIRED -> newStatus == Status.COMPLETED || verifyExpiredUpdateValid(publicId);
            default -> false;
        };

        if (!valid) {
            throw new BadRequestException("Invalid status transition: " + current + " → " + newStatus);
        }

        listingMapper.updateListingStatus(existing.getListingID(), newStatus);

        // Notify IndexNow so COMPLETED listings drop out of the index
        indexNowService.notifyListingChanged(publicId);

        // notify slack about the status change
        slackService.notifyListingStatusChanged(existing, current, newStatus);
    }
    public boolean verifyExpiredUpdateValid(String publicId){
        //get current listing 
        Listing existing = listingMapper.getListingByPublicId(publicId);

        Date listingEndDate = existing.getEndDate();

        //tried to set an expired listing to any other status besides completed before updating end date
        if(listingEndDate.before(new Date())){
            return false;
        }
        return true;
    }

    public List<Listing> getActiveListingsForSitemap() {
        return listingMapper.getActiveListingsForSitemap();
    }

    public List<Listing> getTrendingListings(int limit) {
        List<Listing> listings = listingMapper.getTrendingListings(limit);
        for (Listing listing : listings) {
            listing.setPreSignedGetUrls(getImageUrls(listing.getListingImageFileNames()));
            if (listing.getParking() != null) {
                listing.getParking().setImageUrl(getParkingImageUrl(listing.getParking().getImageKey()));
            }
        }
        return listings;
    }

    public void incrementViewCount(long listingId) {
        listingMapper.incrementViewCount(listingId);
    }

    public int getViewCount(long listingId) {
        return listingMapper.getViewCount(listingId);
    }

    public int getSaveCount(long listingId) {
        return listingMapper.getSaveCount(listingId);
    }

    public void deleteListing(long listingId) {
        Listing listing = listingMapper.getListingById(listingId);
        transactionTemplate.execute(new TransactionCallbackWithoutResult() {
            protected void doInTransactionWithoutResult(TransactionStatus status) {
                try {
                    //archive non-PII listing data before deleting
                    listingMapper.archiveListing(listingId);
                    //delete images first
                    for(String fileNames: listingMapper.getListingImageFileNames(listingId)){
                        s3Service.deleteFile(fileNames);
                    }
                    //delete listing
                    listingMapper.deleteListing(listingId);

                }catch (Exception e){
                    status.setRollbackOnly();
                    throw new RuntimeException(e);
                }
            }
        });
        if (listing != null) {
            slackService.notifyListingDeleted(listing.getTitle(), listing.getPublicId());
        }
    }

    public void deleteListings(List<Long> listingIds, boolean sendEmail) {
        try {
            for (Long listingId : listingIds) {

                //Todo: these can both be sped up by sending this info along in the delete request, but for now this works

                //get user info for email
                User user = userMapper.getUserById(getListingById(listingId).getUserID());
                //get listing info for email
                Listing listing = getListingById(listingId);
                String deletedPublicId = listing != null ? listing.getPublicId() : null;
                deleteListing(listingId);

                // Notify IndexNow so the deleted URL is removed from search indexes
                if (deletedPublicId != null) {
                    indexNowService.notifyListingChanged(deletedPublicId);
                }
                //need send email because when deleting users entire profile, we dont need to send double email
                if(sendEmail) {
                    UserRecord userRecord = FirebaseAuth.getInstance().getUser(user.getFirebaseUid());
                    Email email = new Email();
                    email.setEmail(userRecord.getEmail());
                    email.setName(userRecord.getDisplayName());
                    email.setMessage("We have deleted your listing " + listing.getTitle() + ", please reach out with any questions");
                    emailService.sendDeletedListingsEmail(email);
                }
            }
        }catch (Exception e){
            throw new RuntimeException(e);
        }
    }

    // Runs daily at 12:01 AM Central
    @Scheduled(cron = "0 1 0 * * *", zone = "America/Chicago")
    public void updateExpiredListings(){
        //get listings that arent expired
        List<Listing> listings = listingMapper.getListingsNotExpired();
        List<Listing> expiredListings = new ArrayList<>();
        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("America/Chicago"));

        //find new expired listings, and listings expiring in exactly 3 days
        for(Listing listing : listings){
            if(listing.getEndDate().before(new Date())){
                expiredListings.add(listing);
            } else {
                java.time.LocalDate endDate = listing.getEndDate().toInstant()
                        .atZone(java.time.ZoneId.of("America/Chicago")).toLocalDate();
                if (java.time.temporal.ChronoUnit.DAYS.between(today, endDate) == 3) {
                    sendExpiringReminder(listing);
                }
            }
        }

        //update to expired at notify slack and indexnow
        for(Listing listing : expiredListings){
            String publicId = listing.getPublicId();
            Status currentStatus = listing.getStatus();
            listingMapper.updateListingStatus(listing.getListingID(), Status.EXPIRED);

            // Notify IndexNow so COMPLETED listings drop out of the index
            indexNowService.notifyListingChanged(publicId);

            // notify slack about the status change
            slackService.notifyListingStatusChanged(listing, currentStatus, Status.EXPIRED);
        }


    }

    // best-effort "expires in 3 days" nudge to the owner; a failure here shouldn't break the expiry job
    private void sendExpiringReminder(Listing listing) {
        try {
            User owner = userMapper.getUserById(listing.getUserID());
            if (owner == null || owner.getFirebaseUid() == null) return;

            UserRecord ownerRecord = FirebaseAuth.getInstance().getUser(owner.getFirebaseUid());
            if (ownerRecord.getEmail() == null) return;

            Email reminder = new Email();
            reminder.setEmail(ownerRecord.getEmail());
            reminder.setName(ownerRecord.getDisplayName() != null ? ownerRecord.getDisplayName() : "there");
            reminder.setListingTitle(listing.getTitle());
            reminder.setListingUrl("https://madlease.net/listings/" + listing.getPublicId() + "/edit");
            reminder.setExpiryDate(new java.text.SimpleDateFormat("MMMM d, yyyy").format(listing.getEndDate()));
            emailService.sendListingExpiringEmail(reminder);
        } catch (Exception ignored) {}
    }
    private String generateFileName(String fileName, String listingPublicId) {
        validateFileName(fileName);
        return "listings/" + listingPublicId + "/" + new Date().getTime() + "-" + fileName;
    }
    private String buildParkingImageKey(String listingPublicId, String parkingImageName) {
        validateFileName(parkingImageName);
        return "listings/" + listingPublicId + "/parking/" + new Date().getTime() + "-" + parkingImageName;
    }

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".heic", ".heif", ".avif"
    );

    private void validateFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            throw new BadRequestException("File name cannot be empty");
        }

        // Check for path traversal attempts
        if (fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            throw new BadRequestException("Invalid file name: path traversal not allowed");
        }

        // Check for null bytes (another path traversal technique)
        if (fileName.contains("\0")) {
            throw new BadRequestException("Invalid file name: illegal characters");
        }

        // Validate file extension
        String lowerFileName = fileName.toLowerCase();
        boolean hasValidExtension = ALLOWED_EXTENSIONS.stream()
            .anyMatch(lowerFileName::endsWith);

        if (!hasValidExtension) {
            throw new BadRequestException("Invalid file type. Allowed types: JPG, JPEG, PNG, GIF, WEBP, BMP, HEIC, AVIF");
        }
    }

    private List<String> getImageUrls(List<String> fileNames) {
        List<String> imageUrls = new ArrayList<>();
        for (String fileName : fileNames) {
            if (env.acceptsProfiles(Profiles.of("local"))){
                imageUrls.add(s3Service.generatePresignedUrlGet(fileName));
                //just to test if it correctly encodes the file name
                // System.out.println("image url: " + s3Service.getImageUrl(fileName));
            } else if (env.acceptsProfiles(Profiles.of("production"))) {
                imageUrls.add(s3Service.getImageUrl(fileName));
                // System.out.println("image url: " + s3Service.getImageUrl(fileName));
                
            }
        }
        return imageUrls;
    }

    private String getParkingImageUrl(String imageKey) {                                                                 
      if (imageKey == null) return null;                                                                               
      if (env.acceptsProfiles(Profiles.of("local"))) {                                                                 
          return s3Service.generatePresignedUrlGet(imageKey);                                                          
      } else if (env.acceptsProfiles(Profiles.of("production"))) {                                                     
          return s3Service.getImageUrl(imageKey);                                                                      
      }
      return null;                                                                                                     
    }     

    public void submitReport(Report report, User user) {

        Long internalListingId = listingMapper.getListingIdByPublicId(report.getListingId());
        if (internalListingId == null) {
            throw new RuntimeException("Listing not found");
        }

        report.setUserId(user.getUserID());
        report.setInternalListingId(internalListingId);
        listingMapper.insertReport(report);

        // notify Slack about the new report asynchronously
        slackService.notifyReportSubmitted(report);
    }

    public List<ReportWithUserInfo> getAllReportsWithUserInfo() {
        return enrichReports(listingMapper.getAllReports());
    }

    public List<ReportWithUserInfo> getReportsByListingIdWithUserInfo(long listingId) {
        return enrichReports(listingMapper.getReportsByListingId(listingId));
    }

    private List<ReportWithUserInfo> enrichReports(List<Report> reports) {
        List<ReportWithUserInfo> result = new ArrayList<>();
        for (Report report : reports) {
            ReportWithUserInfo reportWithUserInfo = new ReportWithUserInfo(report);
            try {
                User user = userMapper.getUserById(report.getUserId());
                if (user != null && user.getFirebaseUid() != null) {
                    UserRecord record = FirebaseAuth.getInstance().getUser(user.getFirebaseUid());
                    reportWithUserInfo.setReporterName(record.getDisplayName());
                    reportWithUserInfo.setReporterEmail(record.getEmail());
                    reportWithUserInfo.setReporterProfilePictureUrl(record.getPhotoUrl());
                    reportWithUserInfo.setReporterIsVerified(user.isVerified());
                } else {
                    reportWithUserInfo.setReporterName("Unknown");
                    reportWithUserInfo.setReporterEmail("Unknown");
                    reportWithUserInfo.setReporterProfilePictureUrl(null);
                    reportWithUserInfo.setReporterIsVerified(false);
                }
            } catch (Exception e) {
                reportWithUserInfo.setReporterName("Unknown");
                reportWithUserInfo.setReporterEmail("Unknown");
                reportWithUserInfo.setReporterProfilePictureUrl(null);
                reportWithUserInfo.setReporterIsVerified(false);
            }

            // Enrich reported user info if this is a user report
            if (report.getReportedUserId() != null) {
                try {
                    User reportedUser = userMapper.getUserById(report.getReportedUserId());
                    if (reportedUser != null && reportedUser.getFirebaseUid() != null) {
                        UserRecord reportedRecord = FirebaseAuth.getInstance().getUser(reportedUser.getFirebaseUid());
                        reportWithUserInfo.setReportedUserName(reportedRecord.getDisplayName());
                        reportWithUserInfo.setReportedUserEmail(reportedRecord.getEmail());
                    }
                } catch (Exception e) {
                    reportWithUserInfo.setReportedUserName("Unknown");
                    reportWithUserInfo.setReportedUserEmail("Unknown");
                }
            }

            result.add(reportWithUserInfo);
        }
        return result;
    }

    public List<Map<String, Object>> getListingsWithOwnerInfo() {
        List<Listing> listings = getListings();
        List<Map<String, Object>> result = new ArrayList<>();

        for (Listing listing : listings) {
            Map<String, Object> info = new HashMap<>();
            info.put("listingID", listing.getListingID());
            info.put("userID", listing.getUserID());
            info.put("publicId", listing.getPublicId());
            info.put("title", listing.getTitle());
            info.put("status", listing.getStatus());
            info.put("rent", listing.getRent());
            info.put("street", listing.getStreet());
            info.put("city", listing.getCity());

            try {
                User user = userMapper.getUserById(listing.getUserID());
                if (user != null && user.getFirebaseUid() != null) {
                    UserRecord record = FirebaseAuth.getInstance().getUser(user.getFirebaseUid());
                    info.put("name", record.getDisplayName());
                    info.put("email", record.getEmail());
                } else {
                    info.put("name", "Unknown");
                    info.put("email", "Unknown");
                }
            } catch (Exception e) {
                info.put("name", "Unknown");
                info.put("email", "Unknown");
            }

            result.add(info);
        }

        return result;
    }

}