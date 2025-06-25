package com.tmnhat.userservice.validation;

import com.tmnhat.userservice.model.Users;
import com.tmnhat.common.exception.BadRequestException;
import java.util.UUID;
import java.util.regex.Pattern;

public class UserValidator {
    
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+$");
    
    private UserValidator() {
        // Private constructor to prevent instantiation
    }
    
    public static void validateUser(Users user) {
        if (user == null) {
            throw new BadRequestException("User cannot be null");
        }
        
        validateUsername(user.getUsername());
        validateEmail(user.getEmail());
        
    }
    
    public static void validateUsername(String username) {
        if (username == null || username.isBlank()) {
            throw new BadRequestException("Username cannot be empty");
        }
        
        if (username.length() < 3 || username.length() > 50) {
            throw new BadRequestException("Username must be between 3 and 50 characters");
        }
        
        // Allow letters (including Vietnamese), numbers, spaces, dots, underscores, and hyphens
        // Vietnamese characters 
        if (!username.matches("^[a-zA-Z0-9\\u00C0-\\u024F\\u1E00-\\u1EFF\\s._-]+$")) {
            throw new BadRequestException("Username can only contain letters, numbers, spaces, dots, underscores, and hyphens");
        }
        
        // Check for consecutive spaces or leading/trailing spaces
        if (username.trim().length() != username.length() || username.contains("  ")) {
            throw new BadRequestException("Username cannot have leading/trailing spaces or consecutive spaces");
        }
    }
    
    public static void validateEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new BadRequestException("Email cannot be empty");
        }
        
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new BadRequestException("Invalid email format");
        }
    }
    
    public static void validatePassword(String password) {
        if (password == null || password.isBlank()) {
            throw new BadRequestException("Password cannot be empty");
        }
    }
    
    public static void validateUserId(UUID userId) {
        if (userId == null) {
            throw new BadRequestException("User ID cannot be null");
        }
    }
    
    public static void validateProjectId(UUID projectId) {
        if (projectId == null) {
            throw new BadRequestException("Project ID cannot be null");
        }
    }
    
    public static void validateRole(String role) {
        if (role == null || role.isBlank()) {
            throw new BadRequestException("Role cannot be empty");
        }
        try {
            com.tmnhat.userservice.payload.enums.UserRole.valueOf(role.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid role: " + role);
        }
    }
    
} 