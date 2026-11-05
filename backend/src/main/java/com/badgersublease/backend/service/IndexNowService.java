package com.badgersublease.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

/**
 * Notifies IndexNow-participating search engines (Bing, Yandex, Seznam, Naver)
 * when listing URLs are created, updated, or removed. A single endpoint fans
 * out to all participating engines.
 *
 * Key file must be served at https://www.madlease.net/{key}.txt containing the
 * key as its only content.
 */
@Service
public class IndexNowService {

    private static final String INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
    private static final String HOST = "www.madlease.net";
    private static final String CANONICAL_DOMAIN = "https://www.madlease.net";

    @Value("${indexnow.key:af846ec972ef74386cc4dd4ee841410d}")
    private String key;

    @Value("${indexnow.enabled:true}")
    private boolean enabled;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Async
    public void notifyListingChanged(String publicId) {
        if (publicId == null || publicId.isBlank()) return;
        submit(List.of(
                CANONICAL_DOMAIN + "/listings/" + publicId,
                CANONICAL_DOMAIN + "/listings",
                CANONICAL_DOMAIN + "/sitemap.xml"
        ));
    }

    @Async
    public void notifyUrls(List<String> urls) {
        submit(urls);
    }

    private void submit(List<String> urls) {
        if (!enabled || key == null || key.isBlank() || urls == null || urls.isEmpty()) return;

        try {
            StringBuilder urlList = new StringBuilder();
            for (int i = 0; i < urls.size(); i++) {
                if (i > 0) urlList.append(",");
                urlList.append("\"").append(escapeJson(urls.get(i))).append("\"");
            }

            String json = "{"
                    + "\"host\":\"" + HOST + "\","
                    + "\"key\":\"" + key + "\","
                    + "\"keyLocation\":\"" + CANONICAL_DOMAIN + "/" + key + ".txt\","
                    + "\"urlList\":[" + urlList + "]"
                    + "}";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(INDEXNOW_ENDPOINT))
                    .header("Content-Type", "application/json; charset=utf-8")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();

            httpClient.sendAsync(request, HttpResponse.BodyHandlers.discarding());
        } catch (Exception e) {
            // IndexNow failures must never propagate to the caller
        }
    }

    private static String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
