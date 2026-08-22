package com.mathtutor.mastery;

import com.mathtutor.mastery.MasteryCalculator.Components;
import com.mathtutor.mastery.MasteryCalculator.Outcome;
import com.mathtutor.mastery.dto.MasteryDtos.MasteryBreakdownDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Records learning events and recomputes mastery. Called from the knowledge, practice,
 * and quiz flows so a child's mastery updates as they work.
 */
@Service
public class MasteryService {

    private final MasteryRecordRepository recordRepository;
    private final MasteryConfigService configService;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;

    public MasteryService(MasteryRecordRepository recordRepository, MasteryConfigService configService,
                          org.springframework.context.ApplicationEventPublisher eventPublisher) {
        this.recordRepository = recordRepository;
        this.configService = configService;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public void recordKnowledgeViewed(UUID studentId, UUID topicId) {
        MasteryRecord r = getOrCreate(studentId, topicId);
        r.setKnowledgeScore(100);
        recomputeAndSave(r);
    }

    @Transactional
    public void recordPracticeResult(UUID studentId, UUID topicId, boolean correct) {
        MasteryRecord r = getOrCreate(studentId, topicId);
        r.setPracticeTotal(r.getPracticeTotal() + 1);
        if (correct) {
            r.setPracticeCorrect(r.getPracticeCorrect() + 1);
        }
        recomputeAndSave(r);
    }

    @Transactional
    public void recordQuizScore(UUID studentId, UUID topicId, int scorePct) {
        MasteryRecord r = getOrCreate(studentId, topicId);
        if (r.getQuizBestScore() == null || scorePct > r.getQuizBestScore()) {
            r.setQuizBestScore(scorePct);
        }
        recomputeAndSave(r);
    }

    @Transactional
    public void recordHomeworkScore(UUID studentId, UUID topicId, int scorePct) {
        MasteryRecord r = getOrCreate(studentId, topicId);
        if (r.getHomeworkScore() == null || scorePct > r.getHomeworkScore()) {
            r.setHomeworkScore(scorePct);
        }
        recomputeAndSave(r);
    }

    @Transactional(readOnly = true)
    public MasteryRecord getOrEmpty(UUID studentId, UUID topicId) {
        return recordRepository.findByStudentIdAndTopicId(studentId, topicId).orElse(null);
    }

    @Transactional(readOnly = true)
    public java.util.List<MasteryRecord> allForStudent(UUID studentId) {
        return recordRepository.findByStudentId(studentId);
    }

    /** How many students have any recorded progress on a topic (for delete warnings). */
    @Transactional(readOnly = true)
    public long countStudentsWithProgress(UUID topicId) {
        return recordRepository.countByTopicId(topicId);
    }

    public boolean isMastered(UUID studentId, UUID topicId) {
        MasteryRecord r = getOrEmpty(studentId, topicId);
        return r != null && r.isMastered();
    }

    @Transactional(readOnly = true)
    public MasteryBreakdownDto breakdown(UUID studentId, UUID topicId) {
        int requiredPct = configService.effective().getRequiredPct();
        MasteryRecord r = getOrEmpty(studentId, topicId);
        if (r == null) {
            return new MasteryBreakdownDto(topicId, null, null, null, null, 0, requiredPct, false);
        }
        Integer practice = r.getPracticeTotal() > 0
                ? Math.round(r.getPracticeCorrect() * 100f / r.getPracticeTotal())
                : null;
        return new MasteryBreakdownDto(topicId, r.getKnowledgeScore(), practice,
                r.getQuizBestScore(), r.getHomeworkScore(), r.getTotalScore(), requiredPct, r.isMastered());
    }

    private MasteryRecord getOrCreate(UUID studentId, UUID topicId) {
        return recordRepository.findByStudentIdAndTopicId(studentId, topicId)
                .orElseGet(() -> {
                    MasteryRecord r = new MasteryRecord();
                    r.setStudentId(studentId);
                    r.setTopicId(topicId);
                    return r;
                });
    }

    private void recomputeAndSave(MasteryRecord r) {
        MasteryConfig cfg = configService.effective();
        Integer practice = r.getPracticeTotal() > 0
                ? Math.round(r.getPracticeCorrect() * 100f / r.getPracticeTotal())
                : null;
        Components components = new Components(
                r.getKnowledgeScore(), practice, r.getQuizBestScore(), r.getHomeworkScore());
        Outcome outcome = MasteryCalculator.compute(cfg, components);

        boolean justMastered = outcome.mastered() && !r.isMastered();
        r.setTotalScore(outcome.total());
        if (justMastered) {
            r.setAchievedAt(Instant.now());
        }
        r.setMastered(outcome.mastered());
        r.setUpdatedAt(Instant.now());
        recordRepository.save(r);

        if (justMastered) {
            eventPublisher.publishEvent(
                    new com.mathtutor.notification.events.NotificationEvents.TopicMasteredEvent(
                            r.getStudentId(), r.getTopicId()));
        }
    }
}
