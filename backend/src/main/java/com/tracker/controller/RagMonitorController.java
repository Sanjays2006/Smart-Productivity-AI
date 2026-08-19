package com.tracker.controller;

import com.tracker.model.PageChunk;
import com.tracker.model.User;
import com.tracker.repository.AiConversationRepository;
import com.tracker.repository.PageChunkRepository;
import com.tracker.repository.UserRepository;
import com.tracker.service.OllamaService;
import com.tracker.service.OnlineSearchService;
import com.tracker.service.RagService;
import com.tracker.service.ActivityTrackingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

/**
 * RagMonitorController — Dedicated RAG management and monitoring API.
 * Provides real-time metrics, live test queries, network status,
 * and retrieval analytics for the Hybrid RAG system.
 */
@RestController
@RequestMapping("/api/rag")
public class RagMonitorController {

    private final RagService ragService;
    private final OllamaService ollamaService;
    private final OnlineSearchService onlineSearchService;
    private final PageChunkRepository chunkRepository;
    private final AiConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final ActivityTrackingService trackingService;

    // In-memory retrieval stats (per-session)
    private static final AtomicLong totalQueries = new AtomicLong(0);
    private static final AtomicLong offlineQueries = new AtomicLong(0);
    private static final AtomicLong onlineQueries = new AtomicLong(0);
    private static final AtomicLong hybridQueries = new AtomicLong(0);
    private static final List<Map<String, Object>> recentRetrievals = Collections.synchronizedList(new ArrayList<>());

    public RagMonitorController(RagService ragService,
                                OllamaService ollamaService,
                                OnlineSearchService onlineSearchService,
                                PageChunkRepository chunkRepository,
                                AiConversationRepository conversationRepository,
                                UserRepository userRepository,
                                ActivityTrackingService trackingService) {
        this.ragService = ragService;
        this.ollamaService = ollamaService;
        this.onlineSearchService = onlineSearchService;
        this.chunkRepository = chunkRepository;
        this.conversationRepository = conversationRepository;
        this.userRepository = userRepository;
        this.trackingService = trackingService;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsernameOrEmail(username, username).orElse(null);
    }

    /**
     * GET /api/rag/status
     * Returns full system status: internet, Ollama, chunk counts, mode stats.
     */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> getStatus() {
        User user = getCurrentUser();
        boolean internetAvailable = onlineSearchService.isInternetAvailable();
        boolean ollamaRunning = ollamaService.isOllamaRunning();

        long totalChunks = 0;
        long userChunks = 0;
        long uniqueDocs = 0;

        if (user != null) {
            List<PageChunk> uChunks = chunkRepository.findByUserOrderByCreatedAtDesc(user);
            userChunks = uChunks.size();
            uniqueDocs = uChunks.stream()
                .filter(c -> c.getSourceUrl() != null)
                .map(PageChunk::getSourceUrl)
                .distinct()
                .count();
        }
        totalChunks = chunkRepository.count();

        // Determine recommended mode
        String recommendedMode;
        if (internetAvailable && ollamaRunning) {
            recommendedMode = "hybrid";
        } else if (ollamaRunning) {
            recommendedMode = "offline";
        } else if (internetAvailable) {
            recommendedMode = "online";
        } else {
            recommendedMode = "offline"; // fallback to local text search
        }

        Map<String, Object> status = new LinkedHashMap<>();
        status.put("internetAvailable", internetAvailable);
        status.put("ollamaRunning", ollamaRunning);
        status.put("recommendedMode", recommendedMode);
        status.put("totalChunksGlobal", totalChunks);
        status.put("userChunks", userChunks);
        status.put("userDocuments", uniqueDocs);
        status.put("totalQueriesSession", totalQueries.get());
        status.put("offlineQueriesSession", offlineQueries.get());
        status.put("onlineQueriesSession", onlineQueries.get());
        status.put("hybridQueriesSession", hybridQueries.get());
        status.put("timestamp", LocalDateTime.now().toString());

        return ResponseEntity.ok(status);
    }

    /**
     * GET /api/rag/network
     * Quick internet connectivity check with latency measurement.
     */
    @GetMapping("/network")
    public ResponseEntity<Map<String, Object>> getNetworkStatus() {
        long start = System.currentTimeMillis();
        boolean available = onlineSearchService.isInternetAvailable();
        long latency = System.currentTimeMillis() - start;

        Map<String, Object> net = new LinkedHashMap<>();
        net.put("internetAvailable", available);
        net.put("checkLatencyMs", latency);
        net.put("status", available ? "online" : "offline");
        net.put("timestamp", LocalDateTime.now().toString());
        return ResponseEntity.ok(net);
    }

    /**
     * POST /api/rag/test
     * Runs a live test RAG query and returns detailed source breakdown.
     */
    @PostMapping("/test")
    public ResponseEntity<Map<String, Object>> testRag(@RequestBody Map<String, String> body) {
        User user = getCurrentUser();
        if (user == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        String query = body.getOrDefault("query", "");
        String mode  = body.getOrDefault("mode", "hybrid");

        if (query.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Query cannot be empty"));
        }

        // Track RAG query test
        trackingService.track(user.getId(), "RAG", "QUERY_TEST", "Tested RAG query: " + (query.length() > 60 ? query.substring(0, 57) + "..." : query), "mode=" + mode, "rag-test");

        long start = System.currentTimeMillis();
        RagService.RagResult result = ragService.retrieveHybridRag(user, query, mode);
        long elapsed = System.currentTimeMillis() - start;

        // Track stats
        totalQueries.incrementAndGet();
        switch (result.getRetrievalMode().toLowerCase()) {
            case "offline", "offline_fallback" -> offlineQueries.incrementAndGet();
            case "online" -> onlineQueries.incrementAndGet();
            default -> hybridQueries.incrementAndGet();
        }

        // Record recent retrieval
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("query", query.length() > 80 ? query.substring(0, 80) + "..." : query);
        record.put("mode", result.getRetrievalMode());
        record.put("sourceCount", result.getSources().size());
        record.put("retrievalTimeMs", elapsed);
        record.put("internetAvailable", result.isInternetAvailable());
        record.put("timestamp", LocalDateTime.now().toString());
        synchronized (recentRetrievals) {
            recentRetrievals.add(0, record);
            if (recentRetrievals.size() > 20) recentRetrievals.remove(recentRetrievals.size() - 1);
        }

        // Separate local vs online sources for the response
        List<Map<String, String>> localSources = result.getSources().stream()
            .filter(s -> "local".equals(s.get("type")))
            .collect(Collectors.toList());
        List<Map<String, String>> onlineSources = result.getSources().stream()
            .filter(s -> "online".equals(s.get("type")))
            .collect(Collectors.toList());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("query", query);
        response.put("mode", mode);
        response.put("activeMode", result.getRetrievalMode());
        response.put("internetAvailable", result.isInternetAvailable());
        response.put("retrievalTimeMs", elapsed);
        response.put("totalSources", result.getSources().size());
        response.put("localSourceCount", localSources.size());
        response.put("onlineSourceCount", onlineSources.size());
        response.put("localSources", localSources);
        response.put("onlineSources", onlineSources);
        response.put("allSources", result.getSources());

        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/rag/recent
     * Returns recent retrieval history (last 20 queries this session).
     */
    @GetMapping("/recent")
    public ResponseEntity<List<Map<String, Object>>> getRecentRetrievals() {
        synchronized (recentRetrievals) {
            return ResponseEntity.ok(new ArrayList<>(recentRetrievals));
        }
    }

    /**
     * GET /api/rag/chunks
     * Returns the user's indexed knowledge base summary.
     */
    @GetMapping("/chunks")
    public ResponseEntity<Map<String, Object>> getUserChunks() {
        User user = getCurrentUser();
        if (user == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        List<PageChunk> chunks = chunkRepository.findByUserOrderByCreatedAtDesc(user);

        // Group by source document
        Map<String, List<PageChunk>> bySource = chunks.stream()
            .filter(c -> c.getSourceUrl() != null)
            .collect(Collectors.groupingBy(PageChunk::getSourceUrl));

        List<Map<String, Object>> documents = bySource.entrySet().stream()
            .map(entry -> {
                Map<String, Object> doc = new LinkedHashMap<>();
                PageChunk first = entry.getValue().get(0);
                doc.put("url", entry.getKey());
                doc.put("title", first.getSourceTitle() != null ? first.getSourceTitle() : "Untitled");
                doc.put("chunksCount", entry.getValue().size());
                doc.put("hasEmbeddings", entry.getValue().stream().anyMatch(c -> c.getEmbedding() != null && !c.getEmbedding().equals("[]")));
                doc.put("addedDate", first.getVisitDate() != null ? first.getVisitDate().toString() : "Unknown");
                doc.put("type", entry.getKey().startsWith("mentor:") ? "AI Guide" :
                         entry.getKey().startsWith("note:") ? "Note" :
                         entry.getKey().startsWith("session:") ? "Session" : "Web Document");
                return doc;
            })
            .sorted(Comparator.comparing(d -> (String) d.get("addedDate"), Comparator.reverseOrder()))
            .collect(Collectors.toList());

        long withEmbeddings = chunks.stream()
            .filter(c -> c.getEmbedding() != null && !c.getEmbedding().equals("[]"))
            .count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalChunks", chunks.size());
        result.put("totalDocuments", bySource.size());
        result.put("chunksWithEmbeddings", withEmbeddings);
        result.put("chunksWithoutEmbeddings", chunks.size() - withEmbeddings);
        result.put("embeddingCoverage", chunks.isEmpty() ? 0 : Math.round((withEmbeddings * 100.0) / chunks.size()));
        result.put("documents", documents);

        return ResponseEntity.ok(result);
    }

    /**
     * DELETE /api/rag/chunks/{url}
     * Remove a specific document from the knowledge base.
     */
    @DeleteMapping("/chunks")
    public ResponseEntity<Map<String, Object>> deleteChunk(@RequestParam String sourceUrl) {
        User user = getCurrentUser();
        if (user == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        chunkRepository.deleteBySourceUrl(sourceUrl);
        return ResponseEntity.ok(Map.of("message", "Document removed from knowledge base.", "url", sourceUrl));
    }

    /**
     * GET /api/rag/metrics
     * Aggregated session metrics for monitoring chart.
     */
    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Object>> getMetrics() {
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("totalQueries", totalQueries.get());
        metrics.put("offlineQueries", offlineQueries.get());
        metrics.put("onlineQueries", onlineQueries.get());
        metrics.put("hybridQueries", hybridQueries.get());

        long total = totalQueries.get();
        metrics.put("offlinePct", total == 0 ? 0 : Math.round((offlineQueries.get() * 100.0) / total));
        metrics.put("onlinePct", total == 0 ? 0 : Math.round((onlineQueries.get() * 100.0) / total));
        metrics.put("hybridPct", total == 0 ? 0 : Math.round((hybridQueries.get() * 100.0) / total));

        List<Map<String, Object>> recent;
        synchronized (recentRetrievals) {
            recent = new ArrayList<>(recentRetrievals.subList(0, Math.min(10, recentRetrievals.size())));
        }
        metrics.put("recentRetrievals", recent);

        return ResponseEntity.ok(metrics);
    }
}
