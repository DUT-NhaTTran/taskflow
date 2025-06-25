package com.tmnhat.tasksservice.controller;

import com.tmnhat.common.payload.ResponseDataAPI;
import com.tmnhat.tasksservice.model.Comment;
import com.tmnhat.tasksservice.model.Tasks;
import com.tmnhat.tasksservice.service.CommentService;
import com.tmnhat.tasksservice.service.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/comments")
@CrossOrigin(origins = "http://localhost:3000")
public class CommentController {
    
    @Autowired
    private CommentService commentService;
    
    @Autowired
    private TaskService taskService;

    // Get all comments for a task
    @GetMapping("/task/{taskId}")
    public ResponseEntity<ResponseDataAPI> getCommentsByTask(@PathVariable UUID taskId) {
        try {
            List<Comment> comments = commentService.getCommentsByTaskId(taskId);
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(comments));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Error fetching comments: " + e.getMessage()));
        }
    }
    
    // Add new comment
    @PostMapping
    public ResponseEntity<ResponseDataAPI> addComment(@RequestBody Map<String, Object> request) {
        try {
            // Extract and validate required fields
            Object taskIdObj = request.get("taskId");
            String userId = (String) request.get("userId");
            String content = (String) request.get("content");
            
            if (taskIdObj == null || userId == null || content == null) {
                return ResponseEntity.badRequest().body(ResponseDataAPI.error("taskId, userId, and content are required"));
            }
            
            // Convert taskId to UUID
            UUID taskId;
            try {
                if (taskIdObj instanceof String) {
                    taskId = UUID.fromString((String) taskIdObj);
                } else if (taskIdObj instanceof UUID) {
                    taskId = (UUID) taskIdObj;
                } else {
                    return ResponseEntity.badRequest().body(ResponseDataAPI.error("Invalid taskId format. Must be a valid UUID."));
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(ResponseDataAPI.error("Invalid taskId format. Must be a valid UUID."));
            }
            
            // Validate that the task exists
            Tasks task = taskService.getTaskById(taskId);
            if (task == null) {
                return ResponseEntity.badRequest().body(ResponseDataAPI.error("Task not found with ID: " + taskId));
            }
            
            // Add the comment
            Comment newComment = commentService.addComment(taskId, userId, content);
            
            // NOTE: Removed notification logic - frontend will handle this
            System.out.println("🔄 New comment added to task: " + taskId + " - Frontend should handle notification");
            
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(newComment));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Error adding comment: " + e.getMessage()));
        }
    }
    
    // Add reply to a comment
    @PostMapping("/{commentId}/reply")
    public ResponseEntity<ResponseDataAPI> addReply(
            @PathVariable Long commentId,
            @RequestBody Map<String, String> request) {
        try {
            String userId = request.get("userId");
            String content = request.get("content");
            
            if (userId == null || content == null) {
                return ResponseEntity.badRequest().body(ResponseDataAPI.error("userId and content are required"));
            }
            
            Comment reply = commentService.addReply(commentId, userId, content);
            
            
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(reply));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Error adding reply: " + e.getMessage()));
        }
    }
    
    // Update comment
    @PutMapping("/{commentId}")
    public ResponseEntity<ResponseDataAPI> updateComment(
            @PathVariable Long commentId,
            @RequestBody Map<String, String> request) {
        try {
            String userId = request.get("userId");
            String newContent = request.get("content");
            
            if (userId == null || newContent == null) {
                return ResponseEntity.badRequest().body(ResponseDataAPI.error("userId and content are required"));
            }
            
            Comment updatedComment = commentService.updateComment(commentId, userId, newContent);
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(updatedComment));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Error updating comment: " + e.getMessage()));
        }
    }
    
    // Delete comment
    @DeleteMapping("/{commentId}")
    public ResponseEntity<ResponseDataAPI> deleteComment(
            @PathVariable Long commentId,
            @RequestParam String userId) {
        try {
            commentService.deleteComment(commentId, userId);
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta("Comment deleted successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Error deleting comment: " + e.getMessage()));
        }
    }
    
    // Get comment count for a task
    @GetMapping("/task/{taskId}/count")
    public ResponseEntity<ResponseDataAPI> getCommentCount(@PathVariable UUID taskId) {
        try {
            Long count = commentService.getCommentCount(taskId);
            return ResponseEntity.ok(ResponseDataAPI.successWithoutMeta(count));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDataAPI.error("Error getting comment count: " + e.getMessage()));
        }
    }
} 