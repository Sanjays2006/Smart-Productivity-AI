package com.tracker.repository;

import com.tracker.model.Activity;
import com.tracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ActivityRepository extends JpaRepository<Activity, Long> {
    List<Activity> findByIsActiveTrue();
    List<Activity> findByUserAndIsActiveTrue(User user);
}
