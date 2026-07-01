package com.mathtutor.progress;

import com.mathtutor.common.ForbiddenException;
import com.mathtutor.common.NotFoundException;
import com.mathtutor.curriculum.CurriculumService;
import com.mathtutor.curriculum.dto.CurriculumDtos.GradeTreeDto;
import com.mathtutor.curriculum.dto.CurriculumDtos.LessonDto;
import com.mathtutor.curriculum.dto.CurriculumDtos.TopicDto;
import com.mathtutor.curriculum.dto.CurriculumDtos.UnitDto;
import com.mathtutor.enrollment.EnrollmentService;
import com.mathtutor.mastery.MasteryRecord;
import com.mathtutor.mastery.MasteryService;
import com.mathtutor.progress.dto.ProgressDtos.TopicProgressDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Computes each topic's status for a student and enforces progression gating WITHIN
 * the topic's own grade/subject. Each subject is tracked separately: a topic is LOCKED
 * until the previous topic in its grade is mastered, and a student must be enrolled in
 * the subject to work on it.
 */
@Service
public class ProgressService {

    public enum Status { LOCKED, AVAILABLE, IN_PROGRESS, MASTERED }

    private final CurriculumService curriculumService;
    private final MasteryService masteryService;
    private final EnrollmentService enrollmentService;

    public ProgressService(CurriculumService curriculumService,
                           MasteryService masteryService,
                           EnrollmentService enrollmentService) {
        this.curriculumService = curriculumService;
        this.masteryService = masteryService;
        this.enrollmentService = enrollmentService;
    }

    /** Progress for the student's primary subject (first enrollment). */
    @Transactional(readOnly = true)
    public List<TopicProgressDto> progressFor(UUID studentId) {
        UUID gradeId = enrollmentService.primaryGradeId(studentId);
        return gradeId == null ? List.of() : progressForGrade(studentId, gradeId);
    }

    /** Progress for a specific subject's grade. */
    @Transactional(readOnly = true)
    public List<TopicProgressDto> progressForGrade(UUID studentId, UUID gradeId) {
        List<OrderedTopic> sequence = topicSequenceForGrade(gradeId);
        List<TopicProgressDto> out = new ArrayList<>();
        boolean prevMastered = true;
        for (OrderedTopic t : sequence) {
            MasteryRecord r = masteryService.getOrEmpty(studentId, t.id());
            Status status = statusFor(r, prevMastered);
            int total = r == null ? 0 : r.getTotalScore();
            out.add(new TopicProgressDto(t.id(), t.name(), t.unitName(), t.lessonName(),
                    status.name(), total, status == Status.MASTERED));
            prevMastered = r != null && r.isMastered();
        }
        return out;
    }

    /** Throws 403 if the student is not enrolled in the subject or the topic is locked. */
    @Transactional(readOnly = true)
    public void assertUnlocked(UUID studentId, UUID topicId) {
        UUID gradeId = curriculumService.gradeIdForTopic(topicId);
        if (!enrollmentService.isEnrolledInGrade(studentId, gradeId)) {
            throw new ForbiddenException("You are not enrolled in this subject");
        }
        if (status(studentId, topicId) == Status.LOCKED) {
            throw new ForbiddenException("Finish and master the previous topic to unlock this one");
        }
    }

    @Transactional(readOnly = true)
    public Status status(UUID studentId, UUID topicId) {
        UUID gradeId = curriculumService.gradeIdForTopic(topicId);
        boolean prevMastered = true;
        for (OrderedTopic t : topicSequenceForGrade(gradeId)) {
            MasteryRecord r = masteryService.getOrEmpty(studentId, t.id());
            if (t.id().equals(topicId)) {
                return statusFor(r, prevMastered);
            }
            prevMastered = r != null && r.isMastered();
        }
        throw new NotFoundException("Topic is not part of this grade");
    }

    /** The next topic after the given one, within the same grade (for unlock notifications). */
    @Transactional(readOnly = true)
    public java.util.Optional<TopicProgressDto> nextTopicAfter(UUID studentId, UUID topicId) {
        UUID gradeId = curriculumService.gradeIdForTopic(topicId);
        List<TopicProgressDto> seq = progressForGrade(studentId, gradeId);
        for (int i = 0; i < seq.size(); i++) {
            if (seq.get(i).topicId().equals(topicId) && i + 1 < seq.size()) {
                return java.util.Optional.of(seq.get(i + 1));
            }
        }
        return java.util.Optional.empty();
    }

    private Status statusFor(MasteryRecord r, boolean prevMastered) {
        if (r != null && r.isMastered()) {
            return Status.MASTERED;
        }
        if (!prevMastered) {
            return Status.LOCKED;
        }
        boolean started = r != null && (r.getKnowledgeScore() != null
                || r.getPracticeTotal() > 0 || r.getQuizBestScore() != null);
        return started ? Status.IN_PROGRESS : Status.AVAILABLE;
    }

    private List<OrderedTopic> topicSequenceForGrade(UUID gradeId) {
        GradeTreeDto tree = curriculumService.getGradeTree(gradeId);
        List<OrderedTopic> seq = new ArrayList<>();
        for (UnitDto unit : tree.units()) {
            for (LessonDto lesson : unit.lessons()) {
                for (TopicDto topic : lesson.topics()) {
                    seq.add(new OrderedTopic(topic.id(), topic.name(), unit.name(), lesson.name()));
                }
            }
        }
        return seq;
    }

    private record OrderedTopic(UUID id, String name, String unitName, String lessonName) {
    }
}
