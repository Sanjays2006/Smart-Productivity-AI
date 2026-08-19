package com.tracker.repository;

import com.tracker.model.ActivityReward;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ActivityRewardRepository extends JpaRepository<ActivityReward, Long> {
    Optional<ActivityReward> findByCategoryAndAction(String category, String action);
}
