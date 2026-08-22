package com.mathtutor.ai.log;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Aggregates AI usage from the generation logs (excluding test runs). */
@Service
public class AiUsageService {

    private final AiGenerationLogRepository repository;

    public AiUsageService(AiGenerationLogRepository repository) {
        this.repository = repository;
    }

    public record PromptUsage(String promptName, long calls, long tokensIn, long tokensOut) {
    }

    public record DayUsage(String date, long tokens, long calls) {
    }

    public record UsageSummary(long totalCalls, long totalTokens, List<PromptUsage> byPrompt, List<DayUsage> byDay) {
    }

    @Transactional(readOnly = true)
    public UsageSummary usage(int days) {
        ZoneId zone = ZoneId.systemDefault();
        LocalDate today = LocalDate.now();
        Instant after = today.minusDays(days - 1L).atStartOfDay(zone).toInstant();
        List<AiGenerationLog> logs = repository.findByTestFalseAndCreatedAtAfter(after);

        long totalCalls = logs.size();
        long totalTokens = 0;

        Map<String, long[]> byPrompt = new LinkedHashMap<>();   // [calls, in, out]
        Map<LocalDate, long[]> byDay = new LinkedHashMap<>();    // [tokens, calls]
        for (AiGenerationLog l : logs) {
            long tokens = l.getTokensIn() + l.getTokensOut();
            totalTokens += tokens;

            long[] p = byPrompt.computeIfAbsent(l.getPromptName(), k -> new long[3]);
            p[0]++; p[1] += l.getTokensIn(); p[2] += l.getTokensOut();

            LocalDate day = l.getCreatedAt().atZone(zone).toLocalDate();
            long[] d = byDay.computeIfAbsent(day, k -> new long[2]);
            d[0] += tokens; d[1]++;
        }

        List<PromptUsage> prompts = byPrompt.entrySet().stream()
                .map(e -> new PromptUsage(e.getKey(), e.getValue()[0], e.getValue()[1], e.getValue()[2]))
                .sorted((a, b) -> Long.compare(b.calls(), a.calls()))
                .toList();

        List<DayUsage> daily = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            LocalDate day = today.minusDays(i);
            long[] d = byDay.getOrDefault(day, new long[2]);
            daily.add(new DayUsage(day.toString(), d[0], d[1]));
        }

        return new UsageSummary(totalCalls, totalTokens, prompts, daily);
    }
}
