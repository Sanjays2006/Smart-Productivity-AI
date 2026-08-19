package com.tracker.controller;

import com.tracker.model.User;
import com.tracker.model.PageChunk;
import com.tracker.repository.UserRepository;
import com.tracker.repository.PageChunkRepository;
import com.tracker.service.ResourceCollectorService;
import com.tracker.service.ActivityTrackingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/learning")
public class LearningAssistantController {

    private final UserRepository userRepository;
    private final PageChunkRepository chunkRepository;
    private final ResourceCollectorService resourceCollectorService;
    private final ActivityTrackingService trackingService;

    public LearningAssistantController(UserRepository userRepository,
                                       PageChunkRepository chunkRepository,
                                       ResourceCollectorService resourceCollectorService,
                                       ActivityTrackingService trackingService) {
        this.userRepository = userRepository;
        this.chunkRepository = chunkRepository;
        this.resourceCollectorService = resourceCollectorService;
        this.trackingService = trackingService;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsernameOrEmail(username, username).orElse(null);
    }

    @PostMapping("/onboard")
    public ResponseEntity<?> onboardUser(@RequestBody Map<String, Object> payload) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        String useCase = (String) payload.getOrDefault("useCase", "");
        String selectedTopics = (String) payload.getOrDefault("selectedTopics", "");
        String customInterests = (String) payload.getOrDefault("customInterests", "");
        boolean allowed = (Boolean) payload.getOrDefault("resourceCollectionAllowed", true);

        user.setUseCase(useCase);
        user.setSelectedTopics(selectedTopics);
        user.setCustomInterests(customInterests);
        user.setResourceCollectionAllowed(allowed);
        user.setOnboarded(true);

        userRepository.save(user);

        // Track onboarding activity
        trackingService.track(user.getId(), "SYSTEM", "ONBOARD", "Completed learning onboarding config for use case: " + useCase, selectedTopics, user.getId().toString());

        // Async crawl trigger to fetch initial docs for the user
        CompletableFuture.runAsync(() -> {
            try {
                resourceCollectorService.collectResourcesForUser(user);
            } catch (Exception e) {
                System.err.println("Async onboarding crawl failed: " + e.getMessage());
            }
        });

        return ResponseEntity.ok(Map.of(
            "message", "Onboarding configurations saved successfully.",
            "onboarded", true
        ));
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile() {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("username", user.getUsername());
        data.put("email", user.getEmail());
        data.put("onboarded", user.isOnboarded());
        data.put("useCase", user.getUseCase());
        data.put("selectedTopics", user.getSelectedTopics());
        data.put("customInterests", user.getCustomInterests());
        data.put("resourceCollectionAllowed", user.isResourceCollectionAllowed());
        return ResponseEntity.ok(data);
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        List<PageChunk> userChunks = chunkRepository.findByUserOrderByCreatedAtDesc(user);

        // Calculate unique documents
        Map<String, List<PageChunk>> docsGrouped = userChunks.stream()
                .filter(c -> c.getSourceUrl() != null)
                .collect(Collectors.groupingBy(PageChunk::getSourceUrl));

        long docCount = docsGrouped.size();
        long chunkCount = userChunks.size();

        // Unique documents display metadata list
        List<Map<String, Object>> documents = new ArrayList<>();
        for (Map.Entry<String, List<PageChunk>> entry : docsGrouped.entrySet()) {
            Map<String, Object> doc = new LinkedHashMap<>();
            String url = entry.getKey();
            String title = entry.getValue().isEmpty() ? "Unknown Document" : entry.getValue().get(0).getSourceTitle();
            long count = entry.getValue().size();
            doc.put("url", url);
            doc.put("title", title);
            doc.put("chunksCount", count);
            documents.add(doc);
        }

        // Selected interest areas list
        List<String> topics = new ArrayList<>();
        if (user.getSelectedTopics() != null && !user.getSelectedTopics().isBlank()) {
            topics.addAll(Arrays.stream(user.getSelectedTopics().split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .toList());
        }
        if (user.getCustomInterests() != null && !user.getCustomInterests().isBlank()) {
            topics.addAll(Arrays.stream(user.getCustomInterests().split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .toList());
        }

        // Compute coverage metrics
        Map<String, Object> coverage = new LinkedHashMap<>();
        for (String topic : topics) {
            String lowerTopic = topic.toLowerCase();
            long matchingChunks = userChunks.stream()
                    .filter(c -> (c.getChunkText() != null && c.getChunkText().toLowerCase().contains(lowerTopic))
                            || (c.getSourceTitle() != null && c.getSourceTitle().toLowerCase().contains(lowerTopic)))
                    .count();
            coverage.put(topic, matchingChunks);
        }

        // Formulate recommended topics based on active usecase
        List<String> recommendations = getRecommendations(user.getUseCase(), topics);

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalDocuments", docCount);
        stats.put("totalChunks", chunkCount);
        stats.put("coverage", coverage);
        stats.put("recommendations", recommendations);
        stats.put("documents", documents);

        return ResponseEntity.ok(stats);
    }

    @PostMapping("/trigger-crawl")
    public ResponseEntity<?> triggerManualCrawl() {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        CompletableFuture.runAsync(() -> {
            try {
                resourceCollectorService.collectResourcesForUser(user);
            } catch (Exception e) {
                System.err.println("Manual trigger crawl failed: " + e.getMessage());
            }
        });

        // Track crawl trigger activity
        trackingService.track(user.getId(), "DOCUMENT", "CRAWL_TRIGGER", "Triggered manual synchronization of study resources", user.getSelectedTopics(), "manual-crawl");

        return ResponseEntity.ok(Map.of(
            "message", "RAG synchronizer started in the background. Your custom knowledge base is updating."
        ));
    }

    @PostMapping("/add-document")
    public ResponseEntity<?> addDocument(@RequestBody Map<String, String> payload) {
        User user = getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        String input = payload.get("urlOrTopic");
        if (input == null || input.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Input URL or topic name is required."));
        }

        String cleanInput = input.trim();
        CompletableFuture.runAsync(() -> {
            try {
                if (cleanInput.startsWith("http://") || cleanInput.startsWith("https://")) {
                    resourceCollectorService.indexCustomUrl(user, cleanInput, null);
                } else {
                    resourceCollectorService.crawlTopicFromWikipedia(user, cleanInput);
                }
            } catch (Exception e) {
                System.err.println("Failed to index custom document: " + e.getMessage());
            }
        });

        // Track custom document index request
        trackingService.track(user.getId(), "LEARNING", "TOPIC_ADD", "Added learning resource: " + cleanInput, cleanInput, "add-document");

        return ResponseEntity.ok(Map.of(
            "message", "Custom source indexing started in the background. View index logs shortly."
        ));
    }

    private List<String> getRecommendations(String useCase, List<String> currentTopics) {
        List<String> recommendations = new ArrayList<>();
        if (useCase == null) return recommendations;

        List<String> pool;
        switch (useCase.toLowerCase()) {
            case "cybersecurity":
                pool = List.of("Cryptography", "Network Security", "Metasploit", "Kali Linux", "SQL Injection", "OWASP Top 10");
                break;
            case "programming":
                pool = List.of("Java", "Spring Boot", "React", "Python", "Data Structures", "Docker", "Git");
                break;
            case "ai/ml":
                pool = List.of("Machine Learning", "Neural Networks", "Deep Learning", "PyTorch", "Natural Language Processing", "LLMs");
                break;
            case "data science":
                pool = List.of("Data Science", "Pandas", "SQL", "Statistics", "Machine Learning", "Data Visualization");
                break;
            default:
                pool = List.of("Academic Research", "Scientific Method", "HCI", "System Design", "Cloud Computing");
                break;
        }

        for (String rec : pool) {
            boolean alreadyHas = currentTopics.stream().anyMatch(t -> t.equalsIgnoreCase(rec));
            if (!alreadyHas) {
                recommendations.add(rec);
            }
        }
        return recommendations;
    }
}
