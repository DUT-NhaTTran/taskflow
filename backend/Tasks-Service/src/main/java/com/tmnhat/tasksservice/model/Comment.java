package com.tmnhat.tasksservice.model;

import java.time.LocalDateTime;
import java.util.UUID;

public class Comment {
    
    private Long id;
    private UUID taskId;
    private String userId;
    private String content;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long parentCommentId;
    private Boolean isDeleted;

    public Comment() {
    }

    private Comment(Builder builder) {
        this.id = builder.id;
        this.taskId = builder.taskId;
        this.userId = builder.userId;
        this.content = builder.content;
        this.createdAt = builder.createdAt;
        this.updatedAt = builder.updatedAt;
        this.parentCommentId = builder.parentCommentId;
        this.isDeleted = builder.isDeleted;
    }

    public static Builder builder() {
        return new Builder();
    }

    // Getters
    public Long getId() {
        return id;
    }

    public UUID getTaskId() {
        return taskId;
    }

    public String getUserId() {
        return userId;
    }

    public String getContent() {
        return content;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public Long getParentCommentId() {
        return parentCommentId;
    }

    public Boolean getIsDeleted() {
        return isDeleted;
    }

    // Setters
    public void setId(Long id) {
        this.id = id;
    }

    public void setTaskId(UUID taskId) {
        this.taskId = taskId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public void setParentCommentId(Long parentCommentId) {
        this.parentCommentId = parentCommentId;
    }

    public void setIsDeleted(Boolean isDeleted) {
        this.isDeleted = isDeleted;
    }

    @Override
    public String toString() {
        return "Comment{" +
                "id=" + id +
                ", taskId=" + taskId +
                ", userId='" + userId + '\'' +
                ", content='" + content + '\'' +
                ", createdAt=" + createdAt +
                ", updatedAt=" + updatedAt +
                ", parentCommentId=" + parentCommentId +
                ", isDeleted=" + isDeleted +
                '}';
    }

    // Builder
    public static class Builder {
        private Long id;
        private UUID taskId;
        private String userId;
        private String content;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private Long parentCommentId;
        private Boolean isDeleted;

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder taskId(UUID taskId) {
            this.taskId = taskId;
            return this;
        }

        public Builder userId(String userId) {
            this.userId = userId;
            return this;
        }

        public Builder content(String content) {
            this.content = content;
            return this;
        }

        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        public Builder parentCommentId(Long parentCommentId) {
            this.parentCommentId = parentCommentId;
            return this;
        }

        public Builder isDeleted(Boolean isDeleted) {
            this.isDeleted = isDeleted;
            return this;
        }

        public Comment build() {
            return new Comment(this);
        }
    }
} 