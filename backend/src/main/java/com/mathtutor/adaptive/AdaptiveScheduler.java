package com.mathtutor.adaptive;

import com.mathtutor.auth.Student;
import com.mathtutor.auth.StudentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Nightly refresh of every student's learning profile (including AI advice). */
@Component
public class AdaptiveScheduler {

    private static final Logger log = LoggerFactory.getLogger(AdaptiveScheduler.class);

    private final StudentRepository studentRepository;
    private final AdaptiveService adaptiveService;

    public AdaptiveScheduler(StudentRepository studentRepository, AdaptiveService adaptiveService) {
        this.studentRepository = studentRepository;
        this.adaptiveService = adaptiveService;
    }

    @Scheduled(cron = "${app.adaptive.nightly-cron:0 0 2 * * *}")
    public void refreshAllProfiles() {
        log.info("Nightly adaptive profile refresh starting");
        int count = 0;
        for (Student student : studentRepository.findAll()) {
            if (!student.isActive()) {
                continue;
            }
            try {
                adaptiveService.recompute(student.getId(), true);
                count++;
            } catch (Exception e) {
                log.warn("Profile refresh failed for student {}: {}", student.getId(), e.getMessage());
            }
        }
        log.info("Nightly adaptive profile refresh complete: {} profiles", count);
    }
}
