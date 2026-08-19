package com.tracker.service;

import com.tracker.model.ActivityLog;
import com.tracker.model.UserActivityHistory;
import com.tracker.model.User;
import com.tracker.model.XpHistory;
import com.tracker.repository.ActivityLogRepository;
import com.tracker.repository.UserActivityHistoryRepository;
import com.tracker.repository.UserRepository;
import com.tracker.repository.XpHistoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class ActivityTrackingService {

    private final ActivityLogRepository logRepository;
    private final UserActivityHistoryRepository historyRepository;
    private final UserRepository userRepository;
    private final GamificationService gamificationService;
    private final XpHistoryRepository xpHistoryRepository;

    public ActivityTrackingService(ActivityLogRepository logRepository, 
                                   UserActivityHistoryRepository historyRepository,
                                   UserRepository userRepository,
                                   GamificationService gamificationService,
                                   XpHistoryRepository xpHistoryRepository) {
        this.logRepository = logRepository;
        this.historyRepository = historyRepository;
        this.userRepository = userRepository;
        this.gamificationService = gamificationService;
        this.xpHistoryRepository = xpHistoryRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void track(Long userId, String category, String action, String description, String metadata, String relatedRecordId) {
        if (userId == null) return;
        LocalDateTime now = LocalDateTime.now();
        
        try {
            // Write log trace
            ActivityLog log = new ActivityLog();
            log.setUserId(userId);
            log.setCategory(category);
            log.setAction(action);
            log.setDescription(description);
            log.setMetadata(metadata);
            log.setRelatedRecordId(relatedRecordId);
            log.setTimestamp(now);
            logRepository.save(log);

            UserActivityHistory history = new UserActivityHistory();
            history.setUserId(userId);
            history.setCategory(category);
            history.setActivityType(action);
            history.setDescription(description);
            history.setMetadata(metadata);
            history.setRelatedRecordId(relatedRecordId);
            history.setTimestamp(now);
            historyRepository.save(history);

            // Hook XP/Coin awards
            User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                processXpHook(user, category, action, description);
            }

        } catch (Exception e) {
            System.err.println("⚠️ Failed to write activity logs or award XP: " + e.getMessage());
        }
    }

    private void processXpHook(User user, String category, String action, String description) {
        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();

        // 1. CHAT - prompt send
        if ("CHAT".equalsIgnoreCase(category) && "PROMPT_SEND".equalsIgnoreCase(action)) {
            gamificationService.awardXp(user, 15, "Asked AI: " + truncateDesc(description), "CHAT");
        }
        // 2. NOTE - note create
        else if ("NOTE".equalsIgnoreCase(category) && "NOTE_CREATE".equalsIgnoreCase(action)) {
            gamificationService.awardXp(user, 25, "Created Study Note: " + truncateDesc(description), "NOTE");
        }
        // 3. LEARNING - topic add
        else if ("LEARNING".equalsIgnoreCase(category) && "TOPIC_ADD".equalsIgnoreCase(action)) {
            gamificationService.awardXp(user, 30, "Added Topic: " + truncateDesc(description), "LEARNING");
        }
        // 4. DOCUMENT - crawl trigger
        else if ("DOCUMENT".equalsIgnoreCase(category) && "CRAWL_TRIGGER".equalsIgnoreCase(action)) {
            gamificationService.awardXp(user, 20, "Sync Knowledge Base", "DOCUMENT");
        }
        // 5. DOCUMENT - page index
        else if ("DOCUMENT".equalsIgnoreCase(category) && "PAGE_INDEX".equalsIgnoreCase(action)) {
            gamificationService.awardXp(user, 15, "Indexed study reference: " + truncateDesc(description), "DOCUMENT");
        }
        // 6. AUTH - register
        else if ("AUTH".equalsIgnoreCase(category) && "REGISTER".equalsIgnoreCase(action)) {
            gamificationService.awardXp(user, 100, "Created Focus Profile", "AUTH");
        }
        // 7. AUTH - login (capped once per day)
        else if ("AUTH".equalsIgnoreCase(category) && "LOGIN".equalsIgnoreCase(action)) {
            List<XpHistory> todayLogins = xpHistoryRepository.findByUserAndCategoryAndTimestampAfter(user, "AUTH", startOfToday);
            boolean alreadyAwarded = todayLogins.stream().anyMatch(h -> h.getReason().contains("Daily check-in"));
            if (!alreadyAwarded) {
                gamificationService.awardXp(user, 10, "Daily check-in login", "AUTH");
            }
        }
        // 8. RAG - query test
        else if ("RAG".equalsIgnoreCase(category) && "QUERY_TEST".equalsIgnoreCase(action)) {
            gamificationService.awardXp(user, 5, "Tested context retrieval", "RAG");
        }
        // 9. DOCUMENT - website visit (capped at 10 times per day)
        else if ("DOCUMENT".equalsIgnoreCase(category) && "WEBSITE_VISIT".equalsIgnoreCase(action)) {
            List<XpHistory> todayVisits = xpHistoryRepository.findByUserAndCategoryAndTimestampAfter(user, "DOCUMENT", startOfToday);
            long visitsCount = todayVisits.stream().filter(h -> h.getReason().contains("Visited site")).count();
            if (visitsCount < 10) {
                gamificationService.awardXp(user, 5, "Visited site: " + truncateDesc(description), "DOCUMENT");
            }
        }
    }

    private String truncateDesc(String desc) {
        if (desc == null) return "";
        return desc.length() > 50 ? desc.substring(0, 47) + "..." : desc;
    }
}
