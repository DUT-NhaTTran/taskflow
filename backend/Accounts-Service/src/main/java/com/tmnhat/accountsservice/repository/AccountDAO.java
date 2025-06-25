package com.tmnhat.accountsservice.repository;

import com.tmnhat.accountsservice.model.Accounts;
import com.tmnhat.common.exception.ResourceNotFoundException;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.UUID;

@Repository
public class AccountDAO extends BaseDAO {

    public Accounts addAccount(Accounts account) throws SQLException {
        String sql = """
        INSERT INTO accounts (email, password, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        RETURNING id
    """;

        return executeQuery(sql, stmt -> {
            stmt.setString(1, account.getEmail());
            stmt.setString(2, account.getPassword());
            stmt.setTimestamp(3, Timestamp.valueOf(account.getCreatedAt()));
            stmt.setTimestamp(4, Timestamp.valueOf(account.getUpdatedAt()));

            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return new Accounts.Builder()
                        .id(rs.getObject("id", UUID.class)) // ID được DB tự tạo
                        .email(account.getEmail())
                        .password(account.getPassword())
                        .createdAt(account.getCreatedAt())
                        .updatedAt(account.getUpdatedAt())
                        .build();
            }
            throw new SQLException("Failed to insert account");
        });
    }

    public void updatePassword(UUID id, String newHashedPassword, LocalDateTime updatedAt) throws SQLException {
        String sql = "UPDATE accounts SET password = ?, updated_at = ? WHERE id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setString(1, newHashedPassword); // Mật khẩu đã được hash bởi BCrypt
            stmt.setTimestamp(2, updatedAt != null ? Timestamp.valueOf(updatedAt) : null);
            stmt.setObject(3, id);
        });
    }

    public Accounts getAccountByEmail(String email) throws SQLException {
        String sql = "SELECT * FROM accounts WHERE email = ?";
        return executeQuery(sql, stmt -> {
            stmt.setString(1, email);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return mapResultSetToAccount(rs);
            }
            return null;
        });
    }

    public Accounts getAccountByUserId(UUID userId) throws SQLException {
        String sql = "SELECT * FROM accounts WHERE user_id = ?";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, userId);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return mapResultSetToAccount(rs);
            }
            return null;
        });
    }

    public boolean existsByEmail(String email) throws SQLException {
        String sql = "SELECT COUNT(*) FROM accounts WHERE email = ?";
        return executeQuery(sql, stmt -> {
            stmt.setString(1, email);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                return rs.getInt(1) > 0;
            }
            return false;
        });
    }

    private Accounts mapResultSetToAccount(ResultSet rs) throws SQLException {
        return new Accounts.Builder()
                .id(rs.getObject("id", UUID.class))
                .email(rs.getString("email"))
                .password(rs.getString("password"))
                .userId(rs.getObject("user_id", UUID.class))
                .createdAt(rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toLocalDateTime() : null)
                .updatedAt(rs.getTimestamp("updated_at") != null ? rs.getTimestamp("updated_at").toLocalDateTime() : null)
                .build();
    }

    public UUID getUserIdByEmail(String email) throws SQLException {
        String sql = "SELECT user_id FROM accounts WHERE email = ?";
        return executeQuery(sql, stmt -> {
            stmt.setString(1, email);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                UUID userId = (UUID) rs.getObject("user_id");
                if (userId == null) {
                    throw new ResourceNotFoundException("No user_id linked to account with email: " + email);
                }
                return userId;
            }
            throw new ResourceNotFoundException("No account found for email: " + email);
        });
    }

    public void linkUserIdToAccount(UUID accountId, UUID userId) throws SQLException {
        String sql = "UPDATE accounts SET user_id = ? WHERE id = ?";
        executeUpdate(sql, stmt -> {
            stmt.setObject(1, userId);
            stmt.setObject(2, accountId);
        });
    }
    
    public UUID getAccountIdByEmail(String email) throws SQLException {
        String sql = "SELECT id FROM accounts WHERE email = ?";
        return executeQuery(sql, stmt -> {
            stmt.setString(1, email);
            ResultSet rs = stmt.executeQuery();
            if (rs.next()) {
                UUID accountId = (UUID) rs.getObject("id");
                if (accountId == null) {
                    throw new ResourceNotFoundException("No account found for email: " + email);
                }
                return accountId;
            }
            throw new ResourceNotFoundException("No account found for email: " + email);
        });
    }

}