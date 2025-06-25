package com.tmnhat.accountsservice.validation;
import com.tmnhat.accountsservice.model.Accounts;
import com.tmnhat.accountsservice.model.LoginRequest;
import com.tmnhat.common.exception.BadRequestException;

import java.util.UUID;

public class AccountValidator {

    // Validate Account data
    public static void validateAccount(Accounts account) {
        if (account == null) {
            throw new BadRequestException("Account data is required");
        }
        if (account.getEmail() == null || account.getEmail().trim().isEmpty()) {
            throw new BadRequestException("Account email cannot be empty");
        }
        if (account.getPassword() == null || account.getPassword().trim().isEmpty()) {
            throw new BadRequestException("Account password cannot be empty");
        }
        if (account.getUserId() == null) {
            throw new BadRequestException("Associated user ID cannot be null");
        }
    }

    // Validate UUID when operating with account
    public static void validateId(UUID id) {
        if (id == null) {
            throw new BadRequestException("Invalid account ID: ID cannot be null");
        }
    }

    public static void validateLoginRequest(LoginRequest loginRequest) {
        if (loginRequest == null) {
            throw new BadRequestException("Login data is required");
        }
        if (loginRequest.getEmail() == null || loginRequest.getEmail().trim().isEmpty()) {
            throw new BadRequestException("Email cannot be empty");
        }
        if (loginRequest.getPassword() == null || loginRequest.getPassword().trim().isEmpty()) {
            throw new BadRequestException("Password cannot be empty");
        }
    }
}
