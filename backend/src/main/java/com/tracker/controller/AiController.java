package com.tracker.controller;

import com.tracker.model.AiConversation;
import com.tracker.model.User;
import com.tracker.repository.UserRepository;
import com.tracker.service.OllamaService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final OllamaService ollamaService;
    private final com.tracker.service.AiInsightService aiInsightService;
    private final UserRepository userRepository;

    public AiController(OllamaService ollamaService, 
                        com.tracker.service.AiInsightService aiInsightService,
                        UserRepository userRepository) {
        this.ollamaService = ollamaService;
        this.aiInsightService = aiInsightService;
        this.userRepository = userRepository;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsernameOrEmail(username, username).orElseThrow();
    }

    @PostMapping("/ask")
    public ResponseEntity<Map<String, Object>> ask(@RequestBody Map<String, String> body) {
        User user = getCurrentUser();
        String question = body.get("question");
        String mode     = body.getOrDefault("mode", "unknown");

        if (question == null || question.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Question cannot be empty"));
        }

        Map<String, Object> result = ollamaService.askQuestion(user, question, mode);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/conversations")
    public List<AiConversation> getConversations() {
        return ollamaService.getConversationHistory(getCurrentUser());
    }

    @GetMapping("/insights")
    public ResponseEntity<Map<String, Object>> getInsights() {
        User user = getCurrentUser();
        Map<String, Object> analytics = aiInsightService.generateProductivityAnalytics(user);
        return ResponseEntity.ok(analytics);
    }

    /**
     * GET /api/ai/status
     * Returns whether Ollama is reachable.
     */
    @GetMapping("/status")
    public Map<String, Object> getStatus() {
        boolean running = ollamaService.isOllamaRunning();
        return Map.of(
            "ollamaRunning", running,
            "status", running ? "ready" : "offline",
            "message", running ? "Ollama is running ✓" : "Start Ollama: run `ollama serve` in terminal"
        );
    }
}
