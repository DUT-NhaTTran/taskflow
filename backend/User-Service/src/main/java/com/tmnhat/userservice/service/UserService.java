package com.tmnhat.userservice.service;

import com.tmnhat.userservice.model.Users;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

public interface UserService {
    Users createUser(Users user);
    void updateUser(UUID id, Users user);
    void deleteUser(UUID id);
    Users getUserById(UUID id);
    List<Users> getAllUsers();
    List<Users> getUsersByRole(String role);
    Users getUserByUsername(String username);
    Users getUserByEmail(String email);
    void changeUserRole(UUID userId, String role);
    List<Users> searchUsers(String keyword);
    void updateAvatar(UUID userId, String avatarUrl);
    List<Users> getUsersByProjectId(UUID projectId);
    String getUsernameById(UUID id);
} 