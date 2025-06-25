package com.tmnhat.tasksservice.model;
import java.time.LocalDateTime;
import java.util.UUID;

public class TaskMembers {
    private UUID id;
    private UUID taskId;
    private UUID userId;
    private String roleInTask; // Optional: "member", "reviewer", "viewer"
    private LocalDateTime createdAt;

    public TaskMembers() {}

    private TaskMembers(Builder builder) {
        this.id = builder.id;
        this.taskId = builder.taskId;
        this.userId = builder.userId;
        this.roleInTask = builder.roleInTask;
        this.createdAt = builder.createdAt;
    }

    // Getters
    public UUID getId() {
        return id;
    }

    public UUID getTaskId() {
        return taskId;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getRoleInTask() {
        return roleInTask;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    // Setters
    public void setId(UUID id) {
        this.id = id;
    }

    public void setTaskId(UUID taskId) {
        this.taskId = taskId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public void setRoleInTask(String roleInTask) {
        this.roleInTask = roleInTask;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    // Builder
    public static class Builder {
        private UUID id;
        private UUID taskId;
        private UUID userId;
        private String roleInTask;
        private LocalDateTime createdAt;

        public Builder() {}

        public Builder id(UUID id) {
            this.id = id;
            return this;
        }

        public Builder taskId(UUID taskId) {
            this.taskId = taskId;
            return this;
        }

        public Builder userId(UUID userId) {
            this.userId = userId;
            return this;
        }

        public Builder roleInTask(String roleInTask) {
            this.roleInTask = roleInTask;
            return this;
        }

        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public TaskMembers build() {
            return new TaskMembers(this);
        }
    }
}
