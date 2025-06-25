package com.tmnhat.tasksservice.controller;

import com.tmnhat.common.payload.ResponseDataAPI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/files")
@CrossOrigin(origins = "*")
public class FileUploadController {

    private static final String UPLOAD_DIR = "uploads";

    public FileUploadController() {
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
} 