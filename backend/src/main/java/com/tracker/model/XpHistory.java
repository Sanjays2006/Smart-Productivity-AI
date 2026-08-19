package com.tracker.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.LocalDateTime;

@Entity
@Table(name = "xp_history")
public class XpHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", referencedColumnName = "id")
    @JsonIgnore
    private User user;

    @Column(name = "xp_delta", nullable = false)
    private Integer xpDelta;

    @Column(length = 255)
    private String reason;

    @Column(length = 50)
    private String category; // TIMER, CHAT, NOTE, DOCUMENT, AUTH, RAG

    @Column(nullable = false)
    private LocalDateTime timestamp = LocalDateTime.now();

    public XpHistory() {}

    public XpHistory(User user, Integer xpDelta, String reason, String category) {
        this.user = user;
        this.xpDelta = xpDelta;
        this.reason = reason;
        this.category = category;
        this.timestamp = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public Integer getXpDelta() { return xpDelta; }
    public void setXpDelta(Integer xpDelta) { this.xpDelta = xpDelta; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
}
