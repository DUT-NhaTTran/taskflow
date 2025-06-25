package com.tmnhat.projectsservice.model;

import java.util.UUID;

public class ProjectMembers{

    private UUID id;
    private UUID projectId;
    private UUID userId;
    private String roleInProject;

    public ProjectMembers() {
    }

    private ProjectMembers(Builder builder) {
        this.id = builder.id;
        this.projectId = builder.projectId;
        this.userId = builder.userId;
        this.roleInProject = builder.roleInProject;
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public void setProjectId(UUID projectId) {
        this.projectId = projectId;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getRoleInProject() {
        return roleInProject;
    }

    public void setRoleInProject(String roleInProject) {
        this.roleInProject = roleInProject;
    }

    // Builder
    public static class Builder {
        private UUID id;
        private UUID projectId;
        private UUID userId;
        private String roleInProject;

        public Builder() {}

        public Builder id(UUID id) {
            this.id = id;
            return this;
        }

        public Builder projectId(UUID projectId) {
            this.projectId = projectId;
            return this;
        }

        public Builder userId(UUID userId) {
            this.userId = userId;
            return this;
        }

        public Builder roleInProject(String roleInProject) {
            this.roleInProject = roleInProject;
            return this;
        }

        public ProjectMembers build() {
            return new ProjectMembers(this);
        }
    }
}
