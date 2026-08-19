package com.tracker.repository;

import com.tracker.model.UserActivityHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface UserActivityHistoryRepository extends JpaRepository<UserActivityHistory, Long> {

    @Query("SELECT h FROM UserActivityHistory h WHERE " +
           "(:userId IS NULL OR h.userId = :userId) AND " +
           "(:category IS NULL OR h.category = :category) AND " +
           "(:queryLike IS NULL OR LOWER(h.description) LIKE :queryLike OR LOWER(h.metadata) LIKE :queryLike) AND " +
           "(h.timestamp >= COALESCE(:startDate, h.timestamp)) AND " +
           "(h.timestamp <= COALESCE(:endDate, h.timestamp)) " +
           "ORDER BY h.timestamp DESC")
    List<UserActivityHistory> searchActivities(
            @Param("userId") Long userId,
            @Param("category") String category,
            @Param("queryLike") String queryLike,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate
    );

    long countByUserIdAndTimestampGreaterThanEqual(Long userId, LocalDateTime timestamp);
    long countByUserIdAndTimestampBetween(Long userId, LocalDateTime start, LocalDateTime end);
    long countByUserIdAndCategoryAndTimestampGreaterThanEqual(Long userId, String category, LocalDateTime timestamp);
    long countByUserIdAndCategory(Long userId, String category);
    long countByUserIdAndActivityType(Long userId, String activityType);
}
