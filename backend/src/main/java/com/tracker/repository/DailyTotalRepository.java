package com.tracker.repository;

import com.tracker.model.DailyTotal;
import com.tracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailyTotalRepository extends JpaRepository<DailyTotal, Long> {
    Optional<DailyTotal> findByRecordDate(LocalDate date);
    Optional<DailyTotal> findByUserAndRecordDate(User user, LocalDate date);
    List<DailyTotal> findTop7ByUserOrderByRecordDateDesc(User user);
    List<DailyTotal> findTop30ByUserOrderByRecordDateDesc(User user);
    List<DailyTotal> findByUser(User user);
}
