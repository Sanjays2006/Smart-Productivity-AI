package com.tracker.controller;

import com.tracker.model.User;
import com.tracker.model.UserActivityHistory;
import com.tracker.repository.UserActivityHistoryRepository;
import com.tracker.repository.UserRepository;
import com.tracker.repository.AiConversationRepository;
import com.tracker.repository.PageChunkRepository;
import com.tracker.repository.SessionRepository;
import com.tracker.service.ActivityTrackingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/activity")
public class ActivityIntelligenceController {

    private final UserRepository userRepository;
    private final UserActivityHistoryRepository historyRepository;
    private final ActivityTrackingService trackingService;
    private final AiConversationRepository conversationRepository;
    private final PageChunkRepository chunkRepository;
    private final SessionRepository sessionRepository;

    public ActivityIntelligenceController(UserRepository userRepository,
                                          UserActivityHistoryRepository historyRepository,
                                          ActivityTrackingService trackingService,
                                          AiConversationRepository conversationRepository,
                                          PageChunkRepository chunkRepository,
                                          SessionRepository sessionRepository) {
        this.userRepository = userRepository;
        this.historyRepository = historyRepository;
        this.trackingService = trackingService;
        this.conversationRepository = conversationRepository;
        this.chunkRepository = chunkRepository;
        this.sessionRepository = sessionRepository;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsernameOrEmail(username, username).orElse(null);
    }

    @PostMapping("/track")
    public ResponseEntity<?> trackActivity(@RequestBody Map<String, String> payload) {
        User user = getCurrentUser();
        if (user == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        String category = payload.getOrDefault("category", "DASHBOARD");
        String action = payload.getOrDefault("action", "INTERACTION");
        String description = payload.getOrDefault("description", "");
        String metadata = payload.getOrDefault("metadata", "");
        String relatedRecordId = payload.getOrDefault("relatedRecordId", "");

        trackingService.track(user.getId(), category, action, description, metadata, relatedRecordId);
        return ResponseEntity.ok(Map.of("status", "tracked"));
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchActivities(@RequestParam(required = false) String query,
                                              @RequestParam(required = false) String category,
                                              @RequestParam(required = false) String startDate,
                                              @RequestParam(required = false) String endDate) {
        User user = getCurrentUser();
        if (user == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        LocalDateTime start = null;
        LocalDateTime end = null;
        DateTimeFormatter formatter = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

        try {
            if (startDate != null && !startDate.isBlank()) {
                start = LocalDateTime.parse(startDate, formatter);
            }
            if (endDate != null && !endDate.isBlank()) {
                end = LocalDateTime.parse(endDate, formatter);
            }
        } catch (Exception e) {
            try {
                if (startDate != null && !startDate.isBlank()) {
                    start = LocalDate.parse(startDate).atStartOfDay();
                }
                if (endDate != null && !endDate.isBlank()) {
                    end = LocalDate.parse(endDate).atTime(23, 59, 59);
                }
            } catch (Exception ignored) {}
        }

        String queryLike = (query == null || query.isBlank()) ? null : "%" + query.trim().toLowerCase() + "%";

        List<UserActivityHistory> results = historyRepository.searchActivities(
                user.getId(),
                category == null || category.isBlank() ? null : category,
                queryLike,
                start,
                end
        );

        return ResponseEntity.ok(results);
    }

    @GetMapping("/analytics")
    public ResponseEntity<?> getAnalytics() {
        User user = getCurrentUser();
        if (user == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));

        Long userId = user.getId();
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime yesterdayStart = LocalDate.now().minusDays(1).atStartOfDay();
        LocalDateTime yesterdayEnd = LocalDate.now().minusDays(1).atTime(23, 59, 59);
        LocalDateTime weekStart = LocalDate.now().minusDays(7).atStartOfDay();
        LocalDateTime monthStart = LocalDate.now().minusDays(30).atStartOfDay();

        long todayCount = historyRepository.countByUserIdAndTimestampGreaterThanEqual(userId, todayStart);
        long yesterdayCount = historyRepository.countByUserIdAndTimestampBetween(userId, yesterdayStart, yesterdayEnd);
        long weeklyCount = historyRepository.countByUserIdAndTimestampGreaterThanEqual(userId, weekStart);
        long monthlyCount = historyRepository.countByUserIdAndTimestampGreaterThanEqual(userId, monthStart);

        long totalConversations = conversationRepository.countByUser(user);
        long totalAiRequests = historyRepository.countByUserIdAndActivityType(userId, "PROMPT_SEND");
        long totalChunks = chunkRepository.findByUserOrderByCreatedAtDesc(user).size();
        
        long totalDocs = chunkRepository.findByUserOrderByCreatedAtDesc(user).stream()
                .filter(c -> c.getSourceUrl() != null)
                .map(com.tracker.model.PageChunk::getSourceUrl)
                .distinct()
                .count();

        long ragQueries = historyRepository.countByUserIdAndCategory(userId, "RAG");
        long learningSessions = historyRepository.countByUserIdAndCategory(userId, "LEARNING");

        // Focus Time
        List<com.tracker.model.Session> sessions = sessionRepository.findByUserOrderByStartTimeDesc(user);
        long totalFocusSecondsToday = sessions.stream()
                .filter(s -> s.getStartTime() != null && s.getStartTime().isAfter(todayStart) && s.getDurationSeconds() != null)
                .mapToLong(com.tracker.model.Session::getDurationSeconds)
                .sum();
        long totalFocusSecondsWeek = sessions.stream()
                .filter(s -> s.getStartTime() != null && s.getStartTime().isAfter(weekStart) && s.getDurationSeconds() != null)
                .mapToLong(com.tracker.model.Session::getDurationSeconds)
                .sum();

        long focusTimeTodayMinutes = totalFocusSecondsToday / 60;
        long focusTimeWeekMinutes = totalFocusSecondsWeek / 60;

        // Productivity score
        long productivityScore = Math.min(100L, focusTimeTodayMinutes * 2);

        // Engagement breakdown
        Map<String, Long> categoryCounts = new LinkedHashMap<>();
        for (String cat : List.of("AUTH", "CHAT", "DOCUMENT", "RAG", "NOTE", "TIMER", "LEARNING", "DASHBOARD")) {
            categoryCounts.put(cat, historyRepository.countByUserIdAndCategory(userId, cat));
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("todayCount", todayCount);
        response.put("yesterdayCount", yesterdayCount);
        response.put("weeklyCount", weeklyCount);
        response.put("monthlyCount", monthlyCount);
        response.put("totalConversations", totalConversations);
        response.put("totalAiRequests", totalAiRequests);
        response.put("documentsProcessed", totalDocs);
        response.put("chunksCreated", totalChunks);
        response.put("ragQueries", ragQueries);
        response.put("learningSessions", learningSessions);
        response.put("focusTimeTodayMinutes", focusTimeTodayMinutes);
        response.put("focusTimeWeekMinutes", focusTimeWeekMinutes);
        response.put("productivityScore", productivityScore);
        response.put("categoryCounts", categoryCounts);

        return ResponseEntity.ok(response);
    }
}
