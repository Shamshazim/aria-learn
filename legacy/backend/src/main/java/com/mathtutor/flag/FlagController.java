package com.mathtutor.flag;

import com.mathtutor.auth.security.SecurityUtils;
import com.mathtutor.flag.FlagService.FlagDto;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class FlagController {

    private final FlagService flagService;

    public FlagController(FlagService flagService) {
        this.flagService = flagService;
    }

    public record FlagRequest(String reason) {
    }

    /** A student reports a question as wrong or confusing. */
    @PostMapping("/questions/{questionId}/flag")
    @PreAuthorize("hasRole('STUDENT')")
    public void flag(@PathVariable UUID questionId, @RequestBody(required = false) FlagRequest request) {
        flagService.flag(SecurityUtils.currentPrincipal().id(), questionId,
                request == null ? null : request.reason());
    }

    /** Parent: open reports across their children. */
    @GetMapping("/parent/flags")
    @PreAuthorize("hasRole('PARENT')")
    public List<FlagDto> flags() {
        return flagService.openForParent(SecurityUtils.currentPrincipal());
    }

    /** Parent: dismiss a report. */
    @PostMapping("/parent/flags/{flagId}/resolve")
    @PreAuthorize("hasRole('PARENT')")
    public void resolve(@PathVariable UUID flagId) {
        flagService.resolve(SecurityUtils.currentPrincipal(), flagId);
    }
}
