package com.badgersublease.backend.service;

// the 3 events we're tracking:
// 1. user sends an email through the contact form
import com.badgersublease.backend.model.Email;
// 2. new listing is posted
import com.badgersublease.backend.model.Listing;
// 3. user reports a listing
import com.badgersublease.backend.model.Report;
// 4. user reports another user
import com.badgersublease.backend.model.User;
import com.badgersublease.backend.types.Status;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

@Service
public class SlackService {

    // slack webhook url, set in application.properties (injected by @Value)
    @Value("${slack.webhook.url:}") // default to empty string if not set (: at end)
    private String webhookUrl;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Async
    public void notifyNewListing(Listing listing) {
        if (webhookUrl == null || webhookUrl.isEmpty()) return; 

        try {
            String priceLine;
            if (listing.getRent() != null) {
                priceLine = "Rent: $" + listing.getRent() + "/mo";
            } else if (listing.getParking() != null) {
                priceLine = "Parking: $" + listing.getParking().getPrice() + "/mo";
            } else {
                priceLine = "Type: " + listing.getListingType();
            }
            String text = String.format(
                "🏠 *New MadLease Listing*\\n\\nTitle: %s\\n%s\\nAddress: %s, %s, WI\\n\\nView: https://madlease.net/listings/%s",
                  listing.getTitle(),
                  priceLine,
                  listing.getStreet(),
                  listing.getCity(),
                  listing.getPublicId()
              );
              post(text);
          } catch (Exception e) {
              // slack failures must never propagate to the caller
          }
      }

    @Async
      public void notifyReportSubmitted(Report report) {
        if (webhookUrl == null || webhookUrl.isBlank()) return;
        try {
            String text = String.format(
                "🚨 *Listing Report Filed*\\n\\nListing: %s\\nReason: %s\\nMessage: %s",
                report.getListingId(),
                report.getReason(),
                report.getReportMessage()
            );
            post(text);
        } catch (Exception e) {
            // slack failures must never propagate to the caller
          }
      }
        
    @Async
      public void notifyUserReportSubmitted(Report report) {
        if (webhookUrl == null || webhookUrl.isBlank()) return;
        try {
            String text = String.format(
                "🚨 *User Report Filed*\\n\\nReporter ID: %d\\nReported User ID: %d\\nReason: %s\\nDetails: %s",
                report.getUserId(),
                report.getReportedUserId(),
                report.getReason(),
                report.getReportMessage() != null && !report.getReportMessage().isEmpty() ? report.getReportMessage() : "None"
            );
            post(text);
        } catch (Exception e) {
            // slack failures must never propagate to the caller
        }
      }

    @Async
    public void notifyUserDeleted(String email, String name) {
        if (webhookUrl == null || webhookUrl.isBlank()) return;
        try {
            String displayName = (name != null && !name.isBlank()) ? name : "Unknown";
            String text = String.format(
                "🚪 *User Deleted Account*\\n\\nName: %s\\nEmail: %s",
                displayName,
                email
            );
            post(text);
        } catch (Exception e) {
            // slack failures must never propagate to the caller
        }
    }

    @Async
    public void notifyListingDeleted(String title, String publicId) {
        if (webhookUrl == null || webhookUrl.isBlank()) return;
        try {
            String text = String.format(
                "🗑️ *Listing Deleted (self-service)*\\n\\nTitle: %s\\nPublic ID: %s",
                title,
                publicId
            );
            post(text);
        } catch (Exception e) {
            // slack failures must never propagate to the caller
        }
    }

    @Async
    public void notifyFirstMessage(String listingTitle, String listingPublicId, Long requesterUserId, Long listerUserId) {
        if (webhookUrl == null || webhookUrl.isBlank()) return;
        try {
            String text = String.format(
                "💬 *New Conversation Started*\\n\\nListing: %s\\nRequester ID: %d\\nLister ID: %d\\nView: https://madlease.net/listings/%s",
                listingTitle,
                requesterUserId,
                listerUserId,
                listingPublicId
            );
            post(text);
        } catch (Exception e) {
            // slack failures must never propagate to the caller
        }
    }

    @Async
    public void notifyUserBlocked(Long blockerId, Long blockedId) {
        if (webhookUrl == null || webhookUrl.isBlank()) return;
        try {
            String text = String.format(
                "🚫 *User Blocked*\\n\\nBlocker ID: %d\\nBlocked ID: %d",
                blockerId,
                blockedId
            );
            post(text);
        } catch (Exception e) {
            // slack failures must never propagate to the caller
        }
    }

    @Async
    public void notifyListingStatusChanged(Listing listing, Status oldStatus, Status newStatus) {
        if (webhookUrl == null || webhookUrl.isBlank()) return;
        try {
            String text = String.format(
                "🔄 *Listing Status Changed*\\n\\nListing: %s\\nOld Status: %s\\nNew Status: %s",
                listing.getTitle(),
                oldStatus,
                newStatus
            );
            post(text);
        } catch (Exception e) {
            // slack failures must never propagate to the caller
        }
    }

    @Async
      public void notifyContactForm(Email email) {
          if (webhookUrl == null || webhookUrl.isBlank()) return;
          try {
              String text = String.format(
                  "📬 *Contact Form Submission*\\n\\nFrom: %s (%s)\\nInquiry: %s\\nMessage:%s",
                  email.getName(),
                  email.getEmail(),
                  email.getInquiryType(),
                  email.getMessage()
              );
              post(text);
          } catch (Exception e) {
              // slack failures must never propagate to the caller
          }
      }

      @Async
      public void notifyCampaignSent(String campaignName, int sent, int skippedOptedOut, int skippedDormant, int skippedNoEmail) {
          if (webhookUrl == null || webhookUrl.isBlank()) return;
          try {
              String text = String.format(
                  "📣 *Campaign Sent: %s*\\n\\nSent: %d\\nSkipped (opted out): %d\\nSkipped (dormant): %d\\nSkipped (no email): %d",
                  campaignName, sent, skippedOptedOut, skippedDormant, skippedNoEmail
              );
              post(text);
          } catch (Exception e) {
              // slack failures must never propagate to the caller
          }
      }

      private void post(String text) throws Exception {
          String json = "{\"text\": \"" + text.replace("\"", "\\\"") + "\"}";
          HttpRequest request = HttpRequest.newBuilder()
                  .uri(URI.create(webhookUrl))
                  .header("Content-Type", "application/json")
                  .POST(HttpRequest.BodyPublishers.ofString(json))
                  .build();
          httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      }
  
}
