package com.tracker.repository;

import com.tracker.model.GamificationData;
import com.tracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GamificationRepository extends JpaRepository<GamificationData, Long> {
    Optional<GamificationData> findByUser(User user);
}
