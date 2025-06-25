package com.tmnhat.tasksservice.model;

import com.tmnhat.tasksservice.payload.enums.TaskStatus;
import com.tmnhat.tasksservice.payload.enums.TaskTag;
import com.tmnhat.tasksservice.payload.enums.TaskPriority;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class Tasks {

    private UUID id;
    private UUID sprintId;
    private UUID projectId;
    private String title;
    private String description;
    private TaskStatus status;      
    private int storyPoint;
    private UUID assigneeId;
    private UUID createdBy;         
    private LocalDate dueDate;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
    private UUID parentTaskId;
    private List<TaskTag> tags;
    private String label;
    private TaskPriority priority;  
    private LocalDateTime deletedAt;

    public Tasks() {
    }

    private Tasks(Builder builder) {
        this.id = builder.id;
        this.sprintId = builder.sprintId;
        this.projectId = builder.projectId;
        this.title = builder.title;
        this.description = builder.description;
        this.status = builder.status;
        this.storyPoint = builder.storyPoint;
        this.assigneeId = builder.assigneeId;
        this.createdBy = builder.createdBy;
        this.dueDate = builder.dueDate;
        this.createdAt = builder.createdAt;
        this.completedAt = builder.completedAt;
        this.parentTaskId = builder.parentTaskId;
        this.tags = builder.tags;
        this.label = builder.label;
        this.priority = builder.priority;
        this.deletedAt = builder.deletedAt;
    }

    //Getters & Setters

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getSprintId() {
        return sprintId;
    }

    public void setSprintId(UUID sprintId) {
        this.sprintId = sprintId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public void setProjectId(UUID projectId) {
        this.projectId = projectId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public TaskStatus getStatus() {
        return status;
    }

    public void setStatus(TaskStatus status) {
        this.status = status;
    }

    public int getStoryPoint() {
        return storyPoint;
    }

    public void setStoryPoint(int storyPoint) {
        this.storyPoint = storyPoint;
    }

    public UUID getAssigneeId() {
        return assigneeId;
    }

    public void setAssigneeId(UUID assigneeId) {
        this.assigneeId = assigneeId;
    }



    public UUID getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(UUID createdBy) {
        this.createdBy = createdBy;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }

    public UUID getParentTaskId() {
        return parentTaskId;
    }

    public void setParentTaskId(UUID parentTaskId) {
        this.parentTaskId = parentTaskId;
    }

    public List<TaskTag> getTags() {
        return tags;
    }

    public void setTags(List<TaskTag> tags) {
        this.tags = tags;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public TaskPriority getPriority() {
        return priority;
    }

    public void setPriority(TaskPriority priority) {
        this.priority = priority;
    }

    public LocalDateTime getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(LocalDateTime deletedAt) {
        this.deletedAt = deletedAt;
    }

    // Builder class

    public static class Builder {
        private UUID id;
        private UUID sprintId;
        private UUID projectId;
        private String title;
        private String description;
        private TaskStatus status;
        private int storyPoint;
        private UUID assigneeId;
        private UUID createdBy;
        private LocalDate dueDate;
        private LocalDateTime createdAt;
        private LocalDateTime completedAt;
        private UUID parentTaskId;
        private List<TaskTag> tags;
        private String label;
        private TaskPriority priority;
        private LocalDateTime deletedAt;

        public Builder() {}

        public Builder id(UUID id) {
            this.id = id;
            return this;
        }

        public Builder sprintId(UUID sprintId) {
            this.sprintId = sprintId;
            return this;
        }

        public Builder projectId(UUID projectId) {
            this.projectId = projectId;
            return this;
        }

        public Builder title(String title) {
            this.title = title;
            return this;
        }

        public Builder description(String description) {
            this.description = description;
            return this;
        }

        public Builder status(TaskStatus status) {
            this.status = status;
            return this;
        }

        public Builder storyPoint(int storyPoint) {
            this.storyPoint = storyPoint;
            return this;
        }

        public Builder assigneeId(UUID assigneeId) {
            this.assigneeId = assigneeId;
            return this;
        }



        public Builder createdBy(UUID createdBy) {
            this.createdBy = createdBy;
            return this;
        }

        public Builder dueDate(LocalDate dueDate) {
            this.dueDate = dueDate;
            return this;
        }

        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public Builder completedAt(LocalDateTime completedAt) {
            this.completedAt = completedAt;
            return this;
        }

        public Builder parentTaskId(UUID parentTaskId) {
            this.parentTaskId = parentTaskId;
            return this;
        }

        public Builder tags(List<TaskTag> tags) {
            this.tags = tags;
            return this;
        }

        public Builder label(String label) {
            this.label = label;
            return this;
        }

        public Builder priority(TaskPriority priority) {
            this.priority = priority;
            return this;
        }

        public Builder deletedAt(LocalDateTime deletedAt) {
            this.deletedAt = deletedAt;
            return this;
        }

        public Tasks build() {
            return new Tasks(this);
        }
    }
}
