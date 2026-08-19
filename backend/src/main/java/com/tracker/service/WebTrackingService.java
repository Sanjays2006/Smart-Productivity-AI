package com.tracker.service;

import com.tracker.model.User;
import com.tracker.model.WebsiteVisit;
import com.tracker.repository.WebsiteVisitRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class WebTrackingService {

    private final WebsiteVisitRepository visitRepository;

    public WebTrackingService(WebsiteVisitRepository visitRepository) {
        this.visitRepository = visitRepository;
    }

    @Transactional
    public WebsiteVisit recordHeartbeat(User user, String url, String title, int elapsedSeconds) {
        if (url == null || url.isBlank() || url.startsWith("chrome://") || url.startsWith("about:")) {
            return null;
        }

        String domain = extractDomain(url);
        LocalDate today = LocalDate.now();

        WebsiteVisit visit = visitRepository.findByUserAndDomainAndVisitDate(user, domain, today)
                .orElseGet(() -> {
                    WebsiteVisit v = new WebsiteVisit();
                    v.setUser(user);
                    v.setUrl(url);
                    v.setDomain(domain);
                    v.setTitle(title);
                    v.setVisitDate(today);
                    v.setTimeSpentSeconds(0);
                    v.setCategory(categorize(domain));
                    return v;
                });

        visit.setTimeSpentSeconds(visit.getTimeSpentSeconds() + elapsedSeconds);
        visit.setLastSeen(LocalDateTime.now());
        if (title != null && !title.isBlank()) visit.setTitle(title);

        return visitRepository.save(visit);
    }

    public List<WebsiteVisit> getTodaySites(User user) {
        return visitRepository.findByUserAndVisitDateOrderByTimeSpentSecondsDesc(user, LocalDate.now());
    }

    public List<WebsiteVisit> getAllHistory(User user) {
        return visitRepository.findTop100ByUserOrderByVisitDateDescTimeSpentSecondsDesc(user);
    }

    private String extractDomain(String url) {
        try {
            URI uri = new URI(url);
            String host = uri.getHost();
            if (host == null) return url;
            return host.startsWith("www.") ? host.substring(4) : host;
        } catch (Exception e) {
            return url.length() > 50 ? url.substring(0, 50) : url;
        }
    }

    private String categorize(String domain) {
        if (domain == null) return "other";
        String d = domain.toLowerCase();
        if (d.contains("youtube") || d.contains("coursera") || d.contains("udemy") ||
            d.contains("pluralsight") || d.contains("linkedin.com/learning")) return "video";
        if (d.contains("github") || d.contains("gitlab") || d.contains("stackoverflow") ||
            d.contains("docs.") || d.contains("developer.") || d.contains("javadoc")) return "docs";
        if (d.contains("medium") || d.contains("dev.to") || d.contains("hashnode") ||
            d.contains("substack") || d.contains("blog")) return "article";
        if (d.contains("google") || d.contains("bing") || d.contains("duckduckgo")) return "search";
        return "study";
    }
}
