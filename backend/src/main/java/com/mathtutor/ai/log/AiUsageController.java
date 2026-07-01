package com.mathtutor.ai.log;

import com.mathtutor.ai.log.AiUsageService.UsageSummary;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/admin/ai-usage")
@PreAuthorize("hasRole('PARENT')")
public class AiUsageController {

    private final AiUsageService usageService;

    public AiUsageController(AiUsageService usageService) {
        this.usageService = usageService;
    }

    @GetMapping
    public UsageSummary usage(@RequestParam(defaultValue = "14") int days) {
        return usageService.usage(Math.min(Math.max(days, 1), 90));
    }
}
