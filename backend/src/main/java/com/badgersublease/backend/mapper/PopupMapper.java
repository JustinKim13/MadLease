package com.badgersublease.backend.mapper;

import com.badgersublease.backend.model.Feedback;
import com.badgersublease.backend.model.PopupInteraction;
import com.badgersublease.backend.model.PopupType;
import org.apache.ibatis.annotations.*;

@Mapper
public interface PopupMapper {

    //see if user can get a feedback popup
    @Select("SELECT popup_id, popup_purpose, created_at " +
            "FROM popup_types " +
            "WHERE popup_purpose = 'SITE_FEEDBACK' " +
            " AND popup_id NOT IN (" +
            "  SELECT popup_id FROM popup_interactions " +
            "  WHERE UserID = #{userId} " +
            "  AND interaction_type IN ('SUBMIT','DONT_SHOW_AGAIN')" +
            ")")
    @Results({
            @Result(property = "popupId", column = "popup_id"),
            @Result(property = "popupPurpose", column = "popup_purpose"),
            @Result(property = "createdAt", column = "created_at")
    })
    PopupType findFeedbackPopupForUser(@Param("userId") Long userId);

    @Select("SELECT popup_id, popup_purpose, created_at from popup_types " +
        " where popup_purpose = 'SITE_FEEDBACK'")    
    @Results({
            @Result(property = "popupId", column = "popup_id"),
            @Result(property = "popupPurpose", column = "popup_purpose"),
            @Result(property = "createdAt", column = "created_at")
        })
    PopupType returnFeedbackPopupForAnon();

    @Select("SELECT popup_id, popup_purpose, created_at " +
            "FROM popup_types WHERE popup_id = #{popupId}")
    @Results({
            @Result(property = "popupId", column = "popup_id"),
            @Result(property = "popupPurpose", column = "popup_purpose"),
            @Result(property = "createdAt", column = "created_at")
    })
    PopupType findPopupById(@Param("popupId") int popupId);

    @Insert("INSERT INTO popup_interactions (UserID, popup_id, interaction_type) " +
            "VALUES (#{userId}, #{popupId}, #{interactionType})")
    @Options(useGeneratedKeys = true, keyProperty = "popupInteractionsId", keyColumn = "popup_interactions_id")
    void insertInteraction(PopupInteraction interaction);

    @Insert("INSERT INTO feedback (UserID, feedback_type, feedback_message) " +
            "VALUES (#{userId}, #{feedbackType}, #{feedbackMessage})")
    @Options(useGeneratedKeys = true, keyProperty = "feedbackId", keyColumn = "feedback_id")
    void insertFeedback(Feedback feedback);
}
