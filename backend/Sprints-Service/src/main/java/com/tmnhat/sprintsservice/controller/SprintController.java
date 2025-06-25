package com.tmnhat.sprintsservice.controller;

import com.tmnhat.common.config.WebConfig;
import com.tmnhat.common.payload.ResponseDataAPI;
import com.tmnhat.sprintsservice.model.Sprints;
import com.tmnhat.sprintsservice.service.Impl.SprintServiceImpl;
import com.tmnhat.sprintsservice.service.SprintService;
import com.tmnhat.sprintsservice.validation.SprintValidator;
import com.tmnhat.sprintsservice.utils.PermissionUtil;
import com.tmnhat.sprintsservice.payload.enums.SprintStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
@Import(WebConfig.class)

@RestController
@RequestMapping("/api/sprints")
public class SprintController {

    private final SprintService sprintsService;
    
    @Autowired
    private PermissionUtil permissionUtil;

    public SprintController() {
        this.sprintsService = new SprintServiceImpl();
    }

    @PostMapping
    public ResponseEntity<ResponseDataAPI> addSprint(@RequestBody Sprints sprint, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        SprintValidator.validateSprint(sprint);
        
        // Permission check: User must have CREATE_SPRINT permission (admin only)
        if (userId != null && !userId.trim().isEmpty() && sprint.getProjectId() != null) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasSprintPermission(userUUID, sprint.getProjectId(), PermissionUtil.SprintPermission.CREATE_SPRINT)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to create sprint"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        sprintsService.addSprint(sprint);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    @GetMapping
    public ResponseEntity<ResponseDataAPI> getAllSprints() {
        List<Sprints> sprintList = sprintsService.getAllSprints();
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(sprintList));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResponseDataAPI> getSprintById(@PathVariable("id") UUID id, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        SprintValidator.validateSprintId(id);
        
        Sprints sprint = sprintsService.getSprintById(id);
        if (sprint == null) {
            return ResponseEntity.status(404).body(ResponseDataAPI.error("Sprint not found"));
        }
        
        // Permission check: User must have VIEW_SPRINT permission (all project members)
        if (userId != null && !userId.trim().isEmpty() && sprint.getProjectId() != null) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasSprintPermission(userUUID, sprint.getProjectId(), PermissionUtil.SprintPermission.VIEW_SPRINT)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to view this sprint"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(sprint));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ResponseDataAPI> updateSprint(@PathVariable("id") UUID id, @RequestBody Sprints sprint, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        SprintValidator.validateSprintId(id);
        SprintValidator.validateSprint(sprint);
        
        // Get existing sprint to check permissions
        Sprints existingSprint = sprintsService.getSprintById(id);
        if (existingSprint == null) {
            return ResponseEntity.status(404).body(ResponseDataAPI.error("Sprint not found"));
        }
        
        // Permission check: User must have UPDATE_SPRINT permission (admin only)
        if (userId != null && !userId.trim().isEmpty() && existingSprint.getProjectId() != null) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasSprintPermission(userUUID, existingSprint.getProjectId(), PermissionUtil.SprintPermission.UPDATE_SPRINT)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to update sprint"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        sprintsService.updateSprint(id, sprint);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ResponseDataAPI> deleteSprint(@PathVariable("id") UUID id, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        SprintValidator.validateSprintId(id);
        
        // Get existing sprint to check permissions
        Sprints existingSprint = sprintsService.getSprintById(id);
        if (existingSprint == null) {
            return ResponseEntity.status(404).body(ResponseDataAPI.error("Sprint not found"));
        }
        
        // Permission check: User must have DELETE_SPRINT permission (admin only)
        if (userId != null && !userId.trim().isEmpty() && existingSprint.getProjectId() != null) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasSprintPermission(userUUID, existingSprint.getProjectId(), PermissionUtil.SprintPermission.DELETE_SPRINT)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to delete sprint"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        sprintsService.deleteSprint(id);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }
    
    @PostMapping("/{id}/start")
    public ResponseEntity<ResponseDataAPI> startSprint(@PathVariable("id") UUID id, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        SprintValidator.validateSprintId(id);
        
        // Get existing sprint to check permissions
        Sprints existingSprint = sprintsService.getSprintById(id);
        if (existingSprint == null) {
            return ResponseEntity.status(404).body(ResponseDataAPI.error("Sprint not found"));
        }
        
        // Permission check: User must have START_SPRINT permission (admin only)
        if (userId != null && !userId.trim().isEmpty() && existingSprint.getProjectId() != null) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasSprintPermission(userUUID, existingSprint.getProjectId(), PermissionUtil.SprintPermission.START_SPRINT)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to start sprint"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        sprintsService.startSprint(id);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }
    
    @PostMapping("/{id}/complete")
    public ResponseEntity<ResponseDataAPI> completeSprint(@PathVariable("id") UUID id, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        SprintValidator.validateSprintId(id);
        
        // Get existing sprint to check permissions
        Sprints existingSprint = sprintsService.getSprintById(id);
        if (existingSprint == null) {
            return ResponseEntity.status(404).body(ResponseDataAPI.error("Sprint not found"));
        }
        
        // Permission check: User must have END_SPRINT permission (admin only)
        if (userId != null && !userId.trim().isEmpty() && existingSprint.getProjectId() != null) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasSprintPermission(userUUID, existingSprint.getProjectId(), PermissionUtil.SprintPermission.END_SPRINT)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to complete sprint"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        sprintsService.completeSprint(id);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }
    
    @GetMapping("/project/{projectId}/last")
    public ResponseEntity<?> getLastSprintOfProject(@PathVariable UUID projectId, @RequestHeader(value = "X-User-Id", required = false) String userId) throws SQLException {
        // Permission check: User must have VIEW_SPRINT permission
        if (userId != null && !userId.trim().isEmpty()) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasSprintPermission(userUUID, projectId, PermissionUtil.SprintPermission.VIEW_SPRINT)) {
                    return ResponseEntity.status(403).body("Insufficient permissions to view sprints");
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body("Invalid user ID format");
            }
        }
        
        Sprints sprint = sprintsService.getLastSprintOfProject(projectId);
        if (sprint == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No sprint found");
        }
        return ResponseEntity.ok(sprint);
    }
    
    @GetMapping("/project/{projectId}/active")
    public ResponseEntity<ResponseDataAPI> getActiveSprintByProject(@PathVariable UUID projectId, @RequestHeader(value = "X-User-Id", required = false) String userId) throws SQLException {
        // Permission check: User must have VIEW_SPRINT permission
        if (userId != null && !userId.trim().isEmpty()) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasSprintPermission(userUUID, projectId, PermissionUtil.SprintPermission.VIEW_SPRINT)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to view sprints"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        Sprints sprint = sprintsService.getActiveSprint(projectId);
        if (sprint == null) {
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(null));
        }
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(sprint));
    }
    
    @GetMapping("/project/{projectId}")
    public ResponseEntity<?> getSprintsByProject(@PathVariable UUID projectId, @RequestHeader(value = "X-User-Id", required = false) String userId) throws SQLException {
        // Permission check: User must have VIEW_SPRINT permission
        if (userId != null && !userId.trim().isEmpty()) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasSprintPermission(userUUID, projectId, PermissionUtil.SprintPermission.VIEW_SPRINT)) {
                    return ResponseEntity.status(403).body(Map.of("error", "Insufficient permissions to view sprints"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(Map.of("error", "Invalid user ID format"));
            }
        }
        
        List<Sprints> list = sprintsService.getSprintsByProject(projectId);
        return ResponseEntity.ok(Map.of("data", list));
    }

    // Calendar Filter Endpoints
    @GetMapping("/project/{projectId}/calendar/filter")
    public ResponseEntity<ResponseDataAPI> getFilteredSprintsForCalendar(
        @PathVariable UUID projectId,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) List<String> assigneeIds,
        @RequestParam(required = false) List<String> statuses,
        @RequestParam(required = false) String startDate,
        @RequestParam(required = false) String endDate,
        @RequestHeader(value = "X-User-Id", required = false) String userId) {
        
        // Permission check: User must have VIEW_SPRINT permission
        if (userId != null && !userId.trim().isEmpty()) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasSprintPermission(userUUID, projectId, PermissionUtil.SprintPermission.VIEW_SPRINT)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to view sprints"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        List<Sprints> filteredSprints = sprintsService.getFilteredSprintsForCalendar(
            projectId, search, assigneeIds, statuses, startDate, endDate);
        
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(filteredSprints));
    }

    @GetMapping("/project/{projectId}/calendar/assignees")
    public ResponseEntity<ResponseDataAPI> getSprintAssigneesForCalendar(@PathVariable UUID projectId, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        // Permission check: User must have VIEW_SPRINT permission
        if (userId != null && !userId.trim().isEmpty()) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasSprintPermission(userUUID, projectId, PermissionUtil.SprintPermission.VIEW_SPRINT)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to view sprint assignees"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        List<Map<String, Object>> assignees = sprintsService.getSprintAssignees(projectId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(assignees));
    }

    @GetMapping("/project/{projectId}/calendar/statuses")
    public ResponseEntity<ResponseDataAPI> getSprintStatusesForCalendar(@PathVariable UUID projectId, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        // Permission check: User must have VIEW_SPRINT permission
        if (userId != null && !userId.trim().isEmpty()) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasSprintPermission(userUUID, projectId, PermissionUtil.SprintPermission.VIEW_SPRINT)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Insufficient permissions to view sprint statuses"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        List<String> statuses = sprintsService.getSprintStatuses(projectId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(statuses));
    }

    // ✅ NEW: Soft delete and audit endpoints
    @PutMapping("/{id}/cancel")
    public ResponseEntity<ResponseDataAPI> cancelSprint(@PathVariable("id") UUID id, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        SprintValidator.validateSprintId(id);
        
        // Get sprint first to check project and status
        Sprints existingSprint = sprintsService.getSprintById(id);
        if (existingSprint == null) {
            return ResponseEntity.status(404).body(ResponseDataAPI.error("Sprint not found"));
        }
        
        // Permission check: User must be Project Owner or Scrum Master (DELETE_SPRINT permission)
        if (userId != null && !userId.trim().isEmpty()) {
            try {
                UUID userUUID = UUID.fromString(userId);
                
                // Check if user has DELETE_SPRINT permission (Project Owners and Scrum Masters)
                if (!permissionUtil.hasSprintPermission(userUUID, existingSprint.getProjectId(), PermissionUtil.SprintPermission.DELETE_SPRINT)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Only Project Owners and Scrum Masters can cancel sprints"));
                }
                
                // Business rule: Only allow cancelling NOT_STARTED or ACTIVE sprints
                if (existingSprint.getStatus() != SprintStatus.NOT_STARTED && existingSprint.getStatus() != SprintStatus.ACTIVE) {
                    return ResponseEntity.status(400).body(ResponseDataAPI.error("Only NOT_STARTED or ACTIVE sprints can be cancelled"));
                }
                
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        sprintsService.cancelSprint(id);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }
    
    @PutMapping("/{id}/soft-delete")
    public ResponseEntity<ResponseDataAPI> softDeleteSprint(@PathVariable("id") UUID id, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        SprintValidator.validateSprintId(id);
        
        // Get sprint first to check project and status
        Sprints existingSprint = sprintsService.getSprintById(id);
        if (existingSprint == null) {
            return ResponseEntity.status(404).body(ResponseDataAPI.error("Sprint not found"));
        }
        
        // Permission check: User must be Project Owner or Scrum Master (DELETE_SPRINT permission)
        if (userId != null && !userId.trim().isEmpty()) {
            try {
                UUID userUUID = UUID.fromString(userId);
                
                // Check if user has DELETE_SPRINT permission (Project Owners and Scrum Masters)
                if (!permissionUtil.hasSprintPermission(userUUID, existingSprint.getProjectId(), PermissionUtil.SprintPermission.DELETE_SPRINT)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Only Project Owners and Scrum Masters can delete sprints"));
                }
                
                // Business rule: Only allow deleting NOT_STARTED sprints
                if (existingSprint.getStatus() != SprintStatus.NOT_STARTED) {
                    return ResponseEntity.status(400).body(ResponseDataAPI.error("Only NOT_STARTED sprints can be deleted. Started or completed sprints can only be cancelled."));
                }
                
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        sprintsService.softDeleteSprint(id);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }
    
    @PutMapping("/{id}/restore")
    public ResponseEntity<ResponseDataAPI> restoreSprint(@PathVariable("id") UUID id, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        SprintValidator.validateSprintId(id);
        
        // Permission check: User must have CREATE_SPRINT permission to restore
        if (userId != null && !userId.trim().isEmpty()) {
            try {
                UUID userUUID = UUID.fromString(userId);
                // Note: We'll need to get project ID from somewhere - perhaps pass as param
                // For now, assume admin-only operation
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        sprintsService.restoreSprint(id);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }
    
    @GetMapping("/project/{projectId}/deleted")
    public ResponseEntity<ResponseDataAPI> getDeletedSprints(@PathVariable UUID projectId, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        // Permission check: User must be Project Owner or Scrum Master (DELETE_SPRINT permission) to view audit data
        if (userId != null && !userId.trim().isEmpty()) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasSprintPermission(userUUID, projectId, PermissionUtil.SprintPermission.DELETE_SPRINT)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Only Project Owners and Scrum Masters can view deleted sprints"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        List<Sprints> deletedSprints = sprintsService.getDeletedSprintsByProject(projectId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(deletedSprints));
    }
    
    @GetMapping("/project/{projectId}/cancelled")
    public ResponseEntity<ResponseDataAPI> getCancelledSprints(@PathVariable UUID projectId, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        // Permission check: User must be Project Owner or Scrum Master (DELETE_SPRINT permission) to view audit data
        if (userId != null && !userId.trim().isEmpty()) {
            try {
                UUID userUUID = UUID.fromString(userId);
                if (!permissionUtil.hasSprintPermission(userUUID, projectId, PermissionUtil.SprintPermission.DELETE_SPRINT)) {
                    return ResponseEntity.status(403).body(ResponseDataAPI.error("Only Project Owners and Scrum Masters can view cancelled sprints"));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.status(400).body(ResponseDataAPI.error("Invalid user ID format"));
            }
        }
        
        List<Sprints> cancelledSprints = sprintsService.getCancelledSprintsByProject(projectId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(cancelledSprints));
    }
    
    //Task migration endpoints
    @GetMapping("/{id}/incomplete-tasks")
    public ResponseEntity<ResponseDataAPI> getIncompleteTasksFromSprint(@PathVariable UUID id, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        SprintValidator.validateSprintId(id);
        
        List<Map<String, Object>> incompleteTasks = sprintsService.getIncompleteTasksFromSprint(id);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(incompleteTasks));
    }
    
    @PutMapping("/{id}/move-tasks-to-backlog")
    public ResponseEntity<ResponseDataAPI> moveTasksToBacklog(@PathVariable UUID id, @RequestHeader(value = "X-User-Id", required = false) String userId) {
        SprintValidator.validateSprintId(id);
        
        sprintsService.moveTasksToBacklog(id);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }
    
    @PutMapping("/{fromSprintId}/move-tasks-to/{toSprintId}")
    public ResponseEntity<ResponseDataAPI> moveTasksBetweenSprints(
            @PathVariable UUID fromSprintId, 
            @PathVariable UUID toSprintId, 
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        SprintValidator.validateSprintId(fromSprintId);
        SprintValidator.validateSprintId(toSprintId);
        
        sprintsService.moveTasksToSprint(fromSprintId, toSprintId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }
    
    //Move specific tasks by IDs
    @PutMapping("/move-specific-tasks-to-backlog")
    public ResponseEntity<ResponseDataAPI> moveSpecificTasksToBacklog(
            @RequestBody Map<String, Object> request,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        
        @SuppressWarnings("unchecked")
        List<String> taskIdStrings = (List<String>) request.get("taskIds");
        
        if (taskIdStrings == null || taskIdStrings.isEmpty()) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Task IDs are required"));
        }
        
        try {
            List<UUID> taskIds = taskIdStrings.stream()
                .map(UUID::fromString)
                .toList();
            
            sprintsService.moveSpecificTasksToBacklog(taskIds);
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
            
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Invalid task ID format"));
        }
    }
    
    @PutMapping("/move-specific-tasks-to-sprint/{toSprintId}")
    public ResponseEntity<ResponseDataAPI> moveSpecificTasksToSprint(
            @PathVariable UUID toSprintId,
            @RequestBody Map<String, Object> request,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        
        SprintValidator.validateSprintId(toSprintId);
        
        @SuppressWarnings("unchecked")
        List<String> taskIdStrings = (List<String>) request.get("taskIds");
        
        if (taskIdStrings == null || taskIdStrings.isEmpty()) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Task IDs are required"));
        }
        
        try {
            List<UUID> taskIds = taskIdStrings.stream()
                .map(UUID::fromString)
                .toList();
            
            sprintsService.moveSpecificTasksToSprint(taskIds, toSprintId);
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
            
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Invalid task ID format"));
        }
    }
}
