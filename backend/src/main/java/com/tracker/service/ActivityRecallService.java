package com.tracker.service;

import com.tracker.model.*;
import com.tracker.repository.*;
import org.springframework.stereotype.Service;

import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ActivityRecallService {

    private final UserActivityHistoryRepository historyRepo;
    private final SessionRepository sessionRepository;
    private final AiConversationRepository conversationRepository;
    private final DailyTotalRepository dailyTotalRepository;
    private final PageChunkRepository chunkRepository;
    private final NoteRepository noteRepository;

    public ActivityRecallService(UserActivityHistoryRepository historyRepo,
                                 SessionRepository sessionRepository,
                                 AiConversationRepository conversationRepository,
                                 DailyTotalRepository dailyTotalRepository,
                                 PageChunkRepository chunkRepository,
                                 NoteRepository noteRepository) {
        this.historyRepo = historyRepo;
        this.sessionRepository = sessionRepository;
        this.conversationRepository = conversationRepository;
        this.dailyTotalRepository = dailyTotalRepository;
        this.chunkRepository = chunkRepository;
        this.noteRepository = noteRepository;
    }

    public boolean isActivityRecallQuery(String query) {
        if (query == null) return false;
        String lower = query.toLowerCase().trim();
        return lower.contains("what did i") 
            || lower.contains("what tasks did i")
            || lower.contains("show my") 
            || lower.contains("show all") 
            || lower.contains("documents uploaded")
            || lower.contains("learning activity") 
            || lower.contains("my history") 
            || lower.contains("conversations related to")
            || lower.contains("summarize my")
            || lower.contains("productivity trends")
            || lower.contains("productivity trend")
            || lower.contains("learning progress")
            || lower.contains("completed this week")
            || lower.contains("completed today")
            || lower.contains("work on yesterday");
    }

    public String buildRecallPromptContext(User user, String query) {
        String dataText = getRecallDataText(user, query);
        StringBuilder sb = new StringBuilder();
        sb.append("\n[BACKGROUND ACTIVITY DATA FROM POSTGRESQL]\n");
        sb.append(dataText);
        sb.append("[END BACKGROUND DATA]\n");
        sb.append("\nInstructions for Assistant: You act as the user's offline private Memory layer. ");
        sb.append("The user has asked: '").append(query).append("'. ");
        sb.append("Use the background activity data above to construct a detailed, natural-language, and cohesive summary of what the user did. ");
        sb.append("Highlight note creations, RAG crawls, document indexing, focus sessions, and conversations. ");
        sb.append("Be friendly, structure your reply with bullet points and bold headers where helpful, and keep it strictly matching the database logs. ");
        sb.append("Do not mention database schemas, running SQL, or tables, just answer the recall query directly.\n\n");

        return sb.toString();
    }

    public String getRecallDataText(User user, String query) {
        String lower = query.toLowerCase().trim();
        LocalDateTime now = LocalDateTime.now();
        StringBuilder sb = new StringBuilder();

        if (lower.contains("conversation") || lower.contains("chats") || lower.contains("recent ai")) {
            List<AiConversation> chats = conversationRepository.findTop20ByUserOrderByCreatedAtDesc(user);
            sb.append("### 💬 Recent AI Conversations (from PostgreSQL)\n");
            if (chats.isEmpty()) {
                sb.append("No AI conversation records found.\n");
            } else {
                for (int i = 0; i < Math.min(chats.size(), 5); i++) {
                    AiConversation c = chats.get(i);
                    String time = c.getCreatedAt() != null ? c.getCreatedAt().toString().replace("T", " ").substring(0, 16) : "Unknown time";
                    sb.append(String.format("- **[%s]** Q: *\"%s\"*\n", time, c.getQuestion()));
                    String ans = c.getAnswer();
                    if (ans != null) {
                        String snippet = ans.length() > 100 ? ans.substring(0, 97) + "..." : ans;
                        sb.append(String.format("  *A: %s*\n", snippet));
                    }
                }
            }
        } 
        else if (lower.contains("document") || lower.contains("upload") || lower.contains("pdf")) {
            List<PageChunk> chunks = chunkRepository.findByUserOrderByCreatedAtDesc(user);
            sb.append("### 📄 Uploaded Documents (from PostgreSQL)\n");
            
            Set<String> seenDocs = new LinkedHashSet<>();
            List<PageChunk> uniqueDocs = new ArrayList<>();
            for (PageChunk chunk : chunks) {
                String key = chunk.getSourceTitle() != null ? chunk.getSourceTitle() : chunk.getSourceUrl();
                if (key != null && !seenDocs.contains(key)) {
                    seenDocs.add(key);
                    uniqueDocs.add(chunk);
                }
            }

            if (uniqueDocs.isEmpty()) {
                sb.append("No uploaded documents found in your knowledge base.\n");
            } else {
                for (int i = 0; i < Math.min(uniqueDocs.size(), 5); i++) {
                    PageChunk c = uniqueDocs.get(i);
                    String time = c.getCreatedAt() != null ? c.getCreatedAt().toString().replace("T", " ").substring(0, 16) : "Unknown date";
                    sb.append(String.format("- **[%s]** Title: *%s*\n  *Source: %s*\n", time, c.getSourceTitle(), c.getSourceUrl()));
                }
            }
        } 
        else if (lower.contains("trend") || lower.contains("productivity trends") || lower.contains("summarize my trend")) {
            List<DailyTotal> totals = dailyTotalRepository.findTop7ByUserOrderByRecordDateDesc(user);
            sb.append("### 📈 Productivity Trends Summary (last 7 days)\n");
            if (totals.isEmpty()) {
                sb.append("No daily totals found. Complete focus sessions to start tracking trends!\n");
            } else {
                int totalSecs = 0;
                int maxSecs = 0;
                LocalDate peakDay = null;
                int totalSess = 0;
                for (DailyTotal t : totals) {
                    int secs = t.getTotalSeconds() != null ? t.getTotalSeconds() : 0;
                    totalSecs += secs;
                    totalSess += (t.getSessionsCompleted() != null ? t.getSessionsCompleted() : 0);
                    if (secs > maxSecs) {
                        maxSecs = secs;
                        peakDay = t.getRecordDate();
                    }
                }
                double avgHours = (totalSecs / 3600.0) / Math.max(1, totals.size());
                sb.append(String.format("- **Total Focus Time:** %.1f hours\n", totalSecs / 3600.0));
                sb.append(String.format("- **Daily Focus Average:** %.1f hours\n", avgHours));
                sb.append(String.format("- **Sessions Completed:** %d\n", totalSess));
                if (peakDay != null) {
                    sb.append(String.format("- **Peak Focus Day:** %s (%.1f hours)\n", peakDay.toString(), maxSecs / 3600.0));
                }
            }
        } 
        else if (lower.contains("yesterday")) {
            LocalDate yesterday = LocalDate.now().minusDays(1);
            LocalDateTime start = yesterday.atStartOfDay();
            LocalDateTime end = yesterday.atTime(23, 59, 59);

            List<Session> sessions = sessionRepository.findByUserAndStartTimeBetween(user, start, end);
            List<Note> notes = noteRepository.findByUserOrderByCreatedAtDesc(user).stream()
                    .filter(n -> n.getCreatedAt() != null && n.getCreatedAt().isAfter(start) && n.getCreatedAt().isBefore(end))
                    .collect(Collectors.toList());

            sb.append("### 📅 Activity on Yesterday (" + yesterday + ")\n");
            
            if (sessions.isEmpty() && notes.isEmpty()) {
                sb.append("No focus sessions or notes logged yesterday.\n");
            } else {
                if (!sessions.isEmpty()) {
                    sb.append("**⏱️ Focus Sessions:**\n");
                    for (Session s : sessions) {
                        int mins = s.getDurationSeconds() != null ? s.getDurationSeconds() / 60 : 0;
                        String timeStr = s.getStartTime() != null ? s.getStartTime().toString().substring(11, Math.min(16, s.getStartTime().toString().length())) : "Unknown";
                        sb.append(String.format("  - studied **%s** for %d minutes (from %s)\n", 
                            (s.getActivity() != null ? s.getActivity().getName() : "Unknown"), mins, timeStr));
                    }
                }
                if (!notes.isEmpty()) {
                    sb.append("**📝 Captured Notes:**\n");
                    for (Note n : notes) {
                        sb.append(String.format("  - title: *%s*\n", n.getTitle() != null ? n.getTitle() : "Untitled"));
                    }
                }
            }
        } 
        else if (lower.contains("last 7 days") || lower.contains("study activity") || lower.contains("7 days")) {
            LocalDateTime start = LocalDate.now().minusDays(7).atStartOfDay();
            List<Session> sessions = sessionRepository.findByUserAndStartTimeBetween(user, start, now);

            sb.append("### 🎓 Study Activity for the Last 7 Days\n");
            if (sessions.isEmpty()) {
                sb.append("No study sessions recorded in the last 7 days.\n");
            } else {
                Map<String, Integer> topicMinutes = new HashMap<>();
                for (Session s : sessions) {
                    if (s.getEndTime() != null && s.getDurationSeconds() != null) {
                        String name = s.getActivity() != null ? s.getActivity().getName() : "Unknown";
                        topicMinutes.put(name, topicMinutes.getOrDefault(name, 0) + (s.getDurationSeconds() / 60));
                    }
                }
                for (Map.Entry<String, Integer> entry : topicMinutes.entrySet()) {
                    sb.append(String.format("- studied **%s**: %d minutes total (%.1f hours)\n", 
                        entry.getKey(), entry.getValue(), entry.getValue() / 60.0));
                }
            }
        }
        else {
            // General query fallback (chronological timeline)
            LocalDateTime start = LocalDate.now().minusDays(1).atStartOfDay();
            List<UserActivityHistory> records = historyRepo.searchActivities(user.getId(), null, null, start, now);
            sb.append("### 🕒 Recent Cognitive History Logs\n");
            if (records.isEmpty()) {
                sb.append("No recent activity logs found.\n");
            } else {
                for (int i = 0; i < Math.min(records.size(), 10); i++) {
                    UserActivityHistory r = records.get(i);
                    String timeStr = r.getTimestamp() != null ? r.getTimestamp().toString().replace("T", " ").substring(0, Math.min(16, r.getTimestamp().toString().length())) : "Unknown";
                    sb.append(String.format("- `[%s]` **[%s]** %s\n", 
                        timeStr, 
                        r.getCategory() != null ? r.getCategory() : "GENERAL", 
                        r.getDescription() != null ? r.getDescription() : ""));
                }
            }
        }

        return sb.toString();
    }

    private String extractKeyword(String query) {
        String lower = query.toLowerCase();
        lower = lower.replaceAll("[?.!,]", "");
        int relIdx = lower.indexOf("related to ");
        if (relIdx != -1) {
            return query.substring(relIdx + 11).trim();
        }
        int abIdx = lower.indexOf("about ");
        if (abIdx != -1) {
            return query.substring(abIdx + 6).trim();
        }
        String[] stopwords = {
            "what", "did", "i", "do", "yesterday", "today", "show", "my", "all", 
            "conversations", "documents", "uploaded", "during", "the", "last", 
            "days", "week", "month", "learning", "activity", "work", "on", "from"
        };
        List<String> words = new ArrayList<>(Arrays.asList(lower.split("\\s+")));
        words.removeAll(Arrays.asList(stopwords));
        if (!words.isEmpty()) {
            return String.join(" ", words).trim();
        }
        return null;
    }

    public String buildOfflineRecallSummary(User user, String query) {
        String dataText = getRecallDataText(user, query);
        StringBuilder sb = new StringBuilder();
        sb.append("### 🧠 Private Memory Offline Search\n");
        sb.append("> **Status:** Ollama Offline — displaying direct PostgreSQL cognitive logs.\n\n");
        sb.append(dataText);
        return sb.toString();
    }

    private String getCategoryIcon(String category) {
        if (category == null) return "⭐";
        switch (category) {
            case "TIMER": return "⏱️";
            case "CHAT": return "💬";
            case "NOTE": return "📝";
            case "DOCUMENT": return "📄";
            case "AUTH": return "🔐";
            case "LEARNING": return "🎓";
            case "RAG": return "🕸️";
            default: return "⭐";
        }
    }
}
