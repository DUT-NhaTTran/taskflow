package com.tmnhat.projectsservice.validation;

import com.tmnhat.common.exception.BadRequestException;
import com.tmnhat.projectsservice.model.Projects;

import java.util.UUID;

public class ProjectValidator {

    public static void validateProject(Projects project) {
        if (project.getName() == null || project.getName().trim().isEmpty()) {
            throw new BadRequestException("Project name is required");
        }
        if (project.getOwnerId() == null) {
            throw new BadRequestException("Owner ID is required");
        }
        if (project.getKey() == null || project.getKey().trim().isEmpty()) {
            throw new BadRequestException("Project key is required");
        }
    }

    public static void validateProjectId(UUID projectId) {
        if (projectId == null) {
            throw new BadRequestException("Project ID is required");
        }
    }

    public static void validateUserId(UUID userId) {
        if (userId == null) {
            throw new BadRequestException("User ID is required");
        }
    }
}
