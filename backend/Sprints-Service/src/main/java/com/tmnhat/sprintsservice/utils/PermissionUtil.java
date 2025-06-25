package com.tmnhat.sprintsservice.utils;

import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.RestClientException;

import java.util.Map;
import java.util.UUID;

@Component
public class PermissionUtil {

    private final RestTemplate restTemplate = new RestTemplate();
    private final String PROJECTS_SERVICE_URL = "http://localhost:8083";

    // Permission types enum for sprint operations
    public enum SprintPermission {
        CREATE_SPRINT,
        UPDATE_SPRINT,
        DELETE_SPRINT,
        START_SPRINT,
        END_SPRINT,
        VIEW_SPRINT
    }

    // Check if user has permission for sprint operation
    public boolean hasSprintPermission(UUID userId, UUID projectId, SprintPermission permission) {
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
            
            return checkSprintPermission(permissions, permission);
            
        } catch (RestClientException e) {
            System.err.println("Error checking sprint permissions: " + e.getMessage());
            return false;
        }
    }

    // Check specific sprint permission based on user role
    private boolean checkSprintPermission(Map<String, Object> permissions, SprintPermission permission) {
        Boolean isOwner = (Boolean) permissions.get("isOwner");
        Boolean isScrumMaster = (Boolean) permissions.get("isScrumMaster");
        Boolean canCreateSprint = (Boolean) permissions.get("canCreateSprint");
        Boolean canManageSprints = (Boolean) permissions.get("canManageSprints");
        
        // Default to false if null
        boolean hasOwnerRole = Boolean.TRUE.equals(isOwner);
        boolean hasScrumMasterRole = Boolean.TRUE.equals(isScrumMaster);
        boolean hasCreateSprintPermission = Boolean.TRUE.equals(canCreateSprint);
        boolean hasManageSprintsPermission = Boolean.TRUE.equals(canManageSprints);
        
        // ✅ DEBUG: Log all permissions for sprint operations
        System.out.println("🔍 PERMISSION CHECK for " + permission + ":");
        System.out.println("- isOwner: " + hasOwnerRole);
        System.out.println("- isScrumMaster: " + hasScrumMasterRole);
        System.out.println("- canCreateSprint: " + hasCreateSprintPermission);
        System.out.println("- canManageSprints: " + hasManageSprintsPermission);
        
        switch (permission) {
            case CREATE_SPRINT:
                // ✅ FIXED: Only rely on canCreateSprint permission from Projects Service
                // Projects Service already correctly sets this to true only for PO/Scrum Master
                boolean canCreate = hasCreateSprintPermission;
                System.out.println("- Result for CREATE_SPRINT (STRICT): " + canCreate);
                if (!canCreate) {
                    System.out.println("❌ CREATE_SPRINT DENIED: User must have canCreateSprint permission (PO/Scrum Master only)");
                    System.out.println("   - canCreateSprint from Projects Service: " + hasCreateSprintPermission);
                }
                return canCreate;
                
            case UPDATE_SPRINT:
            case START_SPRINT:
            case END_SPRINT:
                // ✅ For other sprint management operations, keep existing logic
                boolean canManage = hasOwnerRole || hasScrumMasterRole || hasCreateSprintPermission || hasManageSprintsPermission;
                System.out.println("- Result for " + permission + ": " + canManage);
                return canManage;
                
            case DELETE_SPRINT:
                // ✅ Project Owners and Scrum Masters can delete sprints (soft delete)
                boolean canDelete = hasOwnerRole || hasScrumMasterRole;
                System.out.println("- Result for DELETE_SPRINT (OWNER OR SCRUM MASTER): " + canDelete);
                if (!canDelete) {
                    System.out.println("❌ DELETE DENIED: User must be Project Owner or Scrum Master");
                    System.out.println("   - Is Project Owner: " + hasOwnerRole);
                    System.out.println("   - Is Scrum Master: " + hasScrumMasterRole);
                    System.out.println("   - Other permissions (canCreateSprint/canManageSprints): " + (hasCreateSprintPermission || hasManageSprintsPermission));
                }
                return canDelete;
                
            case VIEW_SPRINT:
                return true; // All project members can view sprints
                
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
    public PermissionResult checkPermission(UUID userId, UUID projectId, SprintPermission permission) {
        String userRole = getUserRole(userId, projectId);
        
        if (userRole == null) {
            return PermissionResult.deny("User not found in project");
        }
        
        boolean hasPermission = hasSprintPermission(userId, projectId, permission);
        
        if (hasPermission) {
            return PermissionResult.allow(userRole);
        } else {
            return PermissionResult.deny("Insufficient permissions for " + permission + " with role " + userRole);
        }
    }
} 