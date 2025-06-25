package com.tmnhat.tasksservice.repository;

import com.tmnhat.tasksservice.model.Tasks;
import com.tmnhat.tasksservice.payload.enums.TaskStatus;
import com.tmnhat.tasksservice.payload.enums.TaskTag;
import com.tmnhat.tasksservice.payload.enums.TaskPriority;
import org.springframework.web.multipart.MultipartFile;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.Map;
import java.util.HashMap;

public class TasksDAO extends BaseDAO {

    public void addTask(Tasks task) throws SQLException {
        String sql = "INSERT INTO tasks (sprint_id, project_id, title, description, status, story_point, assignee_id, created_by, due_date, created_at, completed_at, parent_task_id, label, priority, updated_at) " +
                     "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, now(), ?, ?, ?, ?, now())";

        executeUpdate(sql, stmt -> {
            stmt.setObject(1, task.getSprintId());
            stmt.setObject(2, task.getProjectId());
            stmt.setString(3, task.getTitle());
            stmt.setString(4, task.getDescription());
            stmt.setString(5, task.getStatus().name());
            stmt.setObject(6, task.getStoryPoint());
            stmt.setObject(7, task.getAssigneeId());
            stmt.setObject(8, task.getCreatedBy());
            stmt.setTimestamp(9, task.getDueDate() != null ? Timestamp.valueOf(task.getDueDate().atStartOfDay()) : null);
            stmt.setTimestamp(10, task.getCompletedAt() != null ? Timestamp.valueOf(task.getCompletedAt()) : null);
            stmt.setObject(11, task.getParentTaskId());
            stmt.setString(12, task.getLabel());
            stmt.setString(13, task.getPriority() != null ? task.getPriority().name() : TaskPriority.MEDIUM.name());
        });
    }

    public void updateTask(UUID id, Tasks task) throws SQLException {
        String sql = "UPDATE tasks SET title = ?, description = ?, status = ?, story_point = ?, assignee_id = ?, created_by = ?, due_date = ?, completed_at = ?, parent_task_id = ?, label = ?, priority = ?, updated_at = now() WHERE id = ?";
        
        executeUpdate(sql, stmt -> {
            stmt.setString(1, task.getTitle());
            stmt.setString(2, task.getDescription());
            stmt.setString(3, task.getStatus().name());
            stmt.setInt(4, task.getStoryPoint());
            stmt.setObject(5, task.getAssigneeId());
            stmt.setObject(6, task.getCreatedBy());
            stmt.setTimestamp(7, task.getDueDate() != null ? Timestamp.valueOf(task.getDueDate().atStartOfDay()) : null);
            stmt.setTimestamp(8, task.getCompletedAt() != null ? Timestamp.valueOf(task.getCompletedAt()) : null);
            stmt.setObject(9, task.getParentTaskId());
            stmt.setString(10, task.getLabel());
            stmt.setString(11, task.getPriority() != null ? task.getPriority().name() : TaskPriority.MEDIUM.name());
            stmt.setObject(12, id);
        });
    }

    public void deleteTask(UUID id) throws SQLException {
        String sql = "UPDATE tasks SET deleted_at = NOW() WHERE id = ?";
        executeUpdate(sql, stmt -> stmt.setObject(1, id));
    }

    public void restoreTask(UUID id) throws SQLException {
        String sql = "UPDATE tasks SET deleted_at = NULL WHERE id = ?";
        executeUpdate(sql, stmt -> stmt.setObject(1, id));
    }

    public void restoreTasksByProject(UUID projectId) throws SQLException {
        String sql = "UPDATE tasks SET deleted_at = NULL WHERE project_id = ? AND deleted_at IS NOT NULL";
        executeUpdate(sql, stmt -> stmt.setObject(1, projectId));
    }

    public List<Tasks> getDeletedTasksByProject(UUID projectId) throws SQLException {
        String sql = "SELECT * FROM tasks WHERE project_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            List<Tasks> tasks = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                tasks.add(mapResultSetToTask(rs));
            }
            return tasks;
        });
    }

    public Tasks getTaskByIdIncludeDeleted(UUID id) throws SQLException {
        String sql = "SELECT * FROM tasks WHERE id = ?";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, id);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return mapResultSetToTask(rs);
            }
            return null;
        });
    }

    public Tasks getTaskById(UUID id) throws SQLException {
        String sql = "SELECT * FROM tasks WHERE id = ? AND deleted_at IS NULL";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, id);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return mapResultSetToTask(rs);
            }
            return null;
        });
    }

    public List<Tasks> getTasksByStatusAndProjectAndSprint(String status, UUID projectId, UUID sprintId) throws SQLException {
        String sql = "SELECT * FROM tasks WHERE status = ? AND project_id = ? AND sprint_id = ?";
        return executeQuery(sql, stmt -> {
            stmt.setString(1, status);
            stmt.setObject(2, projectId);
            stmt.setObject(3, sprintId);
            ResultSet rs = stmt.executeQuery();
            List<Tasks> tasks = new ArrayList<>();
            while (rs.next()) {
                tasks.add(mapResultSetToTask(rs));
            }
            return tasks;
        });
    }

    public List<Tasks> getAllTasks() throws SQLException {
        String sql = "SELECT * FROM tasks WHERE deleted_at IS NULL";
        return executeQuery(sql, stmt -> {
            List<Tasks> tasks = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                tasks.add(mapResultSetToTask(rs));
            }
            return tasks;
        });
    }

    // --- Các hàm khác ---

    public void assignTask(UUID taskId, UUID userId) throws SQLException {
        String sql = "UPDATE tasks SET assignee_id = ?, updated_at = now() WHERE id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setObject(1, userId);
            stmt.setObject(2, taskId);
        });
    }

    public void changeTaskStatus(UUID taskId, String status) throws SQLException {
        String sql = "UPDATE tasks SET status = ?, updated_at = now() WHERE id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setString(1, status);
            stmt.setObject(2, taskId);
        });
    }

    public void updateStoryPoint(UUID taskId, int storyPoint) throws SQLException {
        String sql = "UPDATE tasks SET story_point = ?, updated_at = now() WHERE id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setInt(1, storyPoint);
            stmt.setObject(2, taskId);
        });
    }

    public void linkTasks(UUID taskId, UUID relatedTaskId) throws SQLException {
        // Giả sử bạn có bảng task_links (task_id, related_task_id)
        String sql = "INSERT INTO task_links (task_id, related_task_id) VALUES (?, ?)";
        executeUpdate(sql, stmt -> {
            stmt.setObject(1, taskId);
            stmt.setObject(2, relatedTaskId);
        });
    }

    public List<Tasks> filterTasks(String status, UUID assigneeId) throws SQLException {
        String sql = "SELECT * FROM tasks WHERE status = ? AND assignee_id = ? AND deleted_at IS NULL";
        return executeQuery(sql, stmt -> {
            stmt.setString(1, status);
            stmt.setObject(2, assigneeId);
            List<Tasks> tasks = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                tasks.add(mapResultSetToTask(rs));
            }
            return tasks;
        });
    }

    public List<Tasks> searchTasks(String keyword) throws SQLException {
        String sql = "SELECT * FROM tasks WHERE title ILIKE ? AND deleted_at IS NULL";
        return executeQuery(sql, stmt -> {
            stmt.setString(1, "%" + keyword + "%");
            List<Tasks> tasks = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                tasks.add(mapResultSetToTask(rs));
            }
            return tasks;
        });
    }

    public List<Tasks> getTasksBySprintId(UUID sprintId) throws SQLException {
        String sql = "SELECT * FROM tasks WHERE sprint_id = ? AND deleted_at IS NULL";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, sprintId);
            List<Tasks> tasks = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                tasks.add(mapResultSetToTask(rs));
            }
            return tasks;
        });
    }

    public List<Tasks> paginateTasks(int page, int size) throws SQLException {
        int offset = (page - 1) * size;
        String sql = "SELECT * FROM tasks ORDER BY created_at DESC LIMIT ? OFFSET ?";
        return executeQuery(sql, stmt -> {
            stmt.setInt(1, size);
            stmt.setInt(2, offset);
            List<Tasks> tasks = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                tasks.add(mapResultSetToTask(rs));
            }
            return tasks;
        });
    }

    public void addCommentToTask(UUID taskId, String comment) throws SQLException {
        // Updated to use the actual 'comments' table with proper structure
        String sql = "INSERT INTO comments (task_id, user_id, user_name, content, created_at, updated_at, is_deleted) VALUES (?, ?, ?, ?, now(), now(), false)";
        executeUpdate(sql, stmt -> {
            stmt.setObject(1, taskId);
            stmt.setString(2, "SYSTEM"); // Default user ID - should be passed from service layer
            stmt.setString(3, "System User"); // Default user name - should be passed from service layer
            stmt.setString(4, comment);
        });
    }

    public void attachFileToTask(UUID taskId, MultipartFile file) throws SQLException {
        // (Future) Cần bảng task_attachments (id, task_id, filename, file_data, uploaded_at)
        String sql = "INSERT INTO task_attachments (id, task_id, filename, uploaded_at) VALUES (?, ?, ?, now())";
        executeUpdate(sql, stmt -> {
            stmt.setObject(1, UUID.randomUUID());
            stmt.setObject(2, taskId);
            stmt.setString(3, file.getOriginalFilename());
            // file_data có thể upload vào S3 hoặc file server khác
        });
    }
    // --- Task Members ---

    public void addMemberToTask(UUID taskId, UUID userId) throws SQLException {
        String sql = "INSERT INTO task_members (id, task_id, user_id, role_in_task, created_at) VALUES (?, ?, ?, ?, now())";
        executeUpdate(sql, stmt -> {
            stmt.setObject(1, UUID.randomUUID());
            stmt.setObject(2, taskId);
            stmt.setObject(3, userId);
            stmt.setString(4, "member"); // default role
        });
    }

    public void removeMemberFromTask(UUID taskId, UUID userId) throws SQLException {
        String sql = "DELETE FROM task_members WHERE task_id = ? AND user_id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setObject(1, taskId);
            stmt.setObject(2, userId);
        });
    }

    public List<UUID> getTaskMembers(UUID taskId) throws SQLException {
        String sql = "SELECT user_id FROM task_members WHERE task_id = ?";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, taskId);
            List<UUID> members = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                members.add(rs.getObject("user_id", UUID.class));
            }
            return members;
        });
    }
    public List<Tasks> getTasksByProjectId(UUID projectId) throws SQLException {
        String sql = "SELECT * FROM tasks WHERE project_id = ? AND deleted_at IS NULL";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            ResultSet rs = stmt.executeQuery();
            List<Tasks> tasks = new ArrayList<>();
            while (rs.next()) {
                tasks.add(mapResultSetToTask(rs));
            }
            return tasks;
        });
    }

    public List<Tasks> getTasksByProjectIdSorted(UUID projectId, String sortBy, String sortOrder) throws SQLException {
        // Validate sortBy to prevent SQL injection
        String orderByColumn;
        switch (sortBy.toLowerCase()) {
            case "updated":
                orderByColumn = "updated_at";
                break;
            case "created":
                orderByColumn = "created_at";
                break;
            case "due-date":
                orderByColumn = "due_date";
                break;
            case "priority":
                // Use CASE statement to convert priority enum to numeric values for proper sorting
                orderByColumn = "CASE priority " +
                    "WHEN 'BLOCKER' THEN 6 " +
                    "WHEN 'HIGHEST' THEN 5 " +
                    "WHEN 'HIGH' THEN 4 " +
                    "WHEN 'MEDIUM' THEN 3 " +
                    "WHEN 'LOW' THEN 2 " +
                    "WHEN 'LOWEST' THEN 1 " +
                    "ELSE 3 END";
                break;
            case "status":
                orderByColumn = "status";
                break;
            case "title":
                orderByColumn = "title";
                break;
            default:
                orderByColumn = "updated_at"; // Default to updated_at
        }

        // Validate sortOrder to prevent SQL injection
        String order = "desc".equalsIgnoreCase(sortOrder) ? "DESC" : "ASC";
        
        // For due_date, we want to handle NULL values (put them at the end)
        String sql;
        if ("due_date".equals(orderByColumn)) {
            sql = String.format("SELECT * FROM tasks WHERE project_id = ? AND deleted_at IS NULL ORDER BY %s %s NULLS LAST", orderByColumn, order);
        } else {
            sql = String.format("SELECT * FROM tasks WHERE project_id = ? AND deleted_at IS NULL ORDER BY %s %s", orderByColumn, order);
        }
        
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            ResultSet rs = stmt.executeQuery();
            List<Tasks> tasks = new ArrayList<>();
            while (rs.next()) {
                tasks.add(mapResultSetToTask(rs));
            }
            return tasks;
        });
    }

    // Add method to update task priority
    public void updateTaskPriority(UUID taskId, TaskPriority priority) throws SQLException {
        String sql = "UPDATE tasks SET priority = ?, updated_at = now() WHERE id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setString(1, priority.name());
            stmt.setObject(2, taskId);
        });
    }

    // Add method to get tasks by priority
    public List<Tasks> getTasksByPriority(UUID projectId, TaskPriority priority) throws SQLException {
        String sql = "SELECT * FROM tasks WHERE project_id = ? AND priority = ? AND deleted_at IS NULL";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            stmt.setString(2, priority.name());
            List<Tasks> tasks = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                tasks.add(mapResultSetToTask(rs));
            }
            return tasks;
        });
    }

    // Calendar Filter Methods
    public List<Tasks> getFilteredTasksForCalendar(UUID projectId, String search, 
                                                  List<String> assigneeIds, List<String> types, 
                                                  List<String> statuses, String startDate, 
                                                  String endDate, String sprintId) throws SQLException {
        StringBuilder sql = new StringBuilder("SELECT t.*, u.username as assignee_name FROM tasks t ");
        sql.append("LEFT JOIN users u ON t.assignee_id = u.id WHERE t.project_id = ? AND t.deleted_at IS NULL");
        
        List<Object> params = new ArrayList<>();
        params.add(projectId);
        
        // Search filter
        if (search != null && !search.trim().isEmpty()) {
            sql.append(" AND (t.title ILIKE ? OR t.description ILIKE ?)");
            String searchPattern = "%" + search.trim() + "%";
            params.add(searchPattern);
            params.add(searchPattern);
        }
        
        // Assignee filter
        if (assigneeIds != null && !assigneeIds.isEmpty()) {
            sql.append(" AND (t.assignee_id IN (");
            for (int i = 0; i < assigneeIds.size(); i++) {
                if (i > 0) sql.append(", ");
                sql.append("?");
                try {
                    params.add(UUID.fromString(assigneeIds.get(i)));
                } catch (IllegalArgumentException e) {
                    // Skip invalid UUIDs
                    continue;
                }
            }
            sql.append(") OR t.assignee_id IS NULL)");
        }
        
        // Type filter (using label field as type)
        if (types != null && !types.isEmpty()) {
            sql.append(" AND t.label IN (");
            for (int i = 0; i < types.size(); i++) {
                if (i > 0) sql.append(", ");
                sql.append("?");
                params.add(types.get(i));
            }
            sql.append(")");
        }
        
        // Status filter
        if (statuses != null && !statuses.isEmpty()) {
            sql.append(" AND t.status IN (");
            for (int i = 0; i < statuses.size(); i++) {
                if (i > 0) sql.append(", ");
                sql.append("?");
                params.add(statuses.get(i));
            }
            sql.append(")");
        }
        
        // Date range filter
        if (startDate != null && !startDate.trim().isEmpty()) {
            sql.append(" AND (t.due_date >= ? OR t.created_at >= ?)");
            params.add(startDate);
            params.add(startDate);
        }
        
        if (endDate != null && !endDate.trim().isEmpty()) {
            sql.append(" AND (t.due_date <= ? OR t.created_at <= ?)");
            params.add(endDate);
            params.add(endDate);
        }
        
        // Sprint filter
        if (sprintId != null && !sprintId.trim().isEmpty()) {
            sql.append(" AND t.sprint_id = ?");
            try {
                params.add(UUID.fromString(sprintId));
            } catch (IllegalArgumentException e) {
                // Skip invalid UUID
            }
        }
        
        sql.append(" ORDER BY t.created_at DESC");
        
        return executeQuery(sql.toString(), stmt -> {
            for (int i = 0; i < params.size(); i++) {
                stmt.setObject(i + 1, params.get(i));
            }
            List<Tasks> tasks = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                tasks.add(mapResultSetToTask(rs));
            }
            return tasks;
        });
    }

    public List<Map<String, Object>> getTaskAssignees(UUID projectId) throws SQLException {
        String sql = "SELECT DISTINCT u.id, u.username, u.email FROM users u " +
                    "INNER JOIN tasks t ON u.id = t.assignee_id " +
                    "WHERE t.project_id = ? AND t.assignee_id IS NOT NULL AND t.deleted_at IS NULL " +
                    "ORDER BY u.username";
        
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            List<Map<String, Object>> assignees = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                Map<String, Object> assignee = new HashMap<>();
                assignee.put("id", rs.getObject("id"));
                assignee.put("name", rs.getString("username"));
                assignee.put("email", rs.getString("email"));
                assignees.add(assignee);
            }
            return assignees;
        });
    }

    public List<String> getTaskTypes(UUID projectId) throws SQLException {
        String sql = "SELECT DISTINCT label FROM tasks WHERE project_id = ? AND label IS NOT NULL AND deleted_at IS NULL ORDER BY label";
        
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            List<String> types = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                String label = rs.getString("label");
                if (label != null && !label.trim().isEmpty()) {
                    types.add(label);
                }
            }
            return types;
        });
    }

    public List<String> getTaskStatuses(UUID projectId) throws SQLException {
        String sql = "SELECT DISTINCT status FROM tasks WHERE project_id = ? AND deleted_at IS NULL ORDER BY status";
        
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

    // --- Helper: mapping ResultSet -> Tasks object ---
    private Tasks mapResultSetToTask(ResultSet rs) throws SQLException {
        Tasks.Builder builder = new Tasks.Builder()
                .id(rs.getObject("id", UUID.class))
                .sprintId(rs.getObject("sprint_id", UUID.class))
                .projectId(rs.getObject("project_id", UUID.class))
                .title(rs.getString("title"))
                .description(rs.getString("description"))
                .status(TaskStatus.valueOf(rs.getString("status")))
                .storyPoint(rs.getInt("story_point"))
                .assigneeId(rs.getObject("assignee_id", UUID.class))
                .createdBy(rs.getObject("created_by", UUID.class))
                .dueDate(rs.getTimestamp("due_date") != null ? rs.getTimestamp("due_date").toLocalDateTime().toLocalDate() : null)
                .createdAt(rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toLocalDateTime() : null)
                .completedAt(rs.getTimestamp("completed_at") != null ? rs.getTimestamp("completed_at").toLocalDateTime() : null)
                .parentTaskId(rs.getObject("parent_task_id", UUID.class))
                .tags(null);
                
        // Try to get label field if exists
        try {
            String label = rs.getString("label");
            if (label != null) {
                builder.label(label);
            }
        } catch (SQLException e) {
            // Ignore if label column doesn't exist
        }
        
        // Try to get priority field if exists
        try {
            String priorityStr = rs.getString("priority");
            if (priorityStr != null) {
                try {
                    TaskPriority priority = TaskPriority.valueOf(priorityStr);
                    builder.priority(priority);
                } catch (IllegalArgumentException e) {
                    // If priority value is invalid, default to MEDIUM
                    builder.priority(TaskPriority.MEDIUM);
                }
            } else {
                builder.priority(TaskPriority.MEDIUM);
            }
        } catch (SQLException e) {
            // If priority column doesn't exist, default to MEDIUM
            builder.priority(TaskPriority.MEDIUM);
        }
        
        // Try to get deletedAt field if exists
        try {
            builder.deletedAt(rs.getTimestamp("deleted_at") != null ? rs.getTimestamp("deleted_at").toLocalDateTime() : null);
        } catch (SQLException e) {
            // Ignore if deleted_at column doesn't exist
        }
        
        return builder.build();
    }

    // Get project activity - returns recent task updates as activity data
    public List<Object> getProjectActivity(UUID projectId) throws SQLException {
        String sql = """
            SELECT t.id, t.title, t.status, t.assignee_id, t.updated_at, t.created_at,
                   u.username as assignee_name
            FROM tasks t
            LEFT JOIN users u ON t.assignee_id = u.id
            WHERE t.project_id = ?
            ORDER BY t.updated_at DESC
            LIMIT 10
            """;
            
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            ResultSet rs = stmt.executeQuery();
            List<Object> activities = new ArrayList<>();
            
            while (rs.next()) {
                // Create activity object with task update information
                var activity = new java.util.HashMap<String, Object>();
                activity.put("id", rs.getObject("id", UUID.class));
                activity.put("type", "task_updated");
                activity.put("user", rs.getString("assignee_name") != null ? rs.getString("assignee_name") : "Unknown User");
                activity.put("task", rs.getString("title"));
                activity.put("taskKey", "TASK-" + rs.getObject("id", UUID.class).toString().substring(0, 8));
                activity.put("status", rs.getString("status"));
                activity.put("timestamp", rs.getTimestamp("updated_at") != null ? rs.getTimestamp("updated_at").toLocalDateTime() : rs.getTimestamp("created_at").toLocalDateTime());
                
                activities.add(activity);
            }
            
            return activities;
        });
    }

    // Get overdue tasks for a specific project
    public List<Tasks> getOverdueTasks(UUID projectId) throws SQLException {
        String sql = "SELECT * FROM tasks WHERE project_id = ? AND due_date < CURRENT_DATE AND status != 'DONE' ORDER BY due_date ASC";
        
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            List<Tasks> overdueTasks = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                overdueTasks.add(mapResultSetToTask(rs));
            }
            return overdueTasks;
        });
    }

    // Get all overdue tasks across all projects
    public List<Tasks> getAllOverdueTasks() throws SQLException {
        String sql = "SELECT * FROM tasks WHERE due_date < CURRENT_DATE AND status != 'DONE' ORDER BY due_date ASC";
        
        return executeQuery(sql, stmt -> {
            List<Tasks> overdueTasks = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                overdueTasks.add(mapResultSetToTask(rs));
            }
            return overdueTasks;
        });
    }

}
