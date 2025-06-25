package com.tmnhat.projectsservice.service.Impl;

import com.tmnhat.common.exception.DatabaseException;
import com.tmnhat.common.exception.ResourceNotFoundException;
import com.tmnhat.projectsservice.model.ProjectMembers;
import com.tmnhat.projectsservice.model.Projects;
import com.tmnhat.projectsservice.model.Users;
import com.tmnhat.projectsservice.repository.ProjectDAO;
import com.tmnhat.projectsservice.repository.ProjectMemberDAO;
import com.tmnhat.projectsservice.service.ProjectService;
import com.tmnhat.projectsservice.validation.ProjectValidator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import java.util.Map;
import java.util.HashMap;

@Service
public class ProjectServiceImpl implements ProjectService {

    @Autowired
    private ProjectMemberDAO projectMemberDAO;
    
    @Autowired
    private ProjectDAO projectDAO;
    
    private RestTemplate restTemplate;

    @Override
    public void addProject(Projects project) {
        try {
            ProjectValidator.validateProject(project);
            // Projects are active by default (done_at = null)
            project.setDoneAt(null);
            projectDAO.addProject(project);
        } catch (Exception e) {
            throw new DatabaseException("Error adding project: " + e.getMessage());
        }
    }

    @Override
    public void updateProject(UUID id, Projects project) {
        try {
            ProjectValidator.validateProjectId(id);
            ProjectValidator.validateProject(project);
            Projects existingProject = projectDAO.getProjectById(id);
            if (existingProject == null) {
                throw new ResourceNotFoundException("Project not found with ID " + id);
            }
            projectDAO.updateProject(id, project);
        } catch (Exception e) {
            throw new DatabaseException("Error updating project: " + e.getMessage());
        }
    }

    @Override
    public void deleteProject(UUID id) {
        try {
            ProjectValidator.validateProjectId(id);
            Projects existingProject = projectDAO.getProjectById(id);
            if (existingProject == null) {
                throw new ResourceNotFoundException("Project not found with ID " + id);
            }
            projectDAO.deleteProject(id);
        } catch (Exception e) {
            throw new DatabaseException("Error deleting project: " + e.getMessage());
        }
    }

    @Override
    public Projects getProjectById(UUID id) {
        try {
            ProjectValidator.validateProjectId(id);
            Projects project = projectDAO.getProjectById(id);
            if (project == null) {
                throw new ResourceNotFoundException("Project not found with ID " + id);
            }
            return project;
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving project: " + e.getMessage());
        }
    }

    @Override
    public List<Projects> getAllProjects() {
        try {
            return projectDAO.getAllProjects();
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving projects: " + e.getMessage());
        }
    }

    @Override
    public List<Projects> getAllProjectsByUserMembership(UUID userId) {
        try {
            return projectDAO.getAllProjectsByUserMembership(userId);
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving projects by user membership: " + e.getMessage());
        }
    }
    
    @Override
    public void assignMember(UUID projectId, UUID userId, String roleInProject) {
        try {
            Projects project = projectDAO.getProjectById(projectId);
            if (project == null) {
                throw new ResourceNotFoundException("Project not found with ID " + projectId);
            }
            projectMemberDAO.assignMember(projectId, userId, roleInProject);
        } catch (Exception e) {
            throw new DatabaseException("Error assigning member: " + e.getMessage());
        }
    }
    
    @Override
    public void assignMember(ProjectMembers memberDTO) {
        try {
            projectMemberDAO.assignMember(memberDTO.getProjectId(), memberDTO.getUserId(), memberDTO.getRoleInProject());
        } catch (Exception e) {
            throw new DatabaseException("Error assigning member: " + e.getMessage());
        }
    }

    @Override
    public void removeMember(UUID projectId, UUID userId) {
        try {
            Projects project = projectDAO.getProjectById(projectId);
            if (project == null) {
                throw new ResourceNotFoundException("Project not found with ID " + projectId);
            }
            projectMemberDAO.removeMember(projectId, userId);
        } catch (Exception e) {
            throw new DatabaseException("Error removing member: " + e.getMessage());
        }
    }

    @Override
    public void changeProjectOwner(UUID projectId, UUID newOwnerId) {
        try {
            Projects project = projectDAO.getProjectById(projectId);
            if (project == null) {
                throw new ResourceNotFoundException("Project not found with ID " + projectId);
            }
            projectMemberDAO.changeProjectOwner(projectId, newOwnerId);
        } catch (Exception e) {
            throw new DatabaseException("Error changing project owner: " + e.getMessage());
        }
    }

    @Override
    public List<Projects> searchProjects(String keyword) {
        try {
            return projectDAO.searchProjects(keyword);
        } catch (Exception e) {
            throw new DatabaseException("Error searching projects: " + e.getMessage());
        }
    }

    @Override
    public List<Projects> searchProjectsByUserMembership(String keyword, UUID userId) {
        try {
            return projectDAO.searchProjectsByUserMembership(keyword, userId);
        } catch (Exception e) {
            throw new DatabaseException("Error searching projects by user membership: " + e.getMessage());
        }
    }

    @Override
    public List<Projects> filterProjectsByType(String projectType) {
        try {
            return projectDAO.filterProjectsByType(projectType);
        } catch (Exception e) {
            throw new DatabaseException("Error filtering projects by type: " + e.getMessage());
        }
    }

    @Override
    public void archiveProject(UUID projectId) {
        try {
            Projects project = projectDAO.getProjectById(projectId);
            if (project == null) {
                throw new ResourceNotFoundException("Project not found with ID " + projectId);
            }
            projectDAO.archiveProject(projectId);
        } catch (Exception e) {
            throw new DatabaseException("Error archiving project: " + e.getMessage());
        }
    }

    @Override
    public List<Projects> paginateProjects(int page, int size) {
        try {
            return projectDAO.paginateProjects(page, size);
        } catch (Exception e) {
            throw new DatabaseException("Error paginating projects: " + e.getMessage());
        }
    }

    @Override
    public UUID getLastInsertedProjectId() {
        try {
            return projectDAO.getLastInsertedProjectId();
        } catch (SQLException e) {
            System.err.println("Error getting last inserted project ID: " + e.getMessage());
            throw new RuntimeException("Could not fetch last inserted project ID", e);
        }
    }

    @Override
    public UUID addProjectReturnId(Projects project) {
        try {
            ProjectValidator.validateProject(project);
            // Projects are active by default (done_at = null)
            project.setDoneAt(null);
            UUID projectId = projectDAO.addProjectReturnId(project);
            return projectId;
        } catch (Exception e) {
            throw new DatabaseException("Error adding project with return ID: " + e.getMessage());
        }
    }

    @Override
    public Projects getLatestProjectByOwnerId(UUID ownerId) {
        try {
            return projectDAO.findLatestByOwnerId(ownerId);
        } catch (SQLException e) {
            throw new DatabaseException("Error retrieving latest project by owner: " + e.getMessage());
        }
    }

    @Override
    public List<Projects> getAllProjectsByOwnerId(UUID ownerId) {
        try {
            return projectDAO.findAllByOwnerId(ownerId);
        } catch (SQLException e) {
            throw new DatabaseException("Error retrieving projects by owner: " + e.getMessage());
        }
    }

    @Override
    public List<Users> getProjectUsers(UUID projectId) {
        try {
            // Validate the project ID
            ProjectValidator.validateProjectId(projectId);
            
            // Check if the project exists
            Projects project = projectDAO.getProjectById(projectId);
            if (project == null) {
                throw new ResourceNotFoundException("Project not found with ID " + projectId);
            }
            
            // Get users associated with the project
            return projectMemberDAO.getProjectUsers(projectId);
        } catch (SQLException e) {
            throw new DatabaseException("Error retrieving project users: " + e.getMessage());
        }
    }
    
    @Override
    public void updateMemberRole(ProjectMembers memberDTO) {
        try {
            Projects project = projectDAO.getProjectById(memberDTO.getProjectId());
            if (project == null) {
                throw new ResourceNotFoundException("Project not found with ID " + memberDTO.getProjectId());
            }
            
            projectMemberDAO.updateMemberRole(memberDTO.getProjectId(), 
                                            memberDTO.getUserId(), 
                                            memberDTO.getRoleInProject(), 
                                            project.getOwnerId()); // Use project owner as requester
        } catch (Exception e) {
            throw new DatabaseException("Error updating member role: " + e.getMessage());
        }
    }
    
    @Override
    public String getRoleInProject(UUID projectId, UUID userId) {
        try {
            return projectMemberDAO.getRoleInProject(projectId, userId);
        } catch (Exception e) {
            throw new DatabaseException("Error getting role in project: " + e.getMessage());
        }
    }

    @Override
    public UUID getManagerId(UUID projectId) {
        try {
            UUID managerId = projectMemberDAO.getManagerId(projectId);
            if (managerId == null) {
                throw new DatabaseException("No Scrum Master or Product Owner found for project " + projectId);
            }
            return managerId;
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving manager ID: " + e.getMessage());
        }
    }
    

    // ✅ NEW: Soft delete methods implementation
    @Override
    public void softDeleteProject(UUID id) {
        try {
            ProjectValidator.validateProjectId(id);
            Projects existingProject = projectDAO.getProjectById(id);
            if (existingProject == null) {
                throw new ResourceNotFoundException("Project not found with ID " + id);
            }
            projectDAO.softDeleteProject(id);
        } catch (Exception e) {
            throw new DatabaseException("Error soft deleting project: " + e.getMessage());
        }
    }
    
    @Override
    public void restoreProject(UUID id) {
        try {
            ProjectValidator.validateProjectId(id);
            // Check if project exists in deleted state
            Projects existingProject = projectDAO.getProjectByIdIncludeDeleted(id);
            if (existingProject == null) {
                throw new ResourceNotFoundException("Project not found with ID " + id);
            }
            
            // Restore the project
            projectDAO.restoreProject(id);
            System.out.println("✅ Project restored: " + existingProject.getName());
            
            // ✅ NEW: Also restore all associated tasks for this project
            try {
                restTemplate = new RestTemplate();
                String tasksServiceUrl = "http://localhost:8085/api/tasks/project/" + id + "/restore";
                
                // Set headers
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("X-User-Id", "SYSTEM"); // Use system user for restore operation
                
                HttpEntity<String> entity = new HttpEntity<>(headers);
                
                ResponseEntity<String> response = restTemplate.exchange(
                    tasksServiceUrl, 
                    HttpMethod.PUT, 
                    entity, 
                    String.class
                );
                
                if (response.getStatusCode().is2xxSuccessful()) {
                    System.out.println("✅ All tasks restored for project: " + id);
                } else {
                    System.out.println("⚠️ Warning: Failed to restore tasks for project " + id + 
                                     " - Status: " + response.getStatusCode());
                }
                
            } catch (Exception e) {
                // Don't fail the project restore if task restore fails
                System.err.println("⚠️ Warning: Failed to restore tasks for project " + id + ": " + e.getMessage());
                System.out.println("📝 Project was restored but tasks may need manual restoration");
            }
            
        } catch (Exception e) {
            throw new DatabaseException("Error restoring project: " + e.getMessage());
        }
    }
    
    @Override
    public void permanentDeleteProject(UUID id) {
        try {
            ProjectValidator.validateProjectId(id);
            // Check if project exists (including deleted ones)
            Projects existingProject = projectDAO.getProjectByIdIncludeDeleted(id);
            if (existingProject == null) {
                throw new ResourceNotFoundException("Project not found with ID " + id);
            }
            projectDAO.permanentDeleteProject(id);
        } catch (Exception e) {
            throw new DatabaseException("Error permanently deleting project: " + e.getMessage());
        }
    }
    
    @Override
    public Projects getProjectByIdIncludeDeleted(UUID id) {
        try {
            ProjectValidator.validateProjectId(id);
            Projects project = projectDAO.getProjectByIdIncludeDeleted(id);
            if (project == null) {
                throw new ResourceNotFoundException("Project not found with ID " + id);
            }
            return project;
        } catch (Exception e) {
            throw new DatabaseException("Error retrieving project including deleted: " + e.getMessage());
        }
    }
    
    @Override
    public List<Projects> searchProjectsByUserMembershipIncludeDeleted(String keyword, UUID userId) {
        try {
            return projectDAO.searchProjectsByUserMembershipIncludeDeleted(keyword, userId);
        } catch (Exception e) {
            throw new DatabaseException("Error searching projects by user membership including deleted: " + e.getMessage());
        }
    }

    @Override
    public void reactivateProject(UUID projectId) {
        try {
            Projects project = projectDAO.getProjectByIdIncludeDeleted(projectId);
            if (project == null) {
                throw new ResourceNotFoundException("Project not found with ID " + projectId);
            }
            projectDAO.reactivateProject(projectId);
        } catch (Exception e) {
            throw new DatabaseException("Error reactivating project: " + e.getMessage());
        }
    }

    @Override
    public List<Projects> getArchivedProjects() {
        try {
            return projectDAO.getArchivedProjects();
        } catch (Exception e) {
            throw new DatabaseException("Error getting archived projects: " + e.getMessage());
        }
    }

    @Override
    public List<Projects> getRecentArchivedProjects(int limit) {
        try {
            return projectDAO.getRecentArchivedProjects(limit);
        } catch (Exception e) {
            throw new DatabaseException("Error getting recent archived projects: " + e.getMessage());
        }
    }

    @Override
    public List<Projects> getActiveProjects() {
        try {
            return projectDAO.getActiveProjects();
        } catch (Exception e) {
            throw new DatabaseException("Error getting active projects: " + e.getMessage());
        }
    }

    @Override
    public List<Projects> getArchivedProjectsByUserMembership(UUID userId) {
        try {
            return projectDAO.getArchivedProjectsByUserMembership(userId);
        } catch (Exception e) {
            throw new DatabaseException("Error getting archived projects by user membership: " + e.getMessage());
        }
    }
}
