package com.tracker.controller;

import com.tracker.model.Note;
import com.tracker.model.User;
import com.tracker.repository.NoteRepository;
import com.tracker.repository.UserRepository;
import com.tracker.service.ActivityTrackingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notes")
public class NoteController {

    private final NoteRepository noteRepository;
    private final UserRepository userRepository;
    private final com.tracker.service.RagService ragService;
    private final ActivityTrackingService trackingService;

    public NoteController(NoteRepository noteRepository,
                          UserRepository userRepository,
                          com.tracker.service.RagService ragService,
                          ActivityTrackingService trackingService) {
        this.noteRepository = noteRepository;
        this.userRepository = userRepository;
        this.ragService = ragService;
        this.trackingService = trackingService;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsernameOrEmail(username, username).orElseThrow();
    }

    @GetMapping
    public List<Note> getAllNotes() {
        return noteRepository.findByUserOrderByCreatedAtDesc(getCurrentUser());
    }

    @PostMapping
    public ResponseEntity<Note> createNote(@RequestBody Note note) {
        User user = getCurrentUser();
        note.setUser(user);
        Note savedNote = noteRepository.save(note);
        
        // Log note creation activity
        trackingService.track(user.getId(), "NOTE", "NOTE_CREATE", "Created note: " + note.getTitle(), note.getContent(), savedNote.getId().toString());

        // Index for AI RAG
        try {
            ragService.ingestNote(user, savedNote);
        } catch (Exception e) {
            // Log but don't fail the request
            System.err.println("Failed to index note: " + e.getMessage());
        }
        
        return ResponseEntity.ok(savedNote);
    }
}
