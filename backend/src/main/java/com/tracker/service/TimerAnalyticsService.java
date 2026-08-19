package com.tracker.service;

import com.tracker.model.*;
import com.tracker.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TimerAnalyticsService {

    private final SessionRepository sessionRepository;
    private final DailyTotalRepository dailyTotalRepository;
    private final GamificationRepository gamificationRepository;
    private final OllamaService ollamaService;

    public TimerAnalyticsService(SessionRepository sessionRepository,
                                 DailyTotalRepository dailyTotalRepository,
                                 GamificationRepository gamificationRepository,
                                 OllamaService ollamaService) {
        this.sessionRepository = sessionRepository;
        this.dailyTotalRepository = dailyTotalRepository;
        this.gamificationRepository = gamificationRepository;
        this.ollamaService = ollamaService;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getTimerAnalytics(User user) {
        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();
        LocalDateTime sevenDaysAgo = LocalDate.now().minusDays(7).atStartOfDay();
        LocalDateTime thirtyDaysAgo = LocalDate.now().minusDays(30).atStartOfDay();

        List<Session> allSessions = sessionRepository.findByUserOrderByStartTimeDesc(user);
        List<Session> completedSessions = allSessions.stream()
                .filter(s -> "COMPLETED".equals(s.getStatus()) && s.getDurationSeconds() != null)
                .collect(Collectors.toList());

        // 1. Total Focus Time Today
        long focusTimeTodaySeconds = completedSessions.stream()
                .filter(s -> s.getStartTime() != null && s.getStartTime().isAfter(startOfToday) && s.getDurationSeconds() != null)
                .mapToLong(Session::getDurationSeconds)
                .sum();

        // 2. Weekly Focus Hours
        long focusTimeWeekSeconds = completedSessions.stream()
                .filter(s -> s.getStartTime() != null && s.getStartTime().isAfter(sevenDaysAgo) && s.getDurationSeconds() != null)
                .mapToLong(Session::getDurationSeconds)
                .sum();
        double weeklyFocusHours = Math.round((focusTimeWeekSeconds / 3600.0) * 10.0) / 10.0;

        // 3. Monthly Focus seconds (Productivity indicator)
        long focusTimeMonthSeconds = completedSessions.stream()
                .filter(s -> s.getStartTime() != null && s.getStartTime().isAfter(thirtyDaysAgo) && s.getDurationSeconds() != null)
                .mapToLong(Session::getDurationSeconds)
                .sum();

        // 4. Completed Sessions Count
        long completedSessionsCount = completedSessions.size();

        // 5. Streaks and Profile focus stats from Gamification Profile
        GamificationData gam = gamificationRepository.findByUser(user).orElse(null);
        int bestStreak = gam != null && gam.getLongestStreak() != null ? gam.getLongestStreak() : 0;
        int currentStreak = gam != null && gam.getCurrentStreak() != null ? gam.getCurrentStreak() : 0;

        // 6. Average Session Length (minutes)
        double avgSessionLengthMinutes = 0;
        if (completedSessionsCount > 0) {
            double avgSeconds = completedSessions.stream()
                    .filter(s -> s.getDurationSeconds() != null)
                    .mapToDouble(Session::getDurationSeconds)
                    .average()
                    .orElse(0.0);
            avgSessionLengthMinutes = Math.round((avgSeconds / 60.0) * 10.0) / 10.0;
        }

        // 7. Focus Distribution by Category (minutes per category)
        Map<String, Double> categoryDistribution = new LinkedHashMap<>();
        for (Session s : completedSessions) {
            Activity act = s.getActivity();
            if (act != null && s.getDurationSeconds() != null) {
                String cat = act.getCategory() != null ? act.getCategory() : "CUSTOM";
                double mins = s.getDurationSeconds() / 60.0;
                categoryDistribution.put(cat, categoryDistribution.getOrDefault(cat, 0.0) + mins);
            }
        }
        // Round values
        categoryDistribution.forEach((key, val) -> {
            categoryDistribution.put(key, Math.round(val * 10.0) / 10.0);
        });

        // 8. Weekly Focus Trend (minutes per day for the last 7 days)
        Map<String, Double> weeklyFocusTrend = new LinkedHashMap<>();
        Map<String, List<Integer>> weeklyProductivityTrendScores = new LinkedHashMap<>();
        DateTimeFormatter trendFormatter = DateTimeFormatter.ofPattern("EEE (MM/dd)");

        for (int i = 6; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            String label = date.format(trendFormatter);
            weeklyFocusTrend.put(label, 0.0);
            weeklyProductivityTrendScores.put(label, new ArrayList<>());
        }

        for (Session s : completedSessions) {
            if (s.getStartTime() != null && s.getStartTime().isAfter(sevenDaysAgo)) {
                String label = s.getStartTime().toLocalDate().format(trendFormatter);
                if (weeklyFocusTrend.containsKey(label)) {
                    double mins = s.getDurationSeconds() != null ? s.getDurationSeconds() / 60.0 : 0.0;
                    weeklyFocusTrend.put(label, weeklyFocusTrend.get(label) + mins);
                }
                if (weeklyProductivityTrendScores.containsKey(label) && s.getFocusScore() != null) {
                    weeklyProductivityTrendScores.get(label).add(s.getFocusScore());
                }
            }
        }

        // Round trend values
        weeklyFocusTrend.forEach((key, val) -> {
            weeklyFocusTrend.put(key, Math.round(val * 10.0) / 10.0);
        });

        // 9. Productivity Trend (average focus score per day)
        Map<String, Double> weeklyProductivityTrend = new LinkedHashMap<>();
        weeklyProductivityTrendScores.forEach((key, list) -> {
            if (list.isEmpty()) {
                weeklyProductivityTrend.put(key, 0.0);
            } else {
                double avg = list.stream().mapToDouble(val -> val).average().orElse(0.0);
                weeklyProductivityTrend.put(key, Math.round(avg * 10.0) / 10.0);
            }
        });

        // 10. Heatmap Data (focus seconds per day for last 30 days)
        Map<String, Integer> heatmapData = new LinkedHashMap<>();
        DateTimeFormatter heatmapFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        for (int i = 29; i >= 0; i--) {
            String label = LocalDate.now().minusDays(i).format(heatmapFormatter);
            heatmapData.put(label, 0);
        }
        for (Session s : completedSessions) {
            if (s.getStartTime() != null && s.getStartTime().isAfter(thirtyDaysAgo)) {
                String label = s.getStartTime().toLocalDate().format(heatmapFormatter);
                if (heatmapData.containsKey(label)) {
                    int addSecs = s.getDurationSeconds() != null ? s.getDurationSeconds() : 0;
                    heatmapData.put(label, heatmapData.get(label) + addSecs);
                }
            }
        }

        // 11. AI Recommendation Generation
        String aiRecommendation = generateAiRecommendation(user, completedSessionsCount, weeklyFocusHours, avgSessionLengthMinutes, categoryDistribution);

        // 12. Productivity and Consistency Scores
        double productivityScore = 0.0;
        if (completedSessionsCount > 0) {
            productivityScore = completedSessions.stream()
                    .mapToDouble(s -> s.getFocusScore() != null ? s.getFocusScore() : 0.0)
                    .average()
                    .orElse(0.0);
            productivityScore = Math.round(productivityScore * 10.0) / 10.0;
        }

        double focusConsistencyScore = 0.0;
        Set<LocalDate> distinctDaysFocused = completedSessions.stream()
                .filter(s -> s.getStartTime() != null && s.getStartTime().isAfter(sevenDaysAgo))
                .map(s -> s.getStartTime().toLocalDate())
                .collect(Collectors.toSet());
        focusConsistencyScore = (distinctDaysFocused.size() / 7.0) * 100.0;
        focusConsistencyScore = Math.round(focusConsistencyScore * 10.0) / 10.0;

        // 13. Smart Break Advisor
        String breakRecommendation = "Ready for action! Start a 25-minute Pomodoro focus session to kickstart your productivity.";
        if (completedSessionsCount > 0) {
            Session lastSession = completedSessions.get(0);
            if (lastSession.getEndTime() != null) {
                long minsSinceLast = Duration.between(lastSession.getEndTime(), LocalDateTime.now()).toMinutes();
                if (minsSinceLast < 45) {
                    if (lastSession.getDurationSeconds() >= 2700 && lastSession.getFocusScore() >= 80) {
                        breakRecommendation = "Excellent deep work cycle completed! We recommend a 15-20 minute cognitive break. Step away from screens, hydrate, and stretch.";
                    } else if (lastSession.getDurationSeconds() >= 1200) {
                        breakRecommendation = "Great focus! A 5-minute break is recommended. Rest your eyes and take a brief walk.";
                    } else {
                        breakRecommendation = "Quick session completed. Take a 2-3 minute micro-break to stretch before your next task.";
                    }
                } else {
                    breakRecommendation = "It's been a while since your last deep focus session. Ready to begin your next Pomodoro?";
                }
            }
        }

        Map<String, Object> analytics = new LinkedHashMap<>();
        analytics.put("focusTimeTodayMinutes", Math.round((focusTimeTodaySeconds / 60.0) * 10.0) / 10.0);
        analytics.put("weeklyFocusHours", weeklyFocusHours);
        analytics.put("monthlyFocusMinutes", Math.round((focusTimeMonthSeconds / 60.0) * 10.0) / 10.0);
        analytics.put("completedSessionsCount", completedSessionsCount);
        analytics.put("bestStreak", bestStreak);
        analytics.put("currentStreak", currentStreak);
        analytics.put("averageSessionLengthMinutes", avgSessionLengthMinutes);
        analytics.put("categoryDistribution", categoryDistribution);
        analytics.put("weeklyFocusTrend", weeklyFocusTrend);
        analytics.put("weeklyProductivityTrend", weeklyProductivityTrend);
        analytics.put("heatmapData", heatmapData);
        analytics.put("aiRecommendation", aiRecommendation);
        analytics.put("productivityScore", productivityScore);
        analytics.put("focusConsistencyScore", focusConsistencyScore);
        analytics.put("breakRecommendation", breakRecommendation);

        return analytics;
    }

    private String generateAiRecommendation(User user, long sessionsCount, double weeklyHours, double avgMins, Map<String, Double> categoryDist) {
        if (sessionsCount == 0) {
            return "No deep work history available yet. Start your first session to receive personalized AI recommendations and flow state coaching.";
        }

        StringBuilder categoriesSummary = new StringBuilder();
        categoryDist.forEach((k, v) -> categoriesSummary.append(k).append(": ").append(v).append("m, "));

        String prompt = String.format(
                "You are an expert productivity coach. Review the following deep work metrics for user %s:\n" +
                "- Total Completed Sessions: %d\n" +
                "- Weekly Focus Time: %.1f hours\n" +
                "- Average Session Duration: %.1f minutes\n" +
                "- Category Distribution: %s\n\n" +
                "Provide a brief, encouraging, action-oriented productivity insight (max 3 sentences) suggesting how the user can optimize their flow state, balance categories, or structure focus sessions.",
                user.getUsername(), sessionsCount, weeklyHours, avgMins, categoriesSummary.toString()
        );

        try {
            String response = ollamaService.ask(prompt);
            if (response != null && !response.trim().isEmpty()) {
                return response.trim();
            }
        } catch (Exception e) {
            System.err.println("Ollama recommendation generation failed, using keyword fallback: " + e.getMessage());
        }

        if (weeklyHours < 5.0) {
            return "Try to build consistency by dedicating just 25 minutes of deep focus to a high-priority 'CODING' or 'LEARNING' activity daily. Protect this time block from notification triggers.";
        } else if (avgMins > 60.0) {
            return "Your average focus session duration is excellent (" + avgMins + "m). Make sure to schedule smart breaks (5-10 minutes) between sessions to prevent mental fatigue and consolidate memory.";
        } else {
            return "You are maintaining a healthy balance! To optimize your productivity score, consider activating 'Deep Work Mode' for high-priority tasks and minimize pause interruptions.";
        }
    }
}
