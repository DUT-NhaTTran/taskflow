package com.tmnhat.tasksservice.service;


import com.tmnhat.tasksservice.model.Tasks;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface TaskService {
    void addTask(Tasks task);
    void updateTask(UUID id, Tasks task);
    void updateTask(UUID id, Tasks task, String actorUserId);
    void deleteTask(UUID id);
    Tasks getTaskById(UUID id);
    List<Tasks> getAllTasks();
    void assignTask(UUID taskId, UUID userId);
    void changeTaskStatus(UUID taskId, String status);
    void changeTaskStatus(UUID taskId, String status, String actorUserId);
    void updateStoryPoint(UUID taskId, int storyPoint);
    void addSubtask(UUID parentTaskId, Tasks subtask);
    void linkTasks(UUID taskId, UUID relatedTaskId);
    List<Tasks> filterTasks(String status, UUID assigneeId);
    List<Tasks> searchTasks(String keyword) ;
    List<Tasks> paginateTasks(int page, int size);
    void commentOnTask(UUID taskId, String comment);
    void attachFileToTask(UUID taskId, MultipartFile file);
    List<Tasks> getTasksBySprintId(UUID sprintId);
    List<Tasks> getTasksByProjectId(UUID projectId);
    List<Tasks> getTasksByProjectIdSorted(UUID projectId, String sortBy, String sortOrder);
    List<Tasks> getTasksByStatusAndProjectAndSprint(String status, UUID projectId, UUID sprintId);

    //Members
    void addMemberToTask(UUID taskId, UUID userId);
    void removeMemberFromTask(UUID taskId, UUID userId);
    List<UUID> getTaskMembers(UUID taskId);

    // Activity
    List<Object> getProjectActivity(UUID projectId);

    // Calendar Filter Methods
    List<Tasks> getFilteredTasksForCalendar(UUID projectId, String search, 
                                           List<String> assigneeIds, List<String> types, 
                                           List<String> statuses, String startDate, 
                                           String endDate, String sprintId);
    List<Map<String, Object>> getTaskAssignees(UUID projectId);
    List<String> getTaskTypes(UUID projectId);
    List<String> getTaskStatuses(UUID projectId);

    // AI Story Point Estimation Methods
    Object estimateStoryPoints(UUID taskId);
    Object trainAIModel();
    Object bulkEstimateStoryPoints(UUID projectId);

    // Overdue Tasks Methods
    List<Tasks> getOverdueTasks(UUID projectId);
    List<Tasks> getAllOverdueTasks();
    
    // Calendar Status Method
    List<String> getTaskStatusesForCalendar(UUID projectId);

    // Task restore methods
    void restoreTask(UUID taskId);
    void restoreTasksByProject(UUID projectId);
    List<Tasks> getDeletedTasksByProject(UUID projectId);
    Tasks getTaskByIdIncludeDeleted(UUID taskId);
}