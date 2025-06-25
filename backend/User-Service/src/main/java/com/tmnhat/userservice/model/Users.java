package com.tmnhat.userservice.model;

import com.tmnhat.userservice.payload.enums.UserRole;

import java.time.LocalDateTime;
import java.util.UUID;

public class Users {

    private UUID id;
    private String username;
    private String email;
    private UserRole userRole;
    private String avatar;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String phone;

    public Users() {
    }

    private Users(Builder builder) {
        this.id = builder.id;
        this.username = builder.username;
        this.email = builder.email;
        this.userRole = builder.userRole;
        this.avatar = builder.avatar;
        this.createdAt = builder.createdAt;
        this.updatedAt = builder.updatedAt;
        this.phone = builder.phone;
    }

    // Getters & Setters

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public UserRole getUserRole() {
        return userRole;
    }

    public void setUserRole(UserRole userRole) {
        this.userRole = userRole;
    }

    public String getAvatar() {
        return avatar;
    }

    public void setAvatar(String avatar) {
        this.avatar = avatar;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    // Builder class

    public static class Builder {
        private UUID id;
        private String username;
        private String email;
        private UserRole userRole;
        private String avatar;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private String phone;

        public Builder() {
        }

        public Builder id(UUID id) {
            this.id = id;
            return this;
        }

        public Builder username(String username) {
            this.username = username;
            return this;
        }

        public Builder email(String email) {
            this.email = email;
            return this;
        }

        public Builder userRole(UserRole userRole) {
            this.userRole = userRole;
            return this;
        }

        public Builder avatar(String avatar) {
            this.avatar = avatar;
            return this;
        }

        public Builder createdAt(LocalDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public Builder updatedAt(LocalDateTime updatedAt) {
            this.updatedAt = updatedAt;
            return this;
        }

        public Builder phone(String phone) {
            this.phone = phone;
            return this;
        }

        public Users build() {
            return new Users(this);
        }
    }
} 