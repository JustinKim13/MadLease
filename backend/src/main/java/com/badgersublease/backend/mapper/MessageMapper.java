package com.badgersublease.backend.mapper;

import com.badgersublease.backend.model.Message;
import com.badgersublease.backend.model.UnreadNotification;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface MessageMapper {

    @Select("SELECT m.* " +
            "FROM Messages m " +
            "WHERE m.ConversationID = #{conversationId} " +
            "ORDER BY m.SentAt ASC")
    List<Message> getMessagesByConversation(@Param("conversationId") Long conversationId);

    @Insert("INSERT INTO Messages (ConversationID, SenderID, Content) VALUES (#{conversationID}, #{senderID}, #{content})")
    @Options(useGeneratedKeys = true, keyProperty = "messageID")
    void createMessage(Message message);

    @Update("UPDATE Messages SET IsRead = true WHERE ConversationID = #{conversationId} AND SenderID != #{userId}")
    void markMessagesAsRead(@Param("conversationId") Long conversationId, @Param("userId") Long userId);

    // Delete all messages in conversations involving a user
    @Delete("DELETE FROM Messages WHERE ConversationID IN " +
            "(SELECT ConversationID FROM Conversations WHERE RequesterID = #{userId} OR ListerID = #{userId})")
    void deleteMessagesForUser(@Param("userId") Long userId);

    @Select("SELECT (array_agg(m.Content ORDER BY m.SentAt DESC))[1] as content, " +
            "m.SenderID, MAX(m.SentAt) as sentAt, COUNT(*) as messageCount, " +
            "c.ConversationID, c.RequesterID, c.ListerID, " +
            "l.Title as listingTitle, l.public_id as listingPublicId " +
            "FROM Messages m " +
            "JOIN Conversations c ON m.ConversationID = c.ConversationID " +
            "JOIN Listings l ON c.ListingID = l.ListingID " +
            "WHERE m.IsRead = false " +
            "AND m.notification_sent = false " +
            "AND m.SentAt < NOW() - INTERVAL '1 hour' " +
            "GROUP BY m.ConversationID, m.SenderID, c.ConversationID, c.RequesterID, c.ListerID, l.Title, l.public_id")
    @Results({
            @Result(property = "content", column = "content"),
            @Result(property = "senderID", column = "SenderID"),
            @Result(property = "sentAt", column = "sentAt"),
            @Result(property = "messageCount", column = "messageCount"),
            @Result(property = "conversationID", column = "ConversationID"),
            @Result(property = "requesterID", column = "RequesterID"),
            @Result(property = "listerID", column = "ListerID"),
            @Result(property = "listingTitle", column = "listingTitle"),
            @Result(property = "listingPublicId", column = "listingPublicId")
    })
    List<UnreadNotification> getMessagesEligibleForNotification();

    @Update("UPDATE Messages SET notification_sent = true " +
            "WHERE ConversationID = #{conversationId} AND SenderID = #{senderId} " +
            "AND IsRead = false AND notification_sent = false")
    void markConversationNotificationsSent(@Param("conversationId") Long conversationId, @Param("senderId") Long senderId);

    @Select("SELECT (array_agg(m.Content ORDER BY m.SentAt DESC))[1] as content, " +
            "m.SenderID, MAX(m.SentAt) as sentAt, COUNT(*) as messageCount, " +
            "c.ConversationID, c.RequesterID, c.ListerID, " +
            "l.Title as listingTitle, l.public_id as listingPublicId " +
            "FROM Messages m " +
            "JOIN Conversations c ON m.ConversationID = c.ConversationID " +
            "JOIN Listings l ON c.ListingID = l.ListingID " +
            "WHERE m.IsRead = false " +
            "AND m.notification_sent = true " +
            "AND m.reminder_sent = false " +
            "AND m.SentAt < NOW() - INTERVAL '3 days' " +
            "GROUP BY m.ConversationID, m.SenderID, c.ConversationID, c.RequesterID, c.ListerID, l.Title, l.public_id")
    @Results({
            @Result(property = "content", column = "content"),
            @Result(property = "senderID", column = "SenderID"),
            @Result(property = "sentAt", column = "sentAt"),
            @Result(property = "messageCount", column = "messageCount"),
            @Result(property = "conversationID", column = "ConversationID"),
            @Result(property = "requesterID", column = "RequesterID"),
            @Result(property = "listerID", column = "ListerID"),
            @Result(property = "listingTitle", column = "listingTitle"),
            @Result(property = "listingPublicId", column = "listingPublicId")
    })
    List<UnreadNotification> getMessagesEligibleForReminder();

    @Update("UPDATE Messages SET reminder_sent = true " +
            "WHERE ConversationID = #{conversationId} AND SenderID = #{senderId} " +
            "AND IsRead = false AND reminder_sent = false")
    void markConversationRemindersSent(@Param("conversationId") Long conversationId, @Param("senderId") Long senderId);
}