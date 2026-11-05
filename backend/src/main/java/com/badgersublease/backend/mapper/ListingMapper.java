package com.badgersublease.backend.mapper;

import com.badgersublease.backend.model.Listing;
import com.badgersublease.backend.model.ListingParking;
import com.badgersublease.backend.model.Report;
import com.badgersublease.backend.types.Status;
import org.apache.ibatis.annotations.*;

import java.util.List;
import java.util.Map;

// if running into performance issues, we can switch to XML based mybatis, however this is more
// readable IMO
@Mapper
public interface ListingMapper {

        // GETS

        @Select("SELECT l.ListingID, l.public_id, l.Title, l.Description, l.boosted, l.Street, l.State, l.Zipcode, l.City, l.Rent, l.UserID, l.aptnumber, l.status, l.startdate, l.enddate, l.lat, l.lon, l.amenities, l.bedrooms, l.bathrooms, l.squarefeet, l.roommates, l.listing_type, l.created_at " +
                "FROM Listings l " +
                "WHERE l.UserID = #{userId}")
        @Results({
                @Result(property = "listingID", column = "ListingID"),
                @Result(property = "publicId", column = "public_id"),
                @Result(property = "listingType", column = "listing_type"),
                @Result(property = "createdAt", column = "created_at"),
                @Result(property = "listingImageFileNames", column = "ListingID", javaType = List.class, many = @Many(select = "getListingImageFileNames")),
                @Result(property= "amenities", column = "amenities", javaType = List.class, typeHandler = com.badgersublease.backend.handler.StringListTypeHandler.class),
                @Result(property = "parking", column = "ListingID", javaType = ListingParking.class, one = @One(select = "getListingParkingByListingId"))
        })
        List<Listing> getUserListings(long userId); // MyBatis annotation

        //still called by admin controller
        @Select("SELECT ListingID, public_id, Title, Description, boosted, Street, State, Zipcode, City, Rent, UserID, aptnumber, status, startdate, enddate, lat, lon, amenities, bedrooms, bathrooms, squarefeet, roommates, listing_type, created_at FROM Listings WHERE status != 'COMPLETED'")
        @Results({
                @Result(property = "listingID", column = "ListingID"),
                @Result(property = "publicId", column = "public_id"),
                @Result(property = "listingType", column = "listing_type"),
                @Result(property = "createdAt", column = "created_at"),
                @Result(property = "listingImageFileNames", column = "ListingID", javaType = List.class, many = @Many(select = "getListingImageFileNames")),
                @Result(property= "amenities", column = "amenities", javaType = List.class, typeHandler = com.badgersublease.backend.handler.StringListTypeHandler.class),
                @Result(property = "parking", column = "ListingID", javaType = ListingParking.class, one = @One(select = "getListingParkingByListingId"))
        })
        List<Listing> getListings();

        @Select("SELECT ListingID, public_id, Title, Description, boosted, Street, State, Zipcode, City, Rent, UserID, aptnumber, status, startdate, enddate, lat, lon, amenities, bedrooms, bathrooms, squarefeet, roommates, listing_type, created_at FROM Listings WHERE status != 'COMPLETED' AND status != 'EXPIRED'")
        @Results({
                @Result(property = "listingID", column = "ListingID"),
                @Result(property = "publicId", column = "public_id"),
                @Result(property = "listingType", column = "listing_type"),
                @Result(property = "createdAt", column = "created_at"),
                @Result(property = "listingImageFileNames", column = "ListingID", javaType = List.class, many = @Many(select = "getListingImageFileNames")),
                @Result(property= "amenities", column = "amenities", javaType = List.class, typeHandler = com.badgersublease.backend.handler.StringListTypeHandler.class),
                @Result(property = "parking", column = "ListingID", javaType = ListingParking.class, one = @One(select = "getListingParkingByListingId"))
        })
        List<Listing> getListingsNotExpired();
        
        // SelectProvider allows us to call a Java method to get the SQL instead of using a hardcoded string
        @SelectProvider(type = ListingFilterSqlProvider.class, method = "getFilteredListings")
        @Results({ // map each SQL col to a Java field on Listing object
                @Result(property = "listingID", column = "ListingID"),
                @Result(property = "publicId", column = "public_id"),
                @Result(property = "listingType", column = "listing_type"),
                @Result(property = "createdAt", column = "created_at"),
                @Result(property = "listingImageFileNames", column = "ListingID", javaType = List.class, many = @Many(select = "getListingImageFileNames")),
                @Result(property= "amenities", column = "amenities", javaType = List.class, typeHandler = com.badgersublease.backend.handler.StringListTypeHandler.class),
                @Result(property = "parking", column = "ListingID", javaType = ListingParking.class, one = @One(select = "getListingParkingByListingId")),
                @Result(property = "score", column = "score"),
        })
        List<Listing> getFilteredListings(Map<String, Object> filters);


        @Select("SELECT ListingID, public_id, Title, Description, boosted, Street, State, Zipcode, City, Rent, UserID, aptnumber, status, startdate, enddate, lat, lon, amenities, bedrooms, bathrooms, squarefeet, roommates, listing_type, created_at from Listings where ListingID = #{listingId}")
        @Results({
                @Result(property = "listingID", column = "ListingID"),
                @Result(property = "publicId", column = "public_id"),
                @Result(property = "listingType", column = "listing_type"),
                @Result(property = "createdAt", column = "created_at"),
                @Result(property = "listingImageFileNames", column = "ListingID", javaType = List.class, many = @Many(select = "getListingImageFileNames")),
                @Result(property= "amenities", column = "amenities", javaType = List.class, typeHandler = com.badgersublease.backend.handler.StringListTypeHandler.class),
                @Result(property = "parking", column = "ListingID", javaType = ListingParking.class, one = @One(select = "getListingParkingByListingId"))
        })
        Listing getListingById(long listingId);

        @Select("SELECT FileName " +
                "from ListingPhotos l " +
                "where l.ListingID = #{ListingId} " +
                "ORDER BY ListingPhotosID")
        List<String> getListingImageFileNames(long ListingId);

        // UUID-based lookup methods
        @Select("SELECT ListingID, public_id, Title, Description, boosted, Street, State, Zipcode, City, Rent, UserID, aptnumber, status, startdate, enddate, lat, lon, amenities, bedrooms, bathrooms, squarefeet, roommates, listing_type, created_at from Listings where public_id = #{publicId}")
        @Results({
                @Result(property = "listingID", column = "ListingID"),
                @Result(property = "publicId", column = "public_id"),
                @Result(property = "listingType", column = "listing_type"),
                @Result(property = "createdAt", column = "created_at"),
                @Result(property = "listingImageFileNames", column = "ListingID", javaType = List.class, many = @Many(select = "getListingImageFileNames")),
                @Result(property = "amenities", column = "amenities", javaType = List.class, typeHandler = com.badgersublease.backend.handler.StringListTypeHandler.class),
                @Result(property = "parking", column = "ListingID", javaType = ListingParking.class, one = @One(select = "getListingParkingByListingId"))
        })
        Listing getListingByPublicId(String publicId);

        @Select("SELECT EXISTS(SELECT 1 FROM Listings WHERE public_id = #{publicId})")
        boolean doesListingExistByPublicId(String publicId);

        @Select("SELECT ListingID FROM Listings WHERE public_id = #{publicId}")
        Long getListingIdByPublicId(String publicId);

        @Select("SELECT l.ListingID, l.public_id, l.Title, l.Description, l.boosted, l.Street, l.State, l.Zipcode, l.City, l.Rent, l.UserID, l.aptnumber, l.status, l.startdate, l.enddate, l.lat, l.lon, l.amenities, l.bedrooms, l.bathrooms, l.squarefeet, l.roommates, l.listing_type, l.created_at " +
                "FROM Listings l " +
                "JOIN SavedListings sl ON l.ListingID = sl.ListingID " +
                "JOIN SavedListingLink sll ON sl.SavedListingID = sll.SavedListingID " +
                "WHERE sll.UserID = #{userId} AND l.status != 'COMPLETED' AND l.status != 'EXPIRED'")
        @Results({
                @Result(property = "listingID", column = "ListingID"),
                @Result(property = "publicId", column = "public_id"),
                @Result(property = "listingType", column = "listing_type"),
                @Result(property = "createdAt", column = "created_at"),
                @Result(property = "listingImageFileNames", column = "ListingID", javaType = List.class, many = @Many(select = "getListingImageFileNames")),
                @Result(property= "amenities", column = "amenities", javaType = List.class, typeHandler = com.badgersublease.backend.handler.StringListTypeHandler.class),
                @Result(property = "parking", column = "ListingID", javaType = ListingParking.class, one = @One(select = "getListingParkingByListingId"))
        })
        List<Listing> getAllSavedListings(@Param("userId") long userId);

        @Select("SELECT SavedListingID FROM SavedListings WHERE ListingID = #{listingId}")
        Long getSavedListingId(@Param("listingId") long listingId);

        @Select("SELECT l.ListingID, l.public_id, l.Title, l.Description, l.boosted, l.Street, l.State, l.Zipcode, l.City, l.Rent, l.UserID, l.aptnumber, l.status, l.startdate, l.enddate, l.lat, l.lon, l.amenities, l.bedrooms, l.bathrooms, l.squarefeet, l.roommates, l.listing_type, l.created_at, l.view_count, " +
                "COUNT(DISTINCT sll.UserID) AS save_count " +
                "FROM Listings l " +
                "LEFT JOIN SavedListings sl ON l.ListingID = sl.ListingID " +
                "LEFT JOIN SavedListingLink sll ON sl.SavedListingID = sll.SavedListingID " +
                "WHERE l.status != 'COMPLETED' AND l.status != 'EXPIRED' " +
                "GROUP BY l.ListingID " +
                "ORDER BY (l.view_count * 0.6 + COUNT(DISTINCT sll.UserID) * 0.4) DESC " +
                "LIMIT #{limit}")
        @Results({
                @Result(property = "listingID", column = "ListingID"),
                @Result(property = "publicId", column = "public_id"),
                @Result(property = "listingType", column = "listing_type"),
                @Result(property = "createdAt", column = "created_at"),
                @Result(property = "viewCount", column = "view_count"),
                @Result(property = "listingImageFileNames", column = "ListingID", javaType = List.class, many = @Many(select = "getListingImageFileNames")),
                @Result(property = "amenities", column = "amenities", javaType = List.class, typeHandler = com.badgersublease.backend.handler.StringListTypeHandler.class),
                @Result(property = "parking", column = "ListingID", javaType = ListingParking.class, one = @One(select = "getListingParkingByListingId"))
        })
        List<Listing> getTrendingListings(@Param("limit") int limit);

        @Select("SELECT view_count FROM Listings WHERE ListingID = #{listingId}")
        int getViewCount(@Param("listingId") long listingId);

        // Lightweight projection for sitemap + llms-full: no joins, no image fetching
        @Select("SELECT public_id, title, description, rent, city, state, street, bedrooms, bathrooms, squarefeet, startdate, enddate, listing_type, created_at " +
                "FROM Listings WHERE status != 'COMPLETED' AND status != 'EXPIRED' ORDER BY created_at DESC")
        @Results({
                @Result(property = "publicId", column = "public_id"),
                @Result(property = "listingType", column = "listing_type"),
                @Result(property = "createdAt", column = "created_at"),
                @Result(property = "startDate", column = "startdate"),
                @Result(property = "endDate", column = "enddate"),
                @Result(property = "squareFeet", column = "squarefeet")
        })
        List<Listing> getActiveListingsForSitemap();

        @Select("SELECT COUNT(*) FROM SavedListingLink sll " +
                "JOIN SavedListings sl ON sll.SavedListingID = sl.SavedListingID " +
                "WHERE sl.ListingID = #{listingId}")
        int getSaveCount(@Param("listingId") long listingId);

        // INSERTS

        @Insert("INSERT INTO Listings (public_id, Title, Description, boosted, Street, State, " +
                "Zipcode, City, Rent, UserID, aptnumber, " +
                "status, startdate, enddate, lat, lon, amenities, bedrooms, bathrooms, squarefeet, roommates, listing_type) VALUES (#{publicId}, #{title}, #{description}, " +
                "#{boosted}, #{street}, #{state}, #{zipcode}, #{city}, " +
                "#{rent}, #{userID}, #{aptnumber}, #{status}, #{startDate}, " +
                "#{endDate}, #{lat}, #{lon}, #{amenities, typeHandler=com.badgersublease.backend.handler.StringListTypeHandler}, #{bedrooms}, #{bathrooms}, #{squareFeet}, #{roommates}, #{listingType}) " +
                "RETURNING ListingID")
        // @Options allows us to set ListingID(newly auto generated key) in the passed-in Object(listing 2 lines below)
        @Options(useGeneratedKeys = true, keyProperty = "listingID")
        void addListing(Listing listing);

        @Insert("INSERT INTO ListingPhotos (ListingID, FileName) " +
                "VALUES ( #{listingID}, #{fileName})")
        void addListingPhotos(@Param("listingID") long listingID, @Param("fileName") String fileName);

        @Select("SELECT EXISTS ( " +
                "SELECT 1 FROM SavedListingLink sll " +
                "JOIN SavedListings sl ON sll.SavedListingID = sl.SavedListingID " +
                "WHERE sll.UserID = #{userId} AND sl.ListingID = #{listingId})")
        boolean isListingSaved(@Param("userId") long userId, @Param("listingId") long listingId);

        @Select("SELECT EXISTS (SELECT 1 FROM Listings WHERE ListingID = #{listingId})")
        boolean doesListingExist(@Param("listingId") long listingId);

        @Insert("INSERT INTO SavedListings (ListingID) VALUES (#{listingId})")
        @Options(useGeneratedKeys = true, keyProperty = "SavedListingID")
        void createSavedListing(java.util.Map<String, Object> params);

        @Insert("INSERT INTO SavedListingLink (UserID, SavedListingID) VALUES (#{userId}, #{savedListingId})")
        void createSavedListingLink(@Param("userId") long userId, @Param("savedListingId") long savedListingId);

        // UPDATES

        @Update("UPDATE Listings SET " +
                "Title = #{title}, " +
                "Description = #{description}, " +
                "boosted = #{boosted}, " +
                "Street = #{street}, " +
                "State = #{state}, " +
                "Zipcode = #{zipcode}, " +
                "City = #{city}, " +
                "Rent = #{rent}, " +
                "aptnumber = #{aptnumber}, " +
                "status = #{status}, " +
                "startdate = #{startDate}, " +
                "enddate = #{endDate}, " +
                "lat = #{lat}, " +
                "lon = #{lon}, " +
                "amenities = #{amenities, typeHandler=com.badgersublease.backend.handler.StringListTypeHandler}, " +
                "bedrooms = #{bedrooms}, " +
                "bathrooms = #{bathrooms}, " +
                "squarefeet = #{squareFeet}, " +
                "roommates = #{roommates} " +
                "WHERE ListingID = #{listingID}")
        void updateListing(Listing listing);

        @Update("UPDATE Listings SET view_count = view_count + 1 WHERE ListingID = #{listingId}")
        void incrementViewCount(@Param("listingId") long listingId);

        @Update("UPDATE Listings SET status = #{status} WHERE ListingID = #{listingId}")
        void updateListingStatus(@Param("listingId") long listingId, @Param("status") Status status);

        // deletes
        @Delete(
                "WITH saved_listing_id AS (" +
                "   SELECT sl.SavedListingID" +
                "   FROM SavedListings sl" +
                "   JOIN SavedListingLink sll ON sl.SavedListingID = sll.SavedListingID" +
                "   WHERE sl.ListingID = #{listingId} AND sll.UserID = #{userId}" +
                ")" +
                "   DELETE FROM SavedListings" +
                "   WHERE SavedListingID IN (SELECT SavedListingID FROM saved_listing_id)"
        )
        void unsaveListing(@Param("userId") long userId, @Param("listingId") long listingId);

        @Insert("INSERT INTO deleted_listings " +
                "(original_listing_id, public_id, title, boosted, street, state, zipcode, city, " +
                " rent, aptnumber, status, startdate, enddate, lat, lon, amenities, " +
                " bedrooms, bathrooms, squarefeet, roommates, view_count, created_at, " +
                " parking_type, parking_spots, parking_price, listing_type, deleted_at) " +
                "SELECT l.ListingID, l.public_id, l.Title, l.boosted, l.Street, l.State, l.Zipcode, l.City, " +
                "       l.Rent, l.aptnumber, l.status, l.startdate, l.enddate, l.lat, l.lon, l.amenities, " +
                "       l.bedrooms, l.bathrooms, l.squarefeet, l.roommates, l.view_count, l.created_at, " +
                "       p.ParkingType, p.Spots, p.Price, l.listing_type, NOW() " +
                "FROM Listings l LEFT JOIN ListingParking p ON p.ListingID = l.ListingID " +
                "WHERE l.ListingID = #{listingId}")
        void archiveListing(@Param("listingId") long listingId);

        @Delete("DELETE FROM Listings " +
                "WHERE ListingID = #{listingId}")
        void deleteListing(@Param("listingId") long listingId);

        //int for a delete query returns the number of tuples deleted
        @Delete("DELETE FROM ListingPhotos " +
                "WHERE ListingID = #{listingId} and FileName = #{fileName}")
        int deleteListingPhoto(@Param("listingId") long listingId, @Param("fileName") String fileName);

        // Delete all photos for a listing (used for reordering)
        @Delete("DELETE FROM ListingPhotos WHERE ListingID = #{listingId}")
        void deleteAllListingPhotos(@Param("listingId") long listingId);

        // Delete all saved listing entries for a specific listing (when listing is deleted)
        @Delete("DELETE FROM SavedListingLink WHERE SavedListingID IN " +
                "(SELECT SavedListingID FROM SavedListings WHERE ListingID = #{listingId})")
        void deleteSavedListingLinksByListingId(@Param("listingId") long listingId);

        @Delete("DELETE FROM SavedListings WHERE ListingID = #{listingId}")
        void deleteSavedListingsByListingId(@Param("listingId") long listingId);

        // Delete all of a user's saved listing links (their saved items)
        @Delete("DELETE FROM SavedListingLink WHERE UserID = #{userId}")
        void deleteAllSavedListingLinksByUser(@Param("userId") long userId);

        // Delete all listings by a user
        @Delete("DELETE FROM Listings WHERE UserID = #{userId}")
        void deleteAllListingsByUser(@Param("userId") long userId);

        // Parking
        @Select("SELECT ParkingID, ListingID, ParkingType, Spots, Price, Notes, ImageKey FROM ListingParking WHERE ListingID = #{listingId}")
        @Results({
                @Result(property = "parkingId",   column = "ParkingID"),
                @Result(property = "listingId",   column = "ListingID"),
                @Result(property = "parkingType", column = "ParkingType"),
                @Result(property = "spots",       column = "Spots"),
                @Result(property = "price",       column = "Price"),
                @Result(property = "notes",       column = "Notes"),
                @Result(property = "imageKey",    column = "ImageKey"),
        })
        ListingParking getListingParkingByListingId(@Param("listingId") long listingId);

        @Insert("INSERT INTO ListingParking (ListingID, ParkingType, Spots, Price, Notes, ImageKey) VALUES (#{listingId}, #{parkingType}, #{spots}, #{price}, #{notes}, #{imageKey})")
        @Options(useGeneratedKeys = true, keyProperty = "parkingId")
        void addListingParking(ListingParking parking);

        @Update("UPDATE ListingParking SET ParkingType = #{parkingType}, Spots = #{spots}, Price = #{price}, Notes = #{notes}, ImageKey = #{imageKey} WHERE ListingID = #{listingId}")
        void updateListingParking(ListingParking parking);

        @Delete("DELETE FROM ListingParking WHERE ListingID = #{listingId}")
        void deleteListingParking(@Param("listingId") long listingId);

        // Reports
        @Insert("INSERT INTO Reports (UserId, ListingID, ReportMessage, Reason) " +
                "VALUES (#{userId}, #{internalListingId}, #{reportMessage}, #{reason})")
        void insertReport(Report report);

        @Select("SELECT r.ReportId, r.UserId, r.ListingID, r.ReportedUserID, r.ReportMessage, r.Reason, l.public_id " +
                "FROM Reports r LEFT JOIN Listings l ON r.ListingID = l.ListingID")
        @Results({
                @Result(property = "reportId", column = "ReportId"),
                @Result(property = "userId", column = "UserId"),
                @Result(property = "internalListingId", column = "ListingID"),
                @Result(property = "reportedUserId", column = "ReportedUserID"),
                @Result(property = "reportMessage", column = "ReportMessage"),
                @Result(property = "reason", column = "Reason"),
                @Result(property = "listingId", column = "public_id")
        })
        List<Report> getAllReports();

        @Select("SELECT r.ReportId, r.UserId, r.ListingID, r.ReportMessage, r.Reason, l.public_id " +
                "FROM Reports r JOIN Listings l ON r.ListingID = l.ListingID " +
                "WHERE r.ListingID = #{listingId}")
        @Results({
                @Result(property = "reportId", column = "ReportId"),
                @Result(property = "userId", column = "UserId"),
                @Result(property = "internalListingId", column = "ListingID"),
                @Result(property = "reportMessage", column = "ReportMessage"),
                @Result(property = "reason", column = "Reason"),
                @Result(property = "listingId", column = "public_id")
        })
        List<Report> getReportsByListingId(@Param("listingId") long listingId);
}
