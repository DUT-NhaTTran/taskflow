package com.tmnhat.tasksservice.controller;

import com.tmnhat.common.payload.ResponseDataAPI;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/attachments")
@CrossOrigin(origins = "*")
public class AttachmentController {

    private static final String UPLOAD_DIR = "uploads";

    public AttachmentController() {
        // Tạo thư mục uploads nếu chưa tồn tại
        new File(UPLOAD_DIR).mkdirs();
    }

    @PostMapping("/upload")
    public ResponseEntity<ResponseDataAPI> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("taskId") String taskId) throws IOException {
        
        // Tạo tên file duy nhất
        String originalFilename = file.getOriginalFilename();
        String fileExtension = "";
        
        if (originalFilename != null && originalFilename.contains(".")) {
            fileExtension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        
        String uniqueFilename = UUID.randomUUID().toString() + fileExtension;
        Path filePath = Paths.get(UPLOAD_DIR, uniqueFilename);
        
        // Lưu file vào đĩa
        Files.copy(file.getInputStream(), filePath);
        
        // Tạo thông tin attachment
        Map<String, Object> attachment = new HashMap<>();
        attachment.put("id", UUID.randomUUID().toString());
        attachment.put("task_id", taskId);
        attachment.put("file_name", originalFilename);
        attachment.put("file_url", filePath.toString());
        attachment.put("file_type", file.getContentType());
        attachment.put("uploaded_at", LocalDateTime.now().toString());
        
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(attachment));
    }

    @GetMapping("/task/{taskId}")
    public ResponseEntity<ResponseDataAPI> getAttachmentsByTaskId(@PathVariable String taskId) {
        List<Map<String, Object>> attachments = new ArrayList<>();
        
        // Đọc danh sách file trong thư mục uploads
        File dir = new File(UPLOAD_DIR);
        File[] files = dir.listFiles();
        
        if (files != null) {
            for (File file : files) {
                // Trong thực tế bạn sẽ lấy từ database
                Map<String, Object> attachment = new HashMap<>();
                attachment.put("id", UUID.randomUUID().toString());
                attachment.put("task_id", taskId);
                attachment.put("file_name", file.getName());
                attachment.put("file_url", file.getPath());
                attachment.put("file_type", getFileContentType(file.getName()));
                attachment.put("uploaded_at", LocalDateTime.now().toString());
                attachments.add(attachment);
            }
        }
        
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(attachments));
    }

    @DeleteMapping("/{attachmentId}")
    public ResponseEntity<ResponseDataAPI> deleteAttachment(@PathVariable String attachmentId) {
        // Trong thực tế bạn sẽ tìm thông tin từ database và xóa file
        return ResponseEntity.ok(ResponseDataAPI.successWithoutMetaAndData());
    }

    private String getFileContentType(String filename) {
        if (filename.toLowerCase().endsWith(".png")) return "image/png";
        if (filename.toLowerCase().endsWith(".jpg") || filename.toLowerCase().endsWith(".jpeg")) return "image/jpeg";
        if (filename.toLowerCase().endsWith(".pdf")) return "application/pdf";
        if (filename.toLowerCase().endsWith(".doc") || filename.toLowerCase().endsWith(".docx")) return "application/msword";
        return "application/octet-stream";
    }
} 