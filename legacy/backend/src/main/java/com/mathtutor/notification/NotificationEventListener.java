package com.mathtutor.notification;

import com.mathtutor.auth.Student;
import com.mathtutor.auth.StudentRepository;
import com.mathtutor.curriculum.CurriculumService;
import com.mathtutor.notification.events.NotificationEvents.*;
import com.mathtutor.progress.ProgressService;
import com.mathtutor.progress.dto.ProgressDtos.TopicProgressDto;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Turns domain events into notifications. Uses plain {@code @EventListener} so the
 * notification write happens inside the publishing transaction and commits with it
 * (an AFTER_COMMIT listener would join the already-completed transaction and lose the write).
 */
@Component
public class NotificationEventListener {

    private final NotificationService notifications;
    private final StudentRepository studentRepository;
    private final CurriculumService curriculumService;
    private final ProgressService progressService;

    public NotificationEventListener(NotificationService notifications,
                                     StudentRepository studentRepository,
                                     CurriculumService curriculumService,
                                     ProgressService progressService) {
        this.notifications = notifications;
        this.studentRepository = studentRepository;
        this.curriculumService = curriculumService;
        this.progressService = progressService;
    }

    @EventListener
    public void onAchievement(AchievementEarnedEvent e) {
        notifications.notify(NotificationService.STUDENT, e.studentId(), NotificationType.ACHIEVEMENT,
                "Badge earned! " + e.icon(), "You earned the \"" + e.name() + "\" badge!", "/student");
    }

    @EventListener
    public void onMastered(TopicMasteredEvent e) {
        String topicName = topicName(e.topicId());
        notifications.notify(NotificationService.STUDENT, e.studentId(), NotificationType.MASTERY,
                "Topic mastered! 🏆", "You mastered " + topicName + "! Amazing work.", "/student");

        // New topic unlocked?
        progressService.nextTopicAfter(e.studentId(), e.topicId()).ifPresent(next ->
                notifications.notify(NotificationService.STUDENT, e.studentId(), NotificationType.UNLOCK,
                        "New topic unlocked! 🔓", next.topicName() + " is now available to learn.",
                        "/student/topic/" + next.topicId() + "/knowledge"));

        // Tell the parent.
        student(e.studentId()).ifPresent(s ->
                notifications.notify(NotificationService.PARENT, s.getParentId(), NotificationType.CHILD_MASTERY,
                        s.getDisplayName() + " mastered a topic 🏆",
                        s.getDisplayName() + " mastered " + topicName + ".",
                        "/parent/students/" + s.getId() + "/insights"));
    }

    @EventListener
    public void onHomeworkAssigned(HomeworkAssignedEvent e) {
        String topicName = topicName(e.topicId());
        notifications.notify(NotificationService.STUDENT, e.studentId(), NotificationType.HOMEWORK_ASSIGNED,
                "New homework 🏠", "Aria assigned homework for " + topicName + ".",
                "/student/topic/" + e.topicId() + "/homework");
    }

    @EventListener
    public void onHomeworkGraded(HomeworkGradedEvent e) {
        String topicName = topicName(e.topicId());
        notifications.notify(NotificationService.STUDENT, e.studentId(), NotificationType.HOMEWORK_GRADED,
                "Homework graded ✅", "Your " + topicName + " homework scored " + e.score() + "%.",
                "/student/topic/" + e.topicId() + "/homework");

        student(e.studentId()).ifPresent(s ->
                notifications.notify(NotificationService.PARENT, s.getParentId(), NotificationType.CHILD_HOMEWORK,
                        s.getDisplayName() + "'s homework graded",
                        s.getDisplayName() + " scored " + e.score() + "% on " + topicName + " homework.",
                        "/parent/students/" + s.getId() + "/insights"));
    }

    private java.util.Optional<Student> student(UUID studentId) {
        return studentRepository.findById(studentId);
    }

    private String topicName(UUID topicId) {
        try {
            return curriculumService.requireTopic(topicId).getName();
        } catch (Exception ex) {
            return "your topic";
        }
    }
}
