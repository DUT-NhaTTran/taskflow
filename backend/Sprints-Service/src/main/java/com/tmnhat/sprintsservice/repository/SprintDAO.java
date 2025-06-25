package com.tmnhat.sprintsservice.repository;

import com.tmnhat.sprintsservice.model.Sprints;
import com.tmnhat.sprintsservice.payload.enums.SprintStatus;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.Map;
import java.util.HashMap;

public class SprintDAO extends BaseDAO {

    public void addSprint(Sprints sprint) throws SQLException {
        String sql = "INSERT INTO sprints (project_id, name, start_date, end_date, goal, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        executeUpdate(sql, stmt -> {
            stmt.setObject(1, sprint.getProjectId());
            stmt.setString(2, sprint.getName());
            stmt.setTimestamp(3, sprint.getStartDate() != null ? Timestamp.valueOf(sprint.getStartDate().atStartOfDay()) : null);
            stmt.setTimestamp(4, sprint.getEndDate() != null ? Timestamp.valueOf(sprint.getEndDate().atStartOfDay()) : null);
            stmt.setString(5, sprint.getGoal());
            stmt.setString(6, sprint.getStatus() != null ? sprint.getStatus().name() : SprintStatus.NOT_STARTED.name());
            stmt.setTimestamp(7, sprint.getCreatedAt() != null ? Timestamp.valueOf(sprint.getCreatedAt()) : Timestamp.valueOf(java.time.LocalDateTime.now()));
            stmt.setTimestamp(8, sprint.getUpdatedAt() != null ? Timestamp.valueOf(sprint.getUpdatedAt()) : Timestamp.valueOf(java.time.LocalDateTime.now()));
        });
    }

    public void updateSprint(UUID id, Sprints sprint) throws SQLException {
        String sql = "UPDATE sprints SET name = ?, start_date = ?, end_date = ?, goal = ?, updated_at = ? WHERE id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setString(1, sprint.getName());
            stmt.setTimestamp(2, sprint.getStartDate() != null ? Timestamp.valueOf(sprint.getStartDate().atStartOfDay()) : null);
            stmt.setTimestamp(3, sprint.getEndDate() != null ? Timestamp.valueOf(sprint.getEndDate().atStartOfDay()) : null);
            stmt.setString(4, sprint.getGoal());
            stmt.setTimestamp(5, Timestamp.valueOf(java.time.LocalDateTime.now()));
            stmt.setObject(6, id);
        });
    }

    public void deleteSprint(UUID id) throws SQLException {
        String sql = "UPDATE sprints SET deleted_at = NOW() WHERE id = ?";
        executeUpdate(sql, stmt -> stmt.setObject(1, id));
    }

    public Sprints getSprintById(UUID id) throws SQLException {
        String sql = "SELECT * FROM sprints WHERE id = ? AND deleted_at IS NULL";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, id);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return mapResultSetToSprint(rs);
            }
            return null;
        });
    }

    public List<Sprints> getAllSprints() throws SQLException {
        String sql = "SELECT * FROM sprints WHERE deleted_at IS NULL";
        return executeQuery(sql, stmt -> {
            List<Sprints> sprintList = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                sprintList.add(mapResultSetToSprint(rs));
            }
            return sprintList;
        });
    }

    // Bổ sung: Update Status + Start/End Date
    public void updateSprintStatusAndDates(UUID sprintId, SprintStatus status, LocalDate startDate, LocalDate endDate) throws SQLException {
        String sql = "UPDATE sprints SET status = ?, start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date), updated_at = ? WHERE id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setString(1, status.name());
            stmt.setTimestamp(2, startDate != null ? Timestamp.valueOf(startDate.atStartOfDay()) : null);
            stmt.setTimestamp(3, endDate != null ? Timestamp.valueOf(endDate.atStartOfDay()) : null);
            stmt.setTimestamp(4, Timestamp.valueOf(java.time.LocalDateTime.now()));
            stmt.setObject(5, sprintId);
        });
    }

    // Bổ sung: Chỉ Update Status
    public void updateSprintStatus(UUID sprintId, SprintStatus status) throws SQLException {
        String sql = "UPDATE sprints SET status = ?, updated_at = ? WHERE id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setString(1, status.name());
            stmt.setTimestamp(2, Timestamp.valueOf(java.time.LocalDateTime.now()));
            stmt.setObject(3, sprintId);
        });
    }

    //Bổ sung: Lấy Sprint đang active của Project
    public Sprints getActiveSprintByProject(UUID projectId) throws SQLException {
        String sql = "SELECT * FROM sprints WHERE project_id = ? AND status = ? AND deleted_at IS NULL";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            stmt.setString(2, SprintStatus.ACTIVE.name());
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return mapResultSetToSprint(rs);
            }
            return null;
        });
    }

    //Bổ sung: Chuyển task chưa xong sang sprint mới (future)
    public void moveIncompleteTasks(UUID fromSprintId, UUID toSprintId) throws SQLException {
        String sql = "UPDATE tasks SET sprint_id = ? WHERE sprint_id = ? AND status != 'DONE'";
        executeUpdate(sql, stmt -> {
            stmt.setObject(1, toSprintId);
            stmt.setObject(2, fromSprintId);
        });
    }

    //Cập nhật mapResultSetToSprint để hỗ trợ status, createdAt, updatedAt, deletedAt
    private Sprints mapResultSetToSprint(ResultSet rs) throws SQLException {
        return new Sprints.Builder()
                .id(rs.getObject("id", UUID.class))
                .projectId(rs.getObject("project_id", UUID.class))
                .name(rs.getString("name"))
                .startDate(rs.getTimestamp("start_date") != null ? rs.getTimestamp("start_date").toLocalDateTime().toLocalDate() : null)
                .endDate(rs.getTimestamp("end_date") != null ? rs.getTimestamp("end_date").toLocalDateTime().toLocalDate() : null)
                .goal(rs.getString("goal"))
                .status(SprintStatus.valueOf(rs.getString("status")))
                .createdAt(rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toLocalDateTime() : null)
                .updatedAt(rs.getTimestamp("updated_at") != null ? rs.getTimestamp("updated_at").toLocalDateTime() : null)
                .deletedAt(rs.getTimestamp("deleted_at") != null ? rs.getTimestamp("deleted_at").toLocalDateTime() : null)
                .build();
    }

    public Sprints getLastSprintByProject(UUID projectId) throws SQLException {
        String sql = "SELECT * FROM sprints WHERE project_id = ? AND deleted_at IS NULL ORDER BY end_date DESC LIMIT 1";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return mapResultSetToSprint(rs);
            }
            return null;
        });
    }

    public List<Sprints> getSprintsByProject(UUID projectId) throws SQLException {
        String sql = "SELECT * FROM sprints WHERE project_id = ? AND deleted_at IS NULL AND status NOT IN ('DELETED', 'CANCELLED') ORDER BY created_at ASC";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            List<Sprints> list = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                list.add(mapResultSetToSprint(rs));
            }
            return list;
        });
    }

    // Calendar Filter Methods
    public List<Sprints> getFilteredSprintsForCalendar(UUID projectId, String search, 
                                                      List<String> assigneeIds, List<String> statuses, 
                                                      String startDate, String endDate) throws SQLException {
        StringBuilder sql = new StringBuilder("SELECT * FROM sprints WHERE project_id = ? AND deleted_at IS NULL AND status NOT IN ('DELETED', 'CANCELLED')");
        
        List<Object> params = new ArrayList<>();
        params.add(projectId);
        
        // Search filter
        if (search != null && !search.trim().isEmpty()) {
            sql.append(" AND (name ILIKE ? OR goal ILIKE ?)");
            String searchPattern = "%" + search.trim() + "%";
            params.add(searchPattern);
            params.add(searchPattern);
        }
        
        // Status filter
        if (statuses != null && !statuses.isEmpty()) {
            sql.append(" AND status IN (");
            for (int i = 0; i < statuses.size(); i++) {
                if (i > 0) sql.append(", ");
                sql.append("?");
                params.add(statuses.get(i));
            }
            sql.append(")");
        }
        
        // Date range filter
        if (startDate != null && !startDate.trim().isEmpty()) {
            sql.append(" AND (start_date >= ? OR end_date >= ?)");
            params.add(startDate);
            params.add(startDate);
        }
        
        if (endDate != null && !endDate.trim().isEmpty()) {
            sql.append(" AND (start_date <= ? OR end_date <= ?)");
            params.add(endDate);
            params.add(endDate);
        }
        
        sql.append(" ORDER BY start_date DESC");
        
        return executeQuery(sql.toString(), stmt -> {
            for (int i = 0; i < params.size(); i++) {
                stmt.setObject(i + 1, params.get(i));
            }
            List<Sprints> sprints = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                sprints.add(mapResultSetToSprint(rs));
            }
            return sprints;
        });
    }

    public List<Map<String, Object>> getSprintAssignees(UUID projectId) throws SQLException {

        return new ArrayList<>();
    }

    public List<String> getSprintStatuses(UUID projectId) throws SQLException {
        String sql = "SELECT DISTINCT status FROM sprints WHERE project_id = ? AND deleted_at IS NULL AND status NOT IN ('DELETED', 'CANCELLED') ORDER BY status";
        
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            List<String> statuses = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                String status = rs.getString("status");
                if (status != null && !status.trim().isEmpty()) {
                    statuses.add(status);
                }
            }
            return statuses;
        });
    }

    //Soft delete methods
    public void cancelSprint(UUID sprintId) throws SQLException {
        String sql = "UPDATE sprints SET status = ?, updated_at = ? WHERE id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setString(1, SprintStatus.CANCELLED.name());
            stmt.setTimestamp(2, Timestamp.valueOf(java.time.LocalDateTime.now()));
            stmt.setObject(3, sprintId);
        });
    }
    
    public void softDeleteSprint(UUID sprintId) throws SQLException {
        String sql = "UPDATE sprints SET status = ?, deleted_at = ?, updated_at = ? WHERE id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setString(1, SprintStatus.DELETED.name());
            stmt.setTimestamp(2, Timestamp.valueOf(java.time.LocalDateTime.now()));
            stmt.setTimestamp(3, Timestamp.valueOf(java.time.LocalDateTime.now()));
            stmt.setObject(4, sprintId);
        });
    }
    
    public void restoreSprint(UUID sprintId) throws SQLException {
        String sql = "UPDATE sprints SET status = ?, deleted_at = NULL, updated_at = ? WHERE id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setString(1, SprintStatus.NOT_STARTED.name());
            stmt.setTimestamp(2, Timestamp.valueOf(java.time.LocalDateTime.now()));
            stmt.setObject(3, sprintId);
        });
    }
    
    // Audit queries
    public List<Sprints> getDeletedSprintsByProject(UUID projectId) throws SQLException {
        String sql = "SELECT * FROM sprints WHERE project_id = ? AND status = ? ORDER BY deleted_at DESC";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            stmt.setString(2, SprintStatus.DELETED.name());
            List<Sprints> list = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                list.add(mapResultSetToSprint(rs));
            }
            return list;
        });
    }
    
    public List<Sprints> getCancelledSprintsByProject(UUID projectId) throws SQLException {
        String sql = "SELECT * FROM sprints WHERE project_id = ? AND status = ? ORDER BY updated_at DESC";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            stmt.setString(2, SprintStatus.CANCELLED.name());
            List<Sprints> list = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                list.add(mapResultSetToSprint(rs));
            }
            return list;
        });
    }
    
    // Task migration support
    public List<Map<String, Object>> getIncompleteTasksFromSprint(UUID sprintId) throws SQLException {
        String sql = "SELECT id, title, status, story_point, assignee_id FROM tasks WHERE sprint_id = ? AND status != 'DONE' AND deleted_at IS NULL";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, sprintId);
            List<Map<String, Object>> tasks = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                Map<String, Object> task = new HashMap<>();
                task.put("id", rs.getObject("id", UUID.class));
                task.put("title", rs.getString("title"));
                task.put("status", rs.getString("status"));
                task.put("storyPoint", rs.getInt("story_point"));
                task.put("assigneeId", rs.getObject("assignee_id", UUID.class));
                tasks.add(task);
            }
            return tasks;
        });
    }
    
    public void moveTasksToBacklog(UUID sprintId) throws SQLException {
        String sql = "UPDATE tasks SET sprint_id = NULL, updated_at = ? WHERE sprint_id = ? AND status != 'DONE' AND deleted_at IS NULL";
        executeUpdate(sql, stmt -> {
            stmt.setTimestamp(1, Timestamp.valueOf(java.time.LocalDateTime.now()));
            stmt.setObject(2, sprintId);
        });
    }
    
    public void moveTasksToSprint(UUID fromSprintId, UUID toSprintId) throws SQLException {
        String sql = "UPDATE tasks SET sprint_id = ?, updated_at = ? WHERE sprint_id = ? AND status != 'DONE' AND deleted_at IS NULL";
        executeUpdate(sql, stmt -> {
            stmt.setObject(1, toSprintId);
            stmt.setTimestamp(2, Timestamp.valueOf(java.time.LocalDateTime.now()));
            stmt.setObject(3, fromSprintId);
        });
    }

    // ✅ NEW: Move specific tasks by IDs to backlog
    public void moveSpecificTasksToBacklog(List<UUID> taskIds) throws SQLException {
        if (taskIds == null || taskIds.isEmpty()) {
            return;
        }
        
        StringBuilder sql = new StringBuilder("UPDATE tasks SET sprint_id = NULL, updated_at = ? WHERE id IN (");
        for (int i = 0; i < taskIds.size(); i++) {
            if (i > 0) sql.append(", ");
            sql.append("?");
        }
        sql.append(") AND deleted_at IS NULL");
        
        executeUpdate(sql.toString(), stmt -> {
            stmt.setTimestamp(1, Timestamp.valueOf(java.time.LocalDateTime.now()));
            for (int i = 0; i < taskIds.size(); i++) {
                stmt.setObject(i + 2, taskIds.get(i));
            }
        });
    }
    
    // ✅ NEW: Move specific tasks by IDs to another sprint
    public void moveSpecificTasksToSprint(List<UUID> taskIds, UUID toSprintId) throws SQLException {
        if (taskIds == null || taskIds.isEmpty()) {
            return;
        }
        
        StringBuilder sql = new StringBuilder("UPDATE tasks SET sprint_id = ?, updated_at = ? WHERE id IN (");
        for (int i = 0; i < taskIds.size(); i++) {
            if (i > 0) sql.append(", ");
            sql.append("?");
        }
        sql.append(") AND deleted_at IS NULL");
        
        executeUpdate(sql.toString(), stmt -> {
            stmt.setObject(1, toSprintId);
            stmt.setTimestamp(2, Timestamp.valueOf(java.time.LocalDateTime.now()));
            for (int i = 0; i < taskIds.size(); i++) {
                stmt.setObject(i + 3, taskIds.get(i));
            }
        });
    }

}
