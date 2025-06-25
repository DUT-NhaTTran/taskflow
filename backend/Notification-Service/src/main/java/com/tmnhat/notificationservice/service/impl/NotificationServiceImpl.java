package com.tmnhat.notificationservice.service.impl;

import com.tmnhat.notificationservice.model.Notification;
import com.tmnhat.notificationservice.payload.enums.NotificationType;
import com.tmnhat.notificationservice.repository.NotificationDAO;
import com.tmnhat.notificationservice.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class NotificationServiceImpl implements NotificationService {
    
    @Autowired
    private NotificationDAO notificationDAO;
    
    @Override
    public List<Notification> getNotificationsByUserId(UUID userId) {
        try {
            return notificationDAO.findByRecipientUserIdOrderByCreatedAtDesc(userId);
        } catch (Exception e) {
            System.err.println("Error retrieving notifications for user " + userId + ": " + e.getMessage());
            throw new RuntimeException("Failed to retrieve notifications", e);
        }
    }
    
    @Override
    public List<Notification> getUnreadNotificationsByUserId(UUID userId) {
        try {
            return notificationDAO.findByRecipientUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);
        } catch (Exception e) {
            System.err.println("Error retrieving unread notifications for user " + userId + ": " + e.getMessage());
            throw new RuntimeException("Failed to retrieve unread notifications", e);
        }
    }
    
    @Override
    public long getUnreadCount(UUID userId) {
        try {
            return notificationDAO.countByRecipientUserIdAndIsReadFalse(userId);
        } catch (Exception e) {
            System.err.println("Error counting unread notifications for user " + userId + ": " + e.getMessage());
            throw new RuntimeException("Failed to count unread notifications", e);
        }
    }
    
    @Override
    public Optional<Notification> getNotificationById(Long id) {
        try {
            return notificationDAO.findById(id);
        } catch (Exception e) {
            System.err.println("Error retrieving notification " + id + ": " + e.getMessage());
            throw new RuntimeException("Failed to retrieve notification", e);
        }
    }
    
    @Override
    public boolean markAsRead(Long id) {
        try {
            Optional<Notification> notificationOpt = notificationDAO.findById(id);
            if (notificationOpt.isPresent()) {
                Notification notification = notificationOpt.get();
                notification.setIsRead(true);
                notificationDAO.save(notification);
                return true;
            }
            return false;
        } catch (Exception e) {
            System.err.println("Error marking notification " + id + " as read: " + e.getMessage());
            throw new RuntimeException("Failed to mark notification as read", e);
        }
    }
    
    @Override
    public boolean deleteNotification(Long id) {
        try {
            if (notificationDAO.existsById(id)) {
                notificationDAO.deleteById(id);
                return true;
            }
            return false;
        } catch (Exception e) {
            System.err.println("Error deleting notification " + id + ": " + e.getMessage());
            throw new RuntimeException("Failed to delete notification", e);
        }
    }
    
    @Override
    public Notification createNotification(NotificationType type, String title, String message,
                                         UUID recipientUserId, UUID actorUserId, String actorUserName,
                                         String actorUserAvatar, UUID projectId, String projectName,
                                         UUID taskId, UUID sprintId, Long commentId, String actionUrl) {
        try {
            System.out.println("🔍 SERVICE: Creating notification with params:");
            System.out.println("  - type: " + type);
            System.out.println("  - recipientUserId: " + recipientUserId);
            System.out.println("  - actorUserId: " + actorUserId);
            System.out.println("  - projectId: " + projectId);
            System.out.println("  - taskId: " + taskId);
            System.out.println("  - actionUrl: " + actionUrl);
            
            Notification notification = new Notification.Builder()
                    .type(type)
                    .title(title)
                    .message(message)
                    .recipientUserId(recipientUserId)
                    .actorUserId(actorUserId)
                    .actorUserName(actorUserName)
                    .actorUserAvatar(actorUserAvatar)
                    .projectId(projectId)
                    .projectName(projectName)
                    .taskId(taskId)
                    .sprintId(sprintId)
                    .commentId(commentId)
                    .actionUrl(actionUrl)
                    .isRead(false)
                    .createdAt(LocalDateTime.now())
                    .build();
                    
            Notification saved = notificationDAO.save(notification);
            System.out.println("🔍 SERVICE: Notification saved with ID: " + saved.getId());
            return saved;
        } catch (Exception e) {
            System.err.println("Error creating notification: " + e.getMessage());
            throw new RuntimeException("Failed to create notification: " + e.getMessage(), e);
        }
    }
    
    @Override
    public boolean hasTaskOverdueNotification(UUID taskId, UUID recipientUserId) {
        try {
            System.out.println("🔍 SERVICE: Checking for existing TASK_OVERDUE notification:");
            System.out.println("  - taskId: " + taskId);
            System.out.println("  - recipientUserId: " + recipientUserId);
            
            boolean exists = notificationDAO.hasTaskOverdueNotification(taskId, recipientUserId);
            System.out.println("🔍 SERVICE: Duplicate check result: " + exists);
            return exists;
        } catch (Exception e) {
            System.err.println("Error checking for duplicate TASK_OVERDUE notification: " + e.getMessage());
            // Return false on error to avoid blocking new notifications
            return false;
        }
    }
    
    @Override
    public void removeTaskOverdueNotifications(UUID taskId) {
        try {
            System.out.println("🔍 SERVICE: Removing TASK_OVERDUE notifications for taskId: " + taskId);
            notificationDAO.removeTaskOverdueNotifications(taskId);
            System.out.println("✅ SERVICE: TASK_OVERDUE notifications removed for taskId: " + taskId);
        } catch (Exception e) {
            System.err.println("Error removing TASK_OVERDUE notifications: " + e.getMessage());
            // Don't throw exception as this is cleanup operation
        }
    }
    
    @Override
    public boolean hasSprintOverdueNotification(UUID sprintId, UUID recipientUserId) {
        try {
            System.out.println("🔍 SERVICE: Checking for existing SPRINT_OVERDUE notification:");
            System.out.println("  - sprintId: " + sprintId);
            System.out.println("  - recipientUserId: " + recipientUserId);
            
            boolean exists = notificationDAO.hasSprintOverdueNotification(sprintId, recipientUserId);
            System.out.println("🔍 SERVICE: Duplicate check result: " + exists);
            return exists;
        } catch (Exception e) {
            System.err.println("Error checking for duplicate SPRINT_OVERDUE notification: " + e.getMessage());
            // Return false on error to avoid blocking new notifications
            return false;
        }
    }
    
    @Override
    public void removeSprintOverdueNotifications(UUID sprintId) {
        try {
            System.out.println("🔍 SERVICE: Removing SPRINT_OVERDUE notifications for sprintId: " + sprintId);
            notificationDAO.removeSprintOverdueNotifications(sprintId);
            System.out.println("✅ SERVICE: SPRINT_OVERDUE notifications removed for sprintId: " + sprintId);
        } catch (Exception e) {
            System.err.println("Error removing SPRINT_OVERDUE notifications: " + e.getMessage());
            // Don't throw exception as this is cleanup operation
        }
    }
} 