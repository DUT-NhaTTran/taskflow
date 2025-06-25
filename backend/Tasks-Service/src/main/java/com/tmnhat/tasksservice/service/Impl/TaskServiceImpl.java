package com.tmnhat.tasksservice.service.Impl;

import com.tmnhat.common.exception.DatabaseException;
import com.tmnhat.common.exception.ResourceNotFoundException;
import com.tmnhat.tasksservice.model.Tasks;
import com.tmnhat.tasksservice.payload.enums.TaskStatus;
import com.tmnhat.tasksservice.repository.TasksDAO;
import com.tmnhat.tasksservice.service.TaskService;
import com.tmnhat.tasksservice.validation.TaskValidator;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.HashMap;
import java.util.ArrayList;

@Service
public class TaskServiceImpl implements TaskService {

    private final TasksDAO tasksDAO = new TasksDAO();

    @Override
    public void addTask(Tasks task) {
        try {
            TaskValidator.validateTask(task);
            tasksDAO.addTask(task);
            
            // NOTE: Removed automatic notification sending - frontend will handle this
            System.out.println("🔄 Task created: " + task.getTitle() + " - Frontend should handle notification");
        } catch (Exception e) {
            throw new DatabaseException("Error adding task: " + e.getMessage());
        }
    }

    @Override
    public void updateTask(UUID id, Tasks task) {
        updateTask(id, task, null); // Delegate to overloaded method
    }

    @Override
    public void updateTask(UUID id, Tasks task, String actorUserId) {
        try {
            TaskValidator.validateTaskId(id);
            TaskValidator.validateTask(task);
            Tasks existingTask = tasksDAO.getTaskById(id);
            if (existingTask == null) {
                throw new ResourceNotFoundException("Task not found with ID " + id);
            }
            
            // Check if status changed for notification (but don't send here - let frontend handle it)
            boolean statusChanged = existingTask.getStatus() != task.getStatus();
            TaskStatus oldStatus = existingTask.getStatus();
            TaskStatus newStatus = task.getStatus();
            
            // Set the ID on the task object to ensure it's not null
            task.setId(id);
            
            // Preserve essential fields from existing task if they're missing in the update
            if (task.getProjectId() == null) {
                task.setProjectId(existingTask.getProjectId());
            }
            if (task.getSprintId() == null) {
                task.setSprintId(existingTask.getSprintId());
            }
            if (task.getCreatedAt() == null) {
                task.setCreatedAt(existingTask.getCreatedAt());
            }
            // Preserve createdBy if not provided
            if (task.getCreatedBy() == null) {
                task.setCreatedBy(existingTask.getCreatedBy());
            }
            
            // Update the task
            tasksDAO.updateTask(id, task);
            
            // NOTE: Removed automatic notification sending - frontend will handle this
            // Frontend will call notification API directly when needed
            if (statusChanged) {
                System.out.println("🔄 Task status changed from " + oldStatus + " to " + newStatus + 
                                 " - Frontend should handle notification");
            }
            
        } catch (Exception e) {
            throw new DatabaseException("Error updating task: " + e.getMessage());
        }
    }

    @Override
    public void deleteTask(UUID id) {
        try {
            TaskValidator.validateTaskId(id);
            Tasks existingTask = tasksDAO.getTaskById(id);
            if (existingTask == null) {
                throw new ResourceNotFoundException("Task not found with ID " + id);
            }
            
            // NOTE: Removed automatic notification sending - frontend will handle this
            // Frontend will call notification API directly when needed for TASK_DELETED
            System.out.println("🗑️ Task being deleted: " + existingTask.getTitle() + 
                             " - Frontend should handle TASK_DELETED notification");
            
            tasksDAO.deleteTask(id);
        } catch (Exception e) {
            throw new DatabaseException("Error deleting task: " + e.getMessage());
        }
    }

    @Override
    public Tasks getTaskById(UUID id) {
        try {
            TaskValidator.validateTaskId(id);
            Tasks task = tasksDAO.getTaskById(id);
            if (task == null) {
                throw new ResourceNotFoundException("Task not found with ID " + id);
            }
            return task;
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving task: " + e.getMessage());
        }
    }

    @Override
    public List<Tasks> getTasksByStatusAndProjectAndSprint(String status, UUID projectId, UUID sprintId) {
        try {
            return tasksDAO.getTasksByStatusAndProjectAndSprint(status, projectId, sprintId);
        } catch (Exception e) {
            throw new RuntimeException("Failed to filter tasks", e);
        }
    }

    @Override
    public List<Tasks> getAllTasks() {
        try {
            return tasksDAO.getAllTasks();
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving tasks: " + e.getMessage());
        }
    }

    @Override
    public void assignTask(UUID taskId, UUID userId) {
        try {
            Tasks task = tasksDAO.getTaskById(taskId);
            if (task == null) {
                throw new ResourceNotFoundException("Task not found with ID " + taskId);
            }
            
            tasksDAO.assignTask(taskId, userId);
            
            // ✅ FIXED: Send notification to the assigned user (userId), not the one who assigned
            String projectName = getProjectName(task.getProjectId());
            
            // Send notification to the assigned user
            // This method should be implemented to send notification to the assigned user
            System.out.println("🔄 Task assigned to user: " + userId + " - Frontend should handle notification");
        } catch (Exception e) {
            throw new DatabaseException("Error assigning task: " + e.getMessage());
        }
    }

    @Override
    public void changeTaskStatus(UUID taskId, String status) {
        changeTaskStatus(taskId, status, null); // Delegate to overloaded method
    }

    @Override
    public void changeTaskStatus(UUID taskId, String status, String actorUserId) {
        try {
            Tasks task = tasksDAO.getTaskById(taskId);
            if (task == null) {
                throw new ResourceNotFoundException("Task not found with ID " + taskId);
            }
            
            // Store old status for logging
            TaskStatus oldStatus = task.getStatus();
            TaskStatus newStatus = TaskStatus.valueOf(status);
            
            // Update status in database
            tasksDAO.changeTaskStatus(taskId, status);
            

        } catch (Exception e) {
            throw new DatabaseException("Error changing task status: " + e.getMessage());
        }
    }

    @Override
    public void updateStoryPoint(UUID taskId, int storyPoint) {
        try {
            Tasks task = tasksDAO.getTaskById(taskId);
            if (task == null) {
                throw new ResourceNotFoundException("Task not found with ID " + taskId);
            }
            tasksDAO.updateStoryPoint(taskId, storyPoint);
        } catch (Exception e) {
            throw new DatabaseException("Error updating story point: " + e.getMessage());
        }
    }

    @Override
    public void addSubtask(UUID parentTaskId, Tasks subtask) {
        try {
            Tasks parentTask = tasksDAO.getTaskById(parentTaskId);
            if (parentTask == null) {
                throw new ResourceNotFoundException("Parent Task not found with ID " + parentTaskId);
            }
            subtask.setParentTaskId(parentTaskId);
            tasksDAO.addTask(subtask);
        } catch (Exception e) {
            throw new DatabaseException("Error adding subtask: " + e.getMessage());
        }
    }

    @Override
    public void linkTasks(UUID taskId, UUID relatedTaskId) {
        try {
            // Nếu  có bảng task_relations
            tasksDAO.linkTasks(taskId, relatedTaskId);
        } catch (Exception e) {
            throw new DatabaseException("Error linking tasks: " + e.getMessage());
        }
    }

    @Override
    public List<Tasks> filterTasks(String status, UUID assigneeId) {
        try {
            return tasksDAO.filterTasks(status, assigneeId);
        } catch (Exception e) {
            throw new DatabaseException("Error filtering tasks: " + e.getMessage());
        }
    }

    @Override
    public List<Tasks> searchTasks(String keyword) {
        try {
            return tasksDAO.searchTasks(keyword);
        } catch (Exception e) {
            throw new DatabaseException("Error searching tasks: " + e.getMessage());
        }
    }

    @Override
    public List<Tasks> getTasksBySprintId(UUID sprintId) {
        try {
            return tasksDAO.getTasksBySprintId(sprintId);
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving tasks by sprint: " + e.getMessage());
        }
    }

    @Override
    public List<Tasks> paginateTasks(int page, int size) {
        try {
            return tasksDAO.paginateTasks(page, size);
        } catch (Exception e) {
            throw new DatabaseException("Error paginating tasks: " + e.getMessage());
        }
    }

    @Override
    public void commentOnTask(UUID taskId, String comment) {
        try {
            Tasks task = tasksDAO.getTaskById(taskId);
            if (task == null) {
                throw new ResourceNotFoundException("Task not found with ID " + taskId);
            }
            
            tasksDAO.addCommentToTask(taskId, comment);
            
            // Send notification to assigned user about new comment
            if (task.getAssigneeId() != null) {
                String projectName = getProjectName(task.getProjectId());
                
                // Send notification to the assigned user
                // This method should be implemented to send notification to the assigned user
                System.out.println("🔄 New comment added to task: " + taskId + " - Frontend should handle notification");
            }
        } catch (Exception e) {
            throw new DatabaseException("Error commenting on task: " + e.getMessage());
        }
    }

    @Override
    public void attachFileToTask(UUID taskId, MultipartFile file) {
        try {
            Tasks task = tasksDAO.getTaskById(taskId);
            if (task == null) {
                throw new ResourceNotFoundException("Task not found with ID " + taskId);
            }
            
            tasksDAO.attachFileToTask(taskId, file);
            
            // Send notification about file attachment
            if (task.getAssigneeId() != null) {
                String projectName = getProjectName(task.getProjectId());
                
                // Send notification about file attachment
                // This method should be implemented to send notification about file attachment
                System.out.println("🔄 New file attached to task: " + taskId + " - Frontend should handle notification");
            }
        } catch (Exception e) {
            throw new DatabaseException("Error attaching file to task: " + e.getMessage());
        }
    }

    // --- Member Functions ---

    @Override
    public void addMemberToTask(UUID taskId, UUID userId) {
        try {
            Tasks task = tasksDAO.getTaskById(taskId);
            if (task == null) {
                throw new ResourceNotFoundException("Task not found with ID " + taskId);
            }
            
            tasksDAO.addMemberToTask(taskId, userId);
            
            // Send notification to new member
            String projectName = getProjectName(task.getProjectId());
            
            // Send notification to the new member
            // This method should be implemented to send notification to the new member
            System.out.println("🔄 New member added to task: " + taskId + " - Frontend should handle notification");
        } catch (Exception e) {
            throw new DatabaseException("Error adding member to task: " + e.getMessage());
        }
    }

    @Override
    public void removeMemberFromTask(UUID taskId, UUID userId) {
        try {
            tasksDAO.removeMemberFromTask(taskId, userId);
        } catch (Exception e) {
            throw new DatabaseException("Error removing member from task: " + e.getMessage());
        }
    }

    @Override
    public List<UUID> getTaskMembers(UUID taskId) {
        try {
            return tasksDAO.getTaskMembers(taskId);
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving task members: " + e.getMessage());
        }
    }

    @Override
    public List<Tasks> getTasksByProjectId(UUID projectId) {
        try {
            return tasksDAO.getTasksByProjectId(projectId);
        } catch (Exception e) {
            throw new RuntimeException("Failed to get tasks by projectId", e);
        }
    }

    @Override
    public List<Tasks> getTasksByProjectIdSorted(UUID projectId, String sortBy, String sortOrder) {
        try {
            return tasksDAO.getTasksByProjectIdSorted(projectId, sortBy, sortOrder);
        } catch (Exception e) {
            throw new RuntimeException("Failed to get sorted tasks by projectId", e);
        }
    }

    @Override
    public List<Object> getProjectActivity(UUID projectId) {
        try {
            return tasksDAO.getProjectActivity(projectId);
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving project activity: " + e.getMessage());
        }
    }

    // Calendar Filter Methods Implementation
    @Override
    public List<Tasks> getFilteredTasksForCalendar(UUID projectId, String search, 
                                                  List<String> assigneeIds, List<String> types, 
                                                  List<String> statuses, String startDate, 
                                                  String endDate, String sprintId) {
        try {
            TaskValidator.validateProjectId(projectId);
            return tasksDAO.getFilteredTasksForCalendar(projectId, search, assigneeIds, 
                                                       types, statuses, startDate, endDate, sprintId);
        } catch (Exception e) {
            throw new DatabaseException("Error filtering tasks for calendar: " + e.getMessage());
        }
    }

    @Override
    public List<Map<String, Object>> getTaskAssignees(UUID projectId) {
        try {
            TaskValidator.validateProjectId(projectId);
            return tasksDAO.getTaskAssignees(projectId);
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving task assignees: " + e.getMessage());
        }
    }

    @Override
    public List<String> getTaskTypes(UUID projectId) {
        try {
            TaskValidator.validateProjectId(projectId);
            return tasksDAO.getTaskTypes(projectId);
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving task types: " + e.getMessage());
        }
    }

    @Override
    public List<String> getTaskStatuses(UUID projectId) {
        try {
            TaskValidator.validateProjectId(projectId);
            return tasksDAO.getTaskStatuses(projectId);
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving task statuses: " + e.getMessage());
        }
    }

    // AI Service Configuration
    private static final String AI_SERVICE_URL = System.getenv().getOrDefault("AI_SERVICE_URL", "http://ai-service:8088");
    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    public Object estimateStoryPoints(UUID taskId) {
        try {
            // Get task details
            Tasks task = tasksDAO.getTaskById(taskId);
            if (task == null) {
                throw new ResourceNotFoundException("Task not found with ID " + taskId);
            }

            // Prepare request for AI service - send fields directly without "task" wrapper
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("title", task.getTitle());
            requestBody.put("description", task.getDescription() != null ? task.getDescription() : "");
            requestBody.put("label", ""); // Default empty label
            requestBody.put("priority", task.getPriority() != null ? task.getPriority() : "MEDIUM");
            requestBody.put("attachments_count", 0); // Default 0 attachments

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            // Call AI service
            ResponseEntity<Map> response = restTemplate.exchange(
                AI_SERVICE_URL + "/estimate",
                HttpMethod.POST,
                entity,
                Map.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> aiResponse = response.getBody();
                
                // Update task with AI estimation
                Integer estimatedPoints = (Integer) aiResponse.get("estimated_story_points");
                if (estimatedPoints != null && estimatedPoints.intValue() > 0) {
                    tasksDAO.updateStoryPoint(taskId, estimatedPoints);
                }

                // Return response with success flag
                Map<String, Object> result = new HashMap<>();
                result.put("success", true);
                result.put("data", aiResponse);
                return result;
            } else {
                throw new RuntimeException("AI service returned error");
            }

        } catch (Exception e) {
            // Return error response in consistent format
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("success", false);
            errorResult.put("error", "AI estimation failed: " + e.getMessage());
            return errorResult;
        }
    }

    @Override
    public Object trainAIModel() {
        try {
            // Get all tasks from database for training
            List<Tasks> allTasks = tasksDAO.getAllTasks();
            
            // Prepare training data
            Map<String, Object> requestBody = new HashMap<>();
            List<Map<String, Object>> tasks = new ArrayList<>();
            
            for (Tasks task : allTasks) {
                if (task.getStoryPoint() > 0) {
                    Map<String, Object> taskData = new HashMap<>();
                    taskData.put("title", task.getTitle());
                    taskData.put("description", task.getDescription() != null ? task.getDescription() : "");
                    taskData.put("storyPoint", task.getStoryPoint());
                    tasks.add(taskData);
                }
            }
            
            requestBody.put("tasks", tasks);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            // Call AI service
            ResponseEntity<Map> response = restTemplate.exchange(
                AI_SERVICE_URL + "/train",
                HttpMethod.POST,
                entity,
                Map.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> result = new HashMap<>();
                result.put("success", true);
                result.put("data", response.getBody());
                return result;
            } else {
                throw new RuntimeException("AI service training failed");
            }

        } catch (Exception e) {
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("success", false);
            errorResult.put("error", "AI training failed: " + e.getMessage());
            return errorResult;
        }
    }

    @Override
    public Object bulkEstimateStoryPoints(UUID projectId) {
        try {
            // Get all tasks for the project
            List<Tasks> projectTasks = tasksDAO.getTasksByProjectId(projectId);
            List<Map<String, Object>> results = new ArrayList<>();
            int successCount = 0;
            int failCount = 0;

            for (Tasks task : projectTasks) {
                try {
                    // Skip tasks that already have story points
                    if (task.getStoryPoint() > 0) {
                        continue;
                    }

                    Object estimationResult = estimateStoryPoints(task.getId());
                    Map<String, Object> taskResult = new HashMap<>();
                    taskResult.put("taskId", task.getId());
                    taskResult.put("title", task.getTitle());
                    taskResult.put("result", estimationResult);
                    
                    if (estimationResult instanceof Map && ((Map<?, ?>) estimationResult).get("success").equals(true)) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                    
                    results.add(taskResult);
                } catch (Exception e) {
                    failCount++;
                    Map<String, Object> taskResult = new HashMap<>();
                    taskResult.put("taskId", task.getId());
                    taskResult.put("title", task.getTitle());
                    taskResult.put("error", e.getMessage());
                    results.add(taskResult);
                }
            }

            Map<String, Object> bulkResult = new HashMap<>();
            bulkResult.put("success", true);
            bulkResult.put("totalTasks", projectTasks.size());
            bulkResult.put("successCount", successCount);
            bulkResult.put("failCount", failCount);
            bulkResult.put("results", results);
            return bulkResult;

        } catch (Exception e) {
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("success", false);
            errorResult.put("error", "Bulk estimation failed: " + e.getMessage());
            return errorResult;
        }
    }

    // Helper method to get project name (you might need to implement this)
    private String getProjectName(UUID projectId) {
        try {
            // Call Projects Service to get project name
            String url = "http://localhost:8086/api/projects/" + projectId;
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
            
            if (response.getBody() != null && response.getBody().get("data") != null) {
                Map<String, Object> projectData = (Map<String, Object>) response.getBody().get("data");
                return (String) projectData.get("name");
            }
            return "Unknown Project";
        } catch (Exception e) {
            return "Unknown Project";
        }
    }

    @Override
    public List<Tasks> getOverdueTasks(UUID projectId) {
        try {
            return tasksDAO.getOverdueTasks(projectId);
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving overdue tasks for project: " + e.getMessage());
        }
    }

    @Override
    public List<Tasks> getAllOverdueTasks() {
        try {
            return tasksDAO.getAllOverdueTasks();
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving all overdue tasks: " + e.getMessage());
        }
    }

    @Override
    public List<String> getTaskStatusesForCalendar(UUID projectId) {
        try {
            return tasksDAO.getTaskStatuses(projectId);
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving task statuses for calendar: " + e.getMessage());
        }
    }

    // ✅ NEW: Task restore methods implementation
    @Override
    public void restoreTask(UUID taskId) {
        try {
            TaskValidator.validateTaskId(taskId);
            Tasks existingTask = tasksDAO.getTaskByIdIncludeDeleted(taskId);
            if (existingTask == null) {
                throw new ResourceNotFoundException("Task not found with ID " + taskId);
            }
            tasksDAO.restoreTask(taskId);
        } catch (Exception e) {
            throw new DatabaseException("Error restoring task: " + e.getMessage());
        }
    }
    
    @Override
    public void restoreTasksByProject(UUID projectId) {
        try {
            if (projectId == null) {
                throw new IllegalArgumentException("Project ID cannot be null");
            }
            tasksDAO.restoreTasksByProject(projectId);
            System.out.println("✅ All tasks restored for project: " + projectId);
        } catch (Exception e) {
            throw new DatabaseException("Error restoring tasks for project: " + e.getMessage());
        }
    }
    
    @Override
    public List<Tasks> getDeletedTasksByProject(UUID projectId) {
        try {
            if (projectId == null) {
                throw new IllegalArgumentException("Project ID cannot be null");
            }
            return tasksDAO.getDeletedTasksByProject(projectId);
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving deleted tasks: " + e.getMessage());
        }
    }
    
    @Override
    public Tasks getTaskByIdIncludeDeleted(UUID taskId) {
        try {
            TaskValidator.validateTaskId(taskId);
            Tasks task = tasksDAO.getTaskByIdIncludeDeleted(taskId);
            if (task == null) {
                throw new ResourceNotFoundException("Task not found with ID " + taskId);
            }
            return task;
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving task including deleted: " + e.getMessage());
        }
    }
}

