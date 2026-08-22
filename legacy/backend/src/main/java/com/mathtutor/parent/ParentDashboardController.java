package com.mathtutor.parent;

import com.mathtutor.auth.security.SecurityUtils;
import com.mathtutor.parent.dto.ParentDashboardDtos.ChartsDto;
import com.mathtutor.parent.dto.ParentDashboardDtos.ChildSummaryDto;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/parent")
@PreAuthorize("hasRole('PARENT')")
public class ParentDashboardController {

    private final ParentDashboardService service;

    public ParentDashboardController(ParentDashboardService service) {
        this.service = service;
    }

    /** At-a-glance summary across all of the parent's children. */
    @GetMapping("/overview")
    public List<ChildSummaryDto> overview() {
        return service.overview(SecurityUtils.currentPrincipal());
    }

    /** Chart data for one child: mastery-by-topic (for the given subject) + 7-day activity. */
    @GetMapping("/students/{studentId}/charts")
    public ChartsDto charts(@PathVariable UUID studentId,
                            @RequestParam(required = false) UUID gradeId) {
        return service.charts(SecurityUtils.currentPrincipal(), studentId, gradeId);
    }
}
