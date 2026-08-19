package com.tracker.model;

import jakarta.persistence.*;

@Entity
@Table(name = "activity_rewards")
public class ActivityReward {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String category; // TIMER, CHAT, NOTE, DOCUMENT, AUTH, RAG

    @Column(nullable = false, length = 50)
    private String action; // e.g. PROMPT_SEND, NOTE_CREATE, WEBSITE_VISIT

    @Column(name = "xp_reward", nullable = false)
    private Integer xpReward = 0;

    @Column(name = "coin_reward", nullable = false)
    private Integer coinReward = 0;

    @Column(length = 255)
    private String description;

    public ActivityReward() {}

    public ActivityReward(String category, String action, Integer xpReward, Integer coinReward, String description) {
        this.category = category;
        this.action = action;
        this.xpReward = xpReward;
        this.coinReward = coinReward;
        this.description = description;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public Integer getXpReward() { return xpReward; }
    public void setXpReward(Integer xpReward) { this.xpReward = xpReward; }
    public Integer getCoinReward() { return coinReward; }
    public void setCoinReward(Integer coinReward) { this.coinReward = coinReward; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
