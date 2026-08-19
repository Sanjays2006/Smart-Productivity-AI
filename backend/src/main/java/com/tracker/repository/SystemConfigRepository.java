package com.tracker.repository;

import com.tracker.model.SystemConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * SystemConfigRepository — Data repository to manage 'system_config' records in the database.
 */
@Repository
public interface SystemConfigRepository extends JpaRepository<SystemConfig, String> {
}
