package com.mathtutor.notification;

import com.mathtutor.auth.security.SecurityUtils;
import com.mathtutor.notification.dto.NotificationDtos.*;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Notifications for the signed-in user (parent OR student). Deliberately NOT
 * role-restricted — both roles read their own notifications from the same endpoints.
 */
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    public List<NotificationDto> list(@RequestParam(defaultValue = "20") int limit) {
        return service.list(SecurityUtils.currentPrincipal(), Math.min(limit, 100));
    }

    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount() {
        return Map.of("count", service.unreadCount(SecurityUtils.currentPrincipal()));
    }

    /** Marks the given notifications read, or all if no ids are provided. */
    @PostMapping("/read")
    public void markRead(@RequestBody(required = false) MarkReadRequest request) {
        service.markRead(SecurityUtils.currentPrincipal(), request == null ? null : request.ids());
    }

    @GetMapping("/preferences")
    public List<PreferenceDto> preferences() {
        return service.preferences(SecurityUtils.currentPrincipal());
    }

    @PutMapping("/preferences")
    public void updatePreference(@Valid @RequestBody UpdatePreferenceRequest request) {
        service.updatePreference(SecurityUtils.currentPrincipal(), request.type(), request.enabled());
    }
}
