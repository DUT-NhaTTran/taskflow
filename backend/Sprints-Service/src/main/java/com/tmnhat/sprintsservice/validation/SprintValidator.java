package com.tmnhat.sprintsservice.validation;
import com.tmnhat.common.exception.BadRequestException;
import com.tmnhat.sprintsservice.model.Sprints;

import java.util.UUID;

public class SprintValidator {

    public static void validateSprint(Sprints sprint) {
        if (sprint == null) {
            throw new BadRequestException("Sprint data is required");
        }
        if (sprint.getName() == null || sprint.getName().trim().isEmpty()) {
            throw new BadRequestException("Sprint name cannot be empty");
        }
        if (sprint.getProjectId() == null) {
            throw new BadRequestException("Project ID is required");
        }
        if (sprint.getStartDate() == null || sprint.getEndDate() == null) {
            throw new BadRequestException("Start date and End date are required");
        }
    }

    public static void validateSprintId(UUID id) {
        if (id == null) {
            throw new BadRequestException("Sprint ID is required");
        }
    }
}
