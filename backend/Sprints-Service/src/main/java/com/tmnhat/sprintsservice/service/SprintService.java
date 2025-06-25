package com.tmnhat.sprintsservice.service;


import com.tmnhat.sprintsservice.model.Sprints;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface SprintService {
    void addSprint(Sprints sprint);
    void updateSprint(UUID id, Sprints sprint);
    void deleteSprint(UUID id);
    Sprints getSprintById(UUID id);
    List<Sprints> getAllSprints();
    Sprints getLastSprintOfProject(UUID projectId);
    List<Sprints> getAllSprintsByProject(UUID projectId);
    void startSprint(UUID sprintId);
    void completeSprint(UUID sprintId);
    void archiveSprint(UUID sprintId);
    List<Sprints> getSprintsByProject(UUID projectId);
    Sprints getActiveSprint(UUID projectId);
    void moveIncompleteTasks(UUID fromSprintId, UUID toSprintId);

    void cancelSprint(UUID sprintId);
    void softDeleteSprint(UUID sprintId);
    List<Sprints> getDeletedSprintsByProject(UUID projectId);
    List<Sprints> getCancelledSprintsByProject(UUID projectId);
    void restoreSprint(UUID sprintId);
    
    List<Map<String, Object>> getIncompleteTasksFromSprint(UUID sprintId);
    void moveTasksToBacklog(UUID sprintId);
    void moveTasksToSprint(UUID fromSprintId, UUID toSprintId);
    
    void moveSpecificTasksToBacklog(List<UUID> taskIds);
    void moveSpecificTasksToSprint(List<UUID> taskIds, UUID toSprintId);

    List<Sprints> getFilteredSprintsForCalendar(UUID projectId, String search, 
                                               List<String> assigneeIds, List<String> statuses, 
                                               String startDate, String endDate);
    List<Map<String, Object>> getSprintAssignees(UUID projectId);
    List<String> getSprintStatuses(UUID projectId);
}

