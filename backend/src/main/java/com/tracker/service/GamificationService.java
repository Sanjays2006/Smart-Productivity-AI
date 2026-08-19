package com.tracker.service;

import com.tracker.model.*;
import com.tracker.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class GamificationService {

    private final GamificationRepository gamificationRepository;
    private final AchievementRepository achievementRepository;
    private final RewardRepository rewardRepository;
    private final XpHistoryRepository xpHistoryRepository;
    private final StreakHistoryRepository streakHistoryRepository;
    private final ActivityRewardRepository activityRewardRepository;
    private final LevelProgressRepository levelProgressRepository;
    private final DailyTotalRepository dailyTotalRepository;

    public GamificationService(GamificationRepository gamificationRepository,
                               AchievementRepository achievementRepository,
                               RewardRepository rewardRepository,
                               XpHistoryRepository xpHistoryRepository,
                               StreakHistoryRepository streakHistoryRepository,
                               ActivityRewardRepository activityRewardRepository,
                               LevelProgressRepository levelProgressRepository,
                               DailyTotalRepository dailyTotalRepository) {
        this.gamificationRepository = gamificationRepository;
        this.achievementRepository = achievementRepository;
        this.rewardRepository = rewardRepository;
        this.xpHistoryRepository = xpHistoryRepository;
        this.streakHistoryRepository = streakHistoryRepository;
        this.activityRewardRepository = activityRewardRepository;
        this.levelProgressRepository = levelProgressRepository;
        this.dailyTotalRepository = dailyTotalRepository;
    }

    /**
     * Seeds the global activity reward definitions if the table is empty.
     */
    @Transactional
    public void seedActivityRewards() {
        if (activityRewardRepository.count() == 0) {
            List<ActivityReward> rewards = List.of(
                new ActivityReward("CHAT", "PROMPT_SEND", 15, 2, "Chatted with AI Assistant"),
                new ActivityReward("NOTE", "NOTE_CREATE", 25, 5, "Created a study note"),
                new ActivityReward("LEARNING", "TOPIC_ADD", 30, 6, "Added educational topic"),
                new ActivityReward("DOCUMENT", "CRAWL_TRIGGER", 20, 4, "Triggered manual crawl sync"),
                new ActivityReward("DOCUMENT", "PAGE_INDEX", 15, 3, "Indexed page to RAG context"),
                new ActivityReward("AUTH", "REGISTER", 100, 20, "User profile registered"),
                new ActivityReward("AUTH", "LOGIN", 10, 2, "Daily check-in login"),
                new ActivityReward("RAG", "QUERY_TEST", 5, 1, "Tested RAG system search"),
                new ActivityReward("DOCUMENT", "WEBSITE_VISIT", 5, 1, "Visited educational study site")
            );
            activityRewardRepository.saveAll(rewards);
        }
    }

    /**
     * Seeds default buyable rewards (shop items) for a user if they don't have them yet.
     */
    @Transactional
    public void seedUserShopRewards(User user) {
        List<Reward> userRewards = rewardRepository.findByUser(user);
        if (userRewards.isEmpty()) {
            List<Reward> defaultRewards = List.of(
                new Reward(user, "THEME_CYBERPUNK", "Cyberpunk Hologram Theme", "Unlocks a neon cyberpunk styling for the entire dashboard.", 100),
                new Reward(user, "THEME_GLASSMORPHISM", "Premium Glassmorphism Theme", "Unlocks a beautiful frosted glass interface theme.", 50),
                new Reward(user, "THEME_LIGHT", "Light Mode Aurora Theme", "Unlocks a sleek light theme with soft aurora glows.", 50),
                new Reward(user, "PRODUCTIVITY_REPORT", "Detailed Weekly AI PDF Report", "Unlocks a generated PDF analysis of your deep work habits.", 200),
                new Reward(user, "AI_CREATIVITY_BOOST", "Creative AI Brain Mode", "Unlocks specialized creative brainstorming features in the AI chat.", 150)
            );
            rewardRepository.saveAll(defaultRewards);
        }
    }

    /**
     * Fetches or initializes gamification data (Player Profile) for a user.
     */
    @Transactional
    public GamificationData getGamificationData(User user) {
        // Seed database objects on load
        seedActivityRewards();
        seedUserShopRewards(user);

        GamificationData data = gamificationRepository.findByUser(user).orElseGet(() -> {
            GamificationData newData = new GamificationData();
            newData.setUser(user);
            newData.setLevel(1);
            newData.setCurrentXp(0);
            newData.setTotalXp(0);
            newData.setCurrentStreak(0);
            newData.setLongestStreak(0);
            newData.setTotalSessions(0);
            newData.setCoins(20); // Starting bonus
            newData.setProductivityRank("Focus Rookie");
            newData.setFocusScore(0);
            newData.setLastActiveDate(LocalDate.now().minusDays(1));
            return gamificationRepository.save(newData);
        });

        // Normalize null values to default values so they are never null in DB/responses
        boolean needsUpdate = false;
        if (data.getLevel() == null) { data.setLevel(1); needsUpdate = true; }
        if (data.getCurrentXp() == null) { data.setCurrentXp(0); needsUpdate = true; }
        if (data.getTotalXp() == null) { data.setTotalXp(0); needsUpdate = true; }
        if (data.getCurrentStreak() == null) { data.setCurrentStreak(0); needsUpdate = true; }
        if (data.getLongestStreak() == null) { data.setLongestStreak(0); needsUpdate = true; }
        if (data.getTotalSessions() == null) { data.setTotalSessions(0); needsUpdate = true; }
        if (data.getCoins() == null) { data.setCoins(20); needsUpdate = true; }
        if (data.getProductivityRank() == null) { data.setProductivityRank("Focus Rookie"); needsUpdate = true; }
        if (data.getFocusScore() == null) { data.setFocusScore(0); needsUpdate = true; }
        if (data.getUnlockedAchievements() == null) { data.setUnlockedAchievements(""); needsUpdate = true; }

        // Dynamic update of Focus Score based on today's study sessions
        LocalDate today = LocalDate.now();
        DailyTotal dailyTotal = dailyTotalRepository.findByUserAndRecordDate(user, today).orElse(null);
        int totalSecondsToday = dailyTotal != null ? dailyTotal.getTotalSeconds() : 0;
        double dailyGoal = user.getDailyFocusGoal() != null ? user.getDailyFocusGoal() : 7200.0;
        int calculatedFocusScore = (int) Math.min(100, Math.round((totalSecondsToday / dailyGoal) * 100));
        if (!Objects.equals(data.getFocusScore(), calculatedFocusScore)) {
            data.setFocusScore(calculatedFocusScore);
            needsUpdate = true;
        }

        if (needsUpdate) {
            data = gamificationRepository.save(data);
        }

        return data;
    }

    /**
     * Centralized XP Earning Engine. Awards XP and Coins, logs history, handles leveling and achievements.
     */
    // Awards XP within a single transaction. @Version on GamificationData guards
    // against concurrent updates to the same profile (fail-fast rather than lost update).
    @Transactional
    public void awardXp(User user, int xpAmount, String reason, String category) {
        if (xpAmount <= 0) return;

        GamificationData data = getGamificationData(user);

        // Update active date and daily streak on XP gain
        LocalDate today = LocalDate.now();
        int currentStreak = data.getCurrentStreak() != null ? data.getCurrentStreak() : 0;
        int longestStreak = data.getLongestStreak() != null ? data.getLongestStreak() : 0;

        if (data.getLastActiveDate() == null || data.getLastActiveDate().isBefore(today)) {
            if (data.getLastActiveDate() != null && data.getLastActiveDate().equals(today.minusDays(1))) {
                currentStreak += 1;
            } else if (data.getLastActiveDate() == null || data.getLastActiveDate().isBefore(today.minusDays(1))) {
                currentStreak = 1;
            }
            if (currentStreak > longestStreak) {
                longestStreak = currentStreak;
            }
            data.setCurrentStreak(currentStreak);
            data.setLongestStreak(longestStreak);
            data.setLastActiveDate(today);

            // Record streak history entry
            StreakHistory streakHist = new StreakHistory(user, currentStreak, "DAILY", today.minusDays(currentStreak - 1), today);
            streakHistoryRepository.save(streakHist);
        }

        // Apply XP and Coins
        data.setCurrentXp((data.getCurrentXp() != null ? data.getCurrentXp() : 0) + xpAmount);
        data.setTotalXp((data.getTotalXp() != null ? data.getTotalXp() : 0) + xpAmount);

        // Award Coins (1 coin per 10 XP, rounded)
        int earnedCoins = Math.max(1, xpAmount / 10);
        data.setCoins((data.getCoins() != null ? data.getCoins() : 0) + earnedCoins);

        // Log to XP History
        XpHistory history = new XpHistory(user, xpAmount, reason, category);
        xpHistoryRepository.save(history);

        // Process Level Up loops
        int currentLevel = data.getLevel() != null ? data.getLevel() : 1;
        int xpNeeded = calculateXpForNextLevel(currentLevel);

        while (data.getCurrentXp() >= xpNeeded) {
            data.setCurrentXp(data.getCurrentXp() - xpNeeded);
            currentLevel++;
            data.setLevel(currentLevel);
            data.setCoins(data.getCoins() + 50); // Level-up bonus coins
            data.setProductivityRank(getLevelTitle(currentLevel));

            // Log Level progress milestone
            LevelProgress progress = new LevelProgress(user, currentLevel, xpNeeded);
            levelProgressRepository.save(progress);

            xpNeeded = calculateXpForNextLevel(currentLevel);
        }

        // Check and unlock new Achievements
        checkAndUnlockAchievements(user, data);

        gamificationRepository.save(data);
    }

    /**
     * Specialized XP method for study focus sessions based on duration.
     */
    @Transactional
    public int awardSessionXP(User user, Session session) {
        int duration = session.getDurationSeconds() != null ? session.getDurationSeconds() : 0;
        double hoursWorked = duration / 3600.0;
        int earnedXp = (int) Math.round(hoursWorked * 120.0);
        if (session.getIsPomodoro() != null && session.getIsPomodoro()) {
            earnedXp += 50; // Pomodoro flat bonus
        }
        if (earnedXp < 10) earnedXp = 10; // Minimum XP for completing any session

        String activityName = (session.getActivity() != null && session.getActivity().getName() != null)
                ? session.getActivity().getName() : "Focus Session";
        awardXp(user, earnedXp, "Completed focus session on: " + activityName, "TIMER");
        return earnedXp;
    }

    /**
     * Evaluates and unlocks progression-based achievements.
     */
    private void checkAndUnlockAchievements(User user, GamificationData data) {
        // Define achievements configuration
        Map<String, Map<String, Object>> achConfigs = new LinkedHashMap<>();
        achConfigs.put("FIRST_SESSION", Map.of("title", "First Step", "desc", "Complete your first focus session.", "rarity", "COMMON", "cat", "TIMER", "xp", 50, "coins", 10));
        achConfigs.put("STREAK_3", Map.of("title", "Habit Builder", "desc", "Maintain a 3-day daily streak.", "rarity", "COMMON", "cat", "STREAK", "xp", 100, "coins", 20));
        achConfigs.put("STREAK_7", Map.of("title", "Consistency Master", "desc", "Maintain a 7-day daily streak.", "rarity", "RARE", "cat", "STREAK", "xp", 250, "coins", 50));
        achConfigs.put("STREAK_14", Map.of("title", "Productivity God", "desc", "Maintain a 14-day daily streak.", "rarity", "EPIC", "cat", "STREAK", "xp", 500, "coins", 100));
        achConfigs.put("LEVEL_5", Map.of("title", "Leveling Up", "desc", "Reach Player Level 5.", "rarity", "COMMON", "cat", "LEVEL", "xp", 100, "coins", 20));
        achConfigs.put("LEVEL_10", Map.of("title", "Elite Explorer", "desc", "Reach Player Level 10.", "rarity", "RARE", "cat", "LEVEL", "xp", 300, "coins", 50));
        achConfigs.put("LEVEL_20", Map.of("title", "Zen Master", "desc", "Reach Player Level 20.", "rarity", "EPIC", "cat", "LEVEL", "xp", 1000, "coins", 200));
        achConfigs.put("XP_1000", Map.of("title", "XP Accumulator", "desc", "Earn 1,000 total XP.", "rarity", "COMMON", "cat", "XP", "xp", 150, "coins", 30));
        achConfigs.put("XP_5000", Map.of("title", "XP Overlord", "desc", "Earn 5,000 total XP.", "rarity", "RARE", "cat", "XP", "xp", 500, "coins", 100));

        String unlockedStr = data.getUnlockedAchievements() != null ? data.getUnlockedAchievements() : "";
        List<String> unlockedList = new ArrayList<>(Arrays.asList(unlockedStr.split(",")));
        unlockedList.removeIf(String::isBlank);
        boolean changed = false;

        // Conditions checks
        if (!unlockedList.contains("FIRST_SESSION") && data.getTotalSessions() >= 1) {
            unlockedList.add("FIRST_SESSION");
            unlockAchievementEntity(user, "FIRST_SESSION", achConfigs.get("FIRST_SESSION"));
            changed = true;
        }
        if (!unlockedList.contains("STREAK_3") && data.getCurrentStreak() >= 3) {
            unlockedList.add("STREAK_3");
            unlockAchievementEntity(user, "STREAK_3", achConfigs.get("STREAK_3"));
            changed = true;
        }
        if (!unlockedList.contains("STREAK_7") && data.getCurrentStreak() >= 7) {
            unlockedList.add("STREAK_7");
            unlockAchievementEntity(user, "STREAK_7", achConfigs.get("STREAK_7"));
            changed = true;
        }
        if (!unlockedList.contains("STREAK_14") && data.getCurrentStreak() >= 14) {
            unlockedList.add("STREAK_14");
            unlockAchievementEntity(user, "STREAK_14", achConfigs.get("STREAK_14"));
            changed = true;
        }
        if (!unlockedList.contains("LEVEL_5") && data.getLevel() >= 5) {
            unlockedList.add("LEVEL_5");
            unlockAchievementEntity(user, "LEVEL_5", achConfigs.get("LEVEL_5"));
            changed = true;
        }
        if (!unlockedList.contains("LEVEL_10") && data.getLevel() >= 10) {
            unlockedList.add("LEVEL_10");
            unlockAchievementEntity(user, "LEVEL_10", achConfigs.get("LEVEL_10"));
            changed = true;
        }
        if (!unlockedList.contains("LEVEL_20") && data.getLevel() >= 20) {
            unlockedList.add("LEVEL_20");
            unlockAchievementEntity(user, "LEVEL_20", achConfigs.get("LEVEL_20"));
            changed = true;
        }
        if (!unlockedList.contains("XP_1000") && data.getTotalXp() >= 1000) {
            unlockedList.add("XP_1000");
            unlockAchievementEntity(user, "XP_1000", achConfigs.get("XP_1000"));
            changed = true;
        }
        if (!unlockedList.contains("XP_5000") && data.getTotalXp() >= 5000) {
            unlockedList.add("XP_5000");
            unlockAchievementEntity(user, "XP_5000", achConfigs.get("XP_5000"));
            changed = true;
        }

        if (changed) {
            data.setUnlockedAchievements(String.join(",", unlockedList));
        }
    }

    private void unlockAchievementEntity(User user, String code, Map<String, Object> config) {
        if (achievementRepository.findByUserAndCode(user, code).isEmpty()) {
            Achievement ach = new Achievement(
                user,
                code,
                (String) config.get("title"),
                (String) config.get("desc"),
                (String) config.get("rarity"),
                (String) config.get("cat"),
                (Integer) config.get("xp"),
                (Integer) config.get("coins")
            );
            achievementRepository.save(ach);

            // Award immediate XP and Coins from achievement
            GamificationData data = gamificationRepository.findByUser(user).orElseThrow();
            data.setCurrentXp((data.getCurrentXp() != null ? data.getCurrentXp() : 0) + ach.getXpReward());
            data.setTotalXp((data.getTotalXp() != null ? data.getTotalXp() : 0) + ach.getXpReward());
            data.setCoins((data.getCoins() != null ? data.getCoins() : 0) + ach.getCoinReward());
            gamificationRepository.save(data);
        }
    }

    /**
     * Purchase a shop item with coins.
     */
    @Transactional
    public boolean purchaseReward(User user, String rewardCode) {
        GamificationData profile = getGamificationData(user);
        Reward reward = rewardRepository.findByUserAndCode(user, rewardCode)
            .orElseThrow(() -> new IllegalArgumentException("Reward not found"));

        if (reward.isUnlocked()) {
            return true; // Already purchased
        }

        if (profile.getCoins() >= reward.getCoinCost()) {
            profile.setCoins(profile.getCoins() - reward.getCoinCost());
            reward.setUnlocked(true);
            reward.setUnlockedAt(LocalDateTime.now());
            rewardRepository.save(reward);
            gamificationRepository.save(profile);
            
            // Log XP history trace for purchase
            XpHistory hist = new XpHistory(user, 0, "Purchased shop reward: " + reward.getTitle(), "SHOP");
            xpHistoryRepository.save(hist);
            return true;
        }
        return false;
    }

    public int calculateXpForNextLevel(int currentLevel) {
        return (int) (Math.pow(currentLevel, 2) * 30) + 120; // Enterprise-grade curve
    }

    public String getLevelTitle(int level) {
        if (level < 5) return "Focus Rookie";
        if (level < 10) return "Time Trainee";
        if (level < 20) return "Productivity Pro";
        if (level < 40) return "Deep Work Master";
        if (level < 70) return "Flow State Legend";
        return "Zen Architect";
    }
}
