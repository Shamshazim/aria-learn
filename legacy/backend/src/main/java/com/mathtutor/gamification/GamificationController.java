package com.mathtutor.gamification;

import com.mathtutor.auth.StudentService;
import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.auth.security.SecurityUtils;
import com.mathtutor.gamification.dto.GamificationDtos.GamificationSummary;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class GamificationController {

    private final GamificationService gamificationService;
    private final StudentService studentService;

    public GamificationController(GamificationService gamificationService, StudentService studentService) {
        this.gamificationService = gamificationService;
        this.studentService = studentService;
    }

    /** The signed-in student's XP, level, streak, goals, and achievements. */
    @GetMapping("/student/gamification")
    @PreAuthorize("hasRole('STUDENT')")
    public GamificationSummary mine() {
        return gamificationService.summary(SecurityUtils.currentPrincipal().id());
    }

    /** Parent view of a child's gamification summary (ownership enforced). */
    @GetMapping("/parent/students/{studentId}/gamification")
    @PreAuthorize("hasRole('PARENT')")
    public GamificationSummary child(@PathVariable UUID studentId) {
        AuthPrincipal parent = SecurityUtils.currentPrincipal();
        studentService.requireOwnedStudent(parent, studentId);
        return gamificationService.summary(studentId);
    }
}
