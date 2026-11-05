package com.badgersublease.backend.service;

import com.badgersublease.backend.exceptions.BadRequestException;
import com.badgersublease.backend.mapper.PopupMapper;
import com.badgersublease.backend.model.Feedback;
import com.badgersublease.backend.model.PopupInteraction;
import com.badgersublease.backend.model.PopupInteractionRequest;
import com.badgersublease.backend.model.PopupType;
import com.badgersublease.backend.model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.HtmlUtils;

import java.util.Set;

@Service
public class PopupService {

    private static final Set<String> ALLOWED_INTERACTIONS =
            Set.of("VIEWED", "SUBMIT", "DONT_SHOW_AGAIN");
    private static final Set<String> ALLOWED_FEEDBACK_TYPES =
            Set.of("LIKE", "DISLIKE", "OTHER");
    private static final String SITE_FEEDBACK = "SITE_FEEDBACK";

    private final PopupMapper popupMapper;
    private final UserService userService;

    @Autowired
    public PopupService(PopupMapper popupMapper, UserService userService) {
        this.popupMapper = popupMapper;
        this.userService = userService;
    }

    public PopupType getFeedbackPopup(String authHeader) {
        Long userId = resolveUserId(authHeader);
        if (userId != null) {
            PopupType popup = popupMapper.findFeedbackPopupForUser(userId);
            if (popup != null) {
                return popup;
            }
            else{
                return null;
            }
        }
        
        return popupMapper.returnFeedbackPopupForAnon();
    }

    @Transactional
    public void recordInteraction(int popupId, PopupInteractionRequest req, String authHeader) {
        if (req == null || req.getInteractionType() == null) {
            throw new BadRequestException("interactionType is required");
        }
        String interactionType = req.getInteractionType().toUpperCase();
        if (!ALLOWED_INTERACTIONS.contains(interactionType)) {
            throw new BadRequestException("Invalid interactionType: " + req.getInteractionType());
        }
        
        PopupType popup = popupMapper.findPopupById(popupId);
        if (popup == null) {
            throw new BadRequestException("Popup not found: " + popupId);
        }

        Long userId = resolveUserId(authHeader);
        //only insert interaction if user is logged in, non logged in users are anonymous and cant mark interactions
        if(userId != null){
            PopupInteraction interaction = new PopupInteraction();
            interaction.setUserId(userId);
            interaction.setPopupId(popupId);
            interaction.setInteractionType(interactionType);
            popupMapper.insertInteraction(interaction);
        }
        //allow for feedback without text as well, but must have a type
        if ("SUBMIT".equals(interactionType)
                && SITE_FEEDBACK.equals(popup.getPopupPurpose())
                && req.getFeedback().getFeedbackType() != null
                && (req.getFeedback().getFeedbackMessage() != null || !"OTHER".equals(req.getFeedback().getFeedbackType().toUpperCase()))) {
            
            insertFeedback(req.getFeedback(), userId);
        }
    }

    private void insertFeedback(Feedback feedback, Long userId) {
        String feedbackType = feedback.getFeedbackType().toUpperCase();
        if (!ALLOWED_FEEDBACK_TYPES.contains(feedbackType)) {
            throw new BadRequestException("Invalid feedbackType: " + feedback.getFeedbackType());
        }
        feedback.setFeedbackType(feedbackType);
        feedback.setUserId(userId);
        feedback.setFeedbackMessage(sanitizeMessage(feedback.getFeedbackMessage()));
        popupMapper.insertFeedback(feedback);
    }

    // Trim whitespace and HTML-escape so stored content is safe to render anywhere
    // (belt-and-suspenders alongside React's built-in escaping).
    private String sanitizeMessage(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) return null;
        return HtmlUtils.htmlEscape(trimmed);
    }

    private Long resolveUserId(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        try {
            User user = userService.getOrCreateUserFromToken(authHeader.substring(7));
            return user != null ? user.getUserID() : null;
        } catch (Exception e) {
            return null;
        }
    }
}
