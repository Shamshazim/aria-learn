package com.mathtutor.progress;

import com.mathtutor.auth.StudentService;
import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.auth.security.SecurityUtils;
import com.mathtutor.mastery.MasteryService;
import com.mathtutor.mastery.dto.MasteryDtos.MasteryBreakdownDto;
import com.mathtutor.progress.dto.ProgressDtos.TopicProgressDto;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class ProgressController {

    private final ProgressService progressService;
    private final MasteryService masteryService;
    private final StudentService studentService;

    public ProgressController(ProgressService progressService,
                              MasteryService masteryService,
                              StudentService studentService) {
        this.progressService = progressService;
        this.masteryService = masteryService;
        this.studentService = studentService;
    }

    /** A student's own progress for a subject (gradeId), or their primary subject if omitted. */
    @GetMapping("/student/progress")
    @PreAuthorize("hasRole('STUDENT')")
    public List<TopicProgressDto> myProgress(@RequestParam(required = false) UUID gradeId) {
        UUID studentId = SecurityUtils.currentPrincipal().id();
        return gradeId == null ? progressService.progressFor(studentId)
                : progressService.progressForGrade(studentId, gradeId);
    }

    /** A student's own mastery breakdown for one topic. */
    @GetMapping("/student/topics/{topicId}/mastery")
    @PreAuthorize("hasRole('STUDENT')")
    public MasteryBreakdownDto myMastery(@PathVariable UUID topicId) {
        return masteryService.breakdown(SecurityUtils.currentPrincipal().id(), topicId);
    }

    /** A parent viewing one of their own children's progress (ownership enforced). */
    @GetMapping("/parent/students/{studentId}/progress")
    @PreAuthorize("hasRole('PARENT')")
    public List<TopicProgressDto> childProgress(@PathVariable UUID studentId,
                                                @RequestParam(required = false) UUID gradeId) {
        AuthPrincipal parent = SecurityUtils.currentPrincipal();
        studentService.requireOwnedStudent(parent, studentId); // 403 if not their child
        return gradeId == null ? progressService.progressFor(studentId)
                : progressService.progressForGrade(studentId, gradeId);
    }
}
