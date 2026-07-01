package com.mathtutor.notification;

import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class NotificationServiceTest {

    private final NotificationRepository notifRepo = mock(NotificationRepository.class);
    private final NotificationPreferenceRepository prefRepo = mock(NotificationPreferenceRepository.class);
    private final NotificationService service = new NotificationService(notifRepo, prefRepo);

    private final UUID student = UUID.randomUUID();

    @Test
    void createsNotificationWhenPreferenceUnset() {
        when(prefRepo.findByOwnerTypeAndOwnerIdAndType(any(), any(), any())).thenReturn(Optional.empty());

        service.notify(NotificationService.STUDENT, student, NotificationType.ACHIEVEMENT,
                "Badge!", "You earned a badge", "/student");

        verify(notifRepo).save(any(Notification.class));
    }

    @Test
    void skipsNotificationWhenPreferenceDisabled() {
        NotificationPreference disabled = new NotificationPreference();
        disabled.setEnabled(false);
        when(prefRepo.findByOwnerTypeAndOwnerIdAndType(eq(NotificationService.STUDENT), eq(student),
                eq(NotificationType.ACHIEVEMENT))).thenReturn(Optional.of(disabled));

        service.notify(NotificationService.STUDENT, student, NotificationType.ACHIEVEMENT,
                "Badge!", "You earned a badge", "/student");

        verify(notifRepo, never()).save(any());
    }
}
