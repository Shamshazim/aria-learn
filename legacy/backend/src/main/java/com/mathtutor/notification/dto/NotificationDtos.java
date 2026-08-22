package com.mathtutor.notification.dto;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class NotificationDtos {

    public record NotificationDto(
            UUID id,
            String type,
            String title,
            String message,
            String link,
            boolean read,
            Instant createdAt) {
    }

    public record PreferenceDto(String type, String label, boolean enabled) {
    }

    public record UpdatePreferenceRequest(
            @NotNull String type,
            @NotNull Boolean enabled) {
    }

    public record MarkReadRequest(List<UUID> ids) {
    }
}
