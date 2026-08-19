package com.tracker.service;

import com.tracker.model.Notification;
import com.tracker.model.User;
import com.tracker.repository.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional(readOnly = true)
    public List<Notification> getNotificationsForUser(User user) {
        return notificationRepository.findByUserOrderByCreatedAtDesc(user);
    }

    @Transactional
    public Notification createNotification(User user, String title, String description, String type) {
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setTitle(title);
        notification.setDescription(description);
        notification.setType(type != null ? type : "info");
        notification.setIsRead(false);
        return notificationRepository.save(notification);
    }

    @Transactional
    public Optional<Notification> markAsRead(Long id, User user) {
        return notificationRepository.findById(id).map(notification -> {
            if (notification.getUser() != null && user != null && user.getId() != null && notification.getUser().getId().equals(user.getId())) {
                notification.setIsRead(true);
                return notificationRepository.save(notification);
            }
            throw new SecurityException("Unauthorized to modify this notification");
        });
    }

    @Transactional
    public void clearAll(User user) {
        notificationRepository.deleteByUser(user);
    }
}
