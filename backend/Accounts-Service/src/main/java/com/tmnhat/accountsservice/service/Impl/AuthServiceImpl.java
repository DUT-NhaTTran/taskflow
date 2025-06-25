package com.tmnhat.accountsservice.service.Impl;

import com.tmnhat.accountsservice.model.Accounts;
import com.tmnhat.accountsservice.repository.AccountDAO;
import com.tmnhat.accountsservice.security.JwtUtil;
import com.tmnhat.accountsservice.service.AuthService;
import com.tmnhat.common.exception.DatabaseException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class AuthServiceImpl implements AuthService {

    private final AccountDAO accountDAO;
    private final JwtUtil jwtUtil;
    private final BCryptPasswordEncoder passwordEncoder;

    @Autowired
    public AuthServiceImpl(AccountDAO accountDAO, JwtUtil jwtUtil) {
        this.accountDAO = accountDAO;
        this.jwtUtil = jwtUtil;
        this.passwordEncoder = new BCryptPasswordEncoder();
    }

    @Override
    public String register(String email, String password) throws SQLException {
        if (accountDAO.existsByEmail(email)) {
            throw new DatabaseException("Email already exists");
        }

        Accounts account = new Accounts.Builder()
                .email(email)
                .password(passwordEncoder.encode(password))
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        // Lấy lại account sau khi insert để có id
        Accounts savedAccount = accountDAO.addAccount(account);

        return "Account created successfully with id: " + savedAccount.getId();
    }

    @Override
    public String login(String email, String password) throws SQLException {
        Accounts account = accountDAO.getAccountByEmail(email);

        if (account == null) {
            throw new DatabaseException("Email not found");
        }

        if (!passwordEncoder.matches(password, account.getPassword())) {
            throw new DatabaseException("Incorrect password");
        }

        return jwtUtil.generateToken(account.getId(), "USER");
    }
    @Override
    public UUID getUserIdByEmail(String email) throws SQLException {
        return accountDAO.getUserIdByEmail(email);
    }
    @Override
    public Accounts getAccountByEmail(String email) throws SQLException {
        return accountDAO.getAccountByEmail(email);
    }

    @Override
    public void linkUserIdToAccount(UUID accountId, UUID userId) throws SQLException {
        accountDAO.linkUserIdToAccount(accountId, userId);
    }

    @Override
    public UUID getAccountIdByEmail(String email) throws SQLException {
        return accountDAO.getAccountIdByEmail(email);
    }

    @Override
    public void changePassword(String email, String currentPassword, String newPassword) throws Exception {
        
        // Get account by email
        Accounts account = accountDAO.getAccountByEmail(email);
        if (account == null) {
            System.err.println("❌ Account not found for email: " + email);
            throw new DatabaseException("Account not found");
        }

        
        boolean passwordMatches = passwordEncoder.matches(currentPassword, account.getPassword());
        
        if (!passwordMatches) {
            System.err.println("Current password verification failed");
            System.err.println("Input password: '" + currentPassword + "'");
            System.err.println("Stored hash: '" + account.getPassword() + "'");
            throw new DatabaseException("Current password is incorrect");
        }


        // Hash new password
        String hashedNewPassword = passwordEncoder.encode(newPassword);


        // Update password in database
        accountDAO.updatePassword(account.getId(), hashedNewPassword, LocalDateTime.now());
        
    }

    @Override
    public void changePasswordByUserId(UUID userId, String currentPassword, String newPassword) throws Exception {
        
        // Get account by user_id
        Accounts account = accountDAO.getAccountByUserId(userId);
        if (account == null) {
            System.err.println("Account not found for userId: " + userId);
            throw new DatabaseException("Account not found for this user");
        }

      
        
        // Verify current password
        boolean passwordMatches = passwordEncoder.matches(currentPassword, account.getPassword());        
        if (!passwordMatches) {
            System.err.println("Current password verification failed");
            System.err.println("Input password: '" + currentPassword + "'");
            System.err.println("Stored hash: '" + account.getPassword() + "'");
            throw new DatabaseException("Current password is incorrect");
        }

        System.out.println("Current password verified, hashing new password...");

        // Hash new password
        String hashedNewPassword = passwordEncoder.encode(newPassword);

        // Update password in database
        accountDAO.updatePassword(account.getId(), hashedNewPassword, LocalDateTime.now());
        
    }

}
