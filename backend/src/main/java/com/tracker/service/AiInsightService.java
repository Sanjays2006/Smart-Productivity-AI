package com.tracker.service;

import com.tracker.model.*;
import com.tracker.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AiInsightService {

    // ─── Caching System for Async Ollama Calls ────────────────────────
    private static class BriefingCacheEntry {
        final String prediction;
        final String coaching;
        final long timestamp;

        BriefingCacheEntry(String prediction, String coaching) {
            this.prediction = prediction;
            this.coaching = coaching;
            this.timestamp = System.currentTimeMillis();
        }
    }

    private static class AnalyticsCacheEntry {
        final List<String> insights;
        final long timestamp;

        AnalyticsCacheEntry(List<String> insights) {
            this.insights = insights;
            this.timestamp = System.currentTimeMillis();
        }
    }

    private final Map<Long, BriefingCacheEntry> briefingCache = new java.util.concurrent.ConcurrentHashMap<>();
    private final Map<Long, AnalyticsCacheEntry> analyticsCache = new java.util.concurrent.ConcurrentHashMap<>();
    private final Map<Long, Boolean> briefingRefreshInProgress = new java.util.concurrent.ConcurrentHashMap<>();
    private final Map<Long, Boolean> analyticsRefreshInProgress = new java.util.concurrent.ConcurrentHashMap<>();

    private final OllamaService ollamaService;
    private final SessionRepository sessionRepository;
    private final DailyTotalRepository dailyTotalRepository;
    private final NoteRepository noteRepository;
    private final UserActivityHistoryRepository historyRepository;
    private final AiConversationRepository conversationRepository;
    private final PageChunkRepository chunkRepository;
    private final GamificationRepository gamificationRepository;

    public AiInsightService(OllamaService ollamaService, 
                            SessionRepository sessionRepository,
                            DailyTotalRepository dailyTotalRepository,
                            NoteRepository noteRepository,
                            UserActivityHistoryRepository historyRepository,
                            AiConversationRepository conversationRepository,
                            PageChunkRepository chunkRepository,
                            GamificationRepository gamificationRepository) {
        this.ollamaService = ollamaService;
        this.sessionRepository = sessionRepository;
        this.dailyTotalRepository = dailyTotalRepository;
        this.noteRepository = noteRepository;
        this.historyRepository = historyRepository;
        this.conversationRepository = conversationRepository;
        this.chunkRepository = chunkRepository;
        this.gamificationRepository = gamificationRepository;
    }

    public Map<String, Object> generateProductivityAnalytics(User user) {
        Map<String, Object> analytics = new LinkedHashMap<>();

        // 1. Gather context from PostgreSQL
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime weekAgo = now.minusDays(7);
        LocalDateTime twoWeeksAgo = now.minusDays(14);

        List<Session> recentSessions = sessionRepository.findByUserAndStartTimeBetween(user, weekAgo, now)
                .stream()
                .filter(s -> s.getEndTime() != null)
                .collect(Collectors.toList());

        List<Session> lastWeekSessions = sessionRepository.findByUserAndStartTimeBetween(user, twoWeeksAgo, weekAgo)
                .stream()
                .filter(s -> s.getEndTime() != null)
                .collect(Collectors.toList());

        List<DailyTotal> dailyTotals = dailyTotalRepository.findTop7ByUserOrderByRecordDateDesc(user);

        // 2. Calculate Stats
        int totalSessions = recentSessions.size();
        long totalSeconds = recentSessions.stream().filter(s -> s.getDurationSeconds() != null).mapToLong(Session::getDurationSeconds).sum();
        long avgSeconds = totalSessions > 0 ? totalSeconds / totalSessions : 0;
        
        long lastWeekSeconds = lastWeekSessions.stream().filter(s -> s.getDurationSeconds() != null).mapToLong(Session::getDurationSeconds).sum();
        double thisWeekHours = totalSeconds / 3600.0;
        double lastWeekHours = lastWeekSeconds / 3600.0;

        String weeklyComparison = "0%";
        if (lastWeekSeconds > 0) {
            double percentChange = ((double)(totalSeconds - lastWeekSeconds) / lastWeekSeconds) * 100;
            weeklyComparison = String.format(Locale.US, "%+.1f%%", percentChange);
        } else if (totalSeconds > 0) {
            weeklyComparison = "+100%";
        }

        // Find Peak Focus Hour
        int peakHour = calculatePeakFocusHour(recentSessions);
        String peakHourStr = formatHourRange(peakHour);

        // Find Primary Category
        String primaryCategory = calculatePrimaryCategory(recentSessions);

        // Calculate Consistency Score (percentage of active days in past 7 days)
        long activeDays = dailyTotals.stream().filter(dt -> dt.getTotalSeconds() != null && dt.getTotalSeconds() > 0).count();
        int consistencyScore = (int) Math.round((activeDays / 7.0) * 100);

        // Compute Focus Score (based on total focus hours vs a daily 2h benchmark)
        double totalHours = totalSeconds / 3600.0;
        int focusScore = (int) Math.min(100, Math.round((totalHours / 14.0) * 100)); // 14 hours per week is the 2h/day benchmark

        // 3. Generate Intelligent Insights (Ollama or Fallback via Cache)
        List<String> insightsList = new ArrayList<>();
        AnalyticsCacheEntry cacheEntry = analyticsCache.get(user.getId());
        if (cacheEntry == null) {
            triggerAnalyticsRefresh(user, recentSessions, dailyTotals, peakHourStr, primaryCategory, consistencyScore, totalSessions, totalHours);
            insightsList = generateLocalInsights(totalSessions, totalHours, peakHourStr, primaryCategory, consistencyScore);
        } else {
            if (System.currentTimeMillis() - cacheEntry.timestamp > 900_000) { // 15 mins stale
                triggerAnalyticsRefresh(user, recentSessions, dailyTotals, peakHourStr, primaryCategory, consistencyScore, totalSessions, totalHours);
            }
            insightsList = cacheEntry.insights;
        }

        // 4. Populate structured response
        analytics.put("insights", insightsList);
        analytics.put("focusScore", focusScore);
        analytics.put("totalFocusHours", Math.round(totalHours * 10.0) / 10.0);
        analytics.put("totalSessions", totalSessions);
        analytics.put("weeklyComparison", weeklyComparison);
        analytics.put("thisWeekHours", Math.round(thisWeekHours * 10.0) / 10.0);
        analytics.put("lastWeekHours", Math.round(lastWeekHours * 10.0) / 10.0);

        // Focus Patterns Card
        Map<String, Object> patterns = new LinkedHashMap<>();
        patterns.put("peakHour", peakHourStr);
        patterns.put("avgDuration", (avgSeconds / 60) + " mins");
        patterns.put("primaryCategory", primaryCategory);
        patterns.put("consistencyScore", consistencyScore + "%");
        analytics.put("focusPatterns", patterns);

        // Behavioral Analytics Cards
        List<Map<String, Object>> behavioral = new ArrayList<>();
        
        // Card 1: Focus Endurance
        Map<String, Object> b1 = new LinkedHashMap<>();
        b1.put("title", "Focus Endurance");
        b1.put("description", totalSessions > 0 && (avgSeconds / 60) >= 45 
            ? "Outstanding concentration spans. Your average study duration exceeds 45 minutes."
            : "Focus chunks are short but frequent. Consider extending focus blocks to 45 mins to reach flow state.");
        b1.put("confidence", totalSessions > 0 ? Math.min(98, 50 + (avgSeconds / 60)) : 50);
        b1.put("trend", (avgSeconds / 60) >= 30 ? "UP" : "STABLE");
        behavioral.add(b1);

        // Card 2: Habit Consistency
        Map<String, Object> b2 = new LinkedHashMap<>();
        b2.put("title", "Habit Consistency");
        b2.put("description", consistencyScore >= 70 
            ? "Excellent weekly execution. You log deep focus blocks on most days."
            : "Your consistency fluctuates. Aim to log at least one Pomodoro session daily.");
        b2.put("confidence", Math.min(99, 40 + consistencyScore));
        b2.put("trend", consistencyScore >= 50 ? "UP" : "DOWN");
        behavioral.add(b2);

        // Card 3: Cognitive Versatility
        Map<String, Object> b3 = new LinkedHashMap<>();
        long uniqueActs = recentSessions.stream().map(s -> s.getActivity() != null ? s.getActivity().getName() : "Unknown").distinct().count();
        b3.put("title", "Cognitive Versatility");
        b3.put("description", uniqueActs >= 3 
            ? "Diverse workflow coverage. You segment tasks effectively across multiple activity profiles."
            : "High specialization. You focus heavily on " + primaryCategory + ". Consider segmenting other topics.");
        b3.put("confidence", Math.min(95, 30 + (int)(uniqueActs * 20)));
        b3.put("trend", uniqueActs >= 2 ? "UP" : "STABLE");
        behavioral.add(b3);

        analytics.put("behavioralAnalytics", behavioral);

        return analytics;
    }

    private int calculatePeakFocusHour(List<Session> sessions) {
        if (sessions.isEmpty()) return 9; // Default to 9 AM
        Map<Integer, Long> hourCounts = sessions.stream()
                .collect(Collectors.groupingBy(s -> s.getStartTime().getHour(), Collectors.counting()));
        return hourCounts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(9);
    }

    private String formatHourRange(int hour) {
        int nextHour = (hour + 2) % 24;
        String startPeriod = hour >= 12 ? "PM" : "AM";
        String endPeriod = nextHour >= 12 ? "PM" : "AM";
        
        int displayStart = hour % 12 == 0 ? 12 : hour % 12;
        int displayEnd = nextHour % 12 == 0 ? 12 : nextHour % 12;

        return displayStart + ":00 " + startPeriod + " - " + displayEnd + ":00 " + endPeriod;
    }

    private String calculatePrimaryCategory(List<Session> sessions) {
        if (sessions.isEmpty()) return "None";
        Map<String, Long> categoryCounts = sessions.stream()
                .collect(Collectors.groupingBy(s -> s.getActivity() != null ? s.getActivity().getName() : "Unknown", Collectors.counting()));
        return categoryCounts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("Study");
    }

    private String buildAnalyticsPrompt(User user, List<Session> sessions, List<DailyTotal> totals, 
                                         String peakHour, String category, int consistency) {
        StringBuilder sb = new StringBuilder();
        sb.append("Analyze productivity metrics for explorer ").append(user.getDisplayName()).append(":\n");
        sb.append("- Peak study interval: ").append(peakHour).append("\n");
        sb.append("- Primary topic: ").append(category).append("\n");
        sb.append("- Active days ratio: ").append(consistency).append("%\n");
        sb.append("- Recent sessions: ").append(sessions.size()).append("\n");
        sb.append("Provide 2 concise, intelligent study recommendations based on these statistics. ");
        sb.append("Format output exactly as a JSON array of strings: [\"Recommendation 1\", \"Recommendation 2\"]. ");
        sb.append("Do not add Markdown comments or formatting besides the JSON array.");
        return sb.toString();
    }

    private List<String> generateLocalInsights(int sessions, double hours, String peakHour, String category, int consistency) {
        List<String> list = new ArrayList<>();
        if (sessions == 0) {
            list.add("No focus data found. Complete your first focus session to generate study insights.");
            list.add("Create study notes or chat with the AI assistant to log progression.");
            return list;
        }

        list.add("Your study activity peaks during " + peakHour + ". Capitalize on this peak energy window for challenging deep work.");
        
        if (consistency >= 70) {
            list.add("Excellent execution! Your consistency rating stands at " + consistency + "% this week. Keep maintaining this streak.");
        } else {
            list.add("Consistency check: You are active on " + Math.round(consistency/14.0) + " days out of 7. Try loading a 25-minute Pomodoro daily.");
        }

        if (!"None".equals(category)) {
            list.add("Your primary topic is " + category + ". Ensure you allocate buffer review times to prevent study fatigue.");
        }

        return list.subList(0, Math.min(list.size(), 3));
    }

    // Deprecated but maintained for compatibility
    public String generatePersonalizedInsights(User user) {
        Map<String, Object> analytics = generateProductivityAnalytics(user);
        List<?> insights = (List<?>) analytics.get("insights");
        return insights.stream().map(Object::toString).collect(Collectors.joining("\n"));
    }

    public Map<String, Object> generateDailyBriefing(User user) {
        Map<String, Object> briefing = new LinkedHashMap<>();

        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime todayEnd = LocalDate.now().plusDays(1).atStartOfDay().minusSeconds(1);

        // Fetch today's totals
        DailyTotal todayTotal = dailyTotalRepository.findByUserAndRecordDate(user, LocalDate.now())
                .orElse(new DailyTotal(LocalDate.now()));
        int totalSeconds = todayTotal.getTotalSeconds() != null ? todayTotal.getTotalSeconds() : 0;
        int sessionsCount = todayTotal.getSessionsCompleted() != null ? todayTotal.getSessionsCompleted() : 0;

        int goalSecs = user.getDailyFocusGoal() != null ? user.getDailyFocusGoal() : 7200;
        int pct = Math.min((int) Math.round((totalSeconds / (double) goalSecs) * 100), 100);

        // Daily focus summary
        int h = totalSeconds / 3600;
        int m = (totalSeconds % 3600) / 60;
        String focusSummary = String.format("Logged %dh %dm across %d session%s today.", h, m, sessionsCount, sessionsCount == 1 ? "" : "s");
        if (totalSeconds == 0) {
            focusSummary = "No focus sessions logged yet today. Use the timer to start your first session!";
        }
        briefing.put("dailyFocusSummary", focusSummary);

        // Active goals
        List<Map<String, Object>> activeGoals = new ArrayList<>();
        Map<String, Object> focusGoal = new LinkedHashMap<>();
        focusGoal.put("name", "Daily Focus Time");
        focusGoal.put("target", String.format("%dh", goalSecs / 3600));
        focusGoal.put("current", String.format("%dh %dm", h, m));
        focusGoal.put("pct", pct);
        activeGoals.add(focusGoal);

        // Add note goal if appropriate
        long notesToday = noteRepository.findByUserOrderByCreatedAtDesc(user).stream()
                .filter(n -> n.getCreatedAt() != null && n.getCreatedAt().isAfter(todayStart))
                .count();
        Map<String, Object> noteGoal = new LinkedHashMap<>();
        noteGoal.put("name", "Neural Note Capture");
        noteGoal.put("target", "1 note");
        noteGoal.put("current", String.format("%d note%s", notesToday, notesToday == 1 ? "" : "s"));
        noteGoal.put("pct", notesToday >= 1 ? 100 : 0);
        activeGoals.add(noteGoal);

        briefing.put("activeGoals", activeGoals);

        // Streak
        GamificationData gam = gamificationRepository.findByUser(user).orElse(null);
        int currentStreak = gam != null && gam.getCurrentStreak() != null ? gam.getCurrentStreak() : 0;
        briefing.put("currentStreak", currentStreak);

        // Recommended learning topics
        List<String> recommendedTopics = new ArrayList<>();
        if (user.getSelectedTopics() != null && !user.getSelectedTopics().isBlank()) {
            recommendedTopics.addAll(Arrays.stream(user.getSelectedTopics().split(","))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .limit(2)
                    .collect(Collectors.toList()));
        }
        if (recommendedTopics.isEmpty() && user.getCustomInterests() != null && !user.getCustomInterests().isBlank()) {
            recommendedTopics.addAll(Arrays.stream(user.getCustomInterests().split(","))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .limit(2)
                    .collect(Collectors.toList()));
        }
        if (recommendedTopics.isEmpty()) {
            recommendedTopics.add("Java Concurrency");
            recommendedTopics.add("Spring Boot Architecture");
        }
        briefing.put("recommendedTopics", recommendedTopics);

        // Pending activities
        List<String> pendingActivities = new ArrayList<>();
        if (pct < 100) {
            int remainingMins = Math.max(1, (goalSecs - totalSeconds) / 60);
            pendingActivities.add(String.format("Log another %d minutes of study to hit focus goal", remainingMins));
        } else {
            pendingActivities.add("Daily focus target achieved! ✓");
        }
        if (notesToday == 0) {
            pendingActivities.add("Capture a conceptual note to consolidate today's learnings");
        }
        long chatsToday = conversationRepository.findTop20ByUserOrderByCreatedAtDesc(user).stream()
                .filter(c -> c.getCreatedAt() != null && c.getCreatedAt().isAfter(todayStart))
                .count();
        if (chatsToday == 0) {
            pendingActivities.add("Ask the AI assistant to review your project plan");
        }
        briefing.put("pendingActivities", pendingActivities);

        // Predictions and Recommendations (Ollama or Fallback via Cache)
        String prediction = "Medium focus density expected. Log a session to build momentum.";
        String coaching = "Consider starting a 25-minute Pomodoro session to establish rhythm.";

        BriefingCacheEntry briefingEntry = briefingCache.get(user.getId());
        if (briefingEntry == null) {
            triggerBriefingRefresh(user, h, m, goalSecs, sessionsCount, notesToday, chatsToday, currentStreak);
            
            // Build default fallbacks
            if (pct >= 100) {
                prediction = "Daily goal achieved! Focus synergy is extremely high. Great job today.";
                coaching = "Take time to decompress and review your notes to cement today's learning.";
            } else if (pct >= 50) {
                prediction = "Strong momentum detected. You are halfway to your goal and likely to complete it.";
            } else if (currentStreak > 3) {
                prediction = "High streak consistency! Your habit streak predicts a highly productive flow state today.";
            }
            
            if (coaching.equals("Consider starting a 25-minute Pomodoro session to establish rhythm.")) {
                if (notesToday == 0 && totalSeconds > 0) {
                    coaching = "Try documenting what you worked on in a note to aid long-term memory synthesis.";
                } else if (totalSeconds > 10800) {
                    coaching = "Excellent focus volume. Ensure you are taking regular breaks to avoid burnout.";
                }
            }
        } else {
            if (System.currentTimeMillis() - briefingEntry.timestamp > 900_000) { // 15 mins stale
                triggerBriefingRefresh(user, h, m, goalSecs, sessionsCount, notesToday, chatsToday, currentStreak);
            }
            prediction = briefingEntry.prediction;
            coaching = briefingEntry.coaching;
        }

        briefing.put("productivityPrediction", prediction);
        briefing.put("coachingRecommendations", coaching);

        return briefing;
    }

    private void triggerAnalyticsRefresh(User user, List<Session> recentSessions, List<DailyTotal> dailyTotals,
                                          String peakHourStr, String primaryCategory, int consistencyScore, int totalSessions, double totalHours) {
        Long userId = user.getId();
        if (analyticsRefreshInProgress.putIfAbsent(userId, true) != null) {
            return; // Already refreshing
        }

        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                if (!ollamaService.isOllamaRunning()) {
                    return;
                }
                String prompt = buildAnalyticsPrompt(user, recentSessions, dailyTotals, peakHourStr, primaryCategory, consistencyScore);
                String response = ollamaService.ask(prompt);
                List<String> list = new ArrayList<>();
                if (response.contains("[")) {
                    response = response.substring(response.indexOf("["), response.lastIndexOf("]") + 1);
                    response = response.replaceAll("[\\[\\]\"]", "");
                    list = Arrays.stream(response.split(","))
                            .map(String::trim)
                            .filter(s -> s.length() > 5)
                            .collect(Collectors.toList());
                } else {
                    list = Arrays.stream(response.split("\n"))
                            .map(String::trim)
                            .filter(s -> s.length() > 10)
                            .collect(Collectors.toList());
                }

                if (!list.isEmpty()) {
                    analyticsCache.put(userId, new AnalyticsCacheEntry(list));
                }
            } catch (Exception e) {
                System.err.println("Async Ollama analytics generation failed: " + e.getMessage());
            } finally {
                analyticsRefreshInProgress.remove(userId);
            }
        });
    }

    private void triggerBriefingRefresh(User user, int h, int m, int goalSecs, int sessionsCount, long notesToday, long chatsToday, int currentStreak) {
        Long userId = user.getId();
        if (briefingRefreshInProgress.putIfAbsent(userId, true) != null) {
            return; // Already refreshing
        }

        java.util.concurrent.CompletableFuture.runAsync(() -> {
            try {
                if (!ollamaService.isOllamaRunning()) {
                    return;
                }
                StringBuilder prompt = new StringBuilder();
                prompt.append("Generate a brief daily report for productivity user: ").append(user.getDisplayName()).append(".\n");
                prompt.append("Today's stats:\n");
                prompt.append("- Focus time logged: ").append(h).append("h ").append(m).append("m (Goal: ").append(goalSecs / 3600).append("h)\n");
                prompt.append("- Focus sessions completed: ").append(sessionsCount).append("\n");
                prompt.append("- Study notes written today: ").append(notesToday).append("\n");
                prompt.append("- AI chats engaged today: ").append(chatsToday).append("\n");
                prompt.append("- Current daily streak: ").append(currentStreak).append(" days\n");
                prompt.append("Based on this, predict today's focus capability and recommend a productivity/study adjustment.\n");
                prompt.append("Format the response EXACTLY as a JSON object with keys 'prediction' and 'coaching'. Do not write any markdown code fences or text outside of the raw JSON object.");

                String answer = ollamaService.ask(prompt.toString());
                String prediction = null;
                String coaching = null;

                if (answer.contains("{") && answer.contains("}")) {
                    int startIdx = answer.indexOf("{");
                    int endIdx = answer.lastIndexOf("}") + 1;
                    String json = answer.substring(startIdx, endIdx);
                    int predKey = json.indexOf("\"prediction\"");
                    int coachKey = json.indexOf("\"coaching\"");
                    if (predKey != -1 && coachKey != -1) {
                        String subPred = json.substring(predKey + 12);
                        int col1 = subPred.indexOf(":");
                        int quoteStart1 = subPred.indexOf("\"", col1);
                        int quoteEnd1 = subPred.indexOf("\"", quoteStart1 + 1);
                        prediction = subPred.substring(quoteStart1 + 1, quoteEnd1);

                        String subCoach = json.substring(coachKey + 10);
                        int col2 = subCoach.indexOf(":");
                        int quoteStart2 = subCoach.indexOf("\"", col2);
                        int quoteEnd2 = subCoach.indexOf("\"", quoteStart2 + 1);
                        coaching = subCoach.substring(quoteStart2 + 1, quoteEnd2);
                    }
                }

                if (prediction != null && coaching != null) {
                    briefingCache.put(userId, new BriefingCacheEntry(prediction, coaching));
                }
            } catch (Exception e) {
                System.err.println("Async Ollama briefing generation failed: " + e.getMessage());
            } finally {
                briefingRefreshInProgress.remove(userId);
            }
        });
    }
}
