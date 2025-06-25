package com.tmnhat.userservice.service.impl;
import com.tmnhat.common.exception.*;
import com.tmnhat.userservice.model.Users;
import com.tmnhat.userservice.payload.enums.UserRole;
import com.tmnhat.userservice.repository.UserDAO;
import com.tmnhat.userservice.service.UserService;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.sql.SQLException;

@Service
public class UserServiceImpl implements UserService {
    
    private final UserDAO userDAO;
    
    public UserServiceImpl() {
        this.userDAO = new UserDAO();
    }

    @Override
    public Users createUser(Users user) {       
        if (userDAO.getUserByEmail(user.getEmail()) != null) {
            throw new BadRequestException("Email already exists");
        }
        LocalDateTime now = LocalDateTime.now();
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        
        // Generate UUID for the user
        UUID userId = UUID.randomUUID();
        user.setId(userId);
        
        userDAO.createUser(user);
        
        // Return the created user with ID
        return user;
    }

    @Override
    public void updateUser(UUID id, Users user) {
        Users existingUser = getUserById(id);
        
        if (!existingUser.getUsername().equals(user.getUsername()) && 
            userDAO.getUserByUsername(user.getUsername()) != null) {
            throw new BadRequestException("Username already exists");
        }
        
        if (!existingUser.getEmail().equals(user.getEmail()) && 
            userDAO.getUserByEmail(user.getEmail()) != null) {
            throw new BadRequestException("Email already exists");
        }
        
        user.setUpdatedAt(LocalDateTime.now());
        
        user.setCreatedAt(existingUser.getCreatedAt());
        user.setId(id);
        userDAO.updateUser(id, user);
    }

    @Override
    public void deleteUser(UUID id) {
        // Check if user exists
        getUserById(id);
        
        // Delete user
        userDAO.deleteUser(id);
    }

    @Override
    public Users getUserById(UUID id) {
        Users user = userDAO.getUserById(id);
        if (user == null) {
            throw new ResourceNotFoundException("User not found with id: " + id);
        }
        return user;
    }

    @Override
    public List<Users> getAllUsers() {
        return userDAO.getAllUsers();
    }

    @Override
    public List<Users> getUsersByRole(String role) {
        try {
            UserRole userRole = UserRole.valueOf(role.toUpperCase());
            return userDAO.getUsersByRole(userRole);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid role: " + role);
        }
    }

    @Override
    public Users getUserByUsername(String username) {
        Users user = userDAO.getUserByUsername(username);
        if (user == null) {
            throw new ResourceNotFoundException("User not found with username: " + username);
        }
        return user;
    }

    @Override
    public Users getUserByEmail(String email) {
        Users user = userDAO.getUserByEmail(email);
        if (user == null) {
            throw new ResourceNotFoundException("User not found with email: " + email);
        }
        return user;
    }

    @Override
    public void changeUserRole(UUID userId, String role) {
        Users user = getUserById(userId);
        try {
            UserRole userRole = UserRole.valueOf(role.toUpperCase());
            user.setUserRole(userRole);
            user.setUpdatedAt(LocalDateTime.now());
            userDAO.updateUser(userId, user);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid role: " + role);
        }
    }

    @Override
    public List<Users> searchUsers(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            throw new BadRequestException("Search keyword cannot be empty");
        }
        return userDAO.searchUsers(keyword);
    }

    @Override
    public void updateAvatar(UUID userId, String avatarUrl) {
        Users user = getUserById(userId);
        user.setAvatar(avatarUrl);
        user.setUpdatedAt(LocalDateTime.now());
        userDAO.updateUser(userId, user);
    }

    @Override
    public List<Users> getUsersByProjectId(UUID projectId) {
        if (projectId == null) {
            throw new BadRequestException("Project ID cannot be null");
        }
        try {
            return userDAO.getUsersByProjectId(projectId);
        } catch (SQLException e) {
            throw new RuntimeException("Error fetching users by project ID", e);
        }
    }

    @Override
    public String getUsernameById(UUID id) {
        Users user = getUserById(id);
        return user.getUsername();
    }
} 