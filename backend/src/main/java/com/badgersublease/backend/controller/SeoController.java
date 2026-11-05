package com.badgersublease.backend.controller;

import com.badgersublease.backend.model.Listing;
import com.badgersublease.backend.model.ListingParking;
import com.badgersublease.backend.service.ListingService;
import com.badgersublease.backend.types.ListingType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.TimeZone;

@RestController
@RequestMapping("/api/seo")
public class SeoController {

    private static final String CANONICAL_DOMAIN = "https://www.madlease.net";
    private static final String CACHE_HEADER = "public, max-age=600, s-maxage=1800, stale-while-revalidate=86400";

    private final ListingService listingService;

    @Autowired
    public SeoController(ListingService listingService) {
        this.listingService = listingService;
    }

    @GetMapping(value = "/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> sitemap() {
        SimpleDateFormat dateFmt = new SimpleDateFormat("yyyy-MM-dd");
        dateFmt.setTimeZone(TimeZone.getTimeZone("UTC"));
        String today = dateFmt.format(new Date());

        StringBuilder sb = new StringBuilder(4096);
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        appendUrl(sb, CANONICAL_DOMAIN + "/", today);
        appendUrl(sb, CANONICAL_DOMAIN + "/listings", today);
        appendUrl(sb, CANONICAL_DOMAIN + "/about", "2026-04-13");
        appendUrl(sb, CANONICAL_DOMAIN + "/contact", "2026-01-01");
        appendUrl(sb, CANONICAL_DOMAIN + "/privacy", "2026-01-01");
        appendUrl(sb, CANONICAL_DOMAIN + "/terms", "2026-01-01");

        List<Listing> listings = listingService.getActiveListingsForSitemap();
        for (Listing l : listings) {
            if (l.getPublicId() == null) continue;
            String lastmod = l.getCreatedAt() != null ? dateFmt.format(l.getCreatedAt()) : today;
            appendUrl(sb, CANONICAL_DOMAIN + "/listings/" + l.getPublicId(), lastmod);
        }

        sb.append("</urlset>\n");

        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, CACHE_HEADER)
                .contentType(MediaType.APPLICATION_XML)
                .body(sb.toString());
    }

    @GetMapping(value = "/llms-full.txt", produces = "text/plain; charset=UTF-8")
    public ResponseEntity<String> llmsFull() {
        StringBuilder sb = new StringBuilder(8192);
        sb.append("# MadLease — Complete Site Content\n\n");
        sb.append("> MadLease is the sublease and parking marketplace for University of Wisconsin-Madison students.\n\n");
        sb.append("This document provides clean markdown content and a live index of active listings on [madlease.net](")
          .append(CANONICAL_DOMAIN).append("/) for AI systems that cannot render JavaScript.\n\n");
        sb.append("---\n\n");

        sb.append("## About MadLease\n\n");
        sb.append("MadLease is a free platform built for UW-Madison students to find and post subleases and parking spots near campus. ");
        sb.append("Users sign up with their `@wisc.edu` email (auto-verified) or Google account, post listings with photos, ");
        sb.append("search filters by price/beds/dates/amenities, and contact each other through end-to-end encrypted in-app messaging.\n\n");

        sb.append("### Core pages\n\n");
        sb.append("- Home: ").append(CANONICAL_DOMAIN).append("/\n");
        sb.append("- Browse Listings: ").append(CANONICAL_DOMAIN).append("/listings\n");
        sb.append("- About: ").append(CANONICAL_DOMAIN).append("/about\n");
        sb.append("- Contact: ").append(CANONICAL_DOMAIN).append("/contact\n");
        sb.append("- Privacy Policy: ").append(CANONICAL_DOMAIN).append("/privacy\n");
        sb.append("- Terms of Service: ").append(CANONICAL_DOMAIN).append("/terms\n\n");

        sb.append("---\n\n");
        sb.append("## Active Listings\n\n");
        sb.append("The following are currently-available subleases and parking spots on MadLease, generated live from the database.\n\n");

        SimpleDateFormat monthYear = new SimpleDateFormat("MMMM yyyy");
        monthYear.setTimeZone(TimeZone.getTimeZone("UTC"));

        List<Listing> listings = listingService.getActiveListingsForSitemap();
        int count = 0;
        for (Listing l : listings) {
            if (l.getPublicId() == null) continue;
            count++;
            sb.append("### ").append(safe(l.getTitle())).append("\n\n");
            sb.append("**URL:** ").append(CANONICAL_DOMAIN).append("/listings/").append(l.getPublicId()).append("\n\n");

            // Show listing type for non-housing listings
            ListingType type = l.getListingType();
            if (type == ListingType.PARKING) {
                sb.append("- Type: Parking Spot\n");
            } else if (type == ListingType.BOTH) {
                sb.append("- Type: Housing + Parking\n");
            }

            StringBuilder facts = new StringBuilder();
            if (l.getRent() != null && l.getRent() > 0) {
                facts.append("$").append(l.getRent()).append("/mo");
            } else if (type == ListingType.PARKING) {
                ListingParking p = l.getParking();
                if (p != null && p.getPrice() > 0) facts.append("$").append(p.getPrice()).append("/mo");
            }
            if (l.getBedrooms() != null && l.getBedrooms() > 0) append(facts, l.getBedrooms() + " bed");
            if (l.getBathrooms() != null && l.getBathrooms() > 0) append(facts, l.getBathrooms() + " bath");
            if (l.getSquareFeet() != null && l.getSquareFeet() > 0) append(facts, l.getSquareFeet() + " sq ft");
            if (type == ListingType.BOTH) {
                ListingParking p = l.getParking();
                if (p != null && p.getPrice() > 0) append(facts, "+ $" + p.getPrice() + "/mo parking");
            }
            if (facts.length() > 0) sb.append("- ").append(facts).append("\n");

            String location = joinNonBlank(", ", l.getStreet(), l.getCity(), l.getState());
            if (!location.isEmpty()) sb.append("- Location: ").append(safe(location)).append("\n");

            if (l.getStartDate() != null && l.getEndDate() != null) {
                sb.append("- Available: ").append(monthYear.format(l.getStartDate()))
                  .append(" through ").append(monthYear.format(l.getEndDate())).append("\n");
            }

            if (l.getDescription() != null && !l.getDescription().isBlank()) {
                sb.append("\n").append(safe(l.getDescription())).append("\n");
            }
            sb.append("\n---\n\n");
        }

        sb.append("_").append(count).append(" active listings. Last generated: ")
          .append(new SimpleDateFormat("yyyy-MM-dd").format(new Date())).append(" UTC._\n");

        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, CACHE_HEADER)
                .contentType(MediaType.parseMediaType("text/plain; charset=UTF-8"))
                .body(sb.toString());
    }

    private static void appendUrl(StringBuilder sb, String loc, String lastmod) {
        sb.append("  <url>\n");
        sb.append("    <loc>").append(xmlEscape(loc)).append("</loc>\n");
        sb.append("    <lastmod>").append(lastmod).append("</lastmod>\n");
        sb.append("  </url>\n");
    }

    private static String xmlEscape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    // Strip markdown-breaking characters from user content
    private static String safe(String s) {
        if (s == null) return "";
        return s.replace("\r", "").replace("\n\n\n", "\n\n").trim();
    }

    private static void append(StringBuilder sb, String s) {
        if (sb.length() > 0) sb.append(" | ");
        sb.append(s);
    }

    private static String joinNonBlank(String sep, String... parts) {
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (p == null || p.isBlank()) continue;
            if (sb.length() > 0) sb.append(sep);
            sb.append(p.trim());
        }
        return sb.toString();
    }
}
