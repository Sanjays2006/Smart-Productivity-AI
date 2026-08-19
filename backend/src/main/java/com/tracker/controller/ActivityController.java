package com.tracker.controller;

import com.tracker.model.Activity;
import com.tracker.model.User;
import com.tracker.model.Session;
import com.tracker.repository.ActivityRepository;
import com.tracker.repository.UserRepository;
import com.tracker.repository.SessionRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/activities")
public class ActivityController {

    private final ActivityRepository activityRepository;
    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;

    public ActivityController(ActivityRepository activityRepository, UserRepository userRepository, SessionRepository sessionRepository) {
        this.activityRepository = activityRepository;
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsernameOrEmail(username, username).orElseThrow();
    }

    private void verifyOwnership(Activity activity) {
        User current = getCurrentUser();
        if (activity.getUser() == null || !activity.getUser().getId().equals(current.getId())) {
            throw new SecurityException("Access denied");
        }
    }

    @GetMapping
    @Transactional
    public List<Activity> getActiveActivities() {
        User currentUser = getCurrentUser();
        List<Activity> allActive = activityRepository.findByUserAndIsActiveTrue(currentUser);
        
        // Group by normalized name (trimmed, lowercase) and category (case-insensitive)
        Map<String, List<Activity>> grouped = allActive.stream().collect(Collectors.groupingBy(
            a -> (a.getName().trim().toLowerCase() + "||" + (a.getCategory() != null ? a.getCategory().trim().toUpperCase() : "CUSTOM"))
        ));
        
        List<Activity> uniqueList = new ArrayList<>();
        boolean duplicatesFound = false;
        
        for (List<Activity> group : grouped.values()) {
            if (group.size() > 1) {
                duplicatesFound = true;
                // Sort by ID ascending so the oldest remains as the primary activity
                group.sort((a, b) -> a.getId().compareTo(b.getId()));
                Activity primary = group.get(0);
                uniqueList.add(primary);
                
                // Remap sessions of duplicates to primary activity
                for (int i = 1; i < group.size(); i++) {
                    Activity duplicate = group.get(i);
                    List<Session> duplicateSessions = sessionRepository.findByActivity(duplicate);
                    if (!duplicateSessions.isEmpty()) {
                        for (Session session : duplicateSessions) {
                            session.setActivity(primary);
                        }
                        sessionRepository.saveAll(duplicateSessions);
                    }
                    // Soft-delete duplicate activity
                    duplicate.setIsActive(false);
                    activityRepository.save(duplicate);
                }
            } else {
                uniqueList.add(group.get(0));
            }
        }
        
        if (duplicatesFound) {
            uniqueList.sort((a, b) -> a.getId().compareTo(b.getId()));
        }
        
        return uniqueList;
    }

    @PostMapping
    public ResponseEntity<Activity> createActivity(@RequestBody Activity activity) {
        User currentUser = getCurrentUser();
        String targetName = activity.getName() != null ? activity.getName().trim() : "";
        String targetCategory = activity.getCategory() != null ? activity.getCategory().trim() : "CUSTOM";
        
        // Check if an active duplicate activity already exists
        List<Activity> existing = activityRepository.findByUserAndIsActiveTrue(currentUser);
        for (Activity act : existing) {
            if (act.getName().trim().equalsIgnoreCase(targetName) && 
                act.getCategory().trim().equalsIgnoreCase(targetCategory)) {
                return ResponseEntity.ok(act);
            }
        }
        
        activity.setUser(currentUser);
        activity.setIsActive(true);
        if (activity.getIsFavorite() == null) activity.setIsFavorite(false);
        if (activity.getTags() == null) activity.setTags("");
        return ResponseEntity.ok(activityRepository.save(activity));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Activity> updateActivity(@PathVariable Long id, @RequestBody Activity details) {
        Activity activity = activityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Activity not found"));
        verifyOwnership(activity);

        activity.setName(details.getName());
        activity.setColorCode(details.getColorCode());
        if (details.getIcon() != null) activity.setIcon(details.getIcon());
        if (details.getCategory() != null) activity.setCategory(details.getCategory());
        if (details.getDifficulty() != null) activity.setDifficulty(details.getDifficulty());
        if (details.getEstimatedDuration() != null) activity.setEstimatedDuration(details.getEstimatedDuration());
        if (details.getPriority() != null) activity.setPriority(details.getPriority());
        if (details.getTags() != null) activity.setTags(details.getTags());
        if (details.getIsFavorite() != null) activity.setIsFavorite(details.getIsFavorite());
        return ResponseEntity.ok(activityRepository.save(activity));
    }

    /**
     * Toggle the isFavorite flag for an activity.
     * POST /api/activities/{id}/favorite
     */
    @PostMapping("/{id}/favorite")
    public ResponseEntity<?> toggleFavorite(@PathVariable Long id) {
        Activity activity = activityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Activity not found"));
        verifyOwnership(activity);

        boolean newValue = !Boolean.TRUE.equals(activity.getIsFavorite());
        activity.setIsFavorite(newValue);
        activityRepository.save(activity);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "isFavorite", newValue,
            "message", newValue ? "Added to favorites" : "Removed from favorites"
        ));
    }

    /**
     * Update tags for an activity.
     * PUT /api/activities/{id}/tags
     * Body: { "tags": "comma,separated,tags" }
     */
    @PutMapping("/{id}/tags")
    public ResponseEntity<?> updateTags(@PathVariable Long id, @RequestBody Map<String, String> body) {
        Activity activity = activityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Activity not found"));
        verifyOwnership(activity);

        String tags = body.getOrDefault("tags", "");
        activity.setTags(tags);
        activityRepository.save(activity);

        return ResponseEntity.ok(Map.of(
            "success", true,
            "tags", tags,
            "message", "Tags updated successfully"
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteActivity(@PathVariable Long id) {
        Activity activity = activityRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Activity not found"));
        verifyOwnership(activity);

        activity.setIsActive(false); // soft-delete
        activityRepository.save(activity);
        return ResponseEntity.ok(Map.of("success", true, "message", "Activity deleted successfully"));
    }
}
