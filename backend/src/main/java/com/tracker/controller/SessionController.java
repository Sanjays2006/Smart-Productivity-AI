package com.tracker.controller;

import com.tracker.model.Session;
import com.tracker.model.User;
import com.tracker.repository.UserRepository;
import com.tracker.repository.SessionRepository;
import java.util.Map;
import com.tracker.service.TimerService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private final TimerService timerService;
    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;

    public SessionController(TimerService timerService, UserRepository userRepository, SessionRepository sessionRepository) {
        this.timerService = timerService;
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsernameOrEmail(username, username).orElseThrow();
    }

    @PostMapping("/start")
    public ResponseEntity<Session> startSession(
            @RequestParam Long activityId,
            @RequestParam(required = false, defaultValue = "1500") Integer targetSeconds,
            @RequestParam(required = false, defaultValue = "false") Boolean deepWorkMode) {
        return ResponseEntity.ok(timerService.startSession(getCurrentUser(), activityId, targetSeconds, deepWorkMode));
    }

    @PostMapping("/{id}/pause")
    public ResponseEntity<Session> pauseSession(@PathVariable Long id) {
        return ResponseEntity.ok(timerService.pauseSession(getCurrentUser(), id));
    }

    @PostMapping("/{id}/resume")
    public ResponseEntity<Session> resumeSession(@PathVariable Long id) {
        return ResponseEntity.ok(timerService.resumeSession(getCurrentUser(), id));
    }

    @PostMapping("/{id}/end")
    public ResponseEntity<Session> endSession(
            @PathVariable Long id,
            @RequestParam(defaultValue = "false") boolean isPomodoro,
            @RequestParam(required = false) String notes) {
        return ResponseEntity.ok(timerService.endSession(getCurrentUser(), id, isPomodoro, notes));
    }

    @PostMapping("/{id}/stop")
    public ResponseEntity<Session> stopSession(@PathVariable Long id) {
        return ResponseEntity.ok(timerService.stopSession(getCurrentUser(), id));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<Session> completeSession(
            @PathVariable Long id,
            @RequestParam(defaultValue = "false") boolean isPomodoro,
            @RequestParam(required = false) String notes) {
        return ResponseEntity.ok(timerService.endSession(getCurrentUser(), id, isPomodoro, notes));
    }

    @GetMapping("/{id}/status")
    public ResponseEntity<?> getSessionStatus(@PathVariable Long id) {
        User user = getCurrentUser();
        return sessionRepository.findById(id)
            .filter(s -> s.getUser() != null && s.getUser().getId().equals(user.getId()))
            .map(s -> ResponseEntity.ok(Map.of("id", s.getId(), "status", s.getStatus() != null ? s.getStatus() : "ACTIVE")))
            .orElse(ResponseEntity.notFound().build());
    }
}
