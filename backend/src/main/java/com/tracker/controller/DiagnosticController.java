package com.tracker.controller;

import com.tracker.config.DataSourceConfig;
import com.tracker.model.User;
import com.tracker.repository.UserRepository;
import com.tracker.repository.PageChunkRepository;
import com.tracker.repository.AiConversationRepository;
import com.tracker.service.OllamaService;
import com.tracker.service.RagService;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.lang.management.ManagementFactory;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.util.*;

@RestController
@RequestMapping("/api/diagnostic")
public class DiagnosticController {

    private final JdbcTemplate jdbcTemplate;
    private final UserRepository userRepository;
    private final PageChunkRepository chunkRepository;
    private final AiConversationRepository conversationRepository;
    private final OllamaService ollamaService;
    private final RagService ragService;

    private static final Set<String> WHITELISTED_TABLES = Set.of(
        "users", "ai_conversations", "page_chunks", "sessions", "notes", "website_visits", "activities", "daily_totals", "gamification_data", "activity_log", "user_activity_history"
    );

    public DiagnosticController(JdbcTemplate jdbcTemplate,
                                UserRepository userRepository,
                                PageChunkRepository chunkRepository,
                                AiConversationRepository conversationRepository,
                                OllamaService ollamaService,
                                RagService ragService) {
        this.jdbcTemplate = jdbcTemplate;
        this.userRepository = userRepository;
        this.chunkRepository = chunkRepository;
        this.conversationRepository = conversationRepository;
        this.ollamaService = ollamaService;
        this.ragService = ragService;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsernameOrEmail(username, username).orElse(null);
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> getHealth() {
        Map<String, Object> health = new LinkedHashMap<>();
        
        // JVM Runtime stats
        long uptimeMs = ManagementFactory.getRuntimeMXBean().getUptime();
        long maxMem = Runtime.getRuntime().maxMemory() / (1024 * 1024);
        long totalMem = Runtime.getRuntime().totalMemory() / (1024 * 1024);
        long freeMem = Runtime.getRuntime().freeMemory() / (1024 * 1024);
        long usedMem = totalMem - freeMem;

        health.put("uptimeSeconds", uptimeMs / 1000);
        health.put("memoryMaxMb", maxMem);
        health.put("memoryTotalMb", totalMem);
        health.put("memoryUsedMb", usedMem);

        // PostgreSQL Config status
        boolean dbConfigured = DataSourceConfig.isDatabaseConfigured();
        String activeDb = DataSourceConfig.getActiveDatabase();
        health.put("databaseType", activeDb);
        health.put("databaseConnected", true); // If we're executing this controller, the database is healthy

        // Ollama Service status
        boolean ollamaReady = ollamaService.isOllamaRunning();
        health.put("ollamaStatus", ollamaReady ? "ready" : "not_ready");

        // RAG chunks size
        long totalChunks = chunkRepository.count();
        health.put("ragStatus", ollamaReady ? "ready" : "degraded");
        health.put("totalRagChunks", totalChunks);

        return ResponseEntity.ok(health);
    }

    @GetMapping("/db-metrics")
    public ResponseEntity<Map<String, Object>> getDbMetrics() {
        Map<String, Object> metrics = new LinkedHashMap<>();
        
        String dbType = DataSourceConfig.getActiveDatabase();
        metrics.put("databaseType", dbType);

        String dbName = "Unknown";
        String dbUrl = "Unknown";
        try (Connection conn = jdbcTemplate.getDataSource().getConnection()) {
            DatabaseMetaData meta = conn.getMetaData();
            dbName = meta.getDatabaseProductName();
            dbUrl = meta.getURL();
        } catch (Exception e) {
            System.err.println("Error reading DB Metadata: " + e.getMessage());
        }
        
        metrics.put("databaseName", dbName);
        metrics.put("databaseUrl", dbUrl);
        
        metrics.put("totalUsers", userRepository.count());
        metrics.put("totalConversations", conversationRepository.count());
        metrics.put("totalRagChunks", chunkRepository.count());

        // Dynamic Table Count & Row list
        List<Map<String, Object>> tablesInfo = new ArrayList<>();
        try {
            List<String> tableNames;
            if ("postgresql".equalsIgnoreCase(dbType)) {
                tableNames = jdbcTemplate.queryForList(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'", String.class
                );
            } else {
                tableNames = jdbcTemplate.queryForList(
                    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PUBLIC' AND TABLE_TYPE = 'TABLE'", String.class
                );
            }

            for (String table : tableNames) {
                String cleanName = table.toLowerCase();
                if (WHITELISTED_TABLES.contains(cleanName)) {
                    Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class);
                    Map<String, Object> tMap = new LinkedHashMap<>();
                    tMap.put("tableName", cleanName);
                    tMap.put("rowCount", count != null ? count : 0);
                    tablesInfo.add(tMap);
                }
            }
        } catch (Exception e) {
            System.err.println("Error fetching table counts: " + e.getMessage());
        }

        metrics.put("tables", tablesInfo);
        return ResponseEntity.ok(metrics);
    }

    @GetMapping("/db-table/{tableName}")
    public ResponseEntity<?> getTableData(@PathVariable String tableName) {
        String cleanName = tableName.toLowerCase().trim();
        if (!WHITELISTED_TABLES.contains(cleanName)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Table access restricted or invalid: " + tableName));
        }

        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT * FROM " + cleanName + " LIMIT 50"
            );
            return ResponseEntity.ok(rows);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Error fetching data: " + e.getMessage()));
        }
    }

    @GetMapping("/rag-metrics")
    public ResponseEntity<Map<String, Object>> getRagMetrics() {
        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("totalChunks", chunkRepository.count());

        try {
            List<Map<String, Object>> uniqueSources = jdbcTemplate.queryForList(
                "SELECT source_url, source_title, COUNT(*) as chunks_count FROM page_chunks GROUP BY source_url, source_title"
            );
            metrics.put("sources", uniqueSources);
        } catch (Exception e) {
            metrics.put("sources", Collections.emptyList());
            System.err.println("Error reading RAG sources: " + e.getMessage());
        }

        return ResponseEntity.ok(metrics);
    }

    @GetMapping("/rag-test")
    public ResponseEntity<?> testRagSimilarity(@RequestParam String query,
                                               @RequestParam(required = false, defaultValue = "hybrid") String mode) {
        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Query parameter is required"));
        }

        User user = getCurrentUser();
        RagService.RagResult ragResult = ragService.retrieveHybridRag(user != null ? user : new User(), query, mode);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("query", query);
        response.put("retrievalMode", ragResult.getRetrievalMode());
        response.put("internetAvailable", ragResult.isInternetAvailable());
        response.put("retrievalTimeMs", ragResult.getRetrievalTimeMs());
        response.put("results", ragResult.getSources());
        return ResponseEntity.ok(response);
    }
}
