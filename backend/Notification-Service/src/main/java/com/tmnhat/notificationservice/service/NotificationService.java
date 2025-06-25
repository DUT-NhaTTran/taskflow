package com.tmnhat.notificationservice.service;

import com.tmnhat.notificationservice.model.Notification;
import com.tmnhat.notificationservice.payload.enums.NotificationType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationService {
    
    // Get all notifications for a user
    List<Notification> getNotificationsByUserId(UUID userId);
    
    // Get unread notifications for a user
    List<Notification> getUnreadNotificationsByUserId(UUID userId);
    
    // Get unread count for a user
    long getUnreadCount(UUID userId);
    
    // Get notification by ID
    Optional<Notification> getNotificationById(Long id);
    
    // Mark notification as read
    boolean markAsRead(Long id);
    
    // Delete notification
    boolean deleteNotification(Long id);
    
    // General notification creation method
    Notification createNotification(NotificationType type, String title, String message,
                                  UUID recipientUserId, UUID actorUserId, String actorUserName,
                                  String actorUserAvatar, UUID projectId, String projectName,
                                  UUID taskId, UUID sprintId, Long commentId, String actionUrl);
    
    // Check if TASK_OVERDUE notification already exists for a specific task and user
    boolean hasTaskOverdueNotification(UUID taskId, UUID recipientUserId);
    
    // Remove TASK_OVERDUE notifications for a specific task (when task is completed or no longer overdue)
    void removeTaskOverdueNotifications(UUID taskId);
    
    // Check if SPRINT_OVERDUE notification already exists for a specific sprint and user
    boolean hasSprintOverdueNotification(UUID sprintId, UUID recipientUserId);
    
    // Remove SPRINT_OVERDUE notifications for a specific sprint (when sprint is completed or no longer overdue)
    void removeSprintOverdueNotifications(UUID sprintId);
} 