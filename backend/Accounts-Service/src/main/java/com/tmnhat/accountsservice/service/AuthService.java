package com.tmnhat.accountsservice.service;

import com.tmnhat.accountsservice.model.Accounts;
import java.sql.SQLException;
import java.util.UUID;

public interface AuthService {
    String register(String email, String password) throws Exception;
    String login(String email, String password) throws Exception;
    UUID getUserIdByEmail(String email) throws SQLException;
    Accounts getAccountByEmail(String email) throws SQLException;
    void linkUserIdToAccount(UUID accountId, UUID userId) throws SQLException;
    UUID getAccountIdByEmail(String email) throws SQLException;
    
    // Change password
    void changePassword(String email, String currentPassword, String newPassword) throws Exception;
    
    // Change password by user ID
    void changePasswordByUserId(UUID userId, String currentPassword, String newPassword) throws Exception;
}
