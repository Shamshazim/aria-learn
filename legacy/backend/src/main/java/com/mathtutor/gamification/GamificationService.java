package com.mathtutor.gamification;

import com.mathtutor.gamification.dto.GamificationDtos.*;
import com.mathtutor.mastery.MasteryRecord;
import com.mathtutor.mastery.MasteryService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Gamification engine: awards XP, levels up, tracks streaks and goals, and grants
 * achievements. Event methods are called synchronously from the learning flows, so XP
 * and badges update the moment a child does something.
 */
@Service
public class GamificationService {

    private static final String DAILY = "DAILY";
    private static final String WEEKLY = "WEEKLY";
    private static final int DAILY_TARGET = 10;   // questions answered
    private static final int WEEKLY_TARGET = 15;  // activities

    private final XpLedgerRepository ledgerRepository;
    private final StudentLevelRepository levelRepository;
    private final AchievementRepository achievementRepository;
    private final StudentAchievementRepository studentAchievementRepository;
    private final StreakRepository streakRepository;
    private final GoalRepository goalRepository;
    private final MasteryService masteryService;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;

    public GamificationService(XpLedgerRepository ledgerRepository,
                               StudentLevelRepository levelRepository,
                               AchievementRepository achievementRepository,
                               StudentAchievementRepository studentAchievementRepository,
                               StreakRepository streakRepository,
                               GoalRepository goalRepository,
                               MasteryService masteryService,
                               org.springframework.context.ApplicationEventPublisher eventPublisher) {
        this.ledgerRepository = ledgerRepository;
        this.levelRepository = levelRepository;
        this.achievementRepository = achievementRepository;
        this.studentAchievementRepository = studentAchievementRepository;
        this.streakRepository = streakRepository;
        this.goalRepository = goalRepository;
        this.masteryService = masteryService;
        this.eventPublisher = eventPublisher;
    }

    // ----- Event hooks (called from learning flows) ------------------------

    @Transactional
    public void onKnowledgeViewed(UUID studentId) {
        award(studentId, 5, "Opened a lesson");
        touchStreak(studentId);
        checkAchievements(studentId);
    }

    @Transactional
    public void onPracticeAnswered(UUID studentId, boolean correct) {
        award(studentId, correct ? 10 : 2, correct ? "Correct answer" : "Good try");
        touchStreak(studentId);
        bumpGoal(studentId, DAILY, "QUESTIONS", DAILY_TARGET, 1);
        bumpGoal(studentId, WEEKLY, "ACTIVITIES", WEEKLY_TARGET, 1);
        checkAchievements(studentId);
    }

    @Transactional
    public void onQuizCompleted(UUID studentId, int scorePct, boolean passed) {
        int xp = 20 + (passed ? 30 : 0) + (scorePct >= 100 ? 20 : 0);
        award(studentId, xp, "Completed a quiz");
        touchStreak(studentId);
        bumpGoal(studentId, WEEKLY, "ACTIVITIES", WEEKLY_TARGET, 1);
        checkAchievements(studentId);
    }

    @Transactional
    public void onHomeworkEvaluated(UUID studentId, int scorePct) {
        award(studentId, 20 + scorePct / 5, "Finished homework");
        touchStreak(studentId);
        bumpGoal(studentId, WEEKLY, "ACTIVITIES", WEEKLY_TARGET, 1);
        checkAchievements(studentId);
    }

    // ----- Read ------------------------------------------------------------

    @Transactional
    public GamificationSummary summary(UUID studentId) {
        StudentLevel level = levelRepository.findByStudentId(studentId).orElse(null);
        int xp = level == null ? 0 : level.getXpTotal();

        Streak streak = streakRepository.findByStudentId(studentId).orElse(null);
        StreakDto streakDto = new StreakDto(
                streak == null ? 0 : streak.getCurrentDays(),
                streak == null ? 0 : streak.getLongestDays());

        List<GoalDto> goals = List.of(
                toGoalDto(getOrResetGoal(studentId, DAILY, "QUESTIONS", DAILY_TARGET)),
                toGoalDto(getOrResetGoal(studentId, WEEKLY, "ACTIVITIES", WEEKLY_TARGET)));

        Map<UUID, Instant> earned = new HashMap<>();
        for (StudentAchievement sa : studentAchievementRepository.findByStudentId(studentId)) {
            earned.put(sa.getAchievementId(), sa.getEarnedAt());
        }
        List<AchievementDto> achievements = new ArrayList<>();
        for (Achievement a : achievementRepository.findByActiveTrueOrderBySortOrder()) {
            achievements.add(new AchievementDto(a.getCode(), a.getName(), a.getDescription(),
                    a.getIcon(), earned.containsKey(a.getId()), earned.get(a.getId())));
        }

        return new GamificationSummary(xp, GamificationRules.levelFor(xp),
                GamificationRules.xpIntoLevel(xp), GamificationRules.xpForNextLevel(xp),
                streakDto, goals, achievements);
    }

    /** XP earned and activity count per day over the last {@code days} days (oldest first). */
    @Transactional(readOnly = true)
    public List<ActivityDay> activityByDay(UUID studentId, int days) {
        LocalDate today = LocalDate.now();
        java.time.ZoneId zone = java.time.ZoneId.systemDefault();
        Instant after = today.minusDays(days - 1L).atStartOfDay(zone).toInstant();

        Map<LocalDate, int[]> buckets = new HashMap<>(); // [xpSum, count]
        for (XpLedgerEntry e : ledgerRepository.findByStudentIdAndCreatedAtAfter(studentId, after)) {
            LocalDate day = e.getCreatedAt().atZone(zone).toLocalDate();
            int[] acc = buckets.computeIfAbsent(day, k -> new int[2]);
            acc[0] += e.getAmount();
            acc[1] += 1;
        }
        List<ActivityDay> out = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            int[] acc = buckets.getOrDefault(day, new int[2]);
            out.add(new ActivityDay(day, acc[0], acc[1]));
        }
        return out;
    }

    public record ActivityDay(LocalDate date, int xp, int count) {
    }

    /** True if the student has a learning streak recorded for the given day. */
    @Transactional(readOnly = true)
    public boolean wasActiveOn(UUID studentId, LocalDate date) {
        return streakRepository.findByStudentId(studentId)
                .map(s -> date.equals(s.getLastActiveDate()))
                .orElse(false);
    }

    // ----- Internals -------------------------------------------------------

    private void award(UUID studentId, int amount, String reason) {
        StudentLevel level = levelRepository.findByStudentId(studentId).orElseGet(() -> {
            StudentLevel s = new StudentLevel();
            s.setStudentId(studentId);
            return s;
        });
        level.setXpTotal(level.getXpTotal() + amount);
        level.setLevel(GamificationRules.levelFor(level.getXpTotal()));
        level.setUpdatedAt(Instant.now());
        levelRepository.save(level);

        XpLedgerEntry entry = new XpLedgerEntry();
        entry.setStudentId(studentId);
        entry.setAmount(amount);
        entry.setReason(reason);
        ledgerRepository.save(entry);
    }

    private void touchStreak(UUID studentId) {
        Streak streak = streakRepository.findByStudentId(studentId).orElseGet(() -> {
            Streak s = new Streak();
            s.setStudentId(studentId);
            return s;
        });
        LocalDate today = LocalDate.now();
        int next = GamificationRules.nextStreak(streak.getLastActiveDate(), today, streak.getCurrentDays());
        streak.setCurrentDays(next);
        streak.setLongestDays(Math.max(streak.getLongestDays(), next));
        streak.setLastActiveDate(today);
        streak.setUpdatedAt(Instant.now());
        streakRepository.save(streak);
    }

    private void bumpGoal(UUID studentId, String period, String metric, int target, int inc) {
        Goal goal = getOrResetGoal(studentId, period, metric, target);
        goal.setProgress(goal.getProgress() + inc);
        goal.setUpdatedAt(Instant.now());
        goalRepository.save(goal);
    }

    private Goal getOrResetGoal(UUID studentId, String period, String metric, int target) {
        LocalDate start = period.equals(DAILY) ? LocalDate.now() : weekStart(LocalDate.now());
        Goal goal = goalRepository.findByStudentIdAndPeriod(studentId, period).orElseGet(() -> {
            Goal g = new Goal();
            g.setStudentId(studentId);
            g.setPeriod(period);
            return g;
        });
        if (goal.getPeriodStart() == null || !goal.getPeriodStart().equals(start)) {
            goal.setPeriodStart(start);
            goal.setProgress(0);
        }
        goal.setMetric(metric);
        goal.setTarget(target);
        return goalRepository.save(goal);
    }

    private LocalDate weekStart(LocalDate date) {
        return date.minusDays(date.getDayOfWeek().getValue() - 1L); // Monday
    }

    private void checkAchievements(UUID studentId) {
        List<MasteryRecord> records = masteryService.allForStudent(studentId);
        boolean anyKnowledge = records.stream().anyMatch(r -> r.getKnowledgeScore() != null);
        boolean anyQuiz = records.stream().anyMatch(r -> r.getQuizBestScore() != null);
        boolean quizAce = records.stream().anyMatch(r -> r.getQuizBestScore() != null && r.getQuizBestScore() == 100);
        boolean anyHomework = records.stream().anyMatch(r -> r.getHomeworkScore() != null);
        boolean anyMastered = records.stream().anyMatch(MasteryRecord::isMastered);

        Streak streak = streakRepository.findByStudentId(studentId).orElse(null);
        int bestStreak = streak == null ? 0 : Math.max(streak.getCurrentDays(), streak.getLongestDays());
        StudentLevel level = levelRepository.findByStudentId(studentId).orElse(null);
        int xp = level == null ? 0 : level.getXpTotal();
        int lvl = level == null ? 1 : level.getLevel();

        Map<String, Boolean> met = new HashMap<>();
        met.put("FIRST_LESSON", anyKnowledge);
        met.put("FIRST_QUIZ", anyQuiz);
        met.put("QUIZ_ACE", quizAce);
        met.put("HOMEWORK_HERO", anyHomework);
        met.put("FIRST_MASTERY", anyMastered);
        met.put("STREAK_3", bestStreak >= 3);
        met.put("STREAK_7", bestStreak >= 7);
        met.put("XP_500", xp >= 500);
        met.put("LEVEL_5", lvl >= 5);

        met.forEach((code, achieved) -> {
            if (achieved) {
                grant(studentId, code);
            }
        });
    }

    private void grant(UUID studentId, String code) {
        achievementRepository.findByCode(code).ifPresent(a -> {
            if (!studentAchievementRepository.existsByStudentIdAndAchievementId(studentId, a.getId())) {
                StudentAchievement sa = new StudentAchievement();
                sa.setStudentId(studentId);
                sa.setAchievementId(a.getId());
                studentAchievementRepository.save(sa);
                eventPublisher.publishEvent(
                        new com.mathtutor.notification.events.NotificationEvents.AchievementEarnedEvent(
                                studentId, a.getName(), a.getIcon()));
            }
        });
    }

    private GoalDto toGoalDto(Goal g) {
        return new GoalDto(g.getPeriod(), g.getMetric(), g.getTarget(), g.getProgress());
    }
}
