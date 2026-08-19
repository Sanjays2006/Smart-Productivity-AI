package com.tracker.repository;

import com.tracker.model.XpHistory;
import com.tracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface XpHistoryRepository extends JpaRepository<XpHistory, Long> {
    List<XpHistory> findByUserOrderByTimestampDesc(User user);
    List<XpHistory> findByUserAndCategoryAndTimestampAfter(User user, String category, LocalDateTime timestamp);
}
