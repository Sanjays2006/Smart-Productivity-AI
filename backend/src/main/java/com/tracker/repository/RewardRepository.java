package com.tracker.repository;

import com.tracker.model.Reward;
import com.tracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RewardRepository extends JpaRepository<Reward, Long> {
    List<Reward> findByUser(User user);
    Optional<Reward> findByUserAndCode(User user, String code);
}
