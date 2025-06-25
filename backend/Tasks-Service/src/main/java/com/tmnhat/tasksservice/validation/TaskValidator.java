package com.tmnhat.tasksservice.validation;

import com.tmnhat.tasksservice.model.Tasks;
import com.tmnhat.common.exception.BadRequestException;

import java.util.UUID;

public class TaskValidator {

    public static void validateTask(Tasks task) {
        if (task == null) {
            throw new BadRequestException("Task data is required");
        }
        if (task.getTitle() == null || task.getTitle().trim().isEmpty()) {
            throw new BadRequestException("Task title cannot be empty");
        }
        if (task.getSprintId() == null) {
            throw new BadRequestException("Sprint ID cannot be null");
        }
        if (task.getStatus() == null) {
            throw new BadRequestException("Task status cannot be null");
        }
    }

    public static void validateTaskId(UUID id) {
        if (id == null) {
            throw new BadRequestException("Task ID is required");
        }
    }
    public static void validateUserId(UUID userId) {
        if (userId == null) {
            throw new BadRequestException("User ID cannot be null");
        }
    }
    public static void validateSprintId(UUID sprintId) {
        if (sprintId == null) {
            throw new BadRequestException("Sprint ID cannot be null");
        }
    }

    public static void validateProjectId(UUID projectId) {
        if (projectId == null) {
            throw new BadRequestException("Project ID cannot be null");
        }
    }

}
