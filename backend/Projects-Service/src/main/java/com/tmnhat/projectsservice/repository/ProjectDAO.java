package com.tmnhat.projectsservice.repository;

import com.tmnhat.projectsservice.model.Projects;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.time.LocalDateTime;

@Repository
public class ProjectDAO extends BaseDAO {

    public void addProject(Projects project) throws SQLException {
        String sql = "INSERT INTO projects (name, description, owner_id, deadline, created_at, key, project_type, access, done_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        executeUpdate(sql, stmt -> {
            stmt.setString(1, project.getName());
            stmt.setString(2, project.getDescription());
            stmt.setObject(3, project.getOwnerId());

            LocalDateTime now = LocalDateTime.now();
            stmt.setTimestamp(4, project.getDeadline() != null ? Timestamp.valueOf(project.getDeadline().atStartOfDay()) : Timestamp.valueOf(now));
            stmt.setTimestamp(5, project.getCreatedAt() != null ? Timestamp.valueOf(project.getCreatedAt()) : Timestamp.valueOf(now));

            stmt.setString(6, project.getKey());
            stmt.setString(7, project.getProjectType());
            stmt.setString(8, project.getAccess());
            stmt.setTimestamp(9, project.getDoneAt() != null ? Timestamp.valueOf(project.getDoneAt()) : null);
        });
    }

    public void updateProject(UUID id, Projects project) throws SQLException {
        String sql = "UPDATE projects SET name = ?, description = ?, owner_id = ?, deadline = ?, key = ?, project_type = ?, access = ?, done_at = ? WHERE id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setString(1, project.getName());
            stmt.setString(2, project.getDescription());
            stmt.setObject(3, project.getOwnerId());

            LocalDateTime now = LocalDateTime.now();
            stmt.setTimestamp(4, project.getDeadline() != null ? Timestamp.valueOf(project.getDeadline().atStartOfDay()) : Timestamp.valueOf(now));

            stmt.setString(5, project.getKey());
            stmt.setString(6, project.getProjectType());
            stmt.setString(7, project.getAccess());
            stmt.setTimestamp(8, project.getDoneAt() != null ? Timestamp.valueOf(project.getDoneAt()) : null);
            stmt.setObject(9, id);
        });
    }

    public void deleteProject(UUID id) throws SQLException {
        String sql = "UPDATE projects SET deleted_at = NOW() WHERE id = ?";
        executeUpdate(sql, stmt -> stmt.setObject(1, id));
    }

    public Projects getProjectById(UUID id) throws SQLException {
        String sql = "SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, id);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return mapResultSetToProject(rs);
            }
            return null;
        });
    }

    public List<Projects> getAllProjects() throws SQLException {
        String sql = "SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC";
        return executeQuery(sql, stmt -> {
            List<Projects> projects = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                projects.add(mapResultSetToProject(rs));
            }
            return projects;
        });
    }

    public List<Projects> searchProjects(String keyword) throws SQLException {
        String sql = "SELECT * FROM projects WHERE name ILIKE ? AND deleted_at IS NULL";
        return executeQuery(sql, stmt -> {
            stmt.setString(1, "%" + keyword + "%");
            List<Projects> projects = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                projects.add(mapResultSetToProject(rs));
            }
            return projects;
        });
    }

    public List<Projects> searchProjectsByUserMembership(String keyword, UUID userId) throws SQLException {
        String sql = "SELECT DISTINCT p.* FROM projects p " +
                     "INNER JOIN project_members pm ON p.id = pm.project_id " +
                     "WHERE pm.user_id = ? " +
                     "AND p.name ILIKE ? " +
                     "AND p.deleted_at IS NULL " +
                     "ORDER BY p.created_at DESC";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, userId);
            stmt.setString(2, "%" + keyword + "%");
            List<Projects> projects = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                projects.add(mapResultSetToProject(rs));
            }
            return projects;
        });
    }

    public void archiveProject(UUID projectId) throws SQLException {
        String sql = "UPDATE projects SET done_at = NOW() WHERE id = ?";
        executeUpdate(sql, stmt -> stmt.setObject(1, projectId));
    }

    public void reactivateProject(UUID projectId) throws SQLException {
        String sql = "UPDATE projects SET done_at = NULL WHERE id = ?";
        executeUpdate(sql, stmt -> stmt.setObject(1, projectId));
    }

    // Get archived projects (done_at IS NOT NULL)
    public List<Projects> getArchivedProjects() throws SQLException {
        String sql = "SELECT * FROM projects WHERE done_at IS NOT NULL AND deleted_at IS NULL ORDER BY done_at DESC";
        return executeQuery(sql, stmt -> {
            List<Projects> projects = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                projects.add(mapResultSetToProject(rs));
            }
            return projects;
        });
    }

    // Get recent archived projects for AI reference (limit 2)
    public List<Projects> getRecentArchivedProjects(int limit) throws SQLException {
        String sql = "SELECT * FROM projects WHERE done_at IS NOT NULL AND deleted_at IS NULL ORDER BY done_at DESC LIMIT ?";
        return executeQuery(sql, stmt -> {
            stmt.setInt(1, limit);
            List<Projects> projects = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                projects.add(mapResultSetToProject(rs));
            }
            return projects;
        });
    }

    // Get active projects (done_at IS NULL)
    public List<Projects> getActiveProjects() throws SQLException {
        String sql = "SELECT * FROM projects WHERE done_at IS NULL AND deleted_at IS NULL ORDER BY created_at DESC";
        return executeQuery(sql, stmt -> {
            List<Projects> projects = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                projects.add(mapResultSetToProject(rs));
            }
            return projects;
        });
    }

    // Get archived projects by user membership
    public List<Projects> getArchivedProjectsByUserMembership(UUID userId) throws SQLException {
        String sql = "SELECT DISTINCT p.* FROM projects p " +
                     "INNER JOIN project_members pm ON p.id = pm.project_id " +
                     "WHERE pm.user_id = ? " +
                     "AND p.done_at IS NOT NULL " +
                     "AND p.deleted_at IS NULL " +
                     "ORDER BY p.done_at DESC";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, userId);
            List<Projects> projects = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                projects.add(mapResultSetToProject(rs));
            }
            return projects;
        });
    }

    public List<Projects> paginateProjects(int page, int size) throws SQLException {
        int offset = (page - 1) * size;
        String sql = "SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?";
        return executeQuery(sql, stmt -> {
            stmt.setInt(1, size);
            stmt.setInt(2, offset);
            List<Projects> projects = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                projects.add(mapResultSetToProject(rs));
            }
            return projects;
        });
    }
    public List<Projects> filterProjectsByType(String projectType) throws SQLException {
        String sql = "SELECT * FROM projects WHERE LOWER(project_type) = LOWER(?) AND deleted_at IS NULL";
        return executeQuery(sql, stmt -> {
            stmt.setString(1, projectType);
            List<Projects> projects = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                projects.add(mapResultSetToProject(rs));
            }
            return projects;
        });
    }

    public List<Projects> getAllProjectsByUserMembership(UUID userId) throws SQLException {
        String sql = "SELECT DISTINCT p.* FROM projects p " +
                     "INNER JOIN project_members pm ON p.id = pm.project_id " +
                     "WHERE pm.user_id = ? " +
                     "AND p.deleted_at IS NULL " +
                     "ORDER BY p.created_at DESC";
        
        
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, userId);
            List<Projects> projects = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                Projects project = mapResultSetToProject(rs);
                projects.add(project);
            }
          
            return projects;
        });
    }

    private Projects mapResultSetToProject(ResultSet rs) throws SQLException {
        return new Projects.Builder()
                .id(rs.getObject("id", UUID.class))
                .name(rs.getString("name"))
                .description(rs.getString("description"))
                .ownerId(rs.getObject("owner_id", UUID.class))
                .deadline(rs.getTimestamp("deadline") != null ? rs.getTimestamp("deadline").toLocalDateTime().toLocalDate() : null)
                .createdAt(rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toLocalDateTime() : null)
                .key(rs.getString("key"))
                .projectType(rs.getString("project_type"))
                .access(rs.getString("access"))
                .doneAt(rs.getTimestamp("done_at") != null ? rs.getTimestamp("done_at").toLocalDateTime() : null)
                .deletedAt(rs.getTimestamp("deleted_at") != null ? rs.getTimestamp("deleted_at").toLocalDateTime() : null)
                .build();
    }
    public UUID getLastInsertedProjectId() throws SQLException {
        String sql = "SELECT id FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1";
        return executeQuery(sql, stmt -> {
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return rs.getObject("id", UUID.class);
            } else {
                throw new SQLException("No project found.");
            }
        });
    }
    public UUID addProjectReturnId(Projects project) throws SQLException {
        String sql = "INSERT INTO projects (name, description, owner_id, deadline, created_at, key, project_type, access, done_at) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id";
        return executeQuery(sql, stmt -> {
            stmt.setString(1, project.getName());
            stmt.setString(2, project.getDescription());
            stmt.setObject(3, project.getOwnerId());
            
            LocalDateTime now = LocalDateTime.now();
            stmt.setTimestamp(4, project.getDeadline() != null ? Timestamp.valueOf(project.getDeadline().atStartOfDay()) : Timestamp.valueOf(now));
            stmt.setTimestamp(5, project.getCreatedAt() != null ? Timestamp.valueOf(project.getCreatedAt()) : Timestamp.valueOf(now));
            
            stmt.setString(6, project.getKey());
            stmt.setString(7, project.getProjectType());
            stmt.setString(8, project.getAccess());
            stmt.setTimestamp(9, project.getDoneAt() != null ? Timestamp.valueOf(project.getDoneAt()) : null);

            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return rs.getObject("id", UUID.class);
            } else {
                throw new SQLException("No ID returned from insert.");
            }
        });
    }
    public Projects findLatestByOwnerId(UUID ownerId) throws SQLException {
        String sql = "SELECT * FROM projects WHERE owner_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1";

        return executeQuery(sql, stmt -> {
            stmt.setObject(1, ownerId);
            try (ResultSet rs = stmt.executeQuery()) {
                if (rs.next()) {
                    Projects project = new Projects();
                    project.setId((UUID) rs.getObject("id"));
                    project.setName(rs.getString("name"));
                    project.setDescription(rs.getString("description"));
                    project.setOwnerId((UUID) rs.getObject("owner_id"));
                    Timestamp deadlineTs = rs.getTimestamp("deadline");
                    if (deadlineTs != null) {
                        project.setDeadline(deadlineTs.toLocalDateTime().toLocalDate());
                    }
                    Timestamp createdAtTs = rs.getTimestamp("created_at");
                    if (createdAtTs != null) {
                        project.setCreatedAt(createdAtTs.toLocalDateTime());
                    }
                    project.setKey(rs.getString("key"));
                    project.setProjectType(rs.getString("project_type"));
                    project.setAccess(rs.getString("access"));
                    project.setDoneAt(rs.getTimestamp("done_at") != null ? rs.getTimestamp("done_at").toLocalDateTime() : null);
                    return project;
                } else {
                    return null;
                }
            }
        });
    }

    public List<Projects> findAllByOwnerId(UUID ownerId) throws SQLException {
        String sql = "SELECT * FROM projects WHERE owner_id = ? AND deleted_at IS NULL ORDER BY created_at DESC";
        
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, ownerId);
            List<Projects> projects = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                projects.add(mapResultSetToProject(rs));
            }
            return projects;
        });
    }

    // Soft delete methods
    public void softDeleteProject(UUID id) throws SQLException {
        String sql = "UPDATE projects SET deleted_at = NOW() WHERE id = ?";
        executeUpdate(sql, stmt -> stmt.setObject(1, id));
    }
    
    public void restoreProject(UUID id) throws SQLException {
        String sql = "UPDATE projects SET deleted_at = NULL WHERE id = ?";
        executeUpdate(sql, stmt -> stmt.setObject(1, id));
    }
    
    public void permanentDeleteProject(UUID id) throws SQLException {
        String sql = "DELETE FROM projects WHERE id = ?";
        executeUpdate(sql, stmt -> stmt.setObject(1, id));
    }
    
    public Projects getProjectByIdIncludeDeleted(UUID id) throws SQLException {
        String sql = "SELECT * FROM projects WHERE id = ?";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, id);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return mapResultSetToProject(rs);
            }
            return null;
        });
    }
    
    public List<Projects> searchProjectsByUserMembershipIncludeDeleted(String keyword, UUID userId) throws SQLException {
        String sql = "SELECT DISTINCT p.* FROM projects p " +
                     "INNER JOIN project_members pm ON p.id = pm.project_id " +
                     "WHERE pm.user_id = ? " +
                     "AND p.name ILIKE ? " +
                     "ORDER BY p.created_at DESC";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, userId);
            stmt.setString(2, "%" + keyword + "%");
            List<Projects> projects = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                projects.add(mapResultSetToProject(rs));
            }
            return projects;
        });
    }
}
