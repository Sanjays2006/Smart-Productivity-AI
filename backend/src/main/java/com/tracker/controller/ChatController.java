package com.tracker.controller;

import com.tracker.model.*;
import com.tracker.repository.*;
import com.tracker.service.StreamingOllamaService;
import com.tracker.service.ActivityTrackingService;
import com.tracker.service.ActivityRecallService;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatSessionRepository sessionRepo;
    private final ChatMessageRepository messageRepo;
    private final UserRepository userRepo;
    private final StreamingOllamaService streamingService;
    private final ActivityTrackingService activityTrackingService;
    private final ActivityRecallService activityRecallService;
    private final ExecutorService executor = Executors.newCachedThreadPool();

    public ChatController(ChatSessionRepository sessionRepo,
                          ChatMessageRepository messageRepo,
                          UserRepository userRepo,
                          StreamingOllamaService streamingService,
                          ActivityTrackingService activityTrackingService,
                          ActivityRecallService activityRecallService) {
        this.sessionRepo = sessionRepo;
        this.messageRepo = messageRepo;
        this.userRepo = userRepo;
        this.streamingService = streamingService;
        this.activityTrackingService = activityTrackingService;
        this.activityRecallService = activityRecallService;
    }

    // ── Session CRUD ──────────────────────────────────────────────────────────

    /** GET /api/chat/sessions */
    @GetMapping("/sessions")
    public ResponseEntity<?> listSessions() {
        User user = currentUser();
        if (user == null) return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));

        List<ChatSession> sessions = sessionRepo.findTop20ByUserOrderByUpdatedAtDesc(user);
        List<Map<String, Object>> result = sessions.stream().map(s -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("title", s.getTitle());
            m.put("modelUsed", s.getModelUsed());
            m.put("createdAt", s.getCreatedAt());
            m.put("updatedAt", s.getUpdatedAt());
            m.put("messageCount", messageRepo.countBySession(s));
            return m;
        }).toList();
        return ResponseEntity.ok(result);
    }

    /** POST /api/chat/sessions */
    @PostMapping("/sessions")
    public ResponseEntity<?> createSession(@RequestBody(required = false) Map<String, String> body) {
        User user = currentUser();
        if (user == null) return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));

        ChatSession session = new ChatSession(user);
        if (body != null && body.containsKey("title"))
            session.setTitle(body.get("title"));
        sessionRepo.save(session);

        return ResponseEntity.ok(Map.of(
            "id", session.getId(),
            "title", session.getTitle(),
            "createdAt", session.getCreatedAt()
        ));
    }

    /** GET /api/chat/sessions/{id}/messages */
    @GetMapping("/sessions/{id}/messages")
    public ResponseEntity<?> getMessages(@PathVariable Long id) {
        User user = currentUser();
        if (user == null) return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));

        ChatSession session = sessionRepo.findById(id).orElse(null);
        if (session == null || !session.getUser().getId().equals(user.getId()))
            return ResponseEntity.status(404).body(Map.of("error", "Session not found"));

        List<ChatMessage> messages = messageRepo.findBySessionOrderByCreatedAtAsc(session);
        List<Map<String, Object>> result = messages.stream().map(msg -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", msg.getId());
            m.put("role", msg.getRole());
            m.put("content", msg.getContent());
            m.put("createdAt", msg.getCreatedAt());
            return m;
        }).toList();
        return ResponseEntity.ok(result);
    }

    /** DELETE /api/chat/sessions/{id} */
    @DeleteMapping("/sessions/{id}")
    public ResponseEntity<?> deleteSession(@PathVariable Long id) {
        User user = currentUser();
        if (user == null) return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));

        ChatSession session = sessionRepo.findById(id).orElse(null);
        if (session == null || !session.getUser().getId().equals(user.getId()))
            return ResponseEntity.status(404).body(Map.of("error", "Session not found"));

        sessionRepo.delete(session);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    /** PATCH /api/chat/sessions/{id}/title */
    @PatchMapping("/sessions/{id}/title")
    public ResponseEntity<?> renameSession(@PathVariable Long id,
                                            @RequestBody Map<String, String> body) {
        User user = currentUser();
        if (user == null) return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));

        ChatSession session = sessionRepo.findById(id).orElse(null);
        if (session == null || !session.getUser().getId().equals(user.getId()))
            return ResponseEntity.status(404).body(Map.of("error", "Session not found"));

        session.setTitle(body.getOrDefault("title", session.getTitle()));
        sessionRepo.save(session);
        return ResponseEntity.ok(Map.of("title", session.getTitle()));
    }

    // ── SSE Streaming Endpoint ────────────────────────────────────────────────

    /**
     * GET /api/chat/stream?message=...&sessionId=...
     * Returns Server-Sent Events with token-by-token AI response.
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamChat(@RequestParam String message,
                                  @RequestParam Long sessionId) {
        return handleStreaming(message, sessionId);
    }

    @PostMapping(value = "/stream-post", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamChatPost(@RequestBody Map<String, Object> body) {
        String message = (String) body.get("message");
        Long sessionId = Long.valueOf(body.get("sessionId").toString());
        return handleStreaming(message, sessionId);
    }

    private SseEmitter handleStreaming(String message, Long sessionId) {
        SseEmitter emitter = new SseEmitter(180_000L); // 3 min timeout

        User user = currentUser();
        if (user == null) {
            executor.execute(() -> {
                try {
                    emitter.send(SseEmitter.event().name("error").data("{\"error\":\"Not authenticated\"}"));
                    emitter.complete();
                } catch (Exception ignored) {}
            });
            return emitter;
        }

        ChatSession session = sessionRepo.findById(sessionId).orElse(null);
        if (session == null || !session.getUser().getId().equals(user.getId())) {
            executor.execute(() -> {
                try {
                    emitter.send(SseEmitter.event().name("error").data("{\"error\":\"Session not found\"}"));
                    emitter.complete();
                } catch (Exception ignored) {}
            });
            return emitter;
        }

        // Persist user message
        ChatMessage userMsg = new ChatMessage(session, "user", message);
        messageRepo.save(userMsg);

        // Track user prompt activity
        activityTrackingService.track(user.getId(), "CHAT", "PROMPT_SEND", "Sent chat message: " + (message.length() > 60 ? message.substring(0, 57) + "..." : message), message, session.getId().toString());

        // Build conversation context (last 10 messages for context)
        List<ChatMessage> history = messageRepo.findBySessionOrderByCreatedAtAsc(session);
        String messageToUse = message;
        if (activityRecallService.isActivityRecallQuery(message)) {
            String recallContext = activityRecallService.buildRecallPromptContext(user, message);
            messageToUse = recallContext + "\nUser Query: " + message;
        }
        StringBuilder contextPrompt = buildContextPrompt(history, messageToUse);

        // Update session timestamp
        session.setUpdatedAt(LocalDateTime.now());
        // Auto-title after first user message
        if ("New Chat".equals(session.getTitle()) && !message.isBlank()) {
            String autoTitle = message.length() > 50 ? message.substring(0, 47) + "..." : message;
            session.setTitle(autoTitle);
        }
        sessionRepo.save(session);

        // Stream in background thread
        executor.execute(() -> {
            StringBuilder fullResponse = new StringBuilder();
            try {
                streamingService.streamResponse(contextPrompt.toString(), token -> {
                    try {
                        fullResponse.append(token);
                        emitter.send(SseEmitter.event()
                            .name("token")
                            .data(token));
                    } catch (Exception e) {
                        throw new RuntimeException("SSE send failed", e);
                    }
                });

                // Persist assistant response
                ChatMessage assistantMsg = new ChatMessage(session, "assistant", fullResponse.toString());
                messageRepo.save(assistantMsg);

                // Track assistant response activity
                activityTrackingService.track(user.getId(), "CHAT", "RESPONSE_RECEIVE", "AI responded: " + (fullResponse.length() > 60 ? fullResponse.substring(0, 57) + "..." : fullResponse), fullResponse.toString(), session.getId().toString());

                emitter.send(SseEmitter.event().name("done").data("{\"done\":true}"));
                emitter.complete();
            } catch (Exception e) {
                try {
                    String errJson = "{\"error\":\"" + e.getMessage().replace("\"", "'") + "\"}";
                    emitter.send(SseEmitter.event().name("error").data(errJson));
                    emitter.complete();
                } catch (Exception ignored) {}
            }
        });

        return emitter;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private User currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName()))
            return null;
        return userRepo.findByUsernameOrEmail(auth.getName(), auth.getName()).orElse(null);
    }

    private StringBuilder buildContextPrompt(List<ChatMessage> history, String currentMessage) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are Phi, a helpful, concise, and intelligent AI assistant. ");
        sb.append("Answer accurately and clearly.\n\n");

        // Include last 8 messages for context window
        int start = Math.max(0, history.size() - 9); // -9 because new user msg not yet in list
        for (int i = start; i < history.size() - 1; i++) { // exclude the just-saved user msg
            ChatMessage msg = history.get(i);
            if ("user".equals(msg.getRole()))
                sb.append("User: ").append(msg.getContent()).append("\n");
            else
                sb.append("Assistant: ").append(msg.getContent()).append("\n");
        }
        sb.append("User: ").append(currentMessage).append("\nAssistant:");
        return sb;
    }
}
