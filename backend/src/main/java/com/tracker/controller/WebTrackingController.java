package com.tracker.controller;

import com.tracker.model.User;
import com.tracker.model.WebsiteVisit;
import com.tracker.repository.UserRepository;
import com.tracker.service.ActivityTrackingService;
import com.tracker.service.RagService;
import com.tracker.service.WebTrackingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tracking")
public class WebTrackingController {

    private final WebTrackingService webTrackingService;
    private final RagService ragService;
    private final UserRepository userRepository;
    private final ActivityTrackingService trackingService;

    public WebTrackingController(WebTrackingService webTrackingService,
                                 RagService ragService,
                                 UserRepository userRepository,
                                 ActivityTrackingService trackingService) {
        this.webTrackingService = webTrackingService;
        this.ragService = ragService;
        this.userRepository = userRepository;
        this.trackingService = trackingService;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsernameOrEmail(username, username).orElseThrow();
    }

    @PostMapping("/heartbeat")
    public ResponseEntity<Map<String, Object>> heartbeat(@RequestBody Map<String, Object> body) {
        User user = getCurrentUser();
        String url = (String) body.get("url");
        String title = (String) body.get("title");
        int elapsed = body.get("elapsedSeconds") instanceof Number n ? n.intValue() : 30;

        WebsiteVisit visit = webTrackingService.recordHeartbeat(user, url, title, elapsed);
        if (visit == null) {
            return ResponseEntity.ok(Map.of("status", "skipped"));
        }
        
        // Log webpage visit interaction
        trackingService.track(user.getId(), "DOCUMENT", "WEBSITE_VISIT", "Visited site: " + visit.getDomain() + " (" + title + ")", url, visit.getId().toString());

        return ResponseEntity.ok(Map.of(
            "status", "ok",
            "domain", visit.getDomain(),
            "totalSeconds", visit.getTimeSpentSeconds()
        ));
    }

    @PostMapping("/page-content")
    public ResponseEntity<Map<String, Object>> pageContent(@RequestBody Map<String, Object> body) {
        User user = getCurrentUser();
        String url = (String) body.get("url");
        String title = (String) body.get("title");
        String bodyText = (String) body.get("bodyText");

        try {
            ragService.ingestPageContent(user, url, title, bodyText);
        } catch (Exception e) {
            System.err.println("Failed to index page content: " + e.getMessage());
        }
        
        // Log indexed web document activity
        trackingService.track(user.getId(), "DOCUMENT", "PAGE_INDEX", "Indexed page for RAG: " + title, url, "page-index");

        return ResponseEntity.ok(Map.of("status", "ingested", "url", url != null ? url : ""));
    }

    @GetMapping("/today")
    public List<WebsiteVisit> getTodaySites() {
        return webTrackingService.getTodaySites(getCurrentUser());
    }

    @GetMapping("/history")
    public List<WebsiteVisit> getHistory() {
        return webTrackingService.getAllHistory(getCurrentUser());
    }
}
