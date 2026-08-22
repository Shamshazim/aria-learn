package com.mathtutor.parent;

import com.mathtutor.auth.dto.StudentDtos.StudentResponse;
import com.mathtutor.auth.StudentService;
import com.mathtutor.auth.security.AuthPrincipal;
import com.mathtutor.gamification.GamificationService;
import com.mathtutor.gamification.dto.GamificationDtos.GamificationSummary;
import com.mathtutor.gamification.dto.GamificationDtos.GoalDto;
import com.mathtutor.mastery.MasteryRecord;
import com.mathtutor.mastery.MasteryService;
import com.mathtutor.mastery.dto.MasteryDtos.MasteryBreakdownDto;
import com.mathtutor.parent.dto.ParentDashboardDtos.*;
import com.mathtutor.progress.ProgressService;
import com.mathtutor.progress.dto.ProgressDtos.TopicProgressDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Composes the parent-facing views from the existing learning subsystems
 * (gamification, mastery, progress) — no new storage of its own.
 */
@Service
public class ParentDashboardService {

    private final StudentService studentService;
    private final GamificationService gamificationService;
    private final MasteryService masteryService;
    private final ProgressService progressService;

    public ParentDashboardService(StudentService studentService,
                                  GamificationService gamificationService,
                                  MasteryService masteryService,
                                  ProgressService progressService) {
        this.studentService = studentService;
        this.gamificationService = gamificationService;
        this.masteryService = masteryService;
        this.progressService = progressService;
    }

    @Transactional
    public List<ChildSummaryDto> overview(AuthPrincipal parent) {
        List<ChildSummaryDto> out = new ArrayList<>();
        for (StudentResponse child : studentService.listMyStudents(parent)) {
            out.add(buildSummary(child));
        }
        return out;
    }

    @Transactional
    public ChartsDto charts(AuthPrincipal parent, UUID studentId) {
        return charts(parent, studentId, null);
    }

    /** Charts scoped to one subject (gradeId), or the child's primary subject if omitted. */
    @Transactional
    public ChartsDto charts(AuthPrincipal parent, UUID studentId, UUID gradeId) {
        studentService.requireOwnedStudent(parent, studentId); // 403 if not their child

        List<TopicProgressDto> topics = gradeId == null
                ? progressService.progressFor(studentId)
                : progressService.progressForGrade(studentId, gradeId);

        List<TopicMasteryChartDto> byTopic = new ArrayList<>();
        for (TopicProgressDto p : topics) {
            MasteryBreakdownDto b = masteryService.breakdown(studentId, p.topicId());
            byTopic.add(new TopicMasteryChartDto(p.topicId(), p.topicName(), p.status(),
                    p.masteryScore(), b.knowledgeScore(), b.practiceScore(),
                    b.quizBestScore(), b.homeworkScore()));
        }

        List<ActivityDayDto> activity = gamificationService.activityByDay(studentId, 7).stream()
                .map(a -> new ActivityDayDto(a.date().toString(), a.xp(), a.count()))
                .toList();

        return new ChartsDto(byTopic, activity);
    }

    private ChildSummaryDto buildSummary(StudentResponse child) {
        GamificationSummary game = gamificationService.summary(child.id());
        GoalDto weekly = game.goals().stream()
                .filter(g -> "WEEKLY".equals(g.period()))
                .findFirst().orElse(null);

        List<MasteryRecord> records = masteryService.allForStudent(child.id());
        int mastered = 0, inProgress = 0, sum = 0, active = 0;
        for (MasteryRecord r : records) {
            boolean hasActivity = r.getKnowledgeScore() != null || r.getPracticeTotal() > 0
                    || r.getQuizBestScore() != null || r.getHomeworkScore() != null;
            if (hasActivity) {
                active++;
                sum += r.getTotalScore();
            }
            if (r.isMastered()) {
                mastered++;
            } else if (hasActivity) {
                inProgress++;
            }
        }
        int accuracy = active > 0 ? Math.round((float) sum / active) : 0;

        return new ChildSummaryDto(child.id(), child.displayName(), game.level(), game.xpTotal(),
                game.streak().current(), mastered, inProgress, accuracy,
                weekly == null ? 0 : weekly.progress(), weekly == null ? 0 : weekly.target());
    }
}
