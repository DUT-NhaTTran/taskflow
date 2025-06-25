package com.tmnhat.tasksservice.repository;

import com.tmnhat.tasksservice.model.Comment;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Repository
public class CommentsDAO extends BaseDAO {

    public Comment addComment(Comment comment) throws SQLException {
        String sql = """
            INSERT INTO comments (task_id, user_id, content, created_at, updated_at, parent_comment_id, is_deleted)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING id
        """;

        return executeQuery(sql, stmt -> {
            stmt.setObject(1, comment.getTaskId());
            stmt.setString(2, comment.getUserId());
            stmt.setString(3, comment.getContent());
            stmt.setTimestamp(4, Timestamp.valueOf(comment.getCreatedAt() != null ? comment.getCreatedAt() : LocalDateTime.now()));
            stmt.setTimestamp(5, Timestamp.valueOf(comment.getUpdatedAt() != null ? comment.getUpdatedAt() : LocalDateTime.now()));
            
            if (comment.getParentCommentId() != null) {
                stmt.setLong(6, comment.getParentCommentId());
            } else {
                stmt.setNull(6, java.sql.Types.BIGINT);
            }
            
            stmt.setBoolean(7, comment.getIsDeleted() != null ? comment.getIsDeleted() : false);

            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return new Comment.Builder()
                        .id(rs.getLong("id"))
                        .taskId(comment.getTaskId())
                        .userId(comment.getUserId())
                        .content(comment.getContent())
                        .createdAt(comment.getCreatedAt() != null ? comment.getCreatedAt() : LocalDateTime.now())
                        .updatedAt(comment.getUpdatedAt() != null ? comment.getUpdatedAt() : LocalDateTime.now())
                        .parentCommentId(comment.getParentCommentId())
                        .isDeleted(comment.getIsDeleted() != null ? comment.getIsDeleted() : false)
                        .build();
            }
            throw new SQLException("Failed to insert comment");
        });
    }

    public List<Comment> findByTaskIdAndNotDeleted(UUID taskId) throws SQLException {
        String sql = "SELECT * FROM comments WHERE task_id = ? AND is_deleted = false ORDER BY created_at ASC";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, taskId);
            ResultSet rs = stmt.executeQuery();
            
            List<Comment> comments = new ArrayList<>();
            while (rs.next()) {
                comments.add(mapResultSetToComment(rs));
            }
            return comments;
        });
    }

    public List<Comment> findByUserId(String userId) throws SQLException {
        String sql = "SELECT * FROM comments WHERE user_id = ? ORDER BY created_at DESC";
        return executeQuery(sql, stmt -> {
            stmt.setString(1, userId);
            ResultSet rs = stmt.executeQuery();
            
            List<Comment> comments = new ArrayList<>();
            while (rs.next()) {
                comments.add(mapResultSetToComment(rs));
            }
            return comments;
        });
    }

    public List<Comment> findByParentCommentIdAndIsDeletedFalse(Long parentCommentId) throws SQLException {
        String sql = "SELECT * FROM comments WHERE parent_comment_id = ? AND is_deleted = false ORDER BY created_at ASC";
        return executeQuery(sql, stmt -> {
            stmt.setLong(1, parentCommentId);
            ResultSet rs = stmt.executeQuery();
            
            List<Comment> comments = new ArrayList<>();
            while (rs.next()) {
                comments.add(mapResultSetToComment(rs));
            }
            return comments;
        });
    }

    public Long countByTaskIdAndNotDeleted(UUID taskId) throws SQLException {
        String sql = "SELECT COUNT(*) FROM comments WHERE task_id = ? AND is_deleted = false";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, taskId);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return rs.getLong(1);
            }
            return 0L;
        });
    }

    public Comment findById(Long id) throws SQLException {
        String sql = "SELECT * FROM comments WHERE id = ?";
        return executeQuery(sql, stmt -> {
            stmt.setLong(1, id);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return mapResultSetToComment(rs);
            }
            return null;
        });
    }

    public Comment updateComment(Comment comment) throws SQLException {
        String sql = "UPDATE comments SET task_id = ?, user_id = ?, content = ?, updated_at = ?, parent_comment_id = ?, is_deleted = ? WHERE id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setObject(1, comment.getTaskId());
            stmt.setString(2, comment.getUserId());
            stmt.setString(3, comment.getContent());
            stmt.setTimestamp(4, Timestamp.valueOf(LocalDateTime.now()));
            
            if (comment.getParentCommentId() != null) {
                stmt.setLong(5, comment.getParentCommentId());
            } else {
                stmt.setNull(5, java.sql.Types.BIGINT);
            }
            
            stmt.setBoolean(6, comment.getIsDeleted() != null ? comment.getIsDeleted() : false);
            stmt.setLong(7, comment.getId());
        });
        
        comment.setUpdatedAt(LocalDateTime.now());
        return comment;
    }

    public void deleteComment(Long id) throws SQLException {
        String sql = "DELETE FROM comments WHERE id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setLong(1, id);
        });
    }

    public boolean existsById(Long id) throws SQLException {
        String sql = "SELECT COUNT(*) FROM comments WHERE id = ?";
        return executeQuery(sql, stmt -> {
            stmt.setLong(1, id);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return rs.getInt(1) > 0;
            }
            return false;
        });
    }

    private Comment mapResultSetToComment(ResultSet rs) throws SQLException {
        return new Comment.Builder()
                .id(rs.getLong("id"))
                .taskId(rs.getObject("task_id", UUID.class))
                .userId(rs.getString("user_id"))
                .content(rs.getString("content"))
                .createdAt(rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toLocalDateTime() : null)
                .updatedAt(rs.getTimestamp("updated_at") != null ? rs.getTimestamp("updated_at").toLocalDateTime() : null)
                .parentCommentId(rs.getObject("parent_comment_id", Long.class))
                .isDeleted(rs.getBoolean("is_deleted"))
                .build();
    }
} 