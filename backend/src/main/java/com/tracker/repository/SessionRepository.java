package com.tracker.repository;

import com.tracker.model.Session;
import com.tracker.model.User;
import com.tracker.model.Activity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SessionRepository extends JpaRepository<Session, Long> {
    List<Session> findByEndTimeIsNull();
    List<Session> findByUserAndEndTimeIsNull(User user);
    List<Session> findByStartTimeBetween(LocalDateTime start, LocalDateTime end);
    List<Session> findByUserAndStartTimeBetween(User user, LocalDateTime start, LocalDateTime end);
    List<Session> findByUserOrderByStartTimeDesc(User user);
    List<Session> findByActivity(Activity activity);
}
