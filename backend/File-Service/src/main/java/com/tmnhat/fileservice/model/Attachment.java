package com.tmnhat.fileservice.model;

import java.time.LocalDateTime;
import java.util.UUID;

public class Attachment {
    private Long id;
    private UUID taskId;
    private String fileName;
    private String fileUrl;
    private String fileType;
    private LocalDateTime uploadedAt;

    public Attachment() {
    }

    private Attachment(Builder builder) {
        this.id = builder.id;
        this.taskId = builder.taskId;
        this.fileName = builder.fileName;
        this.fileUrl = builder.fileUrl;
        this.fileType = builder.fileType;
        this.uploadedAt = builder.uploadedAt;
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

    public String getFileName() {
        return fileName;
    }

    public String getFileUrl() {
        return fileUrl;
    }

    public String getFileType() {
        return fileType;
    }

    public LocalDateTime getUploadedAt() {
        return uploadedAt;
    }

    // Setters
    public void setId(Long id) {
        this.id = id;
    }

    public void setTaskId(UUID taskId) {
        this.taskId = taskId;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public void setFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }

    public void setFileType(String fileType) {
        this.fileType = fileType;
    }

    public void setUploadedAt(LocalDateTime uploadedAt) {
        this.uploadedAt = uploadedAt;
    }

    // Builder
    public static class Builder {
        private Long id;
        private UUID taskId;
        private String fileName;
        private String fileUrl;
        private String fileType;
        private LocalDateTime uploadedAt;

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder taskId(UUID taskId) {
            this.taskId = taskId;
            return this;
        }

        public Builder fileName(String fileName) {
            this.fileName = fileName;
            return this;
        }

        public Builder fileUrl(String fileUrl) {
            this.fileUrl = fileUrl;
            return this;
        }

        public Builder fileType(String fileType) {
            this.fileType = fileType;
            return this;
        }

        public Builder uploadedAt(LocalDateTime uploadedAt) {
            this.uploadedAt = uploadedAt;
            return this;
        }

        public Attachment build() {
            return new Attachment(this);
        }
    }
} 