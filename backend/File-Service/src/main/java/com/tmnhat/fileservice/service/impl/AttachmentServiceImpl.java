package com.tmnhat.fileservice.service.impl;

import com.tmnhat.fileservice.model.Attachment;
import com.tmnhat.fileservice.repository.AttachmentDAO;
import com.tmnhat.fileservice.service.AttachmentService;
import com.tmnhat.common.exception.DatabaseException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.UUID;

@Service
public class AttachmentServiceImpl implements AttachmentService {

    @Value("${file.upload.directory}")
    private String uploadDir;

    @Autowired
    private AttachmentDAO attachmentDAO;

    @Override
    public List<Attachment> getAttachmentsByTaskId(UUID taskId) throws SQLException {
        return attachmentDAO.findByTaskId(taskId);
    }
    
    @Override
    public Attachment findById(Long id) throws SQLException {
        return attachmentDAO.findById(id);
    }

    @Override
    public Attachment saveAttachment(MultipartFile file, UUID taskId) throws IOException, SQLException {
        // Create directory if it doesn't exist
        File directory = new File(uploadDir);
        if (!directory.exists()) {
            directory.mkdirs();
        }

        // Generate unique filename
        String originalFilename = file.getOriginalFilename();
        String fileExtension = "";
        
        if (originalFilename != null && originalFilename.contains(".")) {
            fileExtension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        
        String uniqueFilename = UUID.randomUUID().toString() + fileExtension;
        Path filePath = Paths.get(uploadDir, uniqueFilename);
        
        // Save file to disk
        Files.copy(file.getInputStream(), filePath);
        
        // Create and save attachment record
        Attachment attachment = new Attachment.Builder()
                .taskId(taskId)
                .fileName(originalFilename != null ? originalFilename : uniqueFilename)
                .fileUrl(filePath.toString())
                .fileType(file.getContentType())
                .uploadedAt(LocalDateTime.now())
                .build();
        
        Attachment savedAttachment = attachmentDAO.addAttachment(attachment);
        
        // Send notification about file attachment
        // sendFileAttachmentNotification(taskId, originalFilename != null ? originalFilename : uniqueFilename);
        
        return savedAttachment;
    }

    @Override
    public void deleteAttachment(Long attachmentId) throws IOException, SQLException {
        Attachment attachment = attachmentDAO.findById(attachmentId);
        if (attachment == null) {
            throw new IllegalArgumentException("Attachment not found");
        }
        
        // Delete file from disk
        Path filePath = Paths.get(attachment.getFileUrl());
        Files.deleteIfExists(filePath);
        
        // Delete record from database
        attachmentDAO.deleteAttachment(attachmentId);
    }

    @Override
    public Attachment createAttachmentRecord(String fileName, String fileUrl, String fileType, UUID taskId) throws SQLException {
        // Create attachment record without uploading file (file already exists)
        Attachment attachment = new Attachment.Builder()
                .taskId(taskId)
                .fileName(fileName)
                .fileUrl(fileUrl)
                .fileType(fileType)
                .uploadedAt(LocalDateTime.now())
                .build();
        
        Attachment savedAttachment = attachmentDAO.addAttachment(attachment);
        
        // Send notification about file attachment
        // sendFileAttachmentNotification(taskId, fileName);
        
        return savedAttachment;
    }
    
    
    
} 