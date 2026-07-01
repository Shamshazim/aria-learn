package com.mathtutor.gamification;

import com.mathtutor.gamification.GamificationService.ActivityDay;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GamificationServiceTest {

    private final XpLedgerRepository ledgerRepo = mock(XpLedgerRepository.class);

    private final GamificationService service = new GamificationService(
            ledgerRepo, mock(StudentLevelRepository.class), mock(AchievementRepository.class),
            mock(StudentAchievementRepository.class), mock(StreakRepository.class),
            mock(GoalRepository.class), mock(com.mathtutor.mastery.MasteryService.class),
            mock(org.springframework.context.ApplicationEventPublisher.class));

    private XpLedgerEntry entry(UUID studentId, int amount) {
        XpLedgerEntry e = new XpLedgerEntry();
        e.setStudentId(studentId);
        e.setAmount(amount);
        e.setReason("test");
        return e; // createdAt defaults to now()
    }

    @Test
    void activityByDayBucketsTodaysXpAndPadsEmptyDays() {
        UUID studentId = UUID.randomUUID();
        when(ledgerRepo.findByStudentIdAndCreatedAtAfter(eq(studentId), any()))
                .thenReturn(List.of(entry(studentId, 10), entry(studentId, 20)));

        List<ActivityDay> week = service.activityByDay(studentId, 7);

        assertThat(week).hasSize(7);
        assertThat(week.get(6).date()).isEqualTo(LocalDate.now()); // last bucket is today
        assertThat(week.get(6).xp()).isEqualTo(30);
        assertThat(week.get(6).count()).isEqualTo(2);
        // earlier days are present but empty
        assertThat(week.get(0).xp()).isZero();
        assertThat(week.get(0).count()).isZero();
    }
}
