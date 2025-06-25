package com.tmnhat.projectsservice.controller;


import com.tmnhat.common.config.WebConfig;
import com.tmnhat.common.payload.ResponseDataAPI;
import com.tmnhat.projectsservice.model.ProjectMembers;
import com.tmnhat.projectsservice.model.Projects;
import com.tmnhat.projectsservice.model.Users;
import com.tmnhat.projectsservice.service.ProjectService;
import com.tmnhat.projectsservice.service.Impl.ProjectServiceImpl;
import com.tmnhat.projectsservice.validation.ProjectValidator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Import(WebConfig.class)
@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    @Autowired
    private ProjectService projectService;

    @GetMapping("/search")
    public ResponseEntity<?> searchProjects(@RequestParam String keyword) {
        List<Projects> results = projectService.searchProjects(keyword);
        return ResponseEntity.ok(Map.of("data", results));
    }

    @GetMapping("/search/member")
    public ResponseEntity<?> searchProjectsByUserMembership(
            @RequestParam String keyword, 
            @RequestParam UUID userId,
            @RequestParam(required = false, defaultValue = "false") boolean includeDeleted) {
        List<Projects> results;
        if (includeDeleted) {
            results = projectService.searchProjectsByUserMembershipIncludeDeleted(keyword, userId);
        } else {
            results = projectService.searchProjectsByUserMembership(keyword, userId);
        }
        return ResponseEntity.ok(Map.of("data", results));
    }

    @GetMapping("/filter")
    public ResponseEntity<?> filterProjectsByType(@RequestParam String projectType) {
        List<Projects> results = projectService.filterProjectsByType(projectType);
        return ResponseEntity.ok(Map.of("data", results));
    }

    @GetMapping("/paginate")
    public ResponseEntity<?> paginateProjects(@RequestParam int page, @RequestParam int size) {
        List<Projects> results = projectService.paginateProjects(page, size);
        return ResponseEntity.ok(Map.of("data", results));
    }

    @PostMapping
    public ResponseEntity<ResponseDataAPI> addProject(@RequestBody Projects projects) {
        ProjectValidator.validateProject(projects);
        UUID projectId = projectService.addProjectReturnId(projects);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(Collections.singletonMap("id", projectId)));
    }

    @GetMapping
    public ResponseEntity<ResponseDataAPI> getAllProjects() {
        List<Projects> projectList = projectService.getAllProjects();
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(projectList));
    }

    @GetMapping("/member/{userId}")
    public ResponseEntity<ResponseDataAPI> getAllProjectsByUserMembership(@PathVariable UUID userId) {
        ProjectValidator.validateUserId(userId);
        List<Projects> projectList = projectService.getAllProjectsByUserMembership(userId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(projectList));
    }

    @GetMapping("/{projectId}/users")
    public ResponseEntity<ResponseDataAPI> getProjectUsers(@PathVariable UUID projectId) {
        ProjectValidator.validateProjectId(projectId);
        List<Users> users = projectService.getProjectUsers(projectId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(users));
    }

    @GetMapping("/{projectId}/members")
    public ResponseEntity<ResponseDataAPI> getProjectMembers(@PathVariable UUID projectId) {
        ProjectValidator.validateProjectId(projectId);
        List<Users> users = projectService.getProjectUsers(projectId);
        Map<String, Object> result = new HashMap<>();
        result.put("members", users);
        result.put("memberCount", users.size());
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(result));
    }

    @GetMapping("/latest")
    public ResponseEntity<?> getLatestProjectByOwner(@RequestParam("ownerId") UUID ownerId) {
        Projects latestProject = projectService.getLatestProjectByOwnerId(ownerId);
        if (latestProject != null) {
            return ResponseEntity.ok(Map.of("projectId", latestProject.getId()));
        } else {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("No project found for this user.");
        }
    }

    @GetMapping("/owner/{ownerId}")
    public ResponseEntity<ResponseDataAPI> getAllProjectsByOwner(@PathVariable UUID ownerId) {
        ProjectValidator.validateUserId(ownerId);
        List<Projects> projectList = projectService.getAllProjectsByOwnerId(ownerId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(projectList));
    }

    @GetMapping("/last-inserted-id")
    public ResponseEntity<ResponseDataAPI> getLastInsertedProjectId() {
        try {
            UUID lastId = projectService.getLastInsertedProjectId();
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(lastId));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error(e.getMessage()));
        }
    }

    @GetMapping("/{id:[0-9a-fA-F\\-]{36}}")
    public ResponseEntity<ResponseDataAPI> getProjectById(
            @PathVariable UUID id,
            @RequestParam(required = false, defaultValue = "false") boolean includeDeleted) {
        ProjectValidator.validateProjectId(id);
        Projects projects;
        
        if (includeDeleted) {
            // Use the method that includes deleted projects
            try {
                projects = projectService.getProjectByIdIncludeDeleted(id);
            } catch (Exception e) {
                return ResponseEntity.status(404).body(ResponseDataAPI.error("Project not found"));
            }
        } else {
            // Use the regular method that excludes deleted projects
            projects = projectService.getProjectById(id);
        }
        
        if (projects == null) {
            return ResponseEntity.status(404).body(ResponseDataAPI.error("Project not found"));
        }
        
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(projects));
    }

    @PatchMapping("/{id:[0-9a-fA-F\\-]{36}}")
    public ResponseEntity<ResponseDataAPI> updateProject(@PathVariable UUID id, @RequestBody Projects projects) {
        ProjectValidator.validateProjectId(id);
        ProjectValidator.validateProject(projects);
        projectService.updateProject(id, projects);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    @DeleteMapping("/{id:[0-9a-fA-F\\-]{36}}")
    public ResponseEntity<ResponseDataAPI> deleteProject(@PathVariable UUID id) {
        ProjectValidator.validateProjectId(id);
        projectService.deleteProject(id);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    @PatchMapping("/{id:[0-9a-fA-F\\-]{36}}/archive")
    public ResponseEntity<ResponseDataAPI> archiveProject(@PathVariable UUID id) {
        projectService.archiveProject(id);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    @PatchMapping("/{id:[0-9a-fA-F\\-]{36}}/reactivate")
    public ResponseEntity<ResponseDataAPI> reactivateProject(@PathVariable UUID id) {
        projectService.reactivateProject(id);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    @GetMapping("/archived")
    public ResponseEntity<ResponseDataAPI> getArchivedProjects() {
        List<Projects> projects = projectService.getArchivedProjects();
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(projects));
    }

    @GetMapping("/archived/recent")
    public ResponseEntity<ResponseDataAPI> getRecentArchivedProjects(
            @RequestParam(defaultValue = "2") int limit) {
        List<Projects> projects = projectService.getRecentArchivedProjects(limit);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(projects));
    }

    @GetMapping("/active")
    public ResponseEntity<ResponseDataAPI> getActiveProjects() {
        List<Projects> projects = projectService.getActiveProjects();
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(projects));
    }

    @GetMapping("/archived/membership/{userId:[0-9a-fA-F\\-]{36}}")
    public ResponseEntity<ResponseDataAPI> getArchivedProjectsByUserMembership(@PathVariable UUID userId) {
        List<Projects> projects = projectService.getArchivedProjectsByUserMembership(userId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(projects));
    }

    @PostMapping("/{projectId}/members")
    public ResponseEntity<ResponseDataAPI> addProjectMember(
            @PathVariable UUID projectId,
            @RequestBody ProjectMembers member) {
        member.setProjectId(projectId);
        projectService.assignMember(member);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    @DeleteMapping("/{projectId}/members")
    public ResponseEntity<ResponseDataAPI> removeProjectMember(
            @PathVariable UUID projectId,
            @RequestParam UUID userId) {
        projectService.removeMember(projectId, userId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    @PatchMapping("/{projectId}/members/role")
    public ResponseEntity<ResponseDataAPI> updateMemberRole(
            @PathVariable UUID projectId,
            @RequestBody ProjectMembers member) {
        member.setProjectId(projectId);
        projectService.updateMemberRole(member);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    @GetMapping("/{projectId}/members/{userId}/role")
    public ResponseEntity<ResponseDataAPI> getMemberRoleInProject(
            @PathVariable UUID projectId,
            @PathVariable UUID userId) {
        String role = projectService.getRoleInProject(projectId, userId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(role));
    }

    @GetMapping("/{projectId}/manager_id")
    public ResponseEntity<ResponseDataAPI> getScrumMasterId(@PathVariable UUID projectId) {
        ProjectValidator.validateProjectId(projectId);
        UUID scrumMasterId = projectService.getManagerId(projectId);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(scrumMasterId));
    }

    @GetMapping("/{projectId}/members/{userId}/permissions")
    public ResponseEntity<ResponseDataAPI> checkUserPermissions(
            @PathVariable UUID projectId,
            @PathVariable UUID userId) {
        try {
            String role = projectService.getRoleInProject(projectId, userId);
            
            if (role == null) {
                return ResponseEntity.ok(ResponseDataAPI.error("User not found in project"));
            }
    
            boolean isOwner = "PRODUCT_OWNER".equalsIgnoreCase(role);
            boolean isScrumMaster = "SCRUM_MASTER".equalsIgnoreCase(role);
    
            Map<String, Object> permissions = new HashMap<>();
            permissions.put("userId", userId);
            permissions.put("projectId", projectId);
            permissions.put("role", role);
            permissions.put("isOwner", isOwner);
            permissions.put("isScrumMaster", isScrumMaster);
            permissions.put("canManageProject", isOwner);
            permissions.put("canManageMembers", isOwner || isScrumMaster);
            permissions.put("canCreateSprint", isOwner || isScrumMaster);
            permissions.put("canManageSprints", isOwner || isScrumMaster);
            permissions.put("canManageAnyTask", isOwner || isScrumMaster);
            permissions.put("canAssignTasks", isOwner || isScrumMaster);
            permissions.put("canViewReports", isOwner || isScrumMaster);
            permissions.put("canTrainAI", isOwner || isScrumMaster);
    
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(permissions));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(ResponseDataAPI.error("Error checking permissions: " + e.getMessage()));
        }
    }
    

    @PutMapping("/{id:[0-9a-fA-F\\-]{36}}/soft-delete")
    public ResponseEntity<ResponseDataAPI> softDeleteProject(@PathVariable UUID id) {
        ProjectValidator.validateProjectId(id);
        projectService.softDeleteProject(id);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    @PutMapping("/{id:[0-9a-fA-F\\-]{36}}/restore")
    public ResponseEntity<ResponseDataAPI> restoreProject(@PathVariable UUID id) {
        ProjectValidator.validateProjectId(id);
        projectService.restoreProject(id);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    @DeleteMapping("/{id:[0-9a-fA-F\\-]{36}}/permanent")
    public ResponseEntity<ResponseDataAPI> permanentDeleteProject(@PathVariable UUID id) {
        ProjectValidator.validateProjectId(id);
        projectService.permanentDeleteProject(id);
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

}
