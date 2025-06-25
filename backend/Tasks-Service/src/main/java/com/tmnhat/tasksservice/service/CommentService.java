package com.tmnhat.tasksservice.service;

import com.tmnhat.tasksservice.model.Comment;
import com.tmnhat.tasksservice.repository.CommentsDAO;
import com.tmnhat.common.exception.DatabaseException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class CommentService {
    
    @Autowired
    private CommentsDAO commentsDAO;
    
    // Get all comments for a task
    public List<Comment> getCommentsByTaskId(UUID taskId) {
        try {
            return commentsDAO.findByTaskIdAndNotDeleted(taskId);
        } catch (SQLException e) {
            throw new DatabaseException("Error retrieving comments for task: " + e.getMessage());
        }
    }
    
    // Add new comment
    public Comment addComment(UUID taskId, String userId, String content) {
        try {
            Comment comment = new Comment.Builder()
                    .taskId(taskId)
                    .userId(userId)
                    .content(content)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .isDeleted(false)
                    .build();
            
            return commentsDAO.addComment(comment);
        } catch (SQLException e) {
            throw new DatabaseException("Error adding comment: " + e.getMessage());
        }
    }
    
    // Add reply to a comment
    public Comment addReply(Long parentCommentId, String userId, String content) {
        try {
            // Get parent comment to extract taskId
            Comment parentComment = commentsDAO.findById(parentCommentId);
            if (parentComment == null) {
                throw new IllegalArgumentException("Parent comment not found");
            }
            
            Comment reply = new Comment.Builder()
                    .taskId(parentComment.getTaskId())
                    .userId(userId)
                    .content(content)
                    .parentCommentId(parentCommentId)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .isDeleted(false)
                    .build();
            
            return commentsDAO.addComment(reply);
        } catch (SQLException e) {
            throw new DatabaseException("Error adding reply: " + e.getMessage());
        }
    }
    
    // Update comment (only by owner)
    public Comment updateComment(Long commentId, String userId, String newContent) {
        try {
            Comment comment = commentsDAO.findById(commentId);
            if (comment == null) {
                throw new IllegalArgumentException("Comment not found");
            }
            
            if (!comment.getUserId().equals(userId)) {
                throw new IllegalArgumentException("You can only edit your own comments");
            }
            
            comment.setContent(newContent);
            comment.setUpdatedAt(LocalDateTime.now());
            return commentsDAO.updateComment(comment);
        } catch (SQLException e) {
            throw new DatabaseException("Error updating comment: " + e.getMessage());
        }
    }
    
    // Delete comment (soft delete)
    public void deleteComment(Long commentId, String userId) {
        try {
            Comment comment = commentsDAO.findById(commentId);
            if (comment == null) {
                throw new IllegalArgumentException("Comment not found");
            }
            
            if (!comment.getUserId().equals(userId)) {
                throw new IllegalArgumentException("You can only delete your own comments");
            }
            
            comment.setIsDeleted(true);
            comment.setUpdatedAt(LocalDateTime.now());
            commentsDAO.updateComment(comment);
        } catch (SQLException e) {
            throw new DatabaseException("Error deleting comment: " + e.getMessage());
        }
    }
    
    // Get comment count for a task
    public Long getCommentCount(UUID taskId) {
        try {
            return commentsDAO.countByTaskIdAndNotDeleted(taskId);
        } catch (SQLException e) {
            throw new DatabaseException("Error counting comments: " + e.getMessage());
        }
    }
    
    // Get comment by ID
    public Comment getCommentById(Long commentId) {
        try {
            return commentsDAO.findById(commentId);
        } catch (SQLException e) {
            throw new DatabaseException("Error retrieving comment: " + e.getMessage());
        }
    }
    
    // Get replies for a comment
    public List<Comment> getReplies(Long commentId) {
        try {
            return commentsDAO.findByParentCommentIdAndIsDeletedFalse(commentId);
        } catch (SQLException e) {
            throw new DatabaseException("Error retrieving replies: " + e.getMessage());
        }
    }
} 