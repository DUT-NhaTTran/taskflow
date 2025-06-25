package com.tmnhat.userservice.repository;

import com.tmnhat.common.exception.DatabaseException;
import com.tmnhat.userservice.model.Users;
import com.tmnhat.userservice.payload.enums.UserRole;
import java.sql.Timestamp;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Repository;

@Repository
public class UserDAO extends BaseDAO {

    public void createUser(Users user) {
        String query = "INSERT INTO users (id, username, email, user_role, avatar, phone, created_at, updated_at) " +
                       "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

        try {
            executeUpdate(query, stmt -> {
                stmt.setObject(1, user.getId());
                stmt.setString(2, user.getUsername());
                stmt.setString(3, user.getEmail());
                stmt.setString(4, user.getUserRole().name());
                stmt.setString(5, user.getAvatar());
                stmt.setString(6, user.getPhone());
                stmt.setTimestamp(7, Timestamp.valueOf(user.getCreatedAt()));
                stmt.setTimestamp(8, user.getUpdatedAt() != null ? Timestamp.valueOf(user.getUpdatedAt()) : null);
            });
        } catch (SQLException e) {
            throw new DatabaseException("Error creating user: " + e.getMessage());
        }
    }

    public void updateUser(UUID id, Users user) {
        String query = "UPDATE users SET username = ?, email = ?, " +
                "user_role = ?, avatar = ?, updated_at = ?, phone = ? " +
                "WHERE id = ?";

        try {
            executeUpdate(query, stmt -> {
                stmt.setString(1, user.getUsername());
                stmt.setString(2, user.getEmail());
                stmt.setString(3, user.getUserRole().name());
                stmt.setString(4, user.getAvatar());
                stmt.setTimestamp(5, Timestamp.valueOf(user.getUpdatedAt()));
                stmt.setString(6, user.getPhone());
                stmt.setObject(7, id);
            });
        } catch (SQLException e) {
            throw new DatabaseException("Error updating user: " + e.getMessage());
        }
    }

    public void deleteUser(UUID id) {
        String query = "DELETE FROM users WHERE id = ?";

        try {
            executeUpdate(query, stmt -> stmt.setObject(1, id));
        } catch (SQLException e) {
            throw new DatabaseException("Error deleting user: " + e.getMessage());
        }
    }

    public Users getUserById(UUID id) {
        String query = "SELECT * FROM users WHERE id = ?";

        try {
            return executeQuery(query, stmt -> {
                stmt.setObject(1, id);
                ResultSet rs = stmt.executeQuery();
                if (rs.next()) {
                    return mapResultSetToUser(rs);
                }
                return null;
            });
        } catch (SQLException e) {
            throw new DatabaseException("Error getting user by ID: " + e.getMessage());
        }
    }

    public List<Users> getAllUsers() {
        String query = "SELECT * FROM users";

        try {
            return executeQuery(query, stmt -> {
                ResultSet rs = stmt.executeQuery();
                List<Users> users = new ArrayList<>();
                while (rs.next()) {
                    users.add(mapResultSetToUser(rs));
                }
                return users;
            });
        } catch (SQLException e) {
            throw new DatabaseException("Error getting all users: " + e.getMessage());
        }
    }

    public List<Users> getUsersByRole(UserRole role) {
        String query = "SELECT * FROM users WHERE user_role = ?";

        try {
            return executeQuery(query, stmt -> {
                stmt.setString(1, role.name());
                ResultSet rs = stmt.executeQuery();
                List<Users> users = new ArrayList<>();
                while (rs.next()) {
                    users.add(mapResultSetToUser(rs));
                }
                return users;
            });
        } catch (SQLException e) {
            throw new DatabaseException("Error getting users by role: " + e.getMessage());
        }
    }

    public Users getUserByUsername(String username) {
        String query = "SELECT * FROM users WHERE username = ?";

        try {
            return executeQuery(query, stmt -> {
                stmt.setString(1, username);
                ResultSet rs = stmt.executeQuery();
                if (rs.next()) {
                    return mapResultSetToUser(rs);
                }
                return null;
            });
        } catch (SQLException e) {
            throw new DatabaseException("Error getting user by username: " + e.getMessage());
        }
    }

    public Users getUserByEmail(String email) {
        String query = "SELECT * FROM users WHERE email = ?";

        try {
            return executeQuery(query, stmt -> {
                stmt.setString(1, email);
                ResultSet rs = stmt.executeQuery();
                if (rs.next()) {
                    return mapResultSetToUser(rs);
                }
                return null;
            });
        } catch (SQLException e) {
            throw new DatabaseException("Error getting user by email: " + e.getMessage());
        }
    }

    public List<Users> searchUsers(String keyword) {
        String query = "SELECT * FROM users WHERE username ILIKE ? OR email ILIKE ?";
        String searchPattern = "%" + keyword + "%";

        try {
            return executeQuery(query, stmt -> {
                stmt.setString(1, searchPattern);
                stmt.setString(2, searchPattern);
                ResultSet rs = stmt.executeQuery();
                List<Users> users = new ArrayList<>();
                while (rs.next()) {
                    users.add(mapResultSetToUser(rs));
                }
                return users;
            });
        } catch (SQLException e) {
            throw new DatabaseException("Error searching users: " + e.getMessage());
        }
    }
    public List<Users> getUsersByProjectId(UUID projectId) throws SQLException {
        String sql = "SELECT u.* FROM users u " +
                     "JOIN project_members pm ON u.id = pm.user_id " +
                     "WHERE pm.project_id = ?";
        return executeQuery(sql, stmt -> {
            stmt.setObject(1, projectId);
            List<Users> users = new ArrayList<>();
            ResultSet rs = stmt.executeQuery();
            while (rs.next()) {
                users.add(mapResultSetToUser(rs));
            }
            return users;
        });
    }

    public void updateAvatarUrl(UUID userId, String avatarUrl) {
        String sql = "UPDATE users SET avatar = ? WHERE id = ?";
        try {
            executeUpdate(sql, stmt -> {
                stmt.setString(1, avatarUrl);
                stmt.setObject(2, userId);
            });
        } catch (SQLException e) {
            throw new DatabaseException("Failed to update avatar: " + e.getMessage());
        }
    }
    
    
    private Users mapResultSetToUser(ResultSet rs) throws SQLException {
        return new Users.Builder()
                .id((UUID) rs.getObject("id"))
                .username(rs.getString("username"))
                .email(rs.getString("email"))
                .userRole(UserRole.valueOf(rs.getString("user_role")))
                .avatar(rs.getString("avatar"))
                .createdAt(rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toLocalDateTime() : null)
                .updatedAt(rs.getTimestamp("updated_at") != null ? rs.getTimestamp("updated_at").toLocalDateTime() : null)
                .phone(rs.getString("phone"))
                .build();
    }
}
