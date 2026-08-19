package com.tracker.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDateTime;

@Entity
@Table(name = "activities")
public class Activity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @JsonIgnore
    private User user;

    @Column(nullable = false)
    private String name;

    @Column(name = "color_code", length = 7)
    private String colorCode = "#CCCCCC";

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "icon")
    private String icon = "fa-briefcase";

    @Column(name = "category")
    private String category = "CUSTOM";

    @Column(name = "difficulty")
    private String difficulty = "MEDIUM";

    @Column(name = "estimated_duration")
    private Integer estimatedDuration = 25;

    @Column(name = "priority")
    private String priority = "MEDIUM";

    @Column(name = "tags", length = 500)
    private String tags = "";

    @Column(name = "is_favorite")
    private Boolean isFavorite = false;

    public Activity() {}

    public Activity(String name, String colorCode) {
        this.name = name;
        this.colorCode = colorCode;
    }

    public Activity(String name, String colorCode, String icon, String category, String difficulty, Integer estimatedDuration, String priority) {
        this.name = name;
        this.colorCode = colorCode;
        this.icon = icon;
        this.category = category;
        this.difficulty = difficulty;
        this.estimatedDuration = estimatedDuration;
        this.priority = priority;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getColorCode() { return colorCode; }
    public void setColorCode(String colorCode) { this.colorCode = colorCode; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean active) { isActive = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getDifficulty() { return difficulty; }
    public void setDifficulty(String difficulty) { this.difficulty = difficulty; }
    public Integer getEstimatedDuration() { return estimatedDuration; }
    public void setEstimatedDuration(Integer estimatedDuration) { this.estimatedDuration = estimatedDuration; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getTags() { return tags != null ? tags : ""; }
    public void setTags(String tags) { this.tags = tags; }

    public Boolean getIsFavorite() { return isFavorite != null ? isFavorite : false; }
    public void setIsFavorite(Boolean isFavorite) { this.isFavorite = isFavorite; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
}
