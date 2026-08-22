package com.mathtutor.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mathtutor.ai.content.GeneratedQuestion;
import com.mathtutor.practice.AnswerMatcher;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Ad-hoc report: replays every stored multiple-choice question through the sanitizer to measure
 * how many of the questions children were actually given are answerable. Disabled by default —
 * it needs a JSON dump of question_bank. Run with:
 *
 * <pre>./mvnw test -Dtest=ProductionCorpusReport -Dcorpus=/path/to/mc.json</pre>
 */
class ProductionCorpusReport {

    @Test
    @EnabledIfSystemProperty(named = "corpus", matches = ".+")
    void report() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode all = mapper.readTree(new File(System.getProperty("corpus")));

        int total = 0, alreadyFine = 0, repaired = 0, rejected = 0, rejectedThoughGradeable = 0;
        List<String> reasons = new ArrayList<>();

        for (JsonNode node : all) {
            total++;
            List<String> choices = new ArrayList<>();
            node.get("choices").forEach(c -> choices.add(c.asText()));
            String key = node.get("key").asText();
            GeneratedQuestion q = new GeneratedQuestion("MULTIPLE_CHOICE", "MEDIUM",
                    node.get("prompt").asText(), choices, key, node.get("solution").asText());

            // Would a child clicking the intended option have been marked right, as things stood?
            boolean gradeable = choices.stream().anyMatch(c -> AnswerMatcher.matches(c, key));

            QuestionSanitizer.Result r = QuestionSanitizer.sanitize(q);
            if (r.rejected()) {
                rejected++;
                if (gradeable) {
                    rejectedThoughGradeable++;
                }
                reasons.add(r.rejection().replaceAll("'[^']*'", "'…'"));
            } else if (gradeable) {
                alreadyFine++;
            } else {
                repaired++;
            }
        }

        System.out.printf("%n=== %d stored multiple-choice questions ===%n", total);
        System.out.printf("  already answerable : %d (%.1f%%)%n", alreadyFine, pct(alreadyFine, total));
        System.out.printf("  repaired by gate   : %d (%.1f%%)  <- were graded wrong however answered%n",
                repaired, pct(repaired, total));
        System.out.printf("  rejected by gate   : %d (%.1f%%)  <- unanswerable, would never be shown%n",
                rejected, pct(rejected, total));
        System.out.printf("    of which were gradeable before: %d%n", rejectedThoughGradeable);
        System.out.println("  rejection reasons:");
        reasons.stream().collect(java.util.stream.Collectors.groupingBy(s -> s, java.util.TreeMap::new,
                        java.util.stream.Collectors.counting()))
                .forEach((reason, n) -> System.out.printf("    %4d  %s%n", n, reason));
    }

    private static double pct(int n, int total) {
        return total == 0 ? 0 : n * 100.0 / total;
    }

    /**
     * Runs the whole deterministic pipeline (sanitizer plus the maths solver, no model) over the
     * corpus and reports what it does to questions that were already gradeable. Those are the
     * risky events: a solver that misreads a question could drop or re-key a perfectly good one.
     */
    @Test
    @EnabledIfSystemProperty(named = "corpus", matches = ".+")
    void deterministicPipelineOverTheCorpus() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        JsonNode all = mapper.readTree(new File(System.getProperty("corpus")));
        GenerationService svc = new GenerationService(
                org.mockito.Mockito.mock(AiClient.class), mapper,
                org.mockito.Mockito.mock(com.mathtutor.tutor.TutorModeService.class));

        int gradeable = 0, keptSameKey = 0, rekeyed = 0, dropped = 0;
        List<String> rekeyDetail = new ArrayList<>();
        List<String> dropDetail = new ArrayList<>();

        for (JsonNode node : all) {
            List<String> choices = new ArrayList<>();
            node.get("choices").forEach(c -> choices.add(c.asText()));
            String key = node.get("key").asText();
            if (choices.stream().noneMatch(c -> AnswerMatcher.matches(c, key))) {
                continue; // only questions that already graded correctly are at risk here
            }
            gradeable++;
            GeneratedQuestion q = new GeneratedQuestion("MULTIPLE_CHOICE", "MEDIUM",
                    node.get("prompt").asText(), choices, key, node.get("solution").asText());

            List<GeneratedQuestion> out = svc.verifyAnswerKeys(
                    new com.mathtutor.ai.content.PracticeBatch(List.of(q)), "Mathematics", null).questions();
            if (out.isEmpty()) {
                dropped++;
                dropDetail.add(node.get("prompt").asText().replaceAll("\\s+", " ")
                        + "  choices=" + choices + " key=" + key);
            } else if (AnswerMatcher.matchesChoice(out.get(0).correctAnswer(), key)) {
                keptSameKey++;
            } else {
                rekeyed++;
                rekeyDetail.add(node.get("prompt").asText().replaceAll("\\s+", " ")
                        + "  [" + key + " -> " + out.get(0).correctAnswer() + "]");
            }
        }

        System.out.printf("%n=== deterministic pipeline over %d already-gradeable questions ===%n", gradeable);
        System.out.printf("  key left alone : %d%n", keptSameKey);
        System.out.printf("  key corrected  : %d%n", rekeyed);
        System.out.printf("  dropped        : %d%n", dropped);
        rekeyDetail.stream().limit(25).forEach(d -> System.out.println("    " + d));
        System.out.println("  dropped detail:");
        dropDetail.stream().limit(30).forEach(d -> System.out.println("    " + d));
    }
}
