package com.tracker.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDateTime;

@Entity
@Table(name = "achievements")
public class Achievement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", referencedColumnName = "id")
    @JsonIgnore
    private User user;

    @Column(nullable = false, length = 50)
    private String code;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(length = 255)
    private String description;

    @Column(length = 50)
    private String rarity = "COMMON"; // COMMON, RARE, EPIC, LEGENDARY

    @Column(length = 50)
    private String category = "GENERAL"; // TIMER, CHAT, NOTE, DOCUMENT, GENERAL

    @Column(name = "xp_reward", columnDefinition = "int default 0")
    private Integer xpReward = 0;

    @Column(name = "coin_reward", columnDefinition = "int default 0")
    private Integer coinReward = 0;

    @Column(name = "unlocked_at")
    private LocalDateTime unlockedAt = LocalDateTime.now();

    public Achievement() {}

    public Achievement(User user, String code, String title, String description, String rarity, String category, Integer xpReward, Integer coinReward) {
        this.user = user;
        this.code = code;
        this.title = title;
        this.description = description;
        this.rarity = rarity;
        this.category = category;
        this.xpReward = xpReward;
        this.coinReward = coinReward;
        this.unlockedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getRarity() { return rarity; }
    public void setRarity(String rarity) { this.rarity = rarity; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Integer getXpReward() { return xpReward; }
    public void setXpReward(Integer xpReward) { this.xpReward = xpReward; }
    public Integer getCoinReward() { return coinReward; }
    public void setCoinReward(Integer coinReward) { this.coinReward = coinReward; }
    public LocalDateTime getUnlockedAt() { return unlockedAt; }
    public void setUnlockedAt(LocalDateTime unlockedAt) { this.unlockedAt = unlockedAt; }
}
