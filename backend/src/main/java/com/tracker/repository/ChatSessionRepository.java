package com.tracker.repository;

import com.tracker.model.ChatSession;
import com.tracker.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ChatSessionRepository extends JpaRepository<ChatSession, Long> {
    List<ChatSession> findByUserOrderByUpdatedAtDesc(User user);
    List<ChatSession> findTop20ByUserOrderByUpdatedAtDesc(User user);
}
