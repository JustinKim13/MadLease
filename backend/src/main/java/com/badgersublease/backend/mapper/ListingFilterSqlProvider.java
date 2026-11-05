package com.badgersublease.backend.mapper;
import org.apache.ibatis.jdbc.SQL; // ibatis is the same is mybatis
import java.util.*;

public class ListingFilterSqlProvider {

    // whitelist of valid amenities to prevent SQL injection
    // must match the amenity names used in CreateListing.jsx / EditListings.jsx
    private static final Set<String> VALID_AMENITIES = Set.of(
        "In-unit laundry", "Central A/C", "Balcony", "Dishwasher",
        "Wifi", "Furnished", "Parking available", "Gym"
    );
    // right now uses close to state street for lat/long score, but we can change to center of map later

    public static String getFilteredListings(Map<String, Object> filters) {
        return new SQL() {{
            SELECT("ListingID, public_id, Title, Description, boosted, Street, State, Zipcode, " +
                   "City, Rent, UserID, aptnumber, status, startdate, enddate, lat, lon, " +
                   "amenities, bedrooms, bathrooms, squarefeet, roommates, created_at, listing_type, " +
                   "CASE when rent is null or lat is null or lon is null then 0 " +
                   "else 0.75 * percent_rank() over(order by rent desc) + " +
                   " 0.45 * percent_rank() over(order by(" +
                   " abs(lat - 43.07314) + abs(lon + 89.39661)" +
                   ") desc) " + 
                   "end as score ");
            FROM("Listings");

            //get listings that arent completed or expired
            WHERE("status != 'COMPLETED'");
            WHERE("status != 'EXPIRED'");

            // Frontend filter tabs: ALL | HOUSING | PARKING | BOTH.
            // Semantics:
            // - ALL: no type filter
            // - HOUSING: housing listings (includes BOTH)
            // - PARKING: parking-only listings
            // - BOTH: combo listings (housing + parking)
            //
            // Users who want housing-with-parking can use the "parkingIncluded" filter
            // (EXISTS ListingParking) or the "Parking available" amenity.
            String listingType = (String) filters.getOrDefault("listingType", "ALL");
            switch (listingType) {
                case "HOUSING" -> WHERE("listing_type IN ('HOUSING','BOTH')");
                case "PARKING" -> WHERE("listing_type = 'PARKING'");
                case "BOTH"    -> WHERE("listing_type = 'BOTH'");
                default        -> { /* ALL — no type filter */ }
            }

            if (filters.containsKey("minRent")) {
                WHERE("Rent >= #{minRent}");
            }
            if (filters.containsKey("maxRent")) {
                WHERE("Rent <= #{maxRent}");
            }

            if (filters.containsKey("bedrooms")) {
                WHERE("bedrooms = #{bedrooms}");
            }

            if (filters.containsKey("parkingIncluded") && Boolean.TRUE.equals(filters.get("parkingIncluded"))) {
                WHERE("EXISTS (SELECT 1 FROM ListingParking WHERE ListingParking.ListingID = Listings.ListingID)");              
            }                         

            if (filters.containsKey("roommates")) {
                int roommates = (int) filters.get("roommates");
                if (roommates >= 4) {
                    WHERE("roommates >= 4");
                } else {
                    WHERE("roommates = #{roommates}");
                }
            }

            // Date filtering: listing's availability window must overlap with the user's desired range
            if (filters.containsKey("startDate") && filters.containsKey("endDate")) {
                // Both dates: listing must fully encompass the desired range
                WHERE("startdate <= #{startDate}::date");
                WHERE("enddate >= #{endDate}::date");
            } else if (filters.containsKey("startDate")) {
                // Only "from" date: listing must not have ended before user's start
                WHERE("enddate >= #{startDate}::date");
            } else if (filters.containsKey("endDate")) {
                // Only "to" date: listing must have started by user's end
                WHERE("startdate <= #{endDate}::date");
            }

            // amenities use PostgreSQL array containment operator @>
            // we build the ARRAY literal manually and validate against whitelist to prevent injection
            if (filters.containsKey("amenities")) {
                @SuppressWarnings("unchecked")
                List<String> amenities = (List<String>) filters.get("amenities");
                List<String> safeAmenities = new ArrayList<>();
                for (String a : amenities) {
                    if (VALID_AMENITIES.contains(a)) {
                        safeAmenities.add("'" + a + "'");
                    }
                }
                if (!safeAmenities.isEmpty()) {
                    WHERE("amenities @> ARRAY[" + String.join(",", safeAmenities) + "]::text[]");
                }
            }

            //get listings 
            // sort by ListingID DESC so newest listings come first within same boost level
            ORDER_BY("boosted DESC, ListingID DESC");
        }}.toString();
    }
}
