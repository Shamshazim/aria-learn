package com.mathtutor.report;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathtutor.adaptive.AdaptiveService;
import com.mathtutor.adaptive.dto.AdaptiveDtos.ProfileDto;
import com.mathtutor.auth.Student;
import com.mathtutor.auth.StudentService;
import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.common.AiException;
import com.mathtutor.common.ForbiddenException;
import com.mathtutor.common.NotFoundException;
import com.mathtutor.curriculum.Grade;
import com.mathtutor.curriculum.GradeRepository;
import com.mathtutor.gamification.GamificationService;
import com.mathtutor.gamification.GamificationService.ActivityDay;
import com.mathtutor.gamification.dto.GamificationDtos.GamificationSummary;
import com.mathtutor.mastery.MasteryService;
import com.mathtutor.mastery.dto.MasteryDtos.MasteryBreakdownDto;
import com.mathtutor.progress.ProgressService;
import com.mathtutor.progress.dto.ProgressDtos.TopicProgressDto;
import com.mathtutor.report.dto.ReportDto;
import com.mathtutor.report.dto.ReportDto.TopicLine;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ReportService {

    private static final DateTimeFormatter NICE = DateTimeFormatter.ofPattern("MMM d, yyyy");
    private static final Map<String, Integer> SCOPE_DAYS = Map.of(
            "DAILY", 1, "WEEKLY", 7, "MONTHLY", 30, "QUARTERLY", 90, "YEARLY", 365);

    private final StudentService studentService;
    private final GradeRepository gradeRepository;
    private final GamificationService gamificationService;
    private final AdaptiveService adaptiveService;
    private final ProgressService progressService;
    private final MasteryService masteryService;
    private final ReportRepository reportRepository;
    private final ObjectMapper objectMapper;

    public ReportService(StudentService studentService,
                         GradeRepository gradeRepository,
                         GamificationService gamificationService,
                         AdaptiveService adaptiveService,
                         ProgressService progressService,
                         MasteryService masteryService,
                         ReportRepository reportRepository,
                         ObjectMapper objectMapper) {
        this.studentService = studentService;
        this.gradeRepository = gradeRepository;
        this.gamificationService = gamificationService;
        this.adaptiveService = adaptiveService;
        this.progressService = progressService;
        this.masteryService = masteryService;
        this.reportRepository = reportRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ReportDto generate(AuthPrincipal parent, UUID studentId, String scopeRaw) {
        Student student = studentService.requireOwnedStudent(parent, studentId);
        String scope = normalizeScope(scopeRaw);
        int days = SCOPE_DAYS.get(scope);

        LocalDate end = LocalDate.now();
        LocalDate start = end.minusDays(days - 1L);

        String gradeName = student.getCurrentGradeId() == null ? "" :
                gradeRepository.findById(student.getCurrentGradeId()).map(Grade::getName).orElse("");

        GamificationSummary game = gamificationService.summary(studentId);
        ProfileDto profile = adaptiveService.getProfile(studentId);
        List<TopicProgressDto> progress = progressService.progressFor(studentId);

        List<TopicLine> mastery = progress.stream().map(p -> {
            MasteryBreakdownDto b = masteryService.breakdown(studentId, p.topicId());
            return new TopicLine(p.topicName(), p.status(), p.masteryScore(), b.quizBestScore(), b.homeworkScore());
        }).toList();

        List<ActivityDay> activity = gamificationService.activityByDay(studentId, days);
        int periodXp = activity.stream().mapToInt(ActivityDay::xp).sum();
        int periodActivities = activity.stream().mapToInt(ActivityDay::count).sum();
        int activeDays = (int) activity.stream().filter(a -> a.count() > 0).count();

        List<String> strengths = profile.strengths().stream().map(s -> s.topicName() + " (" + s.score() + "%)").toList();
        List<String> weaknesses = profile.weaknesses().stream().map(w -> w.topicName() + " (" + w.score() + "%)").toList();
        List<String> recommendations = profile.recommendations().stream().map(r -> r.reason()).toList();

        ReportDto dto = new ReportDto(null, student.getDisplayName(), gradeName, scope,
                start.format(NICE), end.format(NICE), end.format(NICE),
                game.level(), game.xpTotal(), game.streak().current(),
                profile.accuracy(), profile.masteredCount(), profile.inProgressCount(), progress.size(),
                periodXp, periodActivities, activeDays,
                mastery, strengths, weaknesses, recommendations, profile.advice());

        Report report = new Report();
        report.setOwnerId(parent.id());
        report.setStudentId(studentId);
        report.setScope(scope);
        report.setPeriodStart(start);
        report.setPeriodEnd(end);
        report.setData(serialize(dto));
        report = reportRepository.save(report);

        return dto.withReportId(report.getId());
    }

    /** Loads a previously generated report for PDF rendering (ownership enforced). */
    @Transactional(readOnly = true)
    public ReportDto loadForOwner(AuthPrincipal parent, UUID reportId) {
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new NotFoundException("Report not found"));
        if (!report.getOwnerId().equals(parent.id())) {
            throw new ForbiddenException("This report does not belong to you");
        }
        return deserialize(report.getData()).withReportId(report.getId());
    }

    private String normalizeScope(String scope) {
        if (scope == null) {
            return "WEEKLY";
        }
        String upper = scope.trim().toUpperCase();
        return SCOPE_DAYS.containsKey(upper) ? upper : "WEEKLY";
    }

    private String serialize(ReportDto dto) {
        try {
            return objectMapper.writeValueAsString(dto);
        } catch (Exception e) {
            throw new AiException("Failed to serialize report", e);
        }
    }

    private ReportDto deserialize(String json) {
        try {
            return objectMapper.readValue(json, ReportDto.class);
        } catch (Exception e) {
            throw new AiException("Failed to read report", e);
        }
    }
}
