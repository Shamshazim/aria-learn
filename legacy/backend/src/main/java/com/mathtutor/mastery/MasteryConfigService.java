package com.mathtutor.mastery;

import com.mathtutor.common.BadRequestException;
import com.mathtutor.mastery.dto.MasteryDtos.MasteryConfigDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class MasteryConfigService {

    private final MasteryConfigRepository repository;

    public MasteryConfigService(MasteryConfigRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public MasteryConfig effective() {
        return repository.findByScope("GLOBAL")
                .orElseThrow(() -> new IllegalStateException("Global mastery config is missing"));
    }

    @Transactional(readOnly = true)
    public MasteryConfigDto get() {
        return toDto(effective());
    }

    @Transactional
    public MasteryConfigDto update(MasteryConfigDto dto) {
        int sum = dto.weightKnowledge() + dto.weightPractice() + dto.weightQuiz() + dto.weightHomework();
        if (sum != 100) {
            throw new BadRequestException("Weights must sum to 100 (got " + sum + ")");
        }
        if (dto.requiredPct() < 1 || dto.requiredPct() > 100) {
            throw new BadRequestException("Required mastery percent must be between 1 and 100");
        }
        if (dto.maxQuizAttempts() < 1) {
            throw new BadRequestException("Max quiz attempts must be at least 1");
        }
        MasteryConfig cfg = effective();
        cfg.setWeightKnowledge(dto.weightKnowledge());
        cfg.setWeightPractice(dto.weightPractice());
        cfg.setWeightQuiz(dto.weightQuiz());
        cfg.setWeightHomework(dto.weightHomework());
        cfg.setRequiredPct(dto.requiredPct());
        cfg.setMaxQuizAttempts(dto.maxQuizAttempts());
        cfg.setUpdatedAt(Instant.now());
        return toDto(repository.save(cfg));
    }

    private MasteryConfigDto toDto(MasteryConfig c) {
        return new MasteryConfigDto(c.getWeightKnowledge(), c.getWeightPractice(),
                c.getWeightQuiz(), c.getWeightHomework(), c.getRequiredPct(), c.getMaxQuizAttempts());
    }
}
