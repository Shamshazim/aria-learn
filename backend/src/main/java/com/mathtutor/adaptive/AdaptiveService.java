package com.mathtutor.adaptive;

import com.mathtutor.adaptive.AdaptiveRules.RecType;
import com.mathtutor.adaptive.AdaptiveRules.TopicSignal;
import com.mathtutor.adaptive.dto.AdaptiveDtos.*;
import com.mathtutor.curriculum.CurriculumService;
import com.mathtutor.homework.HomeworkService;
import com.mathtutor.homework.HomeworkService.StudentMisconception;
import com.mathtutor.mastery.MasteryConfigService;
import com.mathtutor.mastery.MasteryRecord;
import com.mathtutor.mastery.MasteryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Builds each child's learning profile from their accumulated mastery and mistake data:
 * overall accuracy/pace, strengths, weaknesses, common mistakes, and personalized study
 * recommendations. Recomputed on read (always fresh) and refreshed nightly.
 */
@Service
public class AdaptiveService {

    private static final Logger log = LoggerFactory.getLogger(AdaptiveService.class);

    private final LearningProfileRepository profileRepository;
    private final StrengthRepository strengthRepository;
    private final WeaknessRepository weaknessRepository;
    private final MistakeLogRepository mistakeRepository;
    private final StudyRecommendationRepository recommendationRepository;
    private final MasteryService masteryService;
    private final MasteryConfigService masteryConfigService;
    private final HomeworkService homeworkService;
    private final CurriculumService curriculumService;
    private final com.mathtutor.ai.GenerationService generationService;

    public AdaptiveService(LearningProfileRepository profileRepository,
                           StrengthRepository strengthRepository,
                           WeaknessRepository weaknessRepository,
                           MistakeLogRepository mistakeRepository,
                           StudyRecommendationRepository recommendationRepository,
                           MasteryService masteryService,
                           MasteryConfigService masteryConfigService,
                           HomeworkService homeworkService,
                           CurriculumService curriculumService,
                           com.mathtutor.ai.GenerationService generationService) {
        this.profileRepository = profileRepository;
        this.strengthRepository = strengthRepository;
        this.weaknessRepository = weaknessRepository;
        this.mistakeRepository = mistakeRepository;
        this.recommendationRepository = recommendationRepository;
        this.masteryService = masteryService;
        this.masteryConfigService = masteryConfigService;
        this.homeworkService = homeworkService;
        this.curriculumService = curriculumService;
        this.generationService = generationService;
    }

    /** Recompute the profile, then return it (across all subjects). */
    @Transactional
    public ProfileDto getProfile(UUID studentId) {
        recompute(studentId, false);
        return read(studentId);
    }

    /** Per-subject profile: same recompute, but filtered to topics in the given grade. */
    @Transactional
    public ProfileDto getProfile(UUID studentId, UUID gradeId) {
        recompute(studentId, false);
        java.util.Set<UUID> ids = curriculumService.topicIdsForGrade(gradeId);
        return readFiltered(studentId, ids);
    }

    private ProfileDto readFiltered(UUID studentId, java.util.Set<UUID> ids) {
        LearningProfile p = profileRepository.findByStudentId(studentId).orElse(null);
        Map<UUID, String> cache = new HashMap<>();

        List<StrengthDto> strengths = strengthRepository.findByStudentId(studentId).stream()
                .filter(s -> ids.contains(s.getTopicId()))
                .map(s -> new StrengthDto(s.getTopicId(), name(cache, s.getTopicId()), s.getScore())).toList();
        List<WeaknessDto> weaknesses = weaknessRepository.findByStudentId(studentId).stream()
                .filter(w -> ids.contains(w.getTopicId()))
                .map(w -> new WeaknessDto(w.getTopicId(), name(cache, w.getTopicId()), w.getScore(), w.getReason())).toList();
        List<MistakeDto> mistakes = mistakeRepository.findByStudentIdOrderByCountDesc(studentId).stream()
                .filter(m -> ids.contains(m.getTopicId()))
                .map(m -> new MistakeDto(m.getTopicId(), name(cache, m.getTopicId()), m.getMisconception(), m.getCount())).toList();
        List<RecommendationDto> recs = recommendationRepository.findByStudentIdOrderByCreatedAtDesc(studentId).stream()
                .filter(r -> r.getTopicId() != null && ids.contains(r.getTopicId()))
                .map(r -> new RecommendationDto(r.getType(), r.getTopicId(), name(cache, r.getTopicId()), r.getReason())).toList();

        int sum = 0, active = 0, mastered = 0, inProgress = 0;
        for (MasteryRecord r : masteryService.allForStudent(studentId)) {
            if (!ids.contains(r.getTopicId())) continue;
            boolean hasActivity = r.getKnowledgeScore() != null || r.getPracticeTotal() > 0
                    || r.getQuizBestScore() != null || r.getHomeworkScore() != null;
            if (hasActivity) { active++; sum += r.getTotalScore(); }
            if (r.isMastered()) mastered++; else if (hasActivity) inProgress++;
        }
        int accuracy = active > 0 ? Math.round((float) sum / active) : 0;
        return new ProfileDto(accuracy, mastered, inProgress, accuracy,
                AdaptiveRules.pace(accuracy, mastered), p == null ? null : p.getAdvice(),
                strengths, weaknesses, mistakes, recs);
    }

    /** Suggested difficulty for the next independent-practice set on a topic. */
    @Transactional(readOnly = true)
    public String suggestDifficulty(UUID studentId, UUID topicId) {
        MasteryRecord r = masteryService.getOrEmpty(studentId, topicId);
        Integer acc = (r != null && r.getPracticeTotal() > 0)
                ? Math.round(r.getPracticeCorrect() * 100f / r.getPracticeTotal())
                : null;
        return AdaptiveRules.suggestDifficulty(acc);
    }

    /**
     * Rebuilds all adaptive data for a student from their mastery records and mistakes.
     * @param forceAdvice regenerate the AI advice blurb even if one already exists (nightly).
     */
    @Transactional
    public void recompute(UUID studentId, boolean forceAdvice) {
        int requiredPct = masteryConfigService.effective().getRequiredPct();
        List<MasteryRecord> records = masteryService.allForStudent(studentId);

        strengthRepository.deleteByStudentId(studentId);
        weaknessRepository.deleteByStudentId(studentId);
        recommendationRepository.deleteByStudentId(studentId);
        mistakeRepository.deleteByStudentId(studentId);

        Map<UUID, String> nameCache = new HashMap<>();
        List<String> strengthNames = new ArrayList<>();
        List<String> weaknessNames = new ArrayList<>();

        int sumTotal = 0, activity = 0, mastered = 0, inProgress = 0;

        for (MasteryRecord r : records) {
            Integer practiceAcc = r.getPracticeTotal() > 0
                    ? Math.round(r.getPracticeCorrect() * 100f / r.getPracticeTotal()) : null;
            TopicSignal signal = new TopicSignal(r.getTopicId(), r.getTotalScore(),
                    practiceAcc, r.getQuizBestScore(), r.getHomeworkScore(), r.isMastered(), requiredPct);

            boolean hasActivity = r.getKnowledgeScore() != null || r.getPracticeTotal() > 0
                    || r.getQuizBestScore() != null || r.getHomeworkScore() != null;
            if (hasActivity) {
                activity++;
                sumTotal += r.getTotalScore();
            }
            if (r.isMastered()) {
                mastered++;
            } else if (hasActivity) {
                inProgress++;
            }

            String topicName = nameCache.computeIfAbsent(r.getTopicId(),
                    id -> curriculumService.requireTopic(id).getName());

            if (AdaptiveRules.isStrength(signal)) {
                Strength s = new Strength();
                s.setStudentId(studentId);
                s.setTopicId(r.getTopicId());
                s.setScore(r.getTotalScore());
                strengthRepository.save(s);
                strengthNames.add(topicName);
            }
            if (AdaptiveRules.isWeakness(signal)) {
                Weakness w = new Weakness();
                w.setStudentId(studentId);
                w.setTopicId(r.getTopicId());
                w.setScore(r.getTotalScore());
                w.setReason(AdaptiveRules.weaknessReason(signal));
                weaknessRepository.save(w);
                weaknessNames.add(topicName);
            }
            AdaptiveRules.recommend(signal).ifPresent(type -> {
                StudyRecommendation rec = new StudyRecommendation();
                rec.setStudentId(studentId);
                rec.setType(type.name());
                rec.setTopicId(r.getTopicId());
                rec.setReason(reasonText(type, topicName));
                recommendationRepository.save(rec);
            });
        }

        // Aggregate misconceptions from homework into the mistake log.
        Map<String, MistakeAgg> mistakeAgg = new LinkedHashMap<>();
        for (StudentMisconception m : homeworkService.misconceptionsForStudent(studentId)) {
            String key = m.topicId() + "::" + m.text().toLowerCase().trim();
            mistakeAgg.computeIfAbsent(key, k -> new MistakeAgg(m.topicId(), m.text())).count++;
        }
        List<String> mistakeTexts = new ArrayList<>();
        for (MistakeAgg agg : mistakeAgg.values()) {
            MistakeLogEntry e = new MistakeLogEntry();
            e.setStudentId(studentId);
            e.setTopicId(agg.topicId);
            e.setMisconception(agg.text);
            e.setCount(agg.count);
            mistakeRepository.save(e);
            mistakeTexts.add(agg.text);
        }

        int accuracy = activity > 0 ? Math.round((float) sumTotal / activity) : 0;

        LearningProfile profile = profileRepository.findByStudentId(studentId)
                .orElseGet(() -> {
                    LearningProfile p = new LearningProfile();
                    p.setStudentId(studentId);
                    return p;
                });
        profile.setAccuracy(accuracy);
        profile.setConfidence(accuracy);
        profile.setMasteredCount(mastered);
        profile.setInProgressCount(inProgress);
        profile.setPace(AdaptiveRules.pace(accuracy, mastered));
        profile.setUpdatedAt(Instant.now());

        boolean hasSignal = !strengthNames.isEmpty() || !weaknessNames.isEmpty() || !mistakeTexts.isEmpty();
        if ((profile.getAdvice() == null || forceAdvice) && hasSignal) {
            profile.setAdvice(buildAdvice(studentId, strengthNames, weaknessNames, mistakeTexts));
        }
        profileRepository.save(profile);
    }

    private String buildAdvice(UUID studentId, List<String> strengths, List<String> weaknesses, List<String> mistakes) {
        try {
            return generationService.generateAdvice("Mathematics",
                    String.join(", ", strengths), String.join(", ", weaknesses),
                    String.join(", ", mistakes), studentId).advice();
        } catch (Exception e) {
            log.warn("AI advice generation failed for {}: {}", studentId, e.getMessage());
            StringBuilder sb = new StringBuilder();
            if (!strengths.isEmpty()) {
                sb.append("Great work on ").append(strengths.get(0)).append("! ");
            }
            if (!weaknesses.isEmpty()) {
                sb.append("Let's practice ").append(weaknesses.get(0)).append(" next.");
            } else {
                sb.append("Keep up the good work.");
            }
            return sb.toString();
        }
    }

    private String reasonText(RecType type, String topicName) {
        return switch (type) {
            case INCREASE_DIFFICULTY -> "You mastered " + topicName + " — ready for tougher challenges!";
            case MORE_PRACTICE -> "Practice more " + topicName + " to build your accuracy.";
            case REVIEW -> "Review " + topicName + " to strengthen your understanding.";
            case SCHEDULE_REVIEW -> "It has been a while — revisit " + topicName + ".";
        };
    }

    private ProfileDto read(UUID studentId) {
        LearningProfile p = profileRepository.findByStudentId(studentId).orElse(null);
        Map<UUID, String> nameCache = new HashMap<>();

        List<StrengthDto> strengths = strengthRepository.findByStudentId(studentId).stream()
                .map(s -> new StrengthDto(s.getTopicId(), name(nameCache, s.getTopicId()), s.getScore()))
                .toList();
        List<WeaknessDto> weaknesses = weaknessRepository.findByStudentId(studentId).stream()
                .map(w -> new WeaknessDto(w.getTopicId(), name(nameCache, w.getTopicId()), w.getScore(), w.getReason()))
                .toList();
        List<MistakeDto> mistakes = mistakeRepository.findByStudentIdOrderByCountDesc(studentId).stream()
                .map(m -> new MistakeDto(m.getTopicId(), name(nameCache, m.getTopicId()), m.getMisconception(), m.getCount()))
                .toList();
        List<RecommendationDto> recs = recommendationRepository.findByStudentIdOrderByCreatedAtDesc(studentId).stream()
                .map(r -> new RecommendationDto(r.getType(), r.getTopicId(),
                        r.getTopicId() == null ? null : name(nameCache, r.getTopicId()), r.getReason()))
                .toList();

        if (p == null) {
            return new ProfileDto(0, 0, 0, 0, "NEW", null, strengths, weaknesses, mistakes, recs);
        }
        return new ProfileDto(p.getAccuracy(), p.getMasteredCount(), p.getInProgressCount(),
                p.getConfidence(), p.getPace(), p.getAdvice(), strengths, weaknesses, mistakes, recs);
    }

    private String name(Map<UUID, String> cache, UUID topicId) {
        return cache.computeIfAbsent(topicId, id -> curriculumService.requireTopic(id).getName());
    }

    private static final class MistakeAgg {
        final UUID topicId;
        final String text;
        int count = 0;
        MistakeAgg(UUID topicId, String text) {
            this.topicId = topicId;
            this.text = text;
        }
    }
}
