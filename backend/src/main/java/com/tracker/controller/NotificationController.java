package com.tracker.controller;

import com.tracker.dto.NotificationDTO;
import com.tracker.model.Notification;
import com.tracker.model.User;
import com.tracker.repository.UserRepository;
import com.tracker.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final UserRepository userRepository;

    public NotificationController(NotificationService notificationService, UserRepository userRepository) {
        this.notificationService = notificationService;
        this.userRepository = userRepository;
    }

    private User getCurrentUser() {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByUsernameOrEmail(username, username).orElseThrow();
    }

    @GetMapping
    public List<NotificationDTO> getNotifications() {
        User user = getCurrentUser();
        return notificationService.getNotificationsForUser(user).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<NotificationDTO> createNotification(@RequestBody NotificationDTO dto) {
        User user = getCurrentUser();
        Notification notification = notificationService.createNotification(
                user,
                dto.getTitle(),
                dto.getDescription(),
                dto.getType()
        );
        return ResponseEntity.ok(convertToDTO(notification));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<NotificationDTO> markAsRead(@PathVariable Long id) {
        User user = getCurrentUser();
        return notificationService.markAsRead(id, user)
                .map(notification -> ResponseEntity.ok(convertToDTO(notification)))
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping
    public ResponseEntity<Void> clearAllNotifications() {
        User user = getCurrentUser();
        notificationService.clearAll(user);
        return ResponseEntity.noContent().build();
    }

    private NotificationDTO convertToDTO(Notification notification) {
        NotificationDTO dto = new NotificationDTO();
        dto.setId(notification.getId());
        dto.setTitle(notification.getTitle());
        dto.setDescription(notification.getDescription());
        dto.setType(notification.getType());
        dto.setIsRead(notification.getIsRead());
        dto.setCreatedAt(notification.getCreatedAt());
        return dto;
    }
}
