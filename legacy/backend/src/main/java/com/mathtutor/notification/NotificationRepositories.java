package com.mathtutor.notification;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface NotificationRepository extends JpaRepository<Notification, UUID> {
    List<Notification> findByRecipientTypeAndRecipientIdOrderByCreatedAtDesc(
            String recipientType, UUID recipientId, Pageable pageable);
    long countByRecipientTypeAndRecipientIdAndReadFalse(String recipientType, UUID recipientId);
    List<Notification> findByRecipientTypeAndRecipientIdAndReadFalse(String recipientType, UUID recipientId);
}

interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, UUID> {
    Optional<NotificationPreference> findByOwnerTypeAndOwnerIdAndType(String ownerType, UUID ownerId, String type);
    List<NotificationPreference> findByOwnerTypeAndOwnerId(String ownerType, UUID ownerId);
}
