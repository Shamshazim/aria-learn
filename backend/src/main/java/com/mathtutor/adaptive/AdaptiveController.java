package com.mathtutor.adaptive;

import com.mathtutor.adaptive.dto.AdaptiveDtos.ProfileDto;
import com.mathtutor.auth.StudentService;
import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.auth.security.SecurityUtils;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class AdaptiveController {

    private final AdaptiveService adaptiveService;
    private final StudentService studentService;

    public AdaptiveController(AdaptiveService adaptiveService, StudentService studentService) {
        this.adaptiveService = adaptiveService;
        this.studentService = studentService;
    }

    /** The signed-in student's learning profile for a subject (gradeId), or across all if omitted. */
    @GetMapping("/student/profile")
    @PreAuthorize("hasRole('STUDENT')")
    public ProfileDto myProfile(@RequestParam(required = false) UUID gradeId) {
        UUID studentId = SecurityUtils.currentPrincipal().id();
        return gradeId == null ? adaptiveService.getProfile(studentId)
                : adaptiveService.getProfile(studentId, gradeId);
    }

    /** A parent viewing one of their own children's learning profile (ownership enforced). */
    @GetMapping("/parent/students/{studentId}/profile")
    @PreAuthorize("hasRole('PARENT')")
    public ProfileDto childProfile(@PathVariable UUID studentId) {
        AuthPrincipal parent = SecurityUtils.currentPrincipal();
        studentService.requireOwnedStudent(parent, studentId);
        return adaptiveService.getProfile(studentId);
    }
}
