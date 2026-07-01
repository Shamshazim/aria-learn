package com.mathtutor.quiz;

import com.mathtutor.auth.security.SecurityUtils;
import com.mathtutor.quiz.dto.QuizDtos.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/quiz")
@PreAuthorize("hasRole('STUDENT')")
public class QuizController {

    private final QuizService quizService;

    public QuizController(QuizService quizService) {
        this.quizService = quizService;
    }

    /** Generates a quiz for the topic and opens an attempt. */
    @PostMapping("/start")
    public QuizDto start(@Valid @RequestBody StartQuizRequest request) {
        return quizService.start(SecurityUtils.currentPrincipal(), request.topicId());
    }

    /** Grades the submitted answers, returning the score and per-question feedback. */
    @PostMapping("/submit")
    public QuizResult submit(@Valid @RequestBody SubmitQuizRequest request) {
        return quizService.submit(SecurityUtils.currentPrincipal(), request);
    }
}
