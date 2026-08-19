package com.tracker.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(mappedBy = "user", cascade = CascadeType.ALL)
    private GamificationData gamificationData;

    @Column(unique = true, nullable = false, length = 50)
    private String username;

    @Column(unique = true, nullable = false, length = 100)
    private String email;

    @Column(nullable = false)
    private String password; // BCrypt hash

    @Column(length = 20)
    private String role = "USER";

    @Column(name = "display_name", length = 100)
    private String displayName;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @Column(name = "onboarded")
    private Boolean onboarded = false;

    @Column(name = "use_case", length = 255)
    private String useCase;

    @Column(name = "selected_topics", length = 1000)
    private String selectedTopics;

    @Column(name = "custom_interests", length = 500)
    private String customInterests;

    @Column(name = "resource_collection_allowed")
    private Boolean resourceCollectionAllowed = true;

    @Column(name = "daily_focus_goal")
    private Integer dailyFocusGoal = 7200;

    public User() {}

    public User(String username, String email, String password) {
        this.username = username;
        this.email = email;
        this.password = password;
        this.displayName = username;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(LocalDateTime lastLoginAt) { this.lastLoginAt = lastLoginAt; }

    public boolean isOnboarded() { return onboarded != null && onboarded; }
    public void setOnboarded(Boolean onboarded) { this.onboarded = onboarded; }
    public String getUseCase() { return useCase; }
    public void setUseCase(String useCase) { this.useCase = useCase; }
    public String getSelectedTopics() { return selectedTopics; }
    public void setSelectedTopics(String selectedTopics) { this.selectedTopics = selectedTopics; }
    public String getCustomInterests() { return customInterests; }
    public void setCustomInterests(String customInterests) { this.customInterests = customInterests; }
    public boolean isResourceCollectionAllowed() { return resourceCollectionAllowed != null && resourceCollectionAllowed; }
    public void setResourceCollectionAllowed(Boolean resourceCollectionAllowed) { this.resourceCollectionAllowed = resourceCollectionAllowed; }

    public Integer getDailyFocusGoal() { return dailyFocusGoal != null ? dailyFocusGoal : 7200; }
    public void setDailyFocusGoal(Integer dailyFocusGoal) { this.dailyFocusGoal = dailyFocusGoal; }

    public GamificationData getGamificationData() { return gamificationData; }
    public void setGamificationData(GamificationData gamificationData) { this.gamificationData = gamificationData; }
}
