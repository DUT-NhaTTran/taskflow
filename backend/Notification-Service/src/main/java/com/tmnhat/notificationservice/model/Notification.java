package com.tmnhat.notificationservice.model;

import com.tmnhat.notificationservice.payload.enums.NotificationType;
import java.time.LocalDateTime;
import java.util.UUID;

public class Notification {
    
    private Long id;
    private NotificationType type;
    private String title;
    private String message;
    private UUID recipientUserId;
    private UUID actorUserId;
    private String actorUserName;
    private String actorUserAvatar;
    private UUID projectId;
    private String projectName;
    private UUID taskId;
    private UUID sprintId;
    private Long commentId;
    private String actionUrl;
    private Boolean isRead = false;
    private LocalDateTime createdAt;
    private LocalDateTime readAt;

    public Notification() {
    }

    private Notification(Builder builder) {
        this.id = builder.id;
        this.type = builder.type;
        this.title = builder.title;
        this.message = builder.message;
        this.recipientUserId = builder.recipientUserId;
        this.actorUserId = builder.actorUserId;
        this.actorUserName = builder.actorUserName;
        this.actorUserAvatar = builder.actorUserAvatar;
        this.projectId = builder.projectId;
        this.projectName = builder.projectName;
        this.taskId = builder.taskId;
        this.sprintId = builder.sprintId;
        this.commentId = builder.commentId;
        this.actionUrl = builder.actionUrl;
        this.isRead = builder.isRead;
        this.createdAt = builder.createdAt;
        this.readAt = builder.readAt;
    }

    // Helper method to set creation time if not set
    public void setCreationTime() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
    
    // Helper method to mark as read
    public void markAsRead() {
        this.isRead = true;
        this.readAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public NotificationType getType() {
        return type;
    }

    public void setType(NotificationType type) {
        this.type = type;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public UUID getRecipientUserId() {
        return recipientUserId;
    }

    public void setRecipientUserId(UUID recipientUserId) {
        this.recipientUserId = recipientUserId;
    }

    public UUID getActorUserId() {
        return actorUserId;
    }

    public void setActorUserId(UUID actorUserId) {
        this.actorUserId = actorUserId;
    }

    public String getActorUserName() {
        return actorUserName;
    }

    public void setActorUserName(String actorUserName) {
        this.actorUserName = actorUserName;
    }

    public String getActorUserAvatar() {
        return actorUserAvatar;
    }

    public void setActorUserAvatar(String actorUserAvatar) {
        this.actorUserAvatar = actorUserAvatar;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public void setProjectId(UUID projectId) {
        this.projectId = projectId;
    }

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }

    public UUID getTaskId() {
        return taskId;
    }

    public void setTaskId(UUID taskId) {
        this.taskId = taskId;
    }

    public UUID getSprintId() {
        return sprintId;
    }

    public void setSprintId(UUID sprintId) {
        this.sprintId = sprintId;
    }

    public Long getCommentId() {
        return commentId;
    }

    public void setCommentId(Long commentId) {
        this.commentId = commentId;
    }

    public String getActionUrl() {
        return actionUrl;
    }

    public void setActionUrl(String actionUrl) {
        this.actionUrl = actionUrl;
    }

    public Boolean getIsRead() {
        return isRead;
    }

    public void setIsRead(Boolean isRead) {
        this.isRead = isRead;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getReadAt() {
        return readAt;
    }

    public void setReadAt(LocalDateTime readAt) {
        this.readAt = readAt;
    }

    @Override
    public String toString() {
        return "Notification{" +
                "id=" + id +
                ", type=" + type +
                ", title='" + title + '\'' +
                ", message='" + message + '\'' +
                ", recipientUserId=" + recipientUserId +
                ", actorUserId=" + actorUserId +
                ", actorUserName='" + actorUserName + '\'' +
                ", projectId='" + projectId + '\'' +
                ", taskId=" + taskId +
                ", sprintId=" + sprintId +
                ", commentId=" + commentId +
                ", isRead=" + isRead +
                ", createdAt=" + createdAt +
                '}';
    }

    // Builder pattern
    public static class Builder {
        private Long id;
        private NotificationType type;
        private String title;
        private String message;
        private UUID recipientUserId;
        private UUID actorUserId;
        private String actorUserName;
        private String actorUserAvatar;
        private UUID projectId;
        private String projectName;
        private UUID taskId;
        private UUID sprintId;
        private Long commentId;
        private String actionUrl;
        private Boolean isRead = false;
        private LocalDateTime createdAt;
        private LocalDateTime readAt;

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder type(NotificationType type) {
            this.type = type;
            return this;
        }

        public Builder title(String title) {
            this.title = title;
            return this;
        }

        public Builder message(String message) {
            this.message = message;
            return this;
        }

        public Builder recipientUserId(UUID recipientUserId) {
            this.recipientUserId = recipientUserId;
            return this;
        }

        public Builder actorUserId(UUID actorUserId) {
            this.actorUserId = actorUserId;
            return this;
        }

        public Builder actorUserName(String actorUserName) {
            this.actorUserName = actorUserName;
            return this;
        }

        public Builder actorUserAvatar(String actorUserAvatar) {
            this.actorUserAvatar = actorUserAvatar;
            return this;
        }

        public Builder projectId(UUID projectId) {
            this.projectId = projectId;
            return this;
        }

        public Builder projectName(String projectName) {
            this.projectName = projectName;
            return this;
        }

        public Builder taskId(UUID taskId) {
            this.taskId = taskId;
            return this;
        }

        public Builder sprintId(UUID sprintId) {
            this.sprintId = sprintId;
            return this;
        }

        public Builder commentId(Long commentId) {
            this.commentId = commentId;
            return this;
        }

        public Builder actionUrl(String actionUrl) {
            this.actionUrl = actionUrl;
            return this;
        }

        public Builder isRead(Boolean isRead) {
            this.isRead = isRead;
            return this;
        }

        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public Builder readAt(LocalDateTime readAt) {
            this.readAt = readAt;
            return this;
        }

        public Notification build() {
            return new Notification(this);
        }
    }
} 