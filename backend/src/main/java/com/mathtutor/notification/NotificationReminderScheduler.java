package com.mathtutor.notification;

import com.mathtutor.auth.Student;
import com.mathtutor.auth.StudentRepository;
import com.mathtutor.gamification.GamificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/** Sends a gentle daily reminder to any student who has not practiced today. */
@Component
public class NotificationReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(NotificationReminderScheduler.class);

    private final StudentRepository studentRepository;
    private final GamificationService gamificationService;
    private final NotificationService notificationService;

    public NotificationReminderScheduler(StudentRepository studentRepository,
                                         GamificationService gamificationService,
                                         NotificationService notificationService) {
        this.studentRepository = studentRepository;
        this.gamificationService = gamificationService;
        this.notificationService = notificationService;
    }

    @Scheduled(cron = "${app.notifications.reminder-cron:0 0 18 * * *}")
    public void sendDailyReminders() {
        LocalDate today = LocalDate.now();
        int sent = 0;
        for (Student student : studentRepository.findAll()) {
            if (!student.isActive() || gamificationService.wasActiveOn(student.getId(), today)) {
                continue;
            }
            notificationService.notify(NotificationService.STUDENT, student.getId(),
                    NotificationType.REMINDER, "Time to practice! 🔥",
                    "Keep your streak going — a few minutes with Aria today makes a big difference.",
                    "/student");
            sent++;
        }
        log.info("Daily reminders sent: {}", sent);
    }
}
