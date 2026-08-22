package com.mathtutor.notification;

import com.mathtutor.auth.Role;
import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.notification.NotificationType.TypeInfo;
import com.mathtutor.notification.dto.NotificationDtos.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class NotificationService {

    public static final String PARENT = "PARENT";
    public static final String STUDENT = "STUDENT";

    private final NotificationRepository notificationRepository;
    private final NotificationPreferenceRepository preferenceRepository;

    public NotificationService(NotificationRepository notificationRepository,
                               NotificationPreferenceRepository preferenceRepository) {
        this.notificationRepository = notificationRepository;
        this.preferenceRepository = preferenceRepository;
    }

    /** Creates a notification unless the recipient has disabled this type. */
    @Transactional
    public void notify(String recipientType, UUID recipientId, String type,
                       String title, String message, String link) {
        if (!isEnabled(recipientType, recipientId, type)) {
            return;
        }
        Notification n = new Notification();
        n.setRecipientType(recipientType);
        n.setRecipientId(recipientId);
        n.setType(type);
        n.setTitle(title);
        n.setMessage(message);
        n.setLink(link);
        notificationRepository.save(n);
    }

    @Transactional(readOnly = true)
    public List<NotificationDto> list(AuthPrincipal principal, int limit) {
        String type = recipientType(principal);
        return notificationRepository
                .findByRecipientTypeAndRecipientIdOrderByCreatedAtDesc(type, principal.id(), PageRequest.of(0, limit))
                .stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount(AuthPrincipal principal) {
        return notificationRepository.countByRecipientTypeAndRecipientIdAndReadFalse(
                recipientType(principal), principal.id());
    }

    @Transactional
    public void markRead(AuthPrincipal principal, List<UUID> ids) {
        String type = recipientType(principal);
        List<Notification> toMark = (ids == null || ids.isEmpty())
                ? notificationRepository.findByRecipientTypeAndRecipientIdAndReadFalse(type, principal.id())
                : notificationRepository.findAllById(ids).stream()
                    .filter(n -> n.getRecipientType().equals(type) && n.getRecipientId().equals(principal.id()))
                    .toList();
        toMark.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(toMark);
    }

    @Transactional(readOnly = true)
    public List<PreferenceDto> preferences(AuthPrincipal principal) {
        String ownerType = recipientType(principal);
        List<TypeInfo> catalog = principal.role() == Role.PARENT
                ? NotificationType.forParent() : NotificationType.forStudent();
        Map<String, Boolean> set = new HashMap<>();
        preferenceRepository.findByOwnerTypeAndOwnerId(ownerType, principal.id())
                .forEach(p -> set.put(p.getType(), p.isEnabled()));
        return catalog.stream()
                .map(t -> new PreferenceDto(t.type(), t.label(), set.getOrDefault(t.type(), true)))
                .toList();
    }

    @Transactional
    public void updatePreference(AuthPrincipal principal, String type, boolean enabled) {
        String ownerType = recipientType(principal);
        NotificationPreference pref = preferenceRepository
                .findByOwnerTypeAndOwnerIdAndType(ownerType, principal.id(), type)
                .orElseGet(() -> {
                    NotificationPreference p = new NotificationPreference();
                    p.setOwnerType(ownerType);
                    p.setOwnerId(principal.id());
                    p.setType(type);
                    return p;
                });
        pref.setEnabled(enabled);
        pref.setUpdatedAt(Instant.now());
        preferenceRepository.save(pref);
    }

    private boolean isEnabled(String ownerType, UUID ownerId, String type) {
        return preferenceRepository.findByOwnerTypeAndOwnerIdAndType(ownerType, ownerId, type)
                .map(NotificationPreference::isEnabled)
                .orElse(true); // default on
    }

    private String recipientType(AuthPrincipal principal) {
        return principal.role() == Role.PARENT ? PARENT : STUDENT;
    }

    private NotificationDto toDto(Notification n) {
        return new NotificationDto(n.getId(), n.getType(), n.getTitle(), n.getMessage(),
                n.getLink(), n.isRead(), n.getCreatedAt());
    }
}
