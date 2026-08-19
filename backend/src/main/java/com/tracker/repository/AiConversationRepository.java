package com.tracker.repository;

import com.tracker.model.AiConversation;
import com.tracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiConversationRepository extends JpaRepository<AiConversation, Long> {
    List<AiConversation> findTop20ByOrderByCreatedAtDesc();
    List<AiConversation> findTop20ByUserOrderByCreatedAtDesc(User user);
    long countByUser(User user);
}
