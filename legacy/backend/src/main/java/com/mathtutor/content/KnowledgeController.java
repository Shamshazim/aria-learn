package com.mathtutor.content;

import com.mathtutor.auth.Role;
import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.auth.security.SecurityUtils;
import com.mathtutor.content.ExamplesService.ExamplesView;
import com.mathtutor.content.KnowledgeService.KnowledgeView;
import com.mathtutor.mastery.MasteryService;
import com.mathtutor.progress.ProgressService;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/topics")
public class KnowledgeController {

    private final KnowledgeService knowledgeService;
    private final ExamplesService examplesService;
    private final ProgressService progressService;
    private final MasteryService masteryService;
    private final com.mathtutor.gamification.GamificationService gamificationService;

    public KnowledgeController(KnowledgeService knowledgeService,
                              ExamplesService examplesService,
                              ProgressService progressService,
                              MasteryService masteryService,
                              com.mathtutor.gamification.GamificationService gamificationService) {
        this.knowledgeService = knowledgeService;
        this.examplesService = examplesService;
        this.progressService = progressService;
        this.masteryService = masteryService;
        this.gamificationService = gamificationService;
    }

    /** Returns the topic's knowledge article, generating it on first access.
     *  For students this enforces progression gating and records the lesson as viewed. */
    @GetMapping("/{topicId}/knowledge")
    public KnowledgeView knowledge(@PathVariable UUID topicId) {
        AuthPrincipal principal = SecurityUtils.currentPrincipal();
        boolean isStudent = principal.role() == Role.STUDENT;
        UUID studentId = isStudent ? principal.id() : null; // null => generic parent-preview version
        if (isStudent) {
            progressService.assertUnlocked(principal.id(), topicId);
        }
        KnowledgeView view = knowledgeService.getOrGenerate(studentId, topicId);
        if (isStudent) {
            masteryService.recordKnowledgeViewed(principal.id(), topicId);
            gamificationService.onKnowledgeViewed(principal.id());
        }
        return view;
    }

    /** Re-explains a topic in a fresh, simpler way when the student is stuck. Generates a new
     *  explanation each call (not cached) so repeated clicks give a different take. */
    @GetMapping("/{topicId}/elaborate")
    public KnowledgeView elaborate(@PathVariable UUID topicId) {
        AuthPrincipal principal = SecurityUtils.currentPrincipal();
        if (principal.role() == Role.STUDENT) {
            progressService.assertUnlocked(principal.id(), topicId);
        }
        return knowledgeService.elaborate(principal.role() == Role.STUDENT ? principal.id() : null, topicId);
    }

    /** Returns the topic's worked examples, personalized to the student (generated on first access). */
    @GetMapping("/{topicId}/examples")
    public ExamplesView examples(@PathVariable UUID topicId) {
        AuthPrincipal principal = SecurityUtils.currentPrincipal();
        boolean isStudent = principal.role() == Role.STUDENT;
        UUID studentId = isStudent ? principal.id() : null;
        if (isStudent) {
            progressService.assertUnlocked(principal.id(), topicId);
        }
        return examplesService.getOrGenerate(studentId, topicId);
    }
}
