package com.tracker.repository;

import com.tracker.model.User;
import com.tracker.model.WebsiteVisit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface WebsiteVisitRepository extends JpaRepository<WebsiteVisit, Long> {
    List<WebsiteVisit> findByVisitDateOrderByTimeSpentSecondsDesc(LocalDate date);
    List<WebsiteVisit> findByUserAndVisitDateOrderByTimeSpentSecondsDesc(User user, LocalDate date);
    
    Optional<WebsiteVisit> findByDomainAndVisitDate(String domain, LocalDate date);
    Optional<WebsiteVisit> findByUserAndDomainAndVisitDate(User user, String domain, LocalDate date);
    
    List<WebsiteVisit> findTop100ByOrderByVisitDateDescTimeSpentSecondsDesc();
    List<WebsiteVisit> findTop100ByUserOrderByVisitDateDescTimeSpentSecondsDesc(User user);
}
