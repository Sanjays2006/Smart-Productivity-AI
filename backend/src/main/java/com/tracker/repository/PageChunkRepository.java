package com.tracker.repository;

import com.tracker.model.PageChunk;
import com.tracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PageChunkRepository extends JpaRepository<PageChunk, Long> {
    List<PageChunk> findTop200ByOrderByCreatedAtDesc();
    List<PageChunk> findByUserOrderByCreatedAtDesc(User user);
    void deleteBySourceUrl(String sourceUrl);
    long countBySourceUrl(String sourceUrl);
    long countByUserAndSourceUrl(User user, String sourceUrl);
}
