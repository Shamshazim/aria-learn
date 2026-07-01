package com.mathtutor.auth.dto;

import com.mathtutor.auth.Role;
import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public class AuthDtos {

    public record LoginRequest(
            @NotBlank String usernameOrEmail,
            @NotBlank String password) {
    }

    public record RefreshRequest(
            @NotBlank String refreshToken) {
    }

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @jakarta.validation.constraints.Size(min = 6, message = "New password must be at least 6 characters") String newPassword) {
    }

    public record TokenResponse(
            String accessToken,
            String refreshToken,
            UUID id,
            Role role,
            String displayName) {
    }
}
