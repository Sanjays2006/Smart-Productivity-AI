package com.tracker.repository;

import com.tracker.model.StreakHistory;
import com.tracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StreakHistoryRepository extends JpaRepository<StreakHistory, Long> {
    List<StreakHistory> findByUserAndActiveTrue(User user);
    List<StreakHistory> findByUserOrderByStartDateDesc(User user);
}
