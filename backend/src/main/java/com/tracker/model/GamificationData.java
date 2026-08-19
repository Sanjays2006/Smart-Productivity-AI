package com.tracker.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDate;

@Entity
@Table(name = "player_profile")
public class GamificationData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Optimistic locking: lets concurrent XP updates to the SAME profile be detected
    // instead of serializing ALL users behind a synchronized method.
    @Version
    @Column(name = "version")
    private Long version;

    @OneToOne
    @JoinColumn(name = "user_id", referencedColumnName = "id")
    @JsonIgnore
    private User user;

    @Column(columnDefinition = "int default 1")
    private Integer level = 1;

    @Column(name = "current_xp", columnDefinition = "int default 0")
    private Integer currentXp = 0;

    @Column(name = "total_xp", columnDefinition = "int default 0")
    private Integer totalXp = 0;

    @Column(name = "current_streak", columnDefinition = "int default 0")
    private Integer currentStreak = 0;

    @Column(name = "longest_streak", columnDefinition = "int default 0")
    private Integer longestStreak = 0;

    @Column(name = "total_sessions", columnDefinition = "int default 0")
    private Integer totalSessions = 0;

    @Column(columnDefinition = "int default 0")
    private Integer coins = 0;

    @Column(name = "unlocked_achievements", columnDefinition = "TEXT")
    private String unlockedAchievements = "";

    @Column(name = "productivity_rank", length = 100)
    private String productivityRank = "Focus Rookie";

    @Column(name = "focus_score", columnDefinition = "int default 0")
    private Integer focusScore = 0;

    @Column(name = "last_active_date")
    private LocalDate lastActiveDate;

    public GamificationData() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Integer getLevel() { return level; }
    public void setLevel(Integer level) { this.level = level; }
    public Integer getCurrentXp() { return currentXp; }
    public void setCurrentXp(Integer currentXp) { this.currentXp = currentXp; }
    public Integer getTotalXp() { return totalXp; }
    public void setTotalXp(Integer totalXp) { this.totalXp = totalXp; }
    public Integer getTotalSessions() { return totalSessions; }
    public void setTotalSessions(Integer totalSessions) { this.totalSessions = totalSessions; }
    public Integer getCurrentStreak() { return currentStreak; }
    public void setCurrentStreak(Integer currentStreak) { this.currentStreak = currentStreak; }
    public Integer getLongestStreak() { return longestStreak; }
    public void setLongestStreak(Integer longestStreak) { this.longestStreak = longestStreak; }
    public Integer getCoins() { return coins; }
    public void setCoins(Integer coins) { this.coins = coins; }
    public String getUnlockedAchievements() { return unlockedAchievements; }
    public void setUnlockedAchievements(String unlockedAchievements) { this.unlockedAchievements = unlockedAchievements; }
    public String getProductivityRank() { return productivityRank; }
    public void setProductivityRank(String productivityRank) { this.productivityRank = productivityRank; }
    public Integer getFocusScore() { return focusScore; }
    public void setFocusScore(Integer focusScore) { this.focusScore = focusScore; }
    public LocalDate getLastActiveDate() { return lastActiveDate; }
    public void setLastActiveDate(LocalDate lastActiveDate) { this.lastActiveDate = lastActiveDate; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
}
