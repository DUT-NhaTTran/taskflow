package com.tmnhat.fileservice.controller;

import com.tmnhat.common.payload.ResponseDataAPI;
import com.tmnhat.fileservice.model.Attachment;
import com.tmnhat.fileservice.service.AttachmentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/attachments")
@CrossOrigin(origins = "*")
public class AttachmentController {

    @Autowired
    private AttachmentService attachmentService;

    @GetMapping("/task/{taskId}")
    public ResponseEntity<ResponseDataAPI> getAttachmentsByTaskId(@PathVariable String taskId) {
        try {
            UUID taskUUID = UUID.fromString(taskId);
            List<Attachment> attachments = attachmentService.getAttachmentsByTaskId(taskUUID);
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(attachments));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Invalid UUID format: " + taskId));
        } catch (SQLException e) {
            return ResponseEntity.status(500).body(ResponseDataAPI.error("Database error: " + e.getMessage()));
        }
    }

    @PostMapping("/upload")
    public ResponseEntity<ResponseDataAPI> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("taskId") String taskId) {
        
        try {
            UUID taskUUID = UUID.fromString(taskId);
            Attachment savedAttachment = attachmentService.saveAttachment(file, taskUUID);
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(savedAttachment));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Invalid UUID format: " + taskId));
        } catch (IOException e) {
            return ResponseEntity.status(500).body(ResponseDataAPI.error("File upload error: " + e.getMessage()));
        } catch (SQLException e) {
            return ResponseEntity.status(500).body(ResponseDataAPI.error("Database error: " + e.getMessage()));
        }
    }

    @PostMapping("/create")
    public ResponseEntity<ResponseDataAPI> createAttachment(@RequestBody CreateAttachmentRequest request) {
        try {
            UUID taskUUID = UUID.fromString(request.getTaskId());
            Attachment attachment = attachmentService.createAttachmentRecord(
                request.getFileName(), 
                request.getFileUrl(), 
                request.getFileType(), 
                taskUUID
            );
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(attachment));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Invalid UUID format: " + request.getTaskId()));
        } catch (SQLException e) {
            return ResponseEntity.status(500).body(ResponseDataAPI.error("Database error: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{attachmentId}")
    public ResponseEntity<ResponseDataAPI> deleteAttachment(@PathVariable Long attachmentId) {
        try {
            attachmentService.deleteAttachment(attachmentId);
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
        } catch (IOException e) {
            return ResponseEntity.status(500).body(ResponseDataAPI.error("File deletion error: " + e.getMessage()));
        } catch (SQLException e) {
            return ResponseEntity.status(500).body(ResponseDataAPI.error("Database error: " + e.getMessage()));
        }
    }

    @GetMapping("/download/{attachmentId}")
    public ResponseEntity<Resource> downloadFile(@PathVariable String attachmentId) {
        try {
            // Find attachment by ID
            Attachment attachment = attachmentService.findById(Long.parseLong(attachmentId));
            if (attachment == null) {
                return ResponseEntity.notFound().build();
            }

            Path path = Paths.get(attachment.getFileUrl());
            Resource resource = new UrlResource(path.toUri());
            
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(attachment.getFileType()))
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + attachment.getFileName() + "\"")
                    .body(resource);
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest().build();
        } catch (SQLException e) {
            return ResponseEntity.status(500).build();
        } catch (IOException e) {
            return ResponseEntity.status(500).build();
        }
    }

    public static class CreateAttachmentRequest {
        private String taskId;
        private String fileName;
        private String fileUrl;
        private String fileType;
        
        // Getters and setters
        public String getTaskId() { return taskId; }
        public void setTaskId(String taskId) { this.taskId = taskId; }
        
        public String getFileName() { return fileName; }
        public void setFileName(String fileName) { this.fileName = fileName; }
        
        public String getFileUrl() { return fileUrl; }
        public void setFileUrl(String fileUrl) { this.fileUrl = fileUrl; }
        
        public String getFileType() { return fileType; }
        public void setFileType(String fileType) { this.fileType = fileType; }
    }
} 