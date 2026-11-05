package com.badgersublease.backend.service;

import com.badgersublease.backend.model.Email;
import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.batch.model.CreateBatchEmailsResponse;
import com.resend.services.emails.model.CreateEmailOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import com.badgersublease.backend.service.SlackService;

import java.util.List;

@Service
public class EmailService {

    @Value("${resend.api-key}")
    private String apiKey;

    @Value("${madlease.noreply.email}")
    private String noReplyEmail;

    @Value("${madlease.support.email}")
    private String supportEmail;

    @Value("${madlease.mailing-address}")
    private String mailingAddress;

    private final SlackService slackService;
    
    public EmailService(SlackService slackService) {
        this.slackService = slackService;
    }

    public void sendInquiryEmail(Email email) throws ResendException {
        Resend resend = new Resend(apiKey);
        CreateEmailOptions options = CreateEmailOptions.builder()
                .from("Madlease <" + noReplyEmail + ">")
                .to(supportEmail)
                .replyTo(email.getEmail())
                .subject("Name: " + email.getName() + " Email: " + email.getEmail() + " InquiryType: " + email.getInquiryType())
                .text("You have a new message from: " + email.getName() + " (" + email.getEmail() + ")\n\n"
                        + "Inquiry Type: " + email.getInquiryType() + "\n\n"
                        + "Message:\n" + email.getMessage())
                .build();

        resend.emails().send(options);
        slackService.notifyContactForm(email);
    }

    public void sendDeletedListingsEmail(Email email) throws ResendException {
        Resend resend = new Resend(apiKey);
        CreateEmailOptions options = CreateEmailOptions.builder()
                .from("Madlease <" + noReplyEmail + ">")
                .to(email.getEmail())
                .subject("Madlease - Deleted listing(s)")
                .text(email.getMessage())
                .build();

        resend.emails().send(options);
    }

    public void sendDeletedAccountsEmail(Email email) throws ResendException {
        Resend resend = new Resend(apiKey);

        String greeting = (email.getName() != null && !email.getName().isBlank())
                ? "Hi " + escapeHtml(email.getName()) + ","
                : "Hi,";

        String html =
            "<div style=\"font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#111;\">" +
                "<div style=\"margin-bottom:28px;\">" +
                    "<span style=\"font-size:17px;font-weight:700;color:#c5050c;letter-spacing:-0.02em;\">MadLease</span>" +
                "</div>" +
                "<h1 style=\"font-size:21px;font-weight:700;color:#111;margin:0 0 12px;line-height:1.3;letter-spacing:-0.02em;\">" +
                    "Your account has been deleted" +
                "</h1>" +
                "<p style=\"font-size:15px;color:#555;line-height:1.65;margin:0 0 28px;\">" +
                    greeting + " We&rsquo;ve permanently removed your MadLease account and all associated data: " +
                    "your listings, messages, and saved items." +
                "</p>" +
                "<div style=\"height:1px;background:#f0f0f0;margin:0 0 24px;\"></div>" +
                "<p style=\"font-size:13px;color:#aaa;line-height:1.6;margin:0;\">" +
                    "Didn&rsquo;t request this? Contact us at " +
                    "<a href=\"mailto:" + supportEmail + "\" style=\"color:#c5050c;text-decoration:none;\">" + supportEmail + "</a>." +
                "</p>" +
            "</div>";

        CreateEmailOptions options = CreateEmailOptions.builder()
                .from("Madlease <" + noReplyEmail + ">")
                .to(email.getEmail())
                .subject("Your MadLease account has been deleted")
                .html(html)
                .build();

        resend.emails().send(options);
    }

    public void sendUnreadMessageNotification(Email email) throws ResendException {
        Resend resend = new Resend(apiKey);

        boolean multiple = email.getMessageCount() > 1;
        String subject = multiple
                ? email.getSenderName() + " sent you " + email.getMessageCount() + " messages on Madlease"
                : email.getSenderName() + " sent you a message on Madlease";
        String intro = multiple
                ? "<strong>" + escapeHtml(email.getSenderName()) + "</strong> sent you " + email.getMessageCount() + " messages about <strong>&ldquo;" + escapeHtml(email.getListingTitle()) + "&rdquo;</strong>."
                : "<strong>" + escapeHtml(email.getSenderName()) + "</strong> sent you a message about <strong>&ldquo;" + escapeHtml(email.getListingTitle()) + "&rdquo;</strong>:";
        String previewLabel = multiple ? "<p>Most recent:</p>" : "";

        String html = "<div style=\"font-family:sans-serif;max-width:600px;padding:24px;color:#111;\">" +
                "<p>Hey " + escapeHtml(email.getName()) + ",</p>" +
                "<p>" + intro + "</p>" +
                previewLabel +
                "<blockquote style=\"border-left:3px solid #ccc;padding:8px 16px;color:#444;\">" +
                escapeHtml(email.getMessage()) +
                "</blockquote>" +
                "<p><a href=\"" + email.getConversationUrl() + "\" style=\"display:inline-block;background:#c5050c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;\">Reply on Madlease &rarr;</a></p>" +
                "</div>";

        CreateEmailOptions options = CreateEmailOptions.builder()
                .from("Madlease <" + noReplyEmail + ">")
                .to(email.getEmail())
                .subject(subject)
                .html(html)
                .build();

        resend.emails().send(options);
    }

    public void sendUnreadReminderEmail(Email email) throws ResendException {
        Resend resend = new Resend(apiKey);

        boolean multiple = email.getMessageCount() > 1;
        String subject = "You still have unread " + (multiple ? "messages" : "a message") + " on Madlease";
        String intro = multiple
                ? "<strong>" + escapeHtml(email.getSenderName()) + "</strong> sent you " + email.getMessageCount() + " messages about <strong>&ldquo;" + escapeHtml(email.getListingTitle()) + "&rdquo;</strong> a few days ago &mdash; still waiting to hear back."
                : "<strong>" + escapeHtml(email.getSenderName()) + "</strong> sent you a message about <strong>&ldquo;" + escapeHtml(email.getListingTitle()) + "&rdquo;</strong> a few days ago &mdash; still waiting to hear back.";

        String html = "<div style=\"font-family:sans-serif;max-width:600px;padding:24px;color:#111;\">" +
                "<p>Hey " + escapeHtml(email.getName()) + ",</p>" +
                "<p>" + intro + "</p>" +
                "<blockquote style=\"border-left:3px solid #ccc;padding:8px 16px;color:#444;\">" +
                escapeHtml(email.getMessage()) +
                "</blockquote>" +
                "<p><a href=\"" + email.getConversationUrl() + "\" style=\"display:inline-block;background:#c5050c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;\">Reply on Madlease &rarr;</a></p>" +
                "</div>";

        CreateEmailOptions options = CreateEmailOptions.builder()
                .from("Madlease <" + noReplyEmail + ">")
                .to(email.getEmail())
                .subject(subject)
                .html(html)
                .build();

        resend.emails().send(options);
    }

    public void sendListingConfirmedEmail(Email email) throws ResendException {
        Resend resend = new Resend(apiKey);

        String html = "<div style=\"font-family:sans-serif;max-width:600px;padding:24px;color:#111;\">" +
                "<p>Hey " + escapeHtml(email.getName()) + ",</p>" +
                "<p>Your listing <strong>&ldquo;" + escapeHtml(email.getListingTitle()) + "&rdquo;</strong> is live on Madlease. Students can now find it and message you directly.</p>" +
                "<p><a href=\"" + email.getListingUrl() + "\" style=\"display:inline-block;background:#c5050c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;\">View your listing &rarr;</a></p>" +
                "</div>";

        CreateEmailOptions options = CreateEmailOptions.builder()
                .from("Madlease <" + noReplyEmail + ">")
                .to(email.getEmail())
                .subject("Your listing is live on Madlease")
                .html(html)
                .build();

        resend.emails().send(options);
    }

    public void sendListingExpiringEmail(Email email) throws ResendException {
        Resend resend = new Resend(apiKey);

        String html = "<div style=\"font-family:sans-serif;max-width:600px;padding:24px;color:#111;\">" +
                "<p>Hey " + escapeHtml(email.getName()) + ",</p>" +
                "<p>Your listing <strong>&ldquo;" + escapeHtml(email.getListingTitle()) + "&rdquo;</strong> expires on <strong>" + escapeHtml(email.getExpiryDate()) + "</strong> &mdash; 3 days from now.</p>" +
                "<p>Already found someone? You can mark it complete. Still looking? Extend the end date to keep it visible to students searching for a sublease.</p>" +
                "<p><a href=\"" + email.getListingUrl() + "\" style=\"display:inline-block;background:#c5050c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;\">Update your listing &rarr;</a></p>" +
                "</div>";

        CreateEmailOptions options = CreateEmailOptions.builder()
                .from("Madlease <" + noReplyEmail + ">")
                .to(email.getEmail())
                .subject("Your Madlease listing expires in 3 days")
                .html(html)
                .build();

        resend.emails().send(options);
    }

    // Builds (but does not send) one campaign email's options, for batching by the caller.
    public CreateEmailOptions buildSubleaseReminderCampaignOptions(Email email) {
        String firstName = (email.getName() != null && !email.getName().isBlank()) ? email.getName() : "there";

        String html = "<div style=\"font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#111;\">" +
                "<div style=\"margin-bottom:28px;\">" +
                    "<span style=\"font-size:17px;font-weight:700;color:#c5050c;letter-spacing:-0.02em;\">MadLease</span>" +
                "</div>" +
                "<h1 style=\"font-size:21px;font-weight:700;color:#111;margin:0 0 16px;line-height:1.3;letter-spacing:-0.02em;\">" +
                    "Leaving Madison in December? List your place now." +
                "</h1>" +
                "<p style=\"font-size:15px;color:#333;line-height:1.65;margin:0 0 16px;\">" +
                    "Hi " + escapeHtml(firstName) + "," +
                "</p>" +
                "<p style=\"font-size:15px;color:#333;line-height:1.65;margin:0 0 16px;\">" +
                    "If you&rsquo;re graduating, studying abroad, or moving out after fall semester, now is the time to find someone to take over your lease. " +
                    "Spring subletters start searching in November, and listings posted early fill fastest." +
                "</p>" +
                "<p style=\"font-size:15px;color:#333;line-height:1.65;margin:0 0 24px;\">" +
                    "Listing on MadLease takes about two minutes, and you can message interested students directly." +
                "</p>" +
                "<p style=\"margin:0 0 28px;\">" +
                    "<a href=\"https://madlease.net/listings/new\" style=\"display:inline-block;background:#c5050c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;\">List your place &rarr;</a>" +
                "</p>" +
                "<p style=\"font-size:14px;color:#555;line-height:1.6;margin:0 0 28px;\">" +
                    "Know a roommate or neighbor who&rsquo;s leaving too? Forward this to them." +
                "</p>" +
                "<div style=\"height:1px;background:#f0f0f0;margin:0 0 20px;\"></div>" +
                "<p style=\"font-size:12px;color:#aaa;line-height:1.6;margin:0;\">" +
                    "<a href=\"" + email.getUnsubscribeUrl() + "\" style=\"color:#aaa;text-decoration:underline;\">Unsubscribe</a>" +
                    " &middot; " + escapeHtml(mailingAddress) +
                "</p>" +
            "</div>";

        return CreateEmailOptions.builder()
                .from("Madlease <" + noReplyEmail + ">")
                .to(email.getEmail())
                .subject("Leaving Madison in December? List your place now")
                .html(html)
                .build();
    }

    public CreateBatchEmailsResponse sendCampaignBatch(List<CreateEmailOptions> batch) throws ResendException {
        Resend resend = new Resend(apiKey);
        return resend.batch().send(batch);
    }

    private String escapeHtml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;")
                    .replace("'", "&#x27;");
    }
}
