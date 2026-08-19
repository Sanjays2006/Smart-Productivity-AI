package com.tracker.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDate;

@Entity
@Table(name = "daily_totals")
public class DailyTotal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnore
    private User user;

    @Column(name = "record_date", nullable = false)
    private LocalDate recordDate;

    @Column(name = "total_seconds", columnDefinition = "int default 0")
    private Integer totalSeconds = 0;

    @Column(name = "sessions_completed", columnDefinition = "int default 0")
    private Integer sessionsCompleted = 0;

    @Column(name = "total_xp_earned", columnDefinition = "int default 0")
    private Integer totalXpEarned = 0;

    public DailyTotal() {}

    public DailyTotal(LocalDate recordDate) {
        this.recordDate = recordDate;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public LocalDate getRecordDate() { return recordDate; }
    public void setRecordDate(LocalDate recordDate) { this.recordDate = recordDate; }
    public Integer getTotalSeconds() { return totalSeconds; }
    public void setTotalSeconds(Integer totalSeconds) { this.totalSeconds = totalSeconds; }
    public Integer getSessionsCompleted() { return sessionsCompleted; }
    public void setSessionsCompleted(Integer sessionsCompleted) { this.sessionsCompleted = sessionsCompleted; }
    public Integer getTotalXpEarned() { return totalXpEarned; }
    public void setTotalXpEarned(Integer totalXpEarned) { this.totalXpEarned = totalXpEarned; }
}
