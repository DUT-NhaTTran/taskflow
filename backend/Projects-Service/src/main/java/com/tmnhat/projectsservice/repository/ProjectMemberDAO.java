package com.tmnhat.projectsservice.repository;

import com.tmnhat.projectsservice.mapper.ProjectMapper;
import com.tmnhat.projectsservice.model.Projects;
import com.tmnhat.projectsservice.model.Users;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Repository
public class ProjectMemberDAO extends BaseDAO {

    public void assignMember(UUID projectId, UUID userId, String role) throws SQLException {
        String sql = "INSERT INTO project_members (project_id, user_id, role_in_project, joined_at) " +
                     "VALUES (?, ?, ?, NOW())";
        executeUpdate(sql, stmt -> {
            stmt.setObject(1, projectId);
            stmt.setObject(2, userId);
            stmt.setString(3, role);
        });
    }

    public void removeMember(UUID projectId, UUID userId) throws SQLException {
        String sql = "DELETE FROM project_members WHERE project_id = ? AND user_id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setObject(1, projectId);
            stmt.setObject(2, userId);
        });
    }

    public void changeProjectOwner(UUID projectId, UUID newOwnerId) throws SQLException {
        String sql = "UPDATE projects SET owner_id = ? WHERE id = ? AND deleted_at IS NULL";
        executeUpdate(sql, stmt -> {
            stmt.setObject(1, newOwnerId);
            stmt.setObject(2, projectId);
        });
    }

    public List<Users> getProjectUsers(UUID projectId) throws SQLException {
        String sql = "SELECT u.id, u.username, u.email, u.avatar, pm.role_in_project " +
                     "FROM project_members pm " +
                     "JOIN users u ON pm.user_id = u.id " +
                     "WHERE pm.project_id = ?";

        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            List<Users> users = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();

            while (rs.next()) {
                Users user = new Users();
                user.setId(UUID.fromString(rs.getString("id")));
                user.setUsername(rs.getString("username"));
                user.setEmail(rs.getString("email"));
                user.setAvatar(rs.getString("avatar"));
                user.setRoleInProject(rs.getString("role_in_project")); // đúng với tên cột trong DB
                users.add(user);
            }

            return users;
        });
    }

    public List<Projects> filterProjectsByStatus(String status) throws SQLException {
        boolean isArchived = "archived".equalsIgnoreCase(status);
        String sql = "SELECT * FROM projects WHERE is_archived = ? AND deleted_at IS NULL";
        return executeQuery(sql, stmt -> {
            stmt.setBoolean(1, isArchived);
            List<Projects> projects = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                projects.add(ProjectMapper.mapResultSetToProject(rs));
            }
            return projects;
        });
    }

    public boolean canUpdateMemberRoles(UUID projectId, UUID userId) throws SQLException {
        // Check if user is SCRUM_MASTER or PRODUCT_OWNER
        String roleSql = "SELECT 1 FROM project_members " +
                         "WHERE project_id = ? AND user_id = ? AND role_in_project IN ('SCRUM_MASTER', 'PRODUCT_OWNER')";
        
        boolean hasManagerRole = executeQuery(roleSql, stmt -> {
            stmt.setObject(1, projectId);
            stmt.setObject(2, userId);
            ResultSet rs = stmt.executeQuery();
            return rs.next();
        });
    
        if (hasManagerRole) {
            return true;
        }
    
        // Check if user is project owner
        String ownerSql = "SELECT 1 FROM projects " +
                         "WHERE id = ? AND owner_id = ? AND deleted_at IS NULL";
    
        boolean isProjectOwner = executeQuery(ownerSql, stmt -> {
            stmt.setObject(1, projectId);
            stmt.setObject(2, userId);
            ResultSet rs = stmt.executeQuery();
            return rs.next();
        });
    
        return isProjectOwner;
    }
    

    public boolean isProjectLead(UUID projectId, UUID userId) throws SQLException {
        String sql = "SELECT 1 FROM project_members " +
                     "WHERE project_id = ? AND user_id = ? AND role_in_project = 'PROJECT_LEAD'";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            stmt.setObject(2, userId);
            ResultSet rs = stmt.executeQuery();
            return rs.next();
        });
    }

    public void updateMemberRole(UUID projectId, UUID userId, String newRole, UUID requesterId) throws SQLException {
        if (!canUpdateMemberRoles(projectId, requesterId)) {
            throw new SecurityException("Only project owner or scrum master can update roles");
        }

        String sql = "UPDATE project_members SET role_in_project = ? WHERE project_id = ? AND user_id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setString(1, newRole);
            stmt.setObject(2, projectId);
            stmt.setObject(3, userId);
        });
    }

    public String getRoleInProject(UUID projectId, UUID userId) throws SQLException {
        String sql = "SELECT role_in_project FROM project_members WHERE project_id = ? AND user_id = ?";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            stmt.setObject(2, userId);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return rs.getString("role_in_project");
            }
            return null;
        });
    }

    public UUID getManagerId(UUID projectId) throws SQLException {
        String sql = """
            SELECT user_id 
            FROM project_members 
            WHERE project_id = ? AND role_in_project IN ('SCRUM_MASTER', 'PRODUCT_OWNER') 
            LIMIT 1
        """;
    
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return UUID.fromString(rs.getString("user_id"));
            }
            return null;
        });
    }
    
}
