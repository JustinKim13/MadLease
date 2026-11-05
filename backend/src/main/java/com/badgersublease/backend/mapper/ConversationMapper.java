package com.badgersublease.backend.mapper;

import com.badgersublease.backend.model.Conversation;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface ConversationMapper {

    @Select("SELECT c.*, " +
            "l.title as listingTitle, " +
            "l.public_id as listingPublicId, " +
            "(SELECT content FROM Messages m WHERE m.ConversationID = c.ConversationID ORDER BY m.SentAt DESC LIMIT 1) as lastMessageContent, " +
            "(SELECT sentAt FROM Messages m WHERE m.ConversationID = c.ConversationID ORDER BY m.SentAt DESC LIMIT 1) as lastMessageTime, " +
            "(SELECT COUNT(*) FROM Messages m WHERE m.ConversationID = c.ConversationID AND m.SenderID != #{userId} AND m.IsRead = false) as unreadCount " +
            "FROM Conversations c " +
            "JOIN Listings l ON c.ListingID = l.ListingID " +
            "WHERE (c.RequesterID = #{userId} OR c.ListerID = #{userId}) " +
            "AND NOT EXISTS (SELECT 1 FROM DeletedConversations dc WHERE dc.ConversationID = c.ConversationID AND dc.UserID = #{userId}) " +
            "ORDER BY c.UpdatedAt DESC")
    List<Conversation> getUserConversations(@Param("userId") Long userId);

    @Select("SELECT * FROM Conversations WHERE ConversationID = #{conversationId}")
    Conversation getConversationById(@Param("conversationId") Long conversationId);

    @Select("SELECT * FROM Conversations WHERE ListingID = #{listingId} AND RequesterID = #{requesterId}")
    Conversation getConversationByListingAndRequester(@Param("listingId") Long listingId, @Param("requesterId") Long requesterId);

    @Insert("INSERT INTO Conversations (ListingID, RequesterID, ListerID) VALUES (#{listingID}, #{requesterID}, #{listerID})")
    @Options(useGeneratedKeys = true, keyProperty = "conversationID")
    void createConversation(Conversation conversation);

    @Update("UPDATE Conversations SET UpdatedAt = NOW() WHERE ConversationID = #{conversationId}")
    void updateConversationTime(@Param("conversationId") Long conversationId);

    @Insert("INSERT INTO DeletedConversations (ConversationID, UserID) VALUES (#{conversationId}, #{userId})")
    void deleteConversationForUser(@Param("conversationId") Long conversationId, @Param("userId") Long userId);

    @Delete("DELETE FROM DeletedConversations WHERE ConversationID = #{conversationId}")
    void undeleteConversation(@Param("conversationId") Long conversationId);

    // Delete all DeletedConversations records for a user (cleanup before deleting conversations)
    @Delete("DELETE FROM DeletedConversations WHERE UserID = #{userId}")
    void deleteDeletedConversationsForUser(@Param("userId") Long userId);

    // Delete all DeletedConversations records for conversations involving a user
    @Delete("DELETE FROM DeletedConversations WHERE ConversationID IN " +
            "(SELECT ConversationID FROM Conversations WHERE RequesterID = #{userId} OR ListerID = #{userId})")
    void deleteDeletedConversationsForUserConversations(@Param("userId") Long userId);

    // Delete all conversations where user is requester or lister
    @Delete("DELETE FROM Conversations WHERE RequesterID = #{userId} OR ListerID = #{userId}")
    void deleteConversationsForUser(@Param("userId") Long userId);
} 