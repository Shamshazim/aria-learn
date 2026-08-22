package com.mathtutor.practice;

import com.mathtutor.auth.security.SecurityUtils;
import com.mathtutor.practice.dto.PracticeDtos.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/practice")
@PreAuthorize("hasRole('STUDENT')")
public class PracticeController {

    private final PracticeService practiceService;

    public PracticeController(PracticeService practiceService) {
        this.practiceService = practiceService;
    }

    @PostMapping("/independent")
    public PracticeSetDto independent(@Valid @RequestBody GeneratePracticeRequest request) {
        return practiceService.generateIndependent(SecurityUtils.currentPrincipal(), request);
    }

    @PostMapping("/answer")
    public AnswerResult answer(@Valid @RequestBody AnswerRequest request) {
        return practiceService.checkAnswer(SecurityUtils.currentPrincipal(), request);
    }
}
