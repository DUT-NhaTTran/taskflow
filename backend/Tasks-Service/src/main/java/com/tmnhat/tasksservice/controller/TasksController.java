package com.tmnhat.tasksservice.controller;

import com.tmnhat.common.config.WebConfig;
import com.tmnhat.common.payload.ResponseDataAPI;
import com.tmnhat.tasksservice.model.Tasks;
import com.tmnhat.tasksservice.service.TaskService;
import com.tmnhat.tasksservice.service.Impl.TaskServiceImpl;
import com.tmnhat.tasksservice.validation.TaskValidator;
import com.tmnhat.tasksservice.utils.PermissionUtil;
import com.tmnhat.tasksservice.utils.PermissionUtil.TaskPermission;
import com.tmnhat.common.exception.BadRequestException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;
@Import(WebConfig.class)

@RestController
@RequestMapping("/api/tasks")
public class TasksController {

    private final TaskService taskService;
    
    @Autowired
    private PermissionUtil permissionUtil;

    public TasksController() {
        this.taskService = new TaskServiceImpl();
    }

    // Add task
    @PostMapping
    public ResponseEntity<ResponseDataAPI> addTask(@RequestBody Tasks task, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        TaskValidator.validateTask(task);
        
        // Permission check: User must be project member and have CREATE_TASK permission
        if (userId != null && !userId.trim().isEmpty() && task.getProjectId() != null) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasTaskPermission(userUUID, task.getProjectId(), PermissionUtil.TaskPermission.CREATE_TASK)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to create task"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        // Set createdBy if provided in header
        if (userId != null && !userId.trim().isEmpty()) {
            try {
                task.setCreatedBy(UUID.fromString(userId));
            } catch (IllegalArgumentException e) {
                // If invalid UUID, log warning but continue
                System.err.println("Invalid user ID in header: " + userId);
            }
        }
        
        taskService.addTask(task);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    // Update task
    @PutMapping("/{id}")
    public ResponseEntity<ResponseDataAPI> updateTask(@PathVariable UUID id, @RequestBody Tasks task, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        TaskValidator.validateTaskId(id);
        TaskValidator.validateTask(task);
        
        // Permission check: User must have UPDATE_ANY_TASK or UPDATE_ASSIGNED_TASK permission
        if (userId != null && !userId.trim().isEmpty() && task.getProjectId() != null) {
            try {
                UUID userUUID = UUID.fromString(userId);
                
                // Get existing task to check assignee and creator
                Tasks existingTask = taskService.getTaskById(id);
                if (existingTask == null) {
                    return ResponseEntity.status(404).body(ResponseDataAPI.error("Task not found"));
                }
                
                // Check if user can update this specific task (creator, assignee, or admin)
                if (!permissionUtil.canUpdateTask(userUUID, task.getProjectId(), existingTask.getAssigneeId(), existingTask.getCreatedBy())) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to update this task. You can only edit tasks you created or are assigned to."));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        // Pass the userId to service layer for notification
        taskService.updateTask(id, task, userId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    // Delete task
    @DeleteMapping("/{id}")
    public ResponseEntity<ResponseDataAPI> deleteTask(@PathVariable UUID id, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        TaskValidator.validateTaskId(id);
        
        // Get existing task to check permissions
        Tasks existingTask = taskService.getTaskById(id);
        if (existingTask == null) {
            return ResponseEntity.status(404).body(ResponseDataAPI.error("Task not found"));
        }
        
        // Permission check: User must be task creator OR have admin DELETE_TASK permission
        if (userId != null && !userId.trim().isEmpty() && existingTask.getProjectId() != null) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.canDeleteTask(userUUID, existingTask.getProjectId(), existingTask.getCreatedBy())) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to delete this task. You can only delete tasks you created or have admin privileges."));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        taskService.deleteTask(id);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    @GetMapping("/get-by-id/{id}")
    public ResponseEntity<ResponseDataAPI> getTaskById(@PathVariable UUID id, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        TaskValidator.validateTaskId(id);
        
        Tasks task = taskService.getTaskById(id);
        if (task == null) {
            return ResponseEntity.status(404).body(ResponseDataAPI.error("Task not found"));
        }
        
        // Permission check: User must have VIEW_TASK permission (all project members)
        if (userId != null && !userId.trim().isEmpty() && task.getProjectId() != null) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasTaskPermission(userUUID, task.getProjectId(), PermissionUtil.TaskPermission.VIEW_TASK)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to view this task"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(task));
    }
    
    @GetMapping("/filter_details")
    public ResponseEntity<ResponseDataAPI> getTasksByStatusProjectSprint(
            @RequestParam String status,
            @RequestParam UUID projectId,
            @RequestParam UUID sprintId,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
            
        // Permission check: User must have VIEW_TASK permission
        if (userId != null && !userId.trim().isEmpty()) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasTaskPermission(userUUID, projectId, PermissionUtil.TaskPermission.VIEW_TASK)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to view tasks"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        List<Tasks> tasks = taskService.getTasksByStatusAndProjectAndSprint(status, projectId, sprintId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(tasks));
    }
    
    // Get all tasks
    @GetMapping
    public ResponseEntity<ResponseDataAPI> getAllTasks() {
        List<Tasks> tasks = taskService.getAllTasks();
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(tasks));
    }

    // Assign task
    @PatchMapping("/{taskId}/assign")
    public ResponseEntity<ResponseDataAPI> assignTask(@PathVariable UUID taskId, @RequestParam UUID userId, @RequestHeader(value = "X-User-Id", required = false) String requesterId) {
        TaskValidator.validateTaskId(taskId);
        TaskValidator.validateUserId(userId);
        
        // Get existing task to check permissions
        Tasks existingTask = taskService.getTaskById(taskId);
        if (existingTask == null) {
            return ResponseEntity.status(404).body(ResponseDataAPI.error("Task not found"));
        }
        
        // Permission check: User must have ASSIGN_TASK permission (admin only)
        if (requesterId != null && !requesterId.trim().isEmpty() && existingTask.getProjectId() != null) {
            try {
                UUID requesterUUID = UUID.fromString(requesterId);
                if (!permissionUtil.hasTaskPermission(requesterUUID, existingTask.getProjectId(), PermissionUtil.TaskPermission.ASSIGN_TASK)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to assign task"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        taskService.assignTask(taskId, userId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    // Change task status
    @PatchMapping("/{taskId}/status")
    public ResponseEntity<ResponseDataAPI> changeTaskStatus(@PathVariable UUID taskId, @RequestParam String status, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        TaskValidator.validateTaskId(taskId);
        if (status == null || status.isBlank()) {
            throw new BadRequestException("Status cannot be empty");
        }
        
        // Get existing task to check permissions
        Tasks existingTask = taskService.getTaskById(taskId);
        if (existingTask == null) {
            return ResponseEntity.status(404).body(ResponseDataAPI.error("Task not found"));
        }
        
        // Permission check: User must be assigned to task OR created the task OR have admin privileges
        if (userId != null && !userId.trim().isEmpty() && existingTask.getProjectId() != null) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.canUpdateTask(userUUID, existingTask.getProjectId(), existingTask.getAssigneeId(), existingTask.getCreatedBy())) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to change task status. You can only update tasks you created or are assigned to."));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        taskService.changeTaskStatus(taskId, status, userId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    // Update story point
    @PatchMapping("/{taskId}/story-point")
    public ResponseEntity<ResponseDataAPI> updateStoryPoint(@PathVariable UUID taskId, @RequestParam int storyPoint, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        TaskValidator.validateTaskId(taskId);
        
        // Get existing task to check permissions
        Tasks existingTask = taskService.getTaskById(taskId);
        if (existingTask == null) {
            return ResponseEntity.status(404).body(ResponseDataAPI.error("Task not found"));
        }
        
        // Permission check: User must have ESTIMATE_TASK permission (all project members)
        if (userId != null && !userId.trim().isEmpty() && existingTask.getProjectId() != null) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasTaskPermission(userUUID, existingTask.getProjectId(), PermissionUtil.TaskPermission.ESTIMATE_TASK)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to estimate task"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        taskService.updateStoryPoint(taskId, storyPoint);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    // Add subtask
    @PostMapping("/{parentTaskId}/subtasks")
    public ResponseEntity<ResponseDataAPI> addSubtask(@PathVariable UUID parentTaskId, @RequestBody Tasks subtask, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        TaskValidator.validateTaskId(parentTaskId);
        TaskValidator.validateTask(subtask);
        
        // Get parent task to check permissions
        Tasks parentTask = taskService.getTaskById(parentTaskId);
        if (parentTask == null) {
            return ResponseEntity.status(404).body(ResponseDataAPI.error("Parent task not found"));
        }
        
        // Permission check: User must have CREATE_TASK permission
        if (userId != null && !userId.trim().isEmpty() && parentTask.getProjectId() != null) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasTaskPermission(userUUID, parentTask.getProjectId(), PermissionUtil.TaskPermission.CREATE_TASK)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to create subtask"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        taskService.addSubtask(parentTaskId, subtask);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    // Link tasks
    @PostMapping("/{taskId}/link/{relatedTaskId}")
    public ResponseEntity<ResponseDataAPI> linkTasks(@PathVariable UUID taskId, @PathVariable UUID relatedTaskId) {
        TaskValidator.validateTaskId(taskId);
        TaskValidator.validateTaskId(relatedTaskId);
        taskService.linkTasks(taskId, relatedTaskId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    // Filter tasks
    @GetMapping("/filter")
    public ResponseEntity<ResponseDataAPI> filterTasks(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID assigneeId) {
        List<Tasks> tasks = taskService.filterTasks(status, assigneeId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(tasks));
    }

    // Search tasks
    @GetMapping("/search")
    public ResponseEntity<ResponseDataAPI> searchTasks(@RequestParam String keyword) {
        if (keyword == null || keyword.isBlank()) {
            throw new BadRequestException("Keyword cannot be empty");
        }
        List<Tasks> tasks = taskService.searchTasks(keyword);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(tasks));
    }

    // Get tasks by sprint ID
    @GetMapping("/sprint/{sprintId}")
    public ResponseEntity<ResponseDataAPI> getTasksBySprint(@PathVariable UUID sprintId) {
        TaskValidator.validateSprintId(sprintId);
        List<Tasks> tasks = taskService.getTasksBySprintId(sprintId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(tasks));
    }

    // Paginate tasks
    @GetMapping("/paginate")
    public ResponseEntity<ResponseDataAPI> paginateTasks(
            @RequestParam int page,
            @RequestParam int size) {
        List<Tasks> tasks = taskService.paginateTasks(page, size);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(tasks));
    }

    // Comment on task
    @PostMapping("/{taskId}/comment")
    public ResponseEntity<ResponseDataAPI> commentOnTask(@PathVariable UUID taskId, @RequestParam String comment) {
        TaskValidator.validateTaskId(taskId);
        if (comment == null || comment.isBlank()) {
            throw new BadRequestException("Comment cannot be empty");
        }
        taskService.commentOnTask(taskId, comment);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    // Attach file to task
    @PostMapping("/{taskId}/attachment")
    public ResponseEntity<ResponseDataAPI> attachFileToTask(
            @PathVariable UUID taskId,
            @RequestParam MultipartFile file) {
        TaskValidator.validateTaskId(taskId);
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File cannot be empty");
        }
        taskService.attachFileToTask(taskId, file);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    // Add member to task
    @PostMapping("/{taskId}/members")
    public ResponseEntity<ResponseDataAPI> addMemberToTask(
            @PathVariable UUID taskId,
            @RequestParam UUID userId) {
        TaskValidator.validateTaskId(taskId);
        TaskValidator.validateUserId(userId);
        taskService.addMemberToTask(taskId, userId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    //  Remove member from task
    @DeleteMapping("/{taskId}/members/{userId}")
    public ResponseEntity<ResponseDataAPI> removeMemberFromTask(
            @PathVariable UUID taskId,
            @PathVariable UUID userId) {
        TaskValidator.validateTaskId(taskId);
        TaskValidator.validateUserId(userId);
        taskService.removeMemberFromTask(taskId, userId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    // Get task members
    @GetMapping("/{taskId}/members")
    public ResponseEntity<ResponseDataAPI> getTaskMembers(@PathVariable UUID taskId) {
        TaskValidator.validateTaskId(taskId);
        List<UUID> members = taskService.getTaskMembers(taskId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(members));
    }
    @GetMapping("/project/{projectId}")
    public List<Tasks> getTasksByProjectId(@PathVariable UUID projectId) {
        return taskService.getTasksByProjectId(projectId);
    }

    // Get tasks by project ID with sorting
    @GetMapping("/project/{projectId}/sorted")
    public ResponseEntity<ResponseDataAPI> getTasksByProjectIdSorted(
            @PathVariable UUID projectId,
            @RequestParam(defaultValue = "updated") String sortBy,
            @RequestParam(defaultValue = "desc") String sortOrder) {
        List<Tasks> tasks = taskService.getTasksByProjectIdSorted(projectId, sortBy, sortOrder);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(tasks));
    }

    // Get project activity (Recent activity for project summary)
    @GetMapping("/project/{projectId}/activity")
    public ResponseEntity<ResponseDataAPI> getProjectActivity(@PathVariable UUID projectId) {
        TaskValidator.validateProjectId(projectId);
        List<Object> activities = taskService.getProjectActivity(projectId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(activities));
    }

    // AI Story Point Estimation
    @PostMapping("/{taskId}/estimate-story-points")
    public ResponseEntity<ResponseDataAPI> estimateStoryPoints(@PathVariable UUID taskId) {
        TaskValidator.validateTaskId(taskId);
        Object estimation = taskService.estimateStoryPoints(taskId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(estimation));
    }

    // Train AI Model
    @PostMapping("/train-ai-model")
    public ResponseEntity<ResponseDataAPI> trainAIModel() {
        Object result = taskService.trainAIModel();
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(result));
    }

    // Bulk AI Estimation for Project
    @PostMapping("/project/{projectId}/bulk-estimate")
    public ResponseEntity<ResponseDataAPI> bulkEstimateProject(@PathVariable UUID projectId) {
        TaskValidator.validateProjectId(projectId);
        Object result = taskService.bulkEstimateStoryPoints(projectId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(result));
    }

    @GetMapping("/project/{projectId}/calendar/filter")
    public ResponseEntity<ResponseDataAPI> getFilteredTasksForCalendar(
        @PathVariable UUID projectId,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) List<String> assigneeIds,
        @RequestParam(required = false) List<String> types,
        @RequestParam(required = false) List<String> statuses,
        @RequestParam(required = false) String startDate,
        @RequestParam(required = false) String endDate,
        @RequestParam(required = false) String sprintId) {
        
        TaskValidator.validateProjectId(projectId);
        
        List<Tasks> filteredTasks = taskService.getFilteredTasksForCalendar(
            projectId, search, assigneeIds, types, statuses, startDate, endDate, sprintId);
        
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(filteredTasks));
    }

    @GetMapping("/project/{projectId}/calendar/assignees")
    public ResponseEntity<ResponseDataAPI> getTaskAssigneesForCalendar(@PathVariable UUID projectId) {
        TaskValidator.validateProjectId(projectId);
        
        List<Map<String, Object>> assignees = taskService.getTaskAssignees(projectId);
        
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(assignees));
    }

    @GetMapping("/project/{projectId}/calendar/types")
    public ResponseEntity<ResponseDataAPI> getTaskTypesForCalendar(@PathVariable UUID projectId) {
        TaskValidator.validateProjectId(projectId);
        
        List<String> types = taskService.getTaskTypes(projectId);
        
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(types));
    }

    @GetMapping("/project/{projectId}/calendar/statuses")
    public ResponseEntity<ResponseDataAPI> getTaskStatusesForCalendar(@PathVariable UUID projectId) {
        try {
            List<String> statuses = taskService.getTaskStatusesForCalendar(projectId);
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(statuses));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error(e.getMessage()));
        }
    }

    // Get overdue tasks for a project
    @GetMapping("/project/{projectId}/overdue")
    public ResponseEntity<ResponseDataAPI> getOverdueTasks(@PathVariable UUID projectId) {
        try {
            TaskValidator.validateProjectId(projectId);
            List<Tasks> overdueTasks = taskService.getOverdueTasks(projectId);
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(overdueTasks));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error(e.getMessage()));
        }
    }

    // Get all overdue tasks (across all projects)
    @GetMapping("/overdue")
    public ResponseEntity<ResponseDataAPI> getAllOverdueTasks() {
        try {
            List<Tasks> overdueTasks = taskService.getAllOverdueTasks();
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(overdueTasks));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error(e.getMessage()));
        }
    }

    @GetMapping("/statuses/{projectId}")
    public ResponseEntity<ResponseDataAPI> getTaskStatuses(@PathVariable UUID projectId) {
        List<String> statuses = taskService.getTaskStatusesForCalendar(projectId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(statuses));
    }
    
    // ✅ NEW: Task restore endpoints
    
    // Restore a single task
    @PutMapping("/{id}/restore")
    public ResponseEntity<ResponseDataAPI> restoreTask(@PathVariable UUID id, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        TaskValidator.validateTaskId(id);
        
        // Get existing task to check permissions
        Tasks existingTask = taskService.getTaskByIdIncludeDeleted(id);
        if (existingTask == null) {
            return ResponseEntity.status(404).body(ResponseDataAPI.error("Task not found"));
        }
        
        // Permission check: User must be task creator OR have admin permissions
        if (userId != null && !userId.trim().isEmpty() && existingTask.getProjectId() != null) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.canDeleteTask(userUUID, existingTask.getProjectId(), existingTask.getCreatedBy())) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to restore this task."));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        taskService.restoreTask(id);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta("Task restored successfully"));
    }
    
    // Restore all tasks for a project (admin only)
    @PutMapping("/project/{projectId}/restore")
    public ResponseEntity<ResponseDataAPI> restoreTasksByProject(@PathVariable UUID projectId, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        if (projectId == null) {
            return ResponseEntity.status(400).body(ResponseDataAPI.error("Project ID is required"));
        }
        
        // Permission check: User must have admin permissions for the project
        if (userId != null && !userId.trim().isEmpty()) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasTaskPermission(userUUID, projectId, TaskPermission.DELETE_TASK)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to restore project tasks. Only project owners can restore all tasks."));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        taskService.restoreTasksByProject(projectId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta("All project tasks restored successfully"));
    }
    
    // Get deleted tasks for a project (admin only)
    @GetMapping("/project/{projectId}/deleted")
    public ResponseEntity<ResponseDataAPI> getDeletedTasksByProject(@PathVariable UUID projectId, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        if (projectId == null) {
            return ResponseEntity.status(400).body(ResponseDataAPI.error("Project ID is required"));
        }
        
        // Permission check: User must have admin permissions for the project
        if (userId != null && !userId.trim().isEmpty()) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasTaskPermission(userUUID, projectId, TaskPermission.DELETE_TASK)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to view deleted tasks."));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        List<Tasks> deletedTasks = taskService.getDeletedTasksByProject(projectId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(deletedTasks));
    }
}
