package com.tmnhat.fileservice.service;

import com.tmnhat.fileservice.model.Attachment;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

public interface AttachmentService {
    List<Attachment> getAttachmentsByTaskId(UUID taskId) throws SQLException;
    Attachment findById(Long id) throws SQLException;
    Attachment saveAttachment(MultipartFile file, UUID taskId) throws IOException, SQLException;
    void deleteAttachment(Long attachmentId) throws IOException, SQLException;
    Attachment createAttachmentRecord(String fileName, String fileUrl, String fileType, UUID taskId) throws SQLException;
} 