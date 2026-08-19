package com.tracker.controller;

import com.tracker.model.*;
import com.tracker.repository.DailyTotalRepository;
import com.tracker.repository.UserRepository;
import com.tracker.repository.XpHistoryRepository;
import com.tracker.repository.AchievementRepository;
import com.tracker.repository.RewardRepository;
import com.tracker.service.GamificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/gamification")
public class GamificationController {

    private final UserRepository userRepository;
    private final GamificationService gamificationService;
    private final DailyTotalRepository dailyTotalRepository;
    private final XpHistoryRepository xpHistoryRepository;
    private final AchievementRepository achievementRepository;
    private final RewardRepository rewardRepository;

    public GamificationController(UserRepository userRepository,
                                  GamificationService gamificationService,
                                  DailyTotalRepository dailyTotalRepository,
                                  XpHistoryRepository xpHistoryRepository,
                                  AchievementRepository achievementRepository,
                                  RewardRepository rewardRepository) {
        this.userRepository = userRepository;
        this.gamificationService = gamificationService;
        this.dailyTotalRepository = dailyTotalRepository;
        this.xpHistoryRepository = xpHistoryRepository;
        this.achievementRepository = achievementRepository;
        this.rewardRepository = rewardRepository;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsernameOrEmail(username, username).orElseThrow();
    }

    @GetMapping("/profile")
    public ResponseEntity<Map<String, Object>> getProfile() {
        User user = getCurrentUser();
        GamificationData data = gamificationService.getGamificationData(user);
        
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("level", data.getLevel());
        profile.put("currentXp", data.getCurrentXp());
        profile.put("totalXp", data.getTotalXp());
        profile.put("currentStreak", data.getCurrentStreak());
        profile.put("longestStreak", data.getLongestStreak());
        profile.put("totalSessions", data.getTotalSessions());
        profile.put("coins", data.getCoins());
        profile.put("productivityRank", data.getProductivityRank());
        profile.put("focusScore", data.getFocusScore());
        
        int xpNeeded = gamificationService.calculateXpForNextLevel(data.getLevel());
        profile.put("xpNeeded", xpNeeded);
        profile.put("levelTitle", gamificationService.getLevelTitle(data.getLevel()));
        
        return ResponseEntity.ok(profile);
    }

    @GetMapping("/xp-history")
    public ResponseEntity<List<XpHistory>> getXpHistory() {
        User user = getCurrentUser();
        return ResponseEntity.ok(xpHistoryRepository.findByUserOrderByTimestampDesc(user));
    }

    @GetMapping("/achievements")
    public ResponseEntity<List<Achievement>> getAchievements() {
        User user = getCurrentUser();
        // Trigger check on request to make sure profile-unlocked badges are synced
        gamificationService.getGamificationData(user);
        return ResponseEntity.ok(achievementRepository.findByUser(user));
    }

    @GetMapping("/rewards")
    public ResponseEntity<List<Reward>> getRewards() {
        User user = getCurrentUser();
        gamificationService.getGamificationData(user); // ensures seed
        return ResponseEntity.ok(rewardRepository.findByUser(user));
    }

    @PostMapping("/rewards/purchase")
    public ResponseEntity<Map<String, Object>> purchaseReward(@RequestBody Map<String, String> body) {
        User user = getCurrentUser();
        String code = body.get("rewardCode");
        
        if (code == null || code.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", "Reward code is required."));
        }

        try {
            boolean success = gamificationService.purchaseReward(user, code);
            if (success) {
                GamificationData profile = gamificationService.getGamificationData(user);
                return ResponseEntity.ok(Map.of("success", true, "message", "Item purchased successfully!", "coins", profile.getCoins()));
            } else {
                return ResponseEntity.ok(Map.of("success", false, "error", "Insufficient coins. Completed more sessions or write notes to earn."));
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @GetMapping("/challenges")
    public ResponseEntity<List<Map<String, Object>>> getChallenges() {
        User user = getCurrentUser();
        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();

        // 1. Calculate today's study duration
        DailyTotal daily = dailyTotalRepository.findByUserAndRecordDate(user, LocalDate.now()).orElse(null);
        int studySeconds = (daily != null && daily.getTotalSeconds() != null) ? daily.getTotalSeconds() : 0;

        // 2. Count today's chats
        List<XpHistory> todayChats = xpHistoryRepository.findByUserAndCategoryAndTimestampAfter(user, "CHAT", startOfToday);
        long chatCount = todayChats.size();

        // 3. Count today's notes
        List<XpHistory> todayNotes = xpHistoryRepository.findByUserAndCategoryAndTimestampAfter(user, "NOTE", startOfToday);
        long noteCount = todayNotes.size();

        // Prepare challenges JSON array
        List<Map<String, Object>> challenges = new ArrayList<>();

        // Challenge 1: Focus Study (30 minutes target)
        Map<String, Object> c1 = new LinkedHashMap<>();
        c1.put("id", "challenge_focus");
        c1.put("name", "Deep Work Blocks");
        c1.put("description", "Log at least 30 minutes of deep study sessions today.");
        c1.put("progress", Math.min(30, studySeconds / 60));
        c1.put("target", 30);
        c1.put("completed", studySeconds >= 1800);
        c1.put("xpReward", 50);
        c1.put("coinReward", 10);
        challenges.add(c1);

        // Challenge 2: AI Prompt (2 chats target)
        Map<String, Object> c2 = new LinkedHashMap<>();
        c2.put("id", "challenge_chat");
        c2.put("name", "Synaptic Engagement");
        c2.put("description", "Engage with the AI Assistant at least twice today.");
        c2.put("progress", Math.min(2, chatCount));
        c2.put("target", 2);
        c2.put("completed", chatCount >= 2);
        c2.put("xpReward", 30);
        c2.put("coinReward", 5);
        challenges.add(c2);

        // Challenge 3: Capture Note (1 note target)
        Map<String, Object> c3 = new LinkedHashMap<>();
        c3.put("id", "challenge_note");
        c3.put("name", "Cerebral Synthesis");
        c3.put("description", "Capture at least one conceptual note to expand your knowledge base.");
        c3.put("progress", Math.min(1, noteCount));
        c3.put("target", 1);
        c3.put("completed", noteCount >= 1);
        c3.put("xpReward", 40);
        c3.put("coinReward", 8);
        challenges.add(c3);

        return ResponseEntity.ok(challenges);
    }
}
