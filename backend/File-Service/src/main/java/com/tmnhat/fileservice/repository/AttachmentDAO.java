package com.tmnhat.fileservice.repository;

import com.tmnhat.fileservice.model.Attachment;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Repository
public class AttachmentDAO extends BaseDAO {

    public Attachment addAttachment(Attachment attachment) throws SQLException {
        String sql = """
            INSERT INTO attachments (task_id, file_name, file_url, file_type, uploaded_at)
            VALUES (?, ?, ?, ?, ?)
            RETURNING id
        """;

        return executeQuery(sql, stmt -> {
            stmt.setObject(1, attachment.getTaskId());
            stmt.setString(2, attachment.getFileName());
            stmt.setString(3, attachment.getFileUrl());
            stmt.setString(4, attachment.getFileType());
            stmt.setTimestamp(5, Timestamp.valueOf(attachment.getUploadedAt()));

            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return new Attachment.Builder()
                        .id(rs.getLong("id"))
                        .taskId(attachment.getTaskId())
                        .fileName(attachment.getFileName())
                        .fileUrl(attachment.getFileUrl())
                        .fileType(attachment.getFileType())
                        .uploadedAt(attachment.getUploadedAt())
                        .build();
            }
            throw new SQLException("Failed to insert attachment");
        });
    }

    public List<Attachment> findByTaskId(UUID taskId) throws SQLException {
        String sql = "SELECT * FROM attachments WHERE task_id = ? ORDER BY uploaded_at DESC";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, taskId);
            ResultSet rs = stmt.executeQuery();
            
            List<Attachment> attachments = new ArrayList<>();
            while (rs.next()) {
                attachments.add(mapResultSetToAttachment(rs));
            }
            return attachments;
        });
    }

    public Attachment findById(Long id) throws SQLException {
        String sql = "SELECT * FROM attachments WHERE id = ?";
        return executeQuery(sql, stmt -> {
            stmt.setLong(1, id);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return mapResultSetToAttachment(rs);
            }
            return null;
        });
    }

    public void deleteAttachment(Long id) throws SQLException {
        String sql = "DELETE FROM attachments WHERE id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setLong(1, id);
        });
    }

    public boolean existsById(Long id) throws SQLException {
        String sql = "SELECT COUNT(*) FROM attachments WHERE id = ?";
        return executeQuery(sql, stmt -> {
            stmt.setLong(1, id);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return rs.getInt(1) > 0;
            }
            return false;
        });
    }

    private Attachment mapResultSetToAttachment(ResultSet rs) throws SQLException {
        return new Attachment.Builder()
                .id(rs.getLong("id"))
                .taskId(rs.getObject("task_id", UUID.class))
                .fileName(rs.getString("file_name"))
                .fileUrl(rs.getString("file_url"))
                .fileType(rs.getString("file_type"))
                .uploadedAt(rs.getTimestamp("uploaded_at") != null ? 
                    rs.getTimestamp("uploaded_at").toLocalDateTime() : null)
                .build();
    }
} 