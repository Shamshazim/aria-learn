package com.mathtutor.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public class StudentDtos {

    public record CreateStudentRequest(
            @NotBlank String username,
            @NotBlank @Size(min = 4, message = "Password must be at least 4 characters") String password,
            @NotBlank String displayName,
            @NotNull UUID gradeId,
            Integer birthYear) {
    }

    public record ResetPasswordRequest(
            @NotBlank @Size(min = 6, message = "Password must be at least 6 characters") String newPassword) {
    }

    public record StudentResponse(
            UUID id,
            String username,
            String displayName,
            String avatar,
            UUID currentGradeId,
            Integer birthYear) {
    }
}
