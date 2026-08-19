package com.tracker.controller;

import com.tracker.model.User;
import com.tracker.repository.UserRepository;
import com.tracker.service.ActivityTrackingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/user/preferences")
public class UserPreferencesController {

    private final UserRepository userRepository;
    private final ActivityTrackingService trackingService;

    public UserPreferencesController(UserRepository userRepository, ActivityTrackingService trackingService) {
        this.userRepository = userRepository;
        this.trackingService = trackingService;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsernameOrEmail(username, username).orElseThrow();
    }

    @GetMapping
    public ResponseEntity<?> getPreferences() {
        User user = getCurrentUser();
        return ResponseEntity.ok(Map.of(
            "dailyFocusGoal", user.getDailyFocusGoal(),
            "displayName", user.getDisplayName() != null ? user.getDisplayName() : user.getUsername(),
            "resourceCollectionAllowed", user.isResourceCollectionAllowed(),
            "useCase", user.getUseCase() != null ? user.getUseCase() : "",
            "selectedTopics", user.getSelectedTopics() != null ? user.getSelectedTopics() : "",
            "customInterests", user.getCustomInterests() != null ? user.getCustomInterests() : ""
        ));
    }

    @PostMapping
    public ResponseEntity<?> updatePreferences(@RequestBody Map<String, Object> payload) {
        User user = getCurrentUser();

        if (payload.containsKey("dailyFocusGoal")) {
            Object val = payload.get("dailyFocusGoal");
            if (val instanceof Number) {
                user.setDailyFocusGoal(((Number) val).intValue());
            } else if (val instanceof String) {
                try {
                    user.setDailyFocusGoal(Integer.parseInt((String) val));
                } catch (NumberFormatException ignored) {}
            }
        }
        if (payload.containsKey("displayName")) {
            user.setDisplayName((String) payload.get("displayName"));
        }
        if (payload.containsKey("resourceCollectionAllowed")) {
            user.setResourceCollectionAllowed((Boolean) payload.get("resourceCollectionAllowed"));
        }
        if (payload.containsKey("useCase")) {
            user.setUseCase((String) payload.get("useCase"));
        }
        if (payload.containsKey("selectedTopics")) {
            user.setSelectedTopics((String) payload.get("selectedTopics"));
        }
        if (payload.containsKey("customInterests")) {
            user.setCustomInterests((String) payload.get("customInterests"));
        }

        userRepository.save(user);

        trackingService.track(user.getId(), "DASHBOARD", "PREFERENCES_UPDATE", 
            "Updated user preferences. Daily goal: " + (user.getDailyFocusGoal() / 3600) + "h", 
            "goal_seconds=" + user.getDailyFocusGoal(), user.getId().toString());

        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Preferences updated successfully",
            "dailyFocusGoal", user.getDailyFocusGoal()
        ));
    }
}
