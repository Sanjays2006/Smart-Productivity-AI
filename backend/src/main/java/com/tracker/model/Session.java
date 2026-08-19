package com.tracker.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDateTime;

@Entity
@Table(name = "sessions")
public class Session {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "activity_id")
    private Activity activity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @JsonIgnore
    private User user;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "duration_seconds")
    private Integer durationSeconds = 0;

    @Column(name = "is_pomodoro")
    private Boolean isPomodoro = false;

    @Column(name = "earned_xp")
    private Integer earnedXp = 0;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "status")
    private String status = "ACTIVE"; // ACTIVE, PAUSED, COMPLETED

    @Column(name = "focus_score")
    private Integer focusScore = 0;

    @Column(name = "pause_count")
    private Integer pauseCount = 0;

    @Column(name = "total_pause_duration_seconds")
    private Integer totalPauseDurationSeconds = 0;

    @Column(name = "target_seconds")
    private Integer targetSeconds = 1500; // default 25 mins

    @Column(name = "deep_work_mode")
    private Boolean deepWorkMode = false;

    @Column(name = "last_paused_time")
    private LocalDateTime lastPausedTime;

    public Session() {}

    public Session(Activity activity, LocalDateTime startTime) {
        this.activity = activity;
        this.startTime = startTime;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Activity getActivity() { return activity; }
    public void setActivity(Activity activity) { this.activity = activity; }
    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }
    public Integer getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Integer durationSeconds) { this.durationSeconds = durationSeconds; }
    public Boolean getIsPomodoro() { return isPomodoro; }
    public void setIsPomodoro(Boolean pomodoro) { isPomodoro = pomodoro; }
    public Integer getEarnedXp() { return earnedXp; }
    public void setEarnedXp(Integer earnedXp) { this.earnedXp = earnedXp; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getFocusScore() { return focusScore; }
    public void setFocusScore(Integer focusScore) { this.focusScore = focusScore; }
    public Integer getPauseCount() { return pauseCount; }
    public void setPauseCount(Integer pauseCount) { this.pauseCount = pauseCount; }
    public Integer getTotalPauseDurationSeconds() { return totalPauseDurationSeconds; }
    public void setTotalPauseDurationSeconds(Integer totalPauseDurationSeconds) { this.totalPauseDurationSeconds = totalPauseDurationSeconds; }
    public Integer getTargetSeconds() { return targetSeconds; }
    public void setTargetSeconds(Integer targetSeconds) { this.targetSeconds = targetSeconds; }
    public Boolean getDeepWorkMode() { return deepWorkMode != null && deepWorkMode; }
    public void setDeepWorkMode(Boolean deepWorkMode) { this.deepWorkMode = deepWorkMode; }
    public LocalDateTime getLastPausedTime() { return lastPausedTime; }
    public void setLastPausedTime(LocalDateTime lastPausedTime) { this.lastPausedTime = lastPausedTime; }

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
}
