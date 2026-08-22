package com.mathtutor.report;

import com.mathtutor.auth.security.SecurityUtils;
import com.mathtutor.report.dto.ReportDto;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/parent")
@PreAuthorize("hasRole('PARENT')")
public class ReportController {

    private final ReportService reportService;
    private final ReportPdfRenderer pdfRenderer;

    public ReportController(ReportService reportService, ReportPdfRenderer pdfRenderer) {
        this.reportService = reportService;
        this.pdfRenderer = pdfRenderer;
    }

    /** Generates a report for a child over the given period (DAILY..YEARLY). */
    @PostMapping("/students/{studentId}/reports")
    public ReportDto generate(@PathVariable UUID studentId,
                              @RequestParam(defaultValue = "WEEKLY") String scope) {
        return reportService.generate(SecurityUtils.currentPrincipal(), studentId, scope);
    }

    /** Downloads a previously generated report as a PDF. */
    @GetMapping("/reports/{reportId}/pdf")
    public ResponseEntity<byte[]> pdf(@PathVariable UUID reportId) {
        ReportDto report = reportService.loadForOwner(SecurityUtils.currentPrincipal(), reportId);
        byte[] bytes = pdfRenderer.render(report);
        String filename = "aria-report-" + report.studentName().toLowerCase().replaceAll("\\s+", "-")
                + "-" + report.scope().toLowerCase() + ".pdf";
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(bytes);
    }
}
