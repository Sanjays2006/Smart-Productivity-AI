package com.tracker.controller;

import com.tracker.model.DailyTotal;
import com.tracker.model.GamificationData;
import com.tracker.model.Session;
import com.tracker.model.User;
import com.tracker.repository.DailyTotalRepository;
import com.tracker.repository.SessionRepository;
import com.tracker.repository.UserRepository;
import com.tracker.service.GamificationService;
import com.tracker.service.AiInsightService;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DailyTotalRepository dailyTotalRepository;
    private final SessionRepository sessionRepository;
    private final GamificationService gamificationService;
    private final UserRepository userRepository;
    private final AiInsightService aiInsightService;

    public DashboardController(DailyTotalRepository dailyTotalRepository,
                               SessionRepository sessionRepository,
                               GamificationService gamificationService,
                               UserRepository userRepository,
                               AiInsightService aiInsightService) {
        this.dailyTotalRepository = dailyTotalRepository;
        this.sessionRepository = sessionRepository;
        this.gamificationService = gamificationService;
        this.userRepository = userRepository;
        this.aiInsightService = aiInsightService;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsernameOrEmail(username, username).orElseThrow();
    }

    @GetMapping
    public Map<String, Object> getDashboardData() {
        User user = getCurrentUser();
        Map<String, Object> data = new HashMap<>();

        GamificationData gamification = gamificationService.getGamificationData(user);
        data.put("gamification", gamification);

        List<DailyTotal> recentTotals = dailyTotalRepository.findTop7ByUserOrderByRecordDateDesc(user);
        data.put("recentTotals", recentTotals);

        DailyTotal today = dailyTotalRepository.findByUserAndRecordDate(user, LocalDate.now())
                .orElse(new DailyTotal(LocalDate.now()));
        data.put("today", today);

        int level = gamification.getLevel() != null ? gamification.getLevel() : 1;
        int xpNeeded = (int) (Math.pow(level, 2) * 20) + 100; // Matches service logic
        data.put("xpNeeded", xpNeeded);
        data.put("levelTitle", gamificationService.getLevelTitle(level));
        data.put("dailyFocusGoal", user.getDailyFocusGoal());

        // Add daily briefing dynamically computed from PostgreSQL
        data.put("briefing", aiInsightService.generateDailyBriefing(user));

        // Calculate consistency statistics
        Map<String, Object> consistencyStats = new HashMap<>();
        List<DailyTotal> last30 = dailyTotalRepository.findTop30ByUserOrderByRecordDateDesc(user);
        long metGoalCount = last30.stream().filter(t -> t.getTotalSeconds() >= user.getDailyFocusGoal()).count();
        int goalCompletionRate = last30.isEmpty() ? 0 : (int) ((metGoalCount * 100) / last30.size());

        long totalSecondsAllTime = dailyTotalRepository.findByUser(user).stream()
                .mapToLong(DailyTotal::getTotalSeconds)
                .sum();
        long totalDeepWorkMinutes = totalSecondsAllTime / 60;

        consistencyStats.put("currentStreak", gamification.getCurrentStreak());
        consistencyStats.put("goalCompletionRate", goalCompletionRate);
        consistencyStats.put("totalDeepWorkMinutes", totalDeepWorkMinutes);
        data.put("consistencyStats", consistencyStats);

        return data;
    }

    @GetMapping("/recent-sessions")
    public List<Session> getRecentSessions() {
        User user = getCurrentUser();
        LocalDateTime since = LocalDateTime.now().minusDays(7);
        return sessionRepository.findByUserAndStartTimeBetween(user, since, LocalDateTime.now())
                .stream()
                .filter(s -> s.getEndTime() != null)
                .sorted(Comparator.comparing(Session::getStartTime).reversed())
                .limit(10)
                .collect(Collectors.toList());
    }
}
