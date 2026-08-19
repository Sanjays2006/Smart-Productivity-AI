package com.tracker.controller;

import com.tracker.model.DailyTotal;
import com.tracker.model.Session;
import com.tracker.model.User;
import com.tracker.repository.DailyTotalRepository;
import com.tracker.repository.SessionRepository;
import com.tracker.repository.UserRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping("/api/history")
public class HistoryController {

    private final DailyTotalRepository dailyTotalRepository;
    private final SessionRepository sessionRepository;
    private final UserRepository userRepository;

    public HistoryController(DailyTotalRepository dailyTotalRepository,
                             SessionRepository sessionRepository,
                             UserRepository userRepository) {
        this.dailyTotalRepository = dailyTotalRepository;
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsernameOrEmail(username, username).orElseThrow();
    }

    @GetMapping
    public List<DailyTotal> getAllHistory() {
        User user = getCurrentUser();
        return dailyTotalRepository.findTop30ByUserOrderByRecordDateDesc(user)
                .stream()
                .sorted(Comparator.comparing(DailyTotal::getRecordDate).reversed())
                .toList();
    }

    @GetMapping("/sessions")
    public List<Session> getAllSessions() {
        User user = getCurrentUser();
        // Return ALL of the user's sessions (newest first). The previous 30-day window
        // silently hid older deep-work logs from the timeline.
        return sessionRepository.findByUserOrderByStartTimeDesc(user);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportCsv() {
        User user = getCurrentUser();
        LocalDateTime since = LocalDateTime.now().minusDays(365);
        List<Session> sessions = sessionRepository.findByUserAndStartTimeBetween(user, since, LocalDateTime.now())
                .stream()
                .filter(s -> s.getEndTime() != null)
                .sorted(Comparator.comparing(Session::getStartTime).reversed())
                .toList();

        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
        StringBuilder csv = new StringBuilder("Date,Activity,Duration (min),XP Earned,Pomodoro,Notes\n");

        for (Session s : sessions) {
            csv.append(s.getStartTime().format(fmt)).append(",");
            csv.append(s.getActivity() != null ? s.getActivity().getName() : "Unknown").append(",");
            csv.append(s.getDurationSeconds() / 60).append(",");
            csv.append(s.getEarnedXp()).append(",");
            csv.append(s.getIsPomodoro() ? "Yes" : "No").append(",");
            csv.append(s.getNotes() != null ? s.getNotes().replace(",", ";") : "").append("\n");
        }

        byte[] bytes = csv.toString().getBytes(StandardCharsets.UTF_8);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv"));
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"focus-history.csv\"");

        return ResponseEntity.ok().headers(headers).body(bytes);
    }
}
