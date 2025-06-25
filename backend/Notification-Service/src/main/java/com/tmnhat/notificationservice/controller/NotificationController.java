package com.tmnhat.notificationservice.controller;

import com.tmnhat.notificationservice.model.Notification;
import com.tmnhat.notificationservice.payload.enums.NotificationType;
import com.tmnhat.notificationservice.service.NotificationService;
import com.tmnhat.notificationservice.payload.ResponseDataAPI;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletResponse;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    
    @Autowired
    private NotificationService notificationService;
    
    // Get all notifications for a user
    @GetMapping("/user/{userId}")
    public ResponseEntity<ResponseDataAPI> getUserNotifications(
            @PathVariable String userId,
            HttpServletResponse response) {
        
        // Disable caching
        response.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
        response.setHeader("Pragma", "no-cache");
        response.setHeader("Expires", "0");
        
        try {
            UUID userUuid = UUID.fromString(userId);
            List<Notification> notifications = notificationService.getNotificationsByUserId(userUuid);
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(notifications));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Invalid UUID format for userId: " + userId));
        }
    }
    
    // Get unread notifications for a user
    @GetMapping("/user/{userId}/unread")
    public ResponseEntity<ResponseDataAPI> getUnreadNotifications(@PathVariable String userId) {
        try {
            UUID userUuid = UUID.fromString(userId);
            List<Notification> notifications = notificationService.getUnreadNotificationsByUserId(userUuid);
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(notifications));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Invalid UUID format for userId: " + userId));
        }
    }
    
    // Get unread count for a user
    @GetMapping("/user/{userId}/unread/count")
    public ResponseEntity<ResponseDataAPI> getUnreadCount(@PathVariable String userId) {
        try {
            UUID userUuid = UUID.fromString(userId);
            long count = notificationService.getUnreadCount(userUuid);
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(count));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Invalid UUID format for userId: " + userId));
        }
    }
    
    // Get notification by ID
    @GetMapping("/{notificationId}")
    public ResponseEntity<ResponseDataAPI> getNotificationById(@PathVariable Long notificationId) {
        Optional<Notification> notification = notificationService.getNotificationById(notificationId);
        
        if (notification.isPresent()) {
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(notification.get()));
        } else {
            return ResponseEntity.notFound().build();
        }
    }
    
    // Mark notification as read
    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<ResponseDataAPI> markAsRead(@PathVariable Long notificationId) {
        boolean success = notificationService.markAsRead(notificationId);
        if (success) {
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta("Notification marked as read successfully"));
        } else {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Notification not found or already read"));
        }
    }
    
    // Delete notification
    @DeleteMapping("/{notificationId}")
    public ResponseEntity<ResponseDataAPI> deleteNotification(@PathVariable Long notificationId) {
        boolean success = notificationService.deleteNotification(notificationId);
        if (success) {
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta("Notification deleted successfully"));
        } else {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Notification not found"));
        }
    }
    
    // Health check endpoint
    @GetMapping("/health")
    public ResponseEntity<ResponseDataAPI> health() {
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta("Notification service is running"));
    }
    
    // Create notification endpoint
    @PostMapping("/create")
    public ResponseEntity<ResponseDataAPI> createNotification(@RequestBody Map<String, Object> request) {
        try {
            System.out.println("🔍 CONTROLLER: Raw payload received:");
            System.out.println("  " + request.toString());
            
            // Extract ONLY fields from standard payload format
            String typeStr = (String) request.get("type");
            String title = (String) request.get("title");
            String message = (String) request.get("message");
            String recipientUserIdStr = (String) request.get("recipientUserId");
            String actorUserIdStr = (String) request.get("actorUserId");
            String actorUserName = (String) request.get("actorUserName");
            String projectIdStr = (String) request.get("projectId");
            String projectName = (String) request.get("projectName");
            String taskIdStr = (String) request.get("taskId");


            // Parse notification type
            NotificationType type = null;
            if (typeStr != null) {
                try {
                    type = NotificationType.valueOf(typeStr.toUpperCase());
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest()
                        .body(ResponseDataAPI.error("Invalid notification type: " + typeStr));
                }
            }

            // Convert String IDs to UUID
            UUID recipientUserId = null;
            UUID actorUserId = null;
            UUID projectId = null;
            UUID taskId = null;
            
            if (recipientUserIdStr != null) {
                try {
                    recipientUserId = UUID.fromString(recipientUserIdStr);
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest().body(ResponseDataAPI.error("Invalid UUID format for recipientUserId: " + recipientUserIdStr));
                }
            }
            
            if (actorUserIdStr != null) {
                try {
                    actorUserId = UUID.fromString(actorUserIdStr);
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest().body(ResponseDataAPI.error("Invalid UUID format for actorUserId: " + actorUserIdStr));
                }
            }
            
            if (projectIdStr != null) {
                try {
                    projectId = UUID.fromString(projectIdStr);
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest().body(ResponseDataAPI.error("Invalid UUID format for projectId: " + projectIdStr));
                }
            }
            
            if (taskIdStr != null) {
                try {
                    taskId = UUID.fromString(taskIdStr);
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest().body(ResponseDataAPI.error("Invalid UUID format for taskId: " + taskIdStr));
                }
            }
            
            // Generate action URL only if project exists and it's not a PROJECT_DELETED notification
            String actionUrl = null;
            if (projectId != null && type != NotificationType.PROJECT_DELETED) {
                if (taskId != null) {
                    actionUrl = String.format("/project/project_homescreen?projectId=%s&taskId=%s&from=notification", projectId, taskId);
                } else {
                    actionUrl = String.format("/project/project_homescreen?projectId=%s&from=notification", projectId);
                }
                System.out.println("🔍 CONTROLLER: Generated actionUrl: " + actionUrl);
            } else {
                System.out.println("🔍 CONTROLLER: No actionUrl generated - projectId: " + projectId + ", type: " + type);
            }
            

            
            // Validate required fields
            if (type == null || recipientUserId == null || actorUserId == null) {
                return ResponseEntity.badRequest()
                    .body(ResponseDataAPI.error("Missing required fields: type, recipientUserId, or actorUserId"));
            }
            
            // ✅ DUPLICATE CHECK: Prevent duplicate TASK_OVERDUE notifications
            if (type == NotificationType.TASK_OVERDUE && taskId != null) {
                // Check if we already have a TASK_OVERDUE notification for this task and user
                boolean duplicateExists = notificationService.hasTaskOverdueNotification(taskId, recipientUserId);
                if (duplicateExists) {
                    System.out.println("🔍 CONTROLLER: Duplicate TASK_OVERDUE prevented for taskId: " + taskId + ", recipientUserId: " + recipientUserId);
                    return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta("Duplicate TASK_OVERDUE notification prevented"));
                }
            }
            
            // ✅ DUPLICATE CHECK: Prevent duplicate SPRINT_OVERDUE notifications
            String sprintIdStr = (String) request.get("sprintId");
            UUID sprintId = null;
            if (sprintIdStr != null) {
                try {
                    sprintId = UUID.fromString(sprintIdStr);
                } catch (IllegalArgumentException e) {
                    return ResponseEntity.badRequest().body(ResponseDataAPI.error("Invalid UUID format for sprintId: " + sprintIdStr));
                }
            }
            
            if (type == NotificationType.SPRINT_OVERDUE && sprintId != null) {
                // Check if we already have a SPRINT_OVERDUE notification for this sprint and user
                boolean duplicateExists = notificationService.hasSprintOverdueNotification(sprintId, recipientUserId);
                if (duplicateExists) {
                    System.out.println("🔍 CONTROLLER: Duplicate SPRINT_OVERDUE prevented for sprintId: " + sprintId + ", recipientUserId: " + recipientUserId);
                    return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta("Duplicate SPRINT_OVERDUE notification prevented"));
                }
            }
            
            // Create notification with ONLY standard fields (no optional nulls)
            Notification notification = notificationService.createNotification(
                type, title, message, recipientUserId, actorUserId, actorUserName,
                null, // actorUserAvatar - not in standard payload
                projectId, projectName, taskId, 
                sprintId, // sprintId - from standard payload
                null, // commentId - not in standard payload
                actionUrl
            );
            
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(notification));
            
        } catch (IllegalArgumentException e) {
            System.err.println("Invalid notification type: " + e.getMessage());
            return ResponseEntity.badRequest()
                .body(ResponseDataAPI.error("Invalid notification type: " + e.getMessage()));
        } catch (Exception e) {
            System.err.println("Error creating notification: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.badRequest()
                .body(ResponseDataAPI.error("Failed to create notification: " + e.getMessage()));
        }
    }
    
    // Clean up TASK_OVERDUE notifications for a completed task
    @DeleteMapping("/task/{taskId}/overdue")
    public ResponseEntity<ResponseDataAPI> cleanupTaskOverdueNotifications(@PathVariable String taskId) {
        try {
            UUID taskUUID = UUID.fromString(taskId);
            notificationService.removeTaskOverdueNotifications(taskUUID);
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta("TASK_OVERDUE notifications cleaned up successfully"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Invalid UUID format for taskId: " + taskId));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ResponseDataAPI.error("Failed to cleanup notifications: " + e.getMessage()));
        }
    }
    
    // Clean up SPRINT_OVERDUE notifications for a completed sprint
    @DeleteMapping("/sprint/{sprintId}/overdue")
    public ResponseEntity<ResponseDataAPI> cleanupSprintOverdueNotifications(@PathVariable String sprintId) {
        try {
            UUID sprintUUID = UUID.fromString(sprintId);
            notificationService.removeSprintOverdueNotifications(sprintUUID);
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta("SPRINT_OVERDUE notifications cleaned up successfully"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Invalid UUID format for sprintId: " + sprintId));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ResponseDataAPI.error("Failed to cleanup notifications: " + e.getMessage()));
        }
    }
} 