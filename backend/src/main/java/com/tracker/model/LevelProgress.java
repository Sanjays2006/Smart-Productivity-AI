package com.tracker.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDateTime;

@Entity
@Table(name = "level_progress")
public class LevelProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", referencedColumnName = "id")
    @JsonIgnore
    private User user;

    @Column(nullable = false)
    private Integer level;

    @Column(name = "xp_required", nullable = false)
    private Integer xpRequired;

    @Column(name = "reached_at", nullable = false)
    private LocalDateTime reachedAt = LocalDateTime.now();

    public LevelProgress() {}

    public LevelProgress(User user, Integer level, Integer xpRequired) {
        this.user = user;
        this.level = level;
        this.xpRequired = xpRequired;
        this.reachedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Integer getLevel() { return level; }
    public void setLevel(Integer level) { this.level = level; }
    public Integer getXpRequired() { return xpRequired; }
    public void setXpRequired(Integer xpRequired) { this.xpRequired = xpRequired; }
    public LocalDateTime getReachedAt() { return reachedAt; }
    public void setReachedAt(LocalDateTime reachedAt) { this.reachedAt = reachedAt; }
}
