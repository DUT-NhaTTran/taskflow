package com.tmnhat.tasksservice.utils;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.RestClientException;

import java.util.Map;
import java.util.UUID;

@Component
public class PermissionUtil {

    private final RestTemplate restTemplate = new RestTemplate();
    
    @Value("${projects.service.url:http://14.225.210.28:8083}")
    private String PROJECTS_SERVICE_URL;

    // Permission types enum
    public enum TaskPermission {
        CREATE_TASK,
        UPDATE_ANY_TASK,
        UPDATE_ASSIGNED_TASK,
        DELETE_TASK,
        ASSIGN_TASK,
        ESTIMATE_TASK,
        VIEW_TASK
    }

    // Check if user has permission for task operation
    public boolean hasTaskPermission(UUID userId, UUID projectId, TaskPermission permission) {
        try {
            // Get user permissions from Projects-Service
            String url = String.format("%s/api/projects/%s/members/%s/permissions", 
                                     PROJECTS_SERVICE_URL, projectId, userId);
            
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            
            if (response == null || !"SUCCESS".equals(response.get("status"))) {
                return false;
            }
            
            @SuppressWarnings("unchecked")
            Map<String, Object> permissions = (Map<String, Object>) response.get("data");
            
            if (permissions == null) {
                return false;
            }
            
            return checkTaskPermission(permissions, permission);
            
        } catch (RestClientException e) {
            System.err.println("Error checking permissions: " + e.getMessage());
            return false;
        }
    }

    // Check specific task permission based on user role
    private boolean checkTaskPermission(Map<String, Object> permissions, TaskPermission permission) {
        Boolean isOwner = (Boolean) permissions.get("isOwner");
        Boolean isScrumMaster = (Boolean) permissions.get("isScrumMaster");
        Boolean canManageAnyTask = (Boolean) permissions.get("canManageAnyTask");
        Boolean canAssignTasks = (Boolean) permissions.get("canAssignTasks");
        
        // Default to false if null
        boolean hasOwnerRole = Boolean.TRUE.equals(isOwner);
        boolean hasScrumMasterRole = Boolean.TRUE.equals(isScrumMaster);
        boolean hasManageTasksPermission = Boolean.TRUE.equals(canManageAnyTask);
        boolean hasAssignPermission = Boolean.TRUE.equals(canAssignTasks);
        
        switch (permission) {
            case CREATE_TASK:
                return true; // All project members can create tasks
                
            case UPDATE_ANY_TASK:
                return hasOwnerRole || hasScrumMasterRole || hasManageTasksPermission;
                
            case UPDATE_ASSIGNED_TASK:
                return true; // Anyone can update tasks assigned to them (checked in service layer)
                
            case DELETE_TASK:
                // ✅ ONLY project owners can delete tasks (soft delete)
                // Note: Task creator check is handled separately in canDeleteTask method
                return hasOwnerRole;
                
            case ASSIGN_TASK:
                return hasOwnerRole || hasScrumMasterRole || hasAssignPermission;
                
            case ESTIMATE_TASK:
                return true; // All project members can estimate tasks
                
            case VIEW_TASK:
                return true; // All project members can view tasks
                
            default:
                return false;
        }
    }

    // Get user role in project
    public String getUserRole(UUID userId, UUID projectId) {
        try {
            String url = String.format("%s/api/projects/%s/members/%s/role", 
                                     PROJECTS_SERVICE_URL, projectId, userId);
            
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            
            if (response != null && "SUCCESS".equals(response.get("status"))) {
                return (String) response.get("data");
            }
            
            return null;
        } catch (RestClientException e) {
            System.err.println("Error getting user role: " + e.getMessage());
            return null;
        }
    }

    // Check if user can update specific task (created by them OR assigned to them OR has admin rights)
    public boolean canUpdateTask(UUID userId, UUID projectId, UUID assigneeId, UUID createdByUserId) {
        // If user created the task, they can update it
        if (userId.equals(createdByUserId)) {
            return true;
        }
        
        // If user is assigned to the task, they can update it
        if (userId.equals(assigneeId)) {
            return true;
        }
        
        // Otherwise, check if they have admin permissions
        return hasTaskPermission(userId, projectId, TaskPermission.UPDATE_ANY_TASK);
    }

    // Overloaded method for backward compatibility (when createdBy is not available)
    public boolean canUpdateTask(UUID userId, UUID projectId, UUID assigneeId) {
        // If user is assigned to the task, they can update it
        if (userId.equals(assigneeId)) {
            return true;
        }
        
        // Otherwise, check if they have admin permissions
        return hasTaskPermission(userId, projectId, TaskPermission.UPDATE_ANY_TASK);
    }

    // Check if user can delete specific task (created by them OR is project owner)
    public boolean canDeleteTask(UUID userId, UUID projectId, UUID createdByUserId) {
        // If user created the task, they can delete it
        if (userId.equals(createdByUserId)) {
            return true;
        }
        
        // Otherwise, check if they are project owner (ONLY project owners, not scrum masters)
        try {
            String url = String.format("%s/api/projects/%s/members/%s/permissions", 
                                     PROJECTS_SERVICE_URL, projectId, userId);
            
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            
            if (response == null || !"SUCCESS".equals(response.get("status"))) {
                return false;
            }
            
            @SuppressWarnings("unchecked")
            Map<String, Object> permissions = (Map<String, Object>) response.get("data");
            
            if (permissions == null) {
                return false;
            }
            
            // ✅ ONLY project owners can delete tasks (not scrum masters)
            Boolean isOwner = (Boolean) permissions.get("isOwner");
            return Boolean.TRUE.equals(isOwner);
            
        } catch (RestClientException e) {
            System.err.println("Error checking delete permissions: " + e.getMessage());
            return false;
        }
    }

    // Permission check result wrapper
    public static class PermissionResult {
        private boolean allowed;
        private String reason;
        private String userRole;
        
        public PermissionResult(boolean allowed, String reason, String userRole) {
            this.allowed = allowed;
            this.reason = reason;
            this.userRole = userRole;
        }
        
        // Getters
        public boolean isAllowed() { return allowed; }
        public String getReason() { return reason; }
        public String getUserRole() { return userRole; }
        
        // Factory methods
        public static PermissionResult allow(String userRole) {
            return new PermissionResult(true, "Permission granted", userRole);
        }
        
        public static PermissionResult deny(String reason) {
            return new PermissionResult(false, reason, null);
        }
    }

    // Comprehensive permission check with detailed result
    public PermissionResult checkPermission(UUID userId, UUID projectId, TaskPermission permission) {
        String userRole = getUserRole(userId, projectId);
        
        if (userRole == null) {
            return PermissionResult.deny("User not found in project");
        }
        
        boolean hasPermission = hasTaskPermission(userId, projectId, permission);
        
        if (hasPermission) {
            return PermissionResult.allow(userRole);
        } else {
            return PermissionResult.deny("Insufficient permissions for " + permission + " with role " + userRole);
        }
    }
} 