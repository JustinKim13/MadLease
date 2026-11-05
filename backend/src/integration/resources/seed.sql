CREATE TABLE Users (
    UserID SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(255) UNIQUE,
    is_verified BOOLEAN DEFAULT FALSE
);

CREATE TABLE Listings (
    ListingID SERIAL PRIMARY KEY,
    public_id VARCHAR(12) UNIQUE NOT NULL DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8),
    Title VARCHAR(100),
    Description VARCHAR(750),
    boosted BOOLEAN,
    Street VARCHAR(255),
    State VARCHAR(100),
    Zipcode INT,
    City VARCHAR(100),
    Rent INT,
    UserID INT REFERENCES Users(UserID) ON DELETE SET NULL ,
    aptnumber INT,
    status VARCHAR(10) CHECK (status IN ('AVAILABLE', 'PENDING', 'COMPLETED', 'EXPIRED')),
    startdate DATE,
    enddate DATE,
    lat Decimal(8,6),
    lon Decimal(9,6),
    amenities TEXT [],
    bedrooms INT,
    bathrooms INT,
    squarefeet INT,
    roommates INT DEFAULT 0,
    view_count INT DEFAULT 0,
    listing_type VARCHAR(10) NOT NULL DEFAULT 'HOUSING'
        CHECK (listing_type IN ('HOUSING', 'PARKING', 'BOTH')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Listings: lookup by owner
-- Queries: getUserListings, deleteAllListingsByUser
CREATE INDEX IF NOT EXISTS idx_listings_userid ON Listings(UserID);

-- Listings: lookup by type for parking-only vs housing browse filters
CREATE INDEX IF NOT EXISTS idx_listings_type ON Listings(listing_type);

CREATE TABLE ListingPhotos (
    ListingPhotosID SERIAL PRIMARY KEY,
    ListingID INT REFERENCES Listings(ListingID) ON DELETE CASCADE,
    FileName VARCHAR(255)
);

-- ListingPhotos: lookup by listing (called per listing due to N+1 pattern)
-- Queries: getListingImageFileNames, photo deletes, CASCADE from Listings
CREATE INDEX IF NOT EXISTS idx_listingphotos_listingid ON ListingPhotos(ListingID);

CREATE TABLE ListingParking(
    ParkingID SERIAL PRIMARY KEY,
    ListingID INT UNIQUE NOT NULL REFERENCES Listings(ListingID) ON DELETE CASCADE,
    ParkingType VARCHAR(50) NOT NULL CHECK (ParkingType IN ('COVERED_GARAGE', 'SURFACE_LOT', 'STREET', 'DRIVEWAY')),
    Spots INT NOT NULL DEFAULT 1,
    Price INT NOT NULL DEFAULT 0,
    NOTES VARCHAR(500),
    ImageKey VARCHAR(500)
);

CREATE INDEX idx_listingparking_listingid on ListingParking(ListingID);

CREATE TABLE deleted_listings (
    deleted_listing_id  SERIAL PRIMARY KEY,
    original_listing_id INT            NOT NULL,
    public_id           VARCHAR(12),
    title               VARCHAR(100),
    boosted             BOOLEAN,
    street              VARCHAR(255),
    state               VARCHAR(100),
    zipcode             INT,
    city                VARCHAR(100),
    rent                INT,
    aptnumber           INT,
    status              VARCHAR(10),
    startdate           DATE,
    enddate             DATE,
    lat                 DECIMAL(8,6),
    lon                 DECIMAL(9,6),
    amenities           TEXT[],
    bedrooms            INT,
    bathrooms           INT,
    squarefeet          INT,
    roommates           INT,
    view_count          INT,
    created_at          TIMESTAMP,
    parking_type        VARCHAR(50),
    parking_spots       INT,
    parking_price       INT,
    listing_type        VARCHAR(10),
    deleted_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE SavedListings(
    SavedListingID SERIAL PRIMARY KEY,
    ListingID INT REFERENCES Listings(ListingID) ON DELETE CASCADE
);

-- SavedListings: lookup by listing
-- Queries: getSavedListingId, getAllSavedListings join, deletes, CASCADE from Listings
CREATE INDEX IF NOT EXISTS idx_savedlistings_listingid ON SavedListings(ListingID);

CREATE TABLE SavedListingLink(
    SavedListingLinkID SERIAL PRIMARY KEY,
    UserID INT REFERENCES Users(UserID) ON DELETE CASCADE ,
    SavedListingID INT REFERENCES SavedListings(SavedListingID) ON DELETE CASCADE
);

-- SavedListingLink: lookup by user and by saved listing
-- Queries: getAllSavedListings, isListingSaved, unsaveListing, deletes, CASCADE
CREATE INDEX IF NOT EXISTS idx_savedlistinglink_userid ON SavedListingLink(UserID);
CREATE INDEX IF NOT EXISTS idx_savedlistinglink_savedlistingid ON SavedListingLink(SavedListingID);

-- Messaging tables
CREATE TABLE Conversations (
    ConversationID SERIAL PRIMARY KEY,
    ListingID INT REFERENCES Listings(ListingID) ON DELETE CASCADE,
    RequesterID INT REFERENCES Users(UserID) ON DELETE CASCADE,
    ListerID INT REFERENCES Users(UserID) ON DELETE CASCADE,
    CreatedAt TIMESTAMP DEFAULT NOW(),
    UpdatedAt TIMESTAMP DEFAULT NOW(),
    UNIQUE(ListingID, RequesterID) -- One conversation per listing per requester
);

-- Conversations: lookup by requester and lister independently
-- Queries: getUserConversations (OR clause), deleteConversationsForUser
-- NOTE: UNIQUE(ListingID, RequesterID) does NOT cover standalone RequesterID lookups
CREATE INDEX IF NOT EXISTS idx_conversations_requesterid ON Conversations(RequesterID);
CREATE INDEX IF NOT EXISTS idx_conversations_listerid ON Conversations(ListerID);

CREATE TABLE Messages (
    MessageID SERIAL PRIMARY KEY,
    ConversationID INT REFERENCES Conversations(ConversationID) ON DELETE CASCADE,
    SenderID INT REFERENCES Users(UserID) ON DELETE CASCADE,
    Content TEXT NOT NULL,
    SentAt TIMESTAMP DEFAULT NOW(),
    IsRead BOOLEAN DEFAULT FALSE,
    notification_sent BOOLEAN DEFAULT FALSE,
    reminder_sent BOOLEAN DEFAULT FALSE
);

-- Messages: composite index for message history sorted by time
-- Queries: getMessagesByConversation (ORDER BY SentAt), getUserConversations subqueries,
--          markMessagesAsRead. B-tree supports both ASC and DESC scans.
CREATE INDEX IF NOT EXISTS idx_messages_conversation_sentat ON Messages(ConversationID, SentAt);

-- Messages: partial index for unread count optimization
-- Targets: SELECT COUNT(*) ... WHERE ConversationID = ? AND SenderID != ? AND IsRead = false
-- Only indexes unread messages, stays compact as messages are read.
CREATE INDEX IF NOT EXISTS idx_messages_unread ON Messages(ConversationID, SenderID) WHERE IsRead = false;

-- Table to track which users have deleted conversations from their view
CREATE TABLE DeletedConversations (
    DeletedConversationID SERIAL PRIMARY KEY,
    ConversationID INT REFERENCES Conversations(ConversationID) ON DELETE CASCADE,
    UserID INT REFERENCES Users(UserID) ON DELETE CASCADE,
    DeletedAt TIMESTAMP DEFAULT NOW(),
    UNIQUE(ConversationID, UserID) -- One deletion record per conversation per user
);

-- Emails that have opted out of promotional/campaign sends (not transactional emails)
CREATE TABLE EmailOptOuts (
    Email VARCHAR(255) PRIMARY KEY,
    OptedOutAt TIMESTAMP DEFAULT NOW()
);

-- Tracks when a one-off promotional campaign was last triggered, so a double-click/retry
-- on the admin trigger doesn't re-send to every user within the same hour
CREATE TABLE CampaignSends (
    CampaignKey VARCHAR(255) PRIMARY KEY,
    LastSentAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE Reports(
    ReportId SERIAL PRIMARY KEY,
    UserId INT REFERENCES  Users(UserID) ON DELETE CASCADE,
    ListingID INT REFERENCES Listings(ListingID) ON DELETE CASCADE,
    ReportedUserID INT REFERENCES Users(UserID) ON DELETE CASCADE,
    ReportMessage TEXT,
    Reason TEXT NOT NULL
);

CREATE TABLE BlockedUsers(
    BlockedUserID SERIAL PRIMARY KEY,
      BlockerID INT NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
      BlockedID INT NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
      CreatedAt TIMESTAMP DEFAULT NOW(),
      UNIQUE(BlockerID, BlockedID),
      CHECK (BlockerID <> BlockedID)
  );
  CREATE INDEX IF NOT EXISTS idx_blockedusers_blocker ON BlockedUsers(BlockerID);
  CREATE INDEX IF NOT EXISTS idx_blockedusers_blocked ON BlockedUsers(BlockedID);
-- Popup types
create table popup_types(
    popup_id SERIAL PRIMARY KEY,
    popup_purpose TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
-- user interactions with popups
CREATE TABLE popup_interactions(
    popup_interactions_id SERIAL PRIMARY KEY,
    UserID INT REFERENCES Users(UserID) ON DELETE SET NULL NULL,
    popup_id INT REFERENCES popup_types(popup_id),
    interaction_type VARCHAR(50) NOT NULL CHECK (interaction_type IN ('NOT_VIEWED', 'VIEWED', 'SUBMIT', 'DONT_SHOW_AGAIN')) default 'NOT_VIEWED',
    created_at TIMESTAMP DEFAULT NOW()
);

-- feedback from users, allow for null so we can get anonymous feedback
CREATE TABLE feedback(
    feedback_id SERIAL PRIMARY KEY,
    UserID INT REFERENCES Users(UserID) ON DELETE SET NULL NULL,
    feedback_type VARCHAR(50) NOT NULL CHECK (feedback_type IN ('LIKE', 'DISLIKE', 'OTHER')),
    feedback_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO popup_types(popup_purpose) VALUES
    ('SITE_FEEDBACK');

INSERT INTO Users (firebase_uid) VALUES
                                      ('kHe0A9jQwggfjos5cuPYML7Dd533'),  -- Your real Firebase UID
                                      ('test-firebase-uid-user-2'),       -- Test user 2
                                      ('test-firebase-uid-user-3'),       -- Test user 3
                                      ('test-firebase-uid-user-4'),       -- Test user 4
                                      ('test-firebase-uid-user-5'),       -- Test user 5
                                      ('test-firebase-uid-user-6'),       -- Test user 6
                                      ('test-firebase-uid-user-7');       -- Test user 7 (notification test)

-- Insert sample data into Listings table (6 listings: 5 active, 1 expired)
INSERT INTO Listings (
    Title, Description, boosted, Street, State, Zipcode, City, Rent, UserID, aptnumber,
    status, startdate, enddate, lat, lon, amenities, bedrooms, bathrooms, squarefeet, roommates, view_count
) VALUES
      (
          'La Ciel Apartments',
          'Bright studio next to State Street on Johnson St.',
          false,
          '420 W Johnson St', 'WI', 53703, 'Madison',
          1800, 1, 101,
          'AVAILABLE', '2025-08-01', '2026-07-31',
          43.073108, -89.392326,
          '{Furnished, Pool}',
          1, 1, 600, 0, 42
      ),

      (
          'Chapter Madison',
          'Modern apartments with bespoke amenities just moments from campus.',
          true,
          '620 University Ave', 'WI', 53703, 'Madison',
          2400, 2, 202,
          'PENDING', '2025-09-01', '2026-08-31',
          43.073537, -89.396825,
          '{Gym, Wifi}',
          2, 2, 900, 1, 87
      ),

      (
          'VERVE Madison',
          'Fully furnished student community two blocks from campus with rooftop pool.',
          false,
          '300 State St', 'WI', 53703, 'Madison',
          2000, 3, 303,
          'AVAILABLE', '2025-08-15', '2026-07-15',
          43.074845, -89.389967,
          '{Sauna, RooftopPool}',
          1, 1, 750, 2, 63
      ),

      (
          'ōLiv Madison',
          'Luxury apartments with high-end finishes and community lounges.',
          false,
          '330 N Frances St', 'WI', 53703, 'Madison',
          2200, 4, 404,
          'EXPIRED', '2025-07-01', '2025-12-31',
          43.072110, -89.395994,
          '{CoffeeBar, FitnessCenter}',
          2, 1, 850, 1, 31
      ),

      (
          'The James',
          'Premier student housing with private bedrooms and modern amenities.',
          true,
          '323 W Johnson St', 'WI', 53703, 'Madison',
          1900, 5, 505,
          'AVAILABLE', '2025-08-01', '2026-05-31',
          43.071950, -89.397596,
          '{StudyLounge, GameRoom}',
          3, 2, 1200, 3, 119
      ),

      (
          'Langdon Street Lofts',
          'Renovated loft-style unit a short walk from Bascom Hill.',
          false,
          '210 Langdon St', 'WI', 53703, 'Madison',
          1650, 1, 210,
          'AVAILABLE', '2025-08-20', '2026-08-15',
          43.074500, -89.393500,
          '{Balcony, Dishwasher}',
          2, 1, 800, 1, 24
      );

-- Notification test data:
-- Conversation between user 7 (requester) and user 5 (lister) on The James (listing 5)
-- User 5's reply (2 hours ago, unread, not notified) should trigger an email to user 7
INSERT INTO Conversations (ListingID, RequesterID, ListerID) VALUES (5, 7, 5);

INSERT INTO Messages (ConversationID, SenderID, Content, SentAt, IsRead, notification_sent) VALUES
    (1, 7, 'Hi, is The James still available for next fall?', NOW() - INTERVAL '3 hours', true, false),
    (1, 5, 'Yes it is! Let me know if you have any questions.', NOW() - INTERVAL '2 hours', false, false);

-- Seed saves so trending score (views * 0.6 + saves * 0.4) has variety
INSERT INTO SavedListings (ListingID) VALUES (1), (2), (3), (4), (5);

INSERT INTO SavedListingLink (UserID, SavedListingID) VALUES
    (2, 1), (3, 1), (4, 1),        -- La Ciel: 3 saves
    (2, 2), (3, 2), (4, 2), (5, 2),-- Chapter: 4 saves
    (2, 3), (3, 3),                 -- VERVE: 2 saves
    (2, 4),                         -- ōLiv: 1 save
    (2, 5), (3, 5), (4, 5), (5, 5), (6, 5); -- The James: 5 saves

-- Insert sample data into ListingPhotos table (photos for different listings)
INSERT INTO ListingPhotos (ListingID, fileName) VALUES
                                                    (1, 'la_ciel_main_image.jpg'),
                                                    (1, 'la_ciel_kitchen.webp'),
                                                    (1, 'la_ciel_living_room.jpg'),
                                                    (2, 'chapter_living_room.jpg'),
                                                    (2, 'chapter_lobby.jpg'),
                                                    (2, 'chapter_main_image.jpg'),
                                                    (3, 'verve_main_image.jpg'),
                                                    (3, 'verve_gym.jpeg'),
                                                    (3, 'verve_rooftop.jpeg'),
                                                    (4, 'oliv_main_image.jpg'),
                                                    (4, 'oliv_lobby.jpg'),
                                                    (4, 'oliv_rooftop.jpg'),
                                                    (5, 'the_james_kitchen.jpg'),
                                                    (5, 'the_james_living_room.webp'),
                                                    (5, 'the_james_main_image.jpg')
                                                    ;
