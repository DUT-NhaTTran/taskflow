package com.tmnhat.notificationservice.repository;

import com.tmnhat.notificationservice.model.Notification;
import com.tmnhat.notificationservice.payload.enums.NotificationType;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class NotificationDAO extends BaseDAO {

    public Notification save(Notification notification) {
        notification.setCreationTime();        
        if (notification.getId() != null && existsById(notification.getId())) {
            updateNotification(notification);
        } else {
            insertNotification(notification);
        }
        
        return notification;
    }

    private void insertNotification(Notification notification) {
        String sql = """
            INSERT INTO notifications (type, title, message, recipient_user_id, actor_user_id, 
                                     actor_user_name, actor_user_avatar, project_id, project_name, 
                                     task_id, sprint_id, comment_id, action_url, is_read, created_at)
            VALUES (?::notification_type, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;

        try {
            executeUpdate(sql, stmt -> {
                stmt.setString(1, notification.getType().name());
                stmt.setString(2, notification.getTitle());
                stmt.setString(3, notification.getMessage());
                stmt.setObject(4, notification.getRecipientUserId());
                stmt.setObject(5, notification.getActorUserId());
                stmt.setString(6, notification.getActorUserName());
                stmt.setString(7, notification.getActorUserAvatar());
                stmt.setObject(8, notification.getProjectId());
                stmt.setString(9, notification.getProjectName());
                stmt.setObject(10, notification.getTaskId());
                stmt.setObject(11, notification.getSprintId());
                if (notification.getCommentId() != null) {
                    stmt.setLong(12, notification.getCommentId());
                } else {
                    stmt.setNull(12, java.sql.Types.BIGINT);
                }
                stmt.setString(13, notification.getActionUrl());
                stmt.setBoolean(14, notification.getIsRead());
                stmt.setTimestamp(15, notification.getCreatedAt() != null ? Timestamp.valueOf(notification.getCreatedAt()) : null);
            });
        } catch (SQLException e) {
            throw new RuntimeException("Error inserting notification: " + e.getMessage(), e);
        }
    }

    private void updateNotification(Notification notification) {
        String sql = """
            UPDATE notifications SET type = ?::notification_type, title = ?, message = ?, 
                                   recipient_user_id = ?, actor_user_id = ?, actor_user_name = ?, 
                                   actor_user_avatar = ?, project_id = ?, project_name = ?, 
                                   task_id = ?, sprint_id = ?, comment_id = ?, 
                                   action_url = ?, is_read = ?, read_at = ? 
            WHERE id = ?
            """;

        try {
            executeUpdate(sql, stmt -> {
                stmt.setString(1, notification.getType().name());
                stmt.setString(2, notification.getTitle());
                stmt.setString(3, notification.getMessage());
                stmt.setObject(4, notification.getRecipientUserId());
                stmt.setObject(5, notification.getActorUserId());
                stmt.setString(6, notification.getActorUserName());
                stmt.setString(7, notification.getActorUserAvatar());
                stmt.setObject(8, notification.getProjectId());
                stmt.setString(9, notification.getProjectName());
                stmt.setObject(10, notification.getTaskId());
                stmt.setObject(11, notification.getSprintId());
                if (notification.getCommentId() != null) {
                    stmt.setLong(12, notification.getCommentId());
                } else {
                    stmt.setNull(12, java.sql.Types.BIGINT);
                }
                stmt.setString(13, notification.getActionUrl());
                stmt.setBoolean(14, notification.getIsRead());
                stmt.setTimestamp(15, notification.getReadAt() != null ? Timestamp.valueOf(notification.getReadAt()) : null);
                stmt.setLong(16, notification.getId());
            });
        } catch (SQLException e) {
            throw new RuntimeException("Error updating notification: " + e.getMessage(), e);
        }
    }

    public Optional<Notification> findById(Long id) {
        String sql = """
            SELECT id, type, title, message, recipient_user_id, actor_user_id, actor_user_name, 
                   actor_user_avatar, project_id, project_name, task_id, sprint_id, 
                   comment_id, action_url, is_read, created_at, read_at 
            FROM notifications WHERE id = ?
            """;

        try {
            return executeQuery(sql, stmt -> {
                stmt.setLong(1, id);
                ResultSet rs = stmt.executeQuery();
                if (rs.next()) {
                    return Optional.of(mapResultSetToNotification(rs));
                }
                return Optional.empty();
            });
        } catch (SQLException e) {
            throw new RuntimeException("Error finding notification by ID: " + e.getMessage(), e);
        }
    }

    public List<Notification> findByRecipientUserIdOrderByCreatedAtDesc(UUID recipientUserId) {
        String sql = """
            SELECT * FROM notifications 
            WHERE recipient_user_id = ? 
            ORDER BY created_at DESC, id DESC
            """;

        try {
            return executeQuery(sql, stmt -> {
                stmt.setObject(1, recipientUserId);
                ResultSet rs = stmt.executeQuery();
                List<Notification> notifications = new ArrayList<>();
                while (rs.next()) {
                    notifications.add(mapResultSetToNotification(rs));
                }
                return notifications;
            });
        } catch (SQLException e) {
            throw new RuntimeException("Error finding notifications by user: " + e.getMessage(), e);
        }
    }

    public List<Notification> findByRecipientUserIdAndIsReadFalseOrderByCreatedAtDesc(UUID recipientUserId) {
        String sql = """
            SELECT * FROM notifications 
            WHERE recipient_user_id = ? 
            AND is_read = false 
            ORDER BY id DESC, created_at DESC
            """;

        try {
            return executeQuery(sql, stmt -> {
                stmt.setObject(1, recipientUserId);
                ResultSet rs = stmt.executeQuery();
                List<Notification> notifications = new ArrayList<>();
                while (rs.next()) {
                    notifications.add(mapResultSetToNotification(rs));
                }
                return notifications;
            });
        } catch (SQLException e) {
            throw new RuntimeException("Error finding unread notifications: " + e.getMessage(), e);
        }
    }

    public long countByRecipientUserIdAndIsReadFalse(UUID recipientUserId) {
        String sql = "SELECT COUNT(*) FROM notifications WHERE recipient_user_id = ? AND is_read = false";

        try {
            return executeQuery(sql, stmt -> {
                stmt.setObject(1, recipientUserId);
                ResultSet rs = stmt.executeQuery();
                if (rs.next()) {
                    return rs.getLong(1);
                }
                return 0L;
            });
        } catch (SQLException e) {
            throw new RuntimeException("Error counting unread notifications: " + e.getMessage(), e);
        }
    }

    public boolean existsById(Long id) {
        String sql = "SELECT COUNT(*) FROM notifications WHERE id = ?";

        try {
            return executeQuery(sql, stmt -> {
                stmt.setLong(1, id);
                ResultSet rs = stmt.executeQuery();
                if (rs.next()) {
                    return rs.getInt(1) > 0;
                }
                return false;
            });
        } catch (SQLException e) {
            throw new RuntimeException("Error checking notification existence: " + e.getMessage(), e);
        }
    }

    public void deleteById(Long id) {
        String sql = "DELETE FROM notifications WHERE id = ?";

        try {
            executeUpdate(sql, stmt -> stmt.setLong(1, id));
        } catch (SQLException e) {
            throw new RuntimeException("Error deleting notification: " + e.getMessage(), e);
        }
    }

    public boolean hasTaskOverdueNotification(UUID taskId, UUID recipientUserId) {
        String sql = """
            SELECT COUNT(*) FROM notifications 
            WHERE task_id = ? AND recipient_user_id = ? AND type = 'TASK_OVERDUE'
            """;

        try {
            return executeQuery(sql, stmt -> {
                stmt.setObject(1, taskId);
                stmt.setObject(2, recipientUserId);
                ResultSet rs = stmt.executeQuery();
                if (rs.next()) {
                    return rs.getInt(1) > 0;
                }
                return false;
            });
        } catch (SQLException e) {
            throw new RuntimeException("Error checking for TASK_OVERDUE notification: " + e.getMessage(), e);
        }
    }

    public void removeTaskOverdueNotifications(UUID taskId) {
        String sql = "DELETE FROM notifications WHERE task_id = ? AND type = 'TASK_OVERDUE'";

        try {
            executeUpdate(sql, stmt -> stmt.setObject(1, taskId));
        } catch (SQLException e) {
            throw new RuntimeException("Error removing TASK_OVERDUE notifications: " + e.getMessage(), e);
        }
    }

    public boolean hasSprintOverdueNotification(UUID sprintId, UUID recipientUserId) {
        String sql = """
            SELECT COUNT(*) FROM notifications 
            WHERE sprint_id = ? AND recipient_user_id = ? AND type = 'SPRINT_OVERDUE'
            """;

        try {
            return executeQuery(sql, stmt -> {
                stmt.setObject(1, sprintId);
                stmt.setObject(2, recipientUserId);
                ResultSet rs = stmt.executeQuery();
                if (rs.next()) {
                    return rs.getInt(1) > 0;
                }
                return false;
            });
        } catch (SQLException e) {
            throw new RuntimeException("Error checking for SPRINT_OVERDUE notification: " + e.getMessage(), e);
        }
    }

    public void removeSprintOverdueNotifications(UUID sprintId) {
        String sql = "DELETE FROM notifications WHERE sprint_id = ? AND type = 'SPRINT_OVERDUE'";

        try {
            executeUpdate(sql, stmt -> stmt.setObject(1, sprintId));
        } catch (SQLException e) {
            throw new RuntimeException("Error removing SPRINT_OVERDUE notifications: " + e.getMessage(), e);
        }
    }

    private Notification mapResultSetToNotification(ResultSet rs) throws SQLException {
        return new Notification.Builder()
                .id(rs.getLong("id"))
                .type(NotificationType.valueOf(rs.getString("type")))
                .title(rs.getString("title"))
                .message(rs.getString("message"))
                .recipientUserId(getUUIDFromResultSet(rs, "recipient_user_id"))
                .actorUserId(getUUIDFromResultSet(rs, "actor_user_id"))
                .actorUserName(rs.getString("actor_user_name"))
                .actorUserAvatar(rs.getString("actor_user_avatar"))
                .projectId(getUUIDFromResultSet(rs, "project_id"))
                .projectName(rs.getString("project_name"))
                .taskId(getUUIDFromResultSet(rs, "task_id"))
                .sprintId(getUUIDFromResultSet(rs, "sprint_id"))
                .commentId(getLongFromResultSet(rs, "comment_id"))
                .actionUrl(rs.getString("action_url"))
                .isRead(rs.getBoolean("is_read"))
                .createdAt(rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toLocalDateTime() : null)
                .readAt(rs.getTimestamp("read_at") != null ? rs.getTimestamp("read_at").toLocalDateTime() : null)
                .build();
    }
    
    // Helper method to safely extract UUID from ResultSet
    private UUID getUUIDFromResultSet(ResultSet rs, String columnName) throws SQLException {
        Object value = rs.getObject(columnName);
        if (value == null) {
            return null;
        }
        if (value instanceof UUID) {
            return (UUID) value;
        } else {
            // Handle string conversion to UUID if needed
            return UUID.fromString(value.toString());
        }
    }
    
    // Helper method to safely extract Long from ResultSet
    private Long getLongFromResultSet(ResultSet rs, String columnName) throws SQLException {
        Object value = rs.getObject(columnName);
        if (value == null) {
            return null;
        }
        if (value instanceof Long) {
            return (Long) value;
        } else if (value instanceof Number) {
            return ((Number) value).longValue();
        } else {
            // Handle string conversion to Long if needed
            return Long.parseLong(value.toString());
        }
    }
} 