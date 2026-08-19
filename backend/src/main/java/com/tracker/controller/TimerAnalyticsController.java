package com.tracker.controller;

import com.tracker.model.User;
import com.tracker.repository.UserRepository;
import com.tracker.service.TimerAnalyticsService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/sessions/analytics")
public class TimerAnalyticsController {

    private final UserRepository userRepository;
    private final TimerAnalyticsService timerAnalyticsService;

    public TimerAnalyticsController(UserRepository userRepository,
                                    TimerAnalyticsService timerAnalyticsService) {
        this.userRepository = userRepository;
        this.timerAnalyticsService = timerAnalyticsService;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsernameOrEmail(username, username).orElseThrow();
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> getTimerAnalytics() {
        return ResponseEntity.ok(timerAnalyticsService.getTimerAnalytics(getCurrentUser()));
    }
}
