package com.tracker.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class OnlineSearchService {

    private static final String USER_AGENT = "FocusAI-Study-Assistant/2.0 (educational; contact@focusai.app)";
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OnlineSearchService() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(10000);
        this.restTemplate = new RestTemplate(factory);
    }

    public boolean isInternetAvailable() {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress("8.8.8.8", 53), 1000);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private HttpEntity<String> buildEntity() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("User-Agent", USER_AGENT);
        headers.set("Accept", "application/json");
        return new HttpEntity<>(headers);
    }

    public List<Map<String, String>> searchOnline(String query) {
        List<Map<String, String>> results = new ArrayList<>();
        if (!isInternetAvailable()) return results;

        // 1. Wikipedia full-text extract (richer RAG context)
        try {
            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
            String searchUrl = "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch="
                + encodedQuery + "&format=json&utf8=1&srlimit=3";

            ResponseEntity<String> searchRes = restTemplate.exchange(searchUrl, HttpMethod.GET, buildEntity(), String.class);
            if (searchRes.getStatusCode().is2xxSuccessful() && searchRes.getBody() != null) {
                JsonNode root = objectMapper.readTree(searchRes.getBody());
                JsonNode searchArray = root.path("query").path("search");

                for (int i = 0; i < Math.min(searchArray.size(), 2); i++) {
                    JsonNode item = searchArray.get(i);
                    String title = item.path("title").asText();
                    String snippetRaw = item.path("snippet").asText().replaceAll("<[^>]*>", "");
                    String wikiUrl = "https://en.wikipedia.org/wiki/"
                        + URLEncoder.encode(title.replace(" ", "_"), StandardCharsets.UTF_8);

                    // Fetch full intro extract for top result
                    String fullText = snippetRaw;
                    if (i == 0) {
                        try {
                            String extractUrl = "https://en.wikipedia.org/w/api.php?action=query&prop=extracts"
                                + "&exintro=1&explaintext=1&titles=" + URLEncoder.encode(title, StandardCharsets.UTF_8)
                                + "&format=json";
                            ResponseEntity<String> extRes = restTemplate.exchange(extractUrl, HttpMethod.GET, buildEntity(), String.class);
                            if (extRes.getStatusCode().is2xxSuccessful() && extRes.getBody() != null) {
                                JsonNode extRoot = objectMapper.readTree(extRes.getBody());
                                JsonNode pages = extRoot.path("query").path("pages");
                                Iterator<String> fieldNames = pages.fieldNames();
                                if (fieldNames.hasNext()) {
                                    String extract = pages.get(fieldNames.next()).path("extract").asText();
                                    if (!extract.isBlank()) {
                                        fullText = extract.length() > 800 ? extract.substring(0, 800) + "..." : extract;
                                    }
                                }
                            }
                        } catch (Exception ignored) {}
                    }

                    Map<String, String> res = new HashMap<>();
                    res.put("title", "Wikipedia: " + title);
                    res.put("url", wikiUrl);
                    res.put("snippet", fullText);
                    res.put("source", "wikipedia");
                    results.add(res);
                }
            }
        } catch (Exception e) {
            System.err.println("Wikipedia online search failed: " + e.getMessage());
        }

        // 2. DuckDuckGo Instant Answer API
        try {
            String encodedQuery = URLEncoder.encode(query, StandardCharsets.UTF_8);
            String ddgUrl = "https://api.duckduckgo.com/?q=" + encodedQuery + "&format=json&no_html=1&skip_disambig=1";
            ResponseEntity<String> response = restTemplate.exchange(ddgUrl, HttpMethod.GET, buildEntity(), String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String abstractText = root.path("AbstractText").asText();
                String abstractUrl  = root.path("AbstractURL").asText();
                String abstractSrc  = root.path("AbstractSource").asText();

                if (!abstractText.isBlank() && !abstractUrl.isBlank()) {
                    Map<String, String> res = new HashMap<>();
                    res.put("title", "DuckDuckGo — " + (abstractSrc.isBlank() ? "Web" : abstractSrc));
                    res.put("url", abstractUrl);
                    res.put("snippet", abstractText.length() > 600 ? abstractText.substring(0, 600) + "..." : abstractText);
                    res.put("source", "duckduckgo");
                    results.add(res);
                }

                // Related Topics
                JsonNode related = root.path("RelatedTopics");
                for (int i = 0; i < Math.min(related.size(), 2); i++) {
                    JsonNode topic = related.get(i);
                    String text = topic.path("Text").asText();
                    String url  = topic.path("FirstURL").asText();
                    if (!text.isBlank() && !url.isBlank()) {
                        Map<String, String> res = new HashMap<>();
                        res.put("title", "Related: " + (text.length() > 60 ? text.substring(0, 60) + "..." : text));
                        res.put("url", url);
                        res.put("snippet", text);
                        res.put("source", "duckduckgo");
                        results.add(res);
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("DuckDuckGo search failed: " + e.getMessage());
        }

        return results;
    }
}
