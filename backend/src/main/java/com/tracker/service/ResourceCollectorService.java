package com.tracker.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tracker.model.PageChunk;
import com.tracker.model.User;
import com.tracker.repository.PageChunkRepository;
import com.tracker.repository.UserRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;

@Service
public class ResourceCollectorService {

    private final UserRepository userRepository;
    private final PageChunkRepository chunkRepository;
    private final OllamaService ollamaService;
    private final OnlineSearchService onlineSearchService;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ResourceCollectorService(UserRepository userRepository,
                                    PageChunkRepository chunkRepository,
                                    @Lazy OllamaService ollamaService,
                                    OnlineSearchService onlineSearchService) {
        this.userRepository = userRepository;
        this.chunkRepository = chunkRepository;
        this.ollamaService = ollamaService;
        this.onlineSearchService = onlineSearchService;
    }

    // Scheduled background crawler runs every 10 minutes to download documents on user topics
    @Scheduled(cron = "0 */10 * * * *")
    public void scheduleResourceCollection() {
        if (!onlineSearchService.isInternetAvailable()) {
            return;
        }
        List<User> onboardedUsers = userRepository.findAll().stream()
                .filter(User::isOnboarded)
                .filter(User::isResourceCollectionAllowed)
                .toList();

        for (User user : onboardedUsers) {
            collectResourcesForUser(user);
        }
    }

    public int collectResourcesForUser(User user) {
        if (user == null || user.getId() == null) return 0;
        User managedUser = userRepository.findById(user.getId()).orElse(user);
        if (!managedUser.isOnboarded()) return 0;

        System.out.println("📚 Starting background resource collection for user: " + managedUser.getUsername());

        List<String> topics = new ArrayList<>();
        if (managedUser.getSelectedTopics() != null) {
            topics.addAll(Arrays.asList(managedUser.getSelectedTopics().split(",")));
        }
        if (managedUser.getCustomInterests() != null && !managedUser.getCustomInterests().isBlank()) {
            topics.addAll(Arrays.asList(managedUser.getCustomInterests().split(",")));
        }

        int countCollected = 0;
        for (String rawTopic : topics) {
            String topic = rawTopic.trim();
            if (topic.isEmpty()) continue;

            System.out.println("🔍 Crawling topic: " + topic);
            boolean success = crawlTopicFromWikipedia(managedUser, topic);
            System.out.println("   -> Wikipedia crawl success: " + success);
            if (success) countCollected++;

            boolean faqSuccess = generateEducationalGuides(managedUser, topic);
            System.out.println("   -> Custom study guide success: " + faqSuccess);
            if (faqSuccess) countCollected++;
        }
        System.out.println("📚 Completed resource collection. Total new items collected: " + countCollected);
        return countCollected;
    }

    public boolean crawlTopicFromWikipedia(User user, String topic) {
        try {
            String query = URLEncoder.encode(topic, StandardCharsets.UTF_8);
            // Search Wikipedia
            String searchUrl = "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + query + "&format=json&utf8=1";
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "FocusAI-Study-Assistant/1.0 (sakthi@example.com)");
            HttpEntity<String> entity = new HttpEntity<>(headers);
            
            ResponseEntity<String> response = restTemplate.exchange(searchUrl, HttpMethod.GET, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                JsonNode searchArray = root.path("query").path("search");
                if (searchArray.size() > 0) {
                    String title = searchArray.get(0).path("title").asText();
                    String sourceUrl = "https://en.wikipedia.org/wiki/" + URLEncoder.encode(title.replace(" ", "_"), StandardCharsets.UTF_8);

                    // Skip duplicate crawling
                    long existing = chunkRepository.countByUserAndSourceUrl(user, sourceUrl);
                    if (existing > 0) {
                        return false;
                    }

                    // Query Wikipedia Text Extract API
                    String extractUrl = "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles=" + URLEncoder.encode(title, StandardCharsets.UTF_8) + "&format=json";
                    ResponseEntity<String> extractResponse = restTemplate.exchange(extractUrl, HttpMethod.GET, entity, String.class);
                    if (extractResponse.getStatusCode().is2xxSuccessful() && extractResponse.getBody() != null) {
                        JsonNode extRoot = objectMapper.readTree(extractResponse.getBody());
                        JsonNode pages = extRoot.path("query").path("pages");
                        Iterator<String> fieldNames = pages.fieldNames();
                        if (fieldNames.hasNext()) {
                            String pageId = fieldNames.next();
                            String extractText = pages.get(pageId).path("extract").asText();
                            if (!extractText.isEmpty()) {
                                System.out.println("   -> Ingesting Wikipedia page: " + title + " (" + extractText.length() + " chars)");
                                ingestTextContent(user, sourceUrl, "Wikipedia: " + title, extractText);
                                return true;
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to crawl topic '" + topic + "' from Wikipedia: " + e.getMessage());
        }
        return false;
    }

    public boolean indexCustomUrl(User user, String url, String customTitle) {
        if (user == null || user.getId() == null || url == null || url.isBlank()) return false;
        User managedUser = userRepository.findById(user.getId()).orElse(user);
        String cleanUrl = url.trim();

        System.out.println("🔗 Indexing custom URL for user " + managedUser.getUsername() + ": " + cleanUrl);

        if (chunkRepository.countByUserAndSourceUrl(managedUser, cleanUrl) > 0) {
            System.out.println("   -> URL already indexed. Skipping.");
            return false;
        }

        try {
            if (cleanUrl.contains("wikipedia.org/wiki/")) {
                String titlePart = cleanUrl.substring(cleanUrl.lastIndexOf("/wiki/") + 6);
                String title = java.net.URLDecoder.decode(titlePart, StandardCharsets.UTF_8).replace("_", " ");
                return crawlTopicFromWikipedia(managedUser, title);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(cleanUrl, HttpMethod.GET, entity, String.class);
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                String html = response.getBody();
                String title = customTitle != null && !customTitle.isBlank() ? customTitle : "Crawled Document";
                int titleStart = html.toLowerCase().indexOf("<title>");
                int titleEnd = html.toLowerCase().indexOf("</title>");
                if (titleStart != -1 && titleEnd != -1 && (customTitle == null || customTitle.isBlank())) {
                    title = html.substring(titleStart + 7, titleEnd).trim();
                }

                // Strip script, style, and HTML tags
                String text = html.replaceAll("<style[^>]*>[\\s\\S]*?</style>", "")
                                  .replaceAll("<script[^>]*>[\\s\\S]*?</script>", "")
                                  .replaceAll("<[^>]*>", " ")
                                  .replaceAll("\\s+", " ")
                                  .trim();

                if (text.length() > 100) {
                    System.out.println("   -> Ingesting custom URL text content (" + text.length() + " chars)");
                    ingestTextContent(managedUser, cleanUrl, title, text);
                    return true;
                } else {
                    System.out.println("   -> Extracted text too short (" + text.length() + " chars). Skipping.");
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to index URL " + cleanUrl + ": " + e.getMessage());
        }
        return false;
    }

    private boolean generateEducationalGuides(User user, String topic) {
        String sourceUrl = "mentor:guides:" + topic.toLowerCase().replace(" ", "_");
        if (chunkRepository.countByUserAndSourceUrl(user, sourceUrl) > 0) {
            return false;
        }

        if (!ollamaService.isOllamaRunning()) {
            return false;
        }

        try {
            String prompt = String.format(
                "Generate a detailed reference guide for a student studying '%s'.\n" +
                "Include a clean reference guide, 2 best practices, 3 FAQs with answers, and 2 common interview questions with code examples if applicable.\n" +
                "Structure everything cleanly.", topic
            );
            Map<String, Object> response = ollamaService.askQuestion(user, prompt, "offline");
            String answer = (String) response.get("answer");
            if (answer != null && !answer.contains("Ollama is not running")) {
                ingestTextContent(user, sourceUrl, "Study Guide: " + topic, answer);
                return true;
            }
        } catch (Exception e) {
            System.err.println("Failed to generate custom study guide for " + topic + ": " + e.getMessage());
        }
        return false;
    }

    private void ingestTextContent(User user, String sourceUrl, String title, String bodyText) {
        String cleanText = bodyText.replaceAll("\\s+", " ").trim();
        List<String> chunks = splitIntoChunks(cleanText, 600);
        int limit = Math.min(chunks.size(), 12); // Limit total resource size
        System.out.println("   -> Ingesting " + limit + " chunks for source: " + title);

        // Check Ollama availability ONCE before the loop to avoid repeated 5s timeouts per chunk
        boolean ollamaAvailable = ollamaService.isOllamaRunning();
        if (!ollamaAvailable) {
            System.out.println("   -> Ollama offline: saving chunks with empty embeddings (text retrieval still works)");
        }

        for (int i = 0; i < limit; i++) {
            PageChunk chunk = new PageChunk();
            chunk.setUser(user);
            chunk.setSourceUrl(sourceUrl);
            chunk.setSourceTitle(title);
            chunk.setChunkText(chunks.get(i));
            chunk.setVisitDate(LocalDate.now());

            if (ollamaAvailable) {
                List<Double> vector = ollamaService.generateEmbedding(chunks.get(i));
                try {
                    chunk.setEmbedding(objectMapper.writeValueAsString(vector));
                } catch (Exception e) {
                    chunk.setEmbedding("[]");
                }
            } else {
                chunk.setEmbedding("[]");
            }
            chunkRepository.save(chunk);
        }
        System.out.println("   -> Saved " + limit + " chunks successfully.");
    }

    private List<String> splitIntoChunks(String text, int chunkSize) {
        List<String> chunks = new ArrayList<>();
        int len = text.length();
        for (int i = 0; i < len; i += chunkSize) {
            chunks.add(text.substring(i, Math.min(i + chunkSize, len)));
        }
        return chunks;
    }
}
