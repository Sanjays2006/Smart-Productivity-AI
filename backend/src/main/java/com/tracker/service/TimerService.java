package com.tracker.service;

import com.tracker.model.Activity;
import com.tracker.model.DailyTotal;
import com.tracker.model.Session;
import com.tracker.model.User;
import com.tracker.repository.ActivityRepository;
import com.tracker.repository.DailyTotalRepository;
import com.tracker.repository.SessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Service
public class TimerService {

    private final SessionRepository sessionRepository;
    private final ActivityRepository activityRepository;
    private final GamificationService gamificationService;
    private final DailyTotalRepository dailyTotalRepository;
    private final RagService ragService;
    private final ActivityTrackingService activityTrackingService;

    public TimerService(SessionRepository sessionRepository, ActivityRepository activityRepository,
                        GamificationService gamificationService, DailyTotalRepository dailyTotalRepository,
                        RagService ragService, ActivityTrackingService activityTrackingService) {
        this.sessionRepository = sessionRepository;
        this.activityRepository = activityRepository;
        this.gamificationService = gamificationService;
        this.dailyTotalRepository = dailyTotalRepository;
        this.ragService = ragService;
        this.activityTrackingService = activityTrackingService;
    }

    @Transactional
    public Session startSession(User user, Long activityId) {
        return startSession(user, activityId, 1500, false);
    }

    @Transactional
    public Session startSession(User user, Long activityId, Integer targetSeconds, Boolean deepWorkMode) {
        Activity activity = activityRepository.findById(activityId)
                .orElseThrow(() -> new IllegalArgumentException("Activity not found"));

        if (activity.getUser() == null || !activity.getUser().getId().equals(user.getId())) {
            throw new SecurityException("Access denied: Activity does not belong to this user");
        }

        if (activity.getIsActive() == null || !activity.getIsActive()) {
            throw new IllegalArgumentException("Activity is not active");
        }

        Session session = new Session(activity, LocalDateTime.now());
        session.setUser(user);
        session.setTargetSeconds(targetSeconds != null ? targetSeconds : 1500);
        session.setDeepWorkMode(deepWorkMode != null && deepWorkMode);
        session.setStatus("ACTIVE");
        Session savedSession = sessionRepository.save(session);
        
        // Track start session
        activityTrackingService.track(user.getId(), "TIMER", "TIMER_START", "Started focus session: " + activity.getName(), activity.getName(), savedSession.getId().toString());
        
        return savedSession;
    }

    @Transactional
    public Session pauseSession(User user, Long sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        if (session.getUser() == null || !session.getUser().getId().equals(user.getId())) {
            throw new SecurityException("Access denied");
        }

        if (!"ACTIVE".equals(session.getStatus())) {
            throw new IllegalStateException("Session is not active");
        }

        session.setStatus("PAUSED");
        session.setPauseCount(session.getPauseCount() + 1);
        session.setLastPausedTime(LocalDateTime.now());
        
        Session savedSession = sessionRepository.save(session);
        
        activityTrackingService.track(user.getId(), "TIMER", "TIMER_PAUSE", "Paused focus session: " + (session.getActivity() != null ? session.getActivity().getName() : "Focus Session"), null, savedSession.getId().toString());
        
        return savedSession;
    }

    @Transactional
    public Session resumeSession(User user, Long sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        if (session.getUser() == null || !session.getUser().getId().equals(user.getId())) {
            throw new SecurityException("Access denied");
        }

        if (!"PAUSED".equals(session.getStatus())) {
            throw new IllegalStateException("Session is not paused");
        }

        if (session.getLastPausedTime() != null) {
            long pauseSecs = Duration.between(session.getLastPausedTime(), LocalDateTime.now()).getSeconds();
            session.setTotalPauseDurationSeconds(session.getTotalPauseDurationSeconds() + (int) pauseSecs);
        }
        
        session.setStatus("ACTIVE");
        session.setLastPausedTime(null);
        
        Session savedSession = sessionRepository.save(session);
        
        activityTrackingService.track(user.getId(), "TIMER", "TIMER_RESUME", "Resumed focus session: " + (session.getActivity() != null ? session.getActivity().getName() : "Focus Session"), null, savedSession.getId().toString());
        
        return savedSession;
    }

    @Transactional
    public Session endSession(User user, Long sessionId, boolean isPomodoro, String notes) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        if (session.getUser() == null || !session.getUser().getId().equals(user.getId())) {
            throw new SecurityException("Access denied");
        }

        if ("COMPLETED".equals(session.getStatus()) || session.getEndTime() != null) {
            throw new IllegalStateException("Session already ended");
        }

        LocalDateTime endTime = LocalDateTime.now();
        session.setEndTime(endTime);
        
        // If it was paused when ended, make sure to add the last pause interval
        if ("PAUSED".equals(session.getStatus()) && session.getLastPausedTime() != null) {
            long pauseSecs = Duration.between(session.getLastPausedTime(), endTime).getSeconds();
            session.setTotalPauseDurationSeconds(session.getTotalPauseDurationSeconds() + (int) pauseSecs);
        }

        // Total seconds from start to end (minus total pause seconds)
        long totalSecs = Duration.between(session.getStartTime(), endTime).getSeconds();
        int activeSecs = (int) totalSecs - session.getTotalPauseDurationSeconds();
        if (activeSecs < 0) activeSecs = 0;

        // Guard against stale sessions left open for hours/days (e.g. tab closed mid-session).
        // Cap the credited active time so a corrupt start time cannot produce an absurd
        // duration/XP (which previously showed as 1263h and failed the save).
        int targetSecs = session.getTargetSeconds() != null ? session.getTargetSeconds() : 1500;
        int maxReasonable = Math.max(targetSecs * 2, 4 * 3600); // 2x target, or 4h floor
        if (activeSecs > maxReasonable) {
            activeSecs = targetSecs;
        }

        session.setDurationSeconds(activeSecs);
        session.setIsPomodoro(isPomodoro);
        session.setNotes(notes);
        session.setStatus("COMPLETED");

        // Focus Score calculation
        int score = 100;
        score -= session.getPauseCount() * 10;
        int target = session.getTargetSeconds() != null ? session.getTargetSeconds() : 1500;
        if (target > 0 && activeSecs < target) {
            double ratio = (double) activeSecs / target;
            score = (int) (score * ratio);
        }
        if (session.getDeepWorkMode() && session.getPauseCount() == 0 && activeSecs >= target) {
            score += 10;
        }
        score = Math.max(0, Math.min(100, score));
        session.setFocusScore(score);

        int earnedXp = gamificationService.awardSessionXP(user, session);
        session.setEarnedXp(earnedXp);

        Session savedSession = sessionRepository.save(session);
        updateDailyTotals(user, savedSession);
        
        // Track end session
        int minutes = savedSession.getDurationSeconds() / 60;
        activityTrackingService.track(user.getId(), "TIMER", "TIMER_END", "Completed focus session: " + (session.getActivity() != null ? session.getActivity().getName() : "Focus Session") + " (" + minutes + "m, Focus Score: " + score + "%, +" + earnedXp + " XP)", notes, savedSession.getId().toString());

        // Index for AI RAG
        try {
            ragService.ingestSession(user, savedSession);
        } catch (Exception e) {
            System.err.println("Failed to index session: " + e.getMessage());
        }
        
        return savedSession;
    }

    @Transactional
    public Session stopSession(User user, Long sessionId) {
        Session session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("Session not found"));

        if (session.getUser() == null || !session.getUser().getId().equals(user.getId())) {
            throw new SecurityException("Access denied");
        }

        if ("COMPLETED".equals(session.getStatus()) || "STOPPED".equals(session.getStatus()) || session.getEndTime() != null) {
            throw new IllegalStateException("Session already ended");
        }

        LocalDateTime endTime = LocalDateTime.now();
        session.setEndTime(endTime);
        
        if ("PAUSED".equals(session.getStatus()) && session.getLastPausedTime() != null) {
            long pauseSecs = Duration.between(session.getLastPausedTime(), endTime).getSeconds();
            session.setTotalPauseDurationSeconds(session.getTotalPauseDurationSeconds() + (int) pauseSecs);
        }

        long totalSecs = Duration.between(session.getStartTime(), endTime).getSeconds();
        int activeSecs = (int) totalSecs - session.getTotalPauseDurationSeconds();
        if (activeSecs < 0) activeSecs = 0;
        
        session.setDurationSeconds(activeSecs);
        session.setStatus("STOPPED");

        int score = 100;
        score -= session.getPauseCount() * 10;
        int target = session.getTargetSeconds() != null ? session.getTargetSeconds() : 1500;
        if (target > 0) {
            double ratio = (double) activeSecs / target;
            score = (int) (score * ratio * 0.8);
        }
        score = Math.max(0, Math.min(100, score));
        session.setFocusScore(score);

        int earnedXp = Math.max(0, activeSecs / 60);
        session.setEarnedXp(earnedXp);

        Session savedSession = sessionRepository.save(session);
        updateDailyTotals(user, savedSession);
        
        int minutes = savedSession.getDurationSeconds() / 60;
        activityTrackingService.track(user.getId(), "TIMER", "TIMER_STOP", "Stopped focus session early: " + (session.getActivity() != null ? session.getActivity().getName() : "Focus Session") + " (" + minutes + "m, Focus Score: " + score + "%, +" + earnedXp + " XP)", "Stopped early", savedSession.getId().toString());

        try {
            ragService.ingestSession(user, savedSession);
        } catch (Exception e) {
            System.err.println("Failed to index session: " + e.getMessage());
        }
        
        return savedSession;
    }

    private void updateDailyTotals(User user, Session session) {
        LocalDate today = LocalDate.now();
        DailyTotal daily = dailyTotalRepository.findByUserAndRecordDate(user, today).orElseGet(() -> {
            DailyTotal d = new DailyTotal(today);
            d.setUser(user);
            return d;
        });
        
        int currentSecs = daily.getTotalSeconds() != null ? daily.getTotalSeconds() : 0;
        int currentSessions = daily.getSessionsCompleted() != null ? daily.getSessionsCompleted() : 0;
        int currentXp = daily.getTotalXpEarned() != null ? daily.getTotalXpEarned() : 0;

        int addSecs = session.getDurationSeconds() != null ? session.getDurationSeconds() : 0;
        int addXp = session.getEarnedXp() != null ? session.getEarnedXp() : 0;

        daily.setTotalSeconds(currentSecs + addSecs);
        daily.setSessionsCompleted(currentSessions + 1);
        daily.setTotalXpEarned(currentXp + addXp);
        
        dailyTotalRepository.save(daily);
    }
}
