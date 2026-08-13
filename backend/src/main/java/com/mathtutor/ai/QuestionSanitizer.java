package com.mathtutor.ai;

import com.mathtutor.ai.content.GeneratedQuestion;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Deterministic structural gate for AI-generated questions. Runs before anything is shown to a
 * child and asks a question no prompt tweak can guarantee: <em>is this item even answerable?</em>
 *
 * <p>Six generations of prompt changes (V15–V22) tried to talk the model out of producing broken
 * items and the defects kept arriving, because the pipeline only ever validated one field — the
 * answer key — for one narrow family of questions. Everything else about a generated item was
 * trusted verbatim. The defects children actually hit are structural:
 *
 * <ul>
 *   <li>the key differs from its option only by a label prefix ("B) 19" vs "19");</li>
 *   <li>the key is a bare letter ("A") that no option literally equals;</li>
 *   <li>all four options arrive crammed into a single string, rendering as one button;</li>
 *   <li>an option is annotated "(Correct)", both giving away the answer and breaking the match;</li>
 *   <li>the options are duplicated into the prompt text;</li>
 *   <li>two options are identical, so the "wrong" one is indistinguishable;</li>
 *   <li>the key names several options at once ("A) 256 and C) 289").</li>
 * </ul>
 *
 * <p>Grading is exact text comparison against the key, so every one of these marks a child wrong
 * no matter what they click. This class repairs what is mechanically repairable and rejects what
 * is not, so a question is either answerable or never reaches a child. It is pure and
 * deterministic — no model call, no network, fully unit-testable — and it only ever resolves a key
 * onto an option that already exists, so it can fix a broken item but never introduce a wrong one.
 * Anything it cannot settle with certainty is rejected rather than guessed at.
 */
public final class QuestionSanitizer {

    private QuestionSanitizer() {
    }

    /**
     * Outcome of sanitizing one question: either a repaired, answerable question, or a rejection
     * with a short human-readable reason (logged so generation defects stay visible).
     */
    public record Result(GeneratedQuestion question, String rejection) {

        public boolean rejected() {
            return rejection != null;
        }

        static Result ok(GeneratedQuestion q) {
            return new Result(q, null);
        }

        static Result reject(String reason) {
            return new Result(null, reason);
        }
    }

    /** An option label at the start of a string or after whitespace: "A)", "b.", "(C)", "d:". */
    private static final Pattern LABEL_AT_START =
            Pattern.compile("^\\(?([A-Da-d])\\)?[).:\\-]?\\s+");

    /** A label used as a split point inside a run-together choice blob: " B) ", " c. ". */
    private static final Pattern EMBEDDED_LABEL =
            Pattern.compile("(?<=\\s)\\(?([A-Da-d])\\)[\\s]|(?<=\\s)\\(?([A-Da-d])[.:]\\s");

    /** A whole line that is just an option, used to strip options duplicated into the prompt. */
    private static final Pattern OPTION_LINE =
            Pattern.compile("^\\s*\\(?[A-Da-d][).:\\-]\\s*.*$");

    /** Annotations the model leaks into option text that reveal the answer: "(Correct)", "✓". */
    private static final Pattern CORRECTNESS_MARKER = Pattern.compile(
            "\\s*(?:[\\(\\[]\\s*(?:correct(?:\\s+answer)?|right(?:\\s+answer)?|answer|true)\\s*[\\)\\]]|[✓✔☑])\\s*",
            Pattern.CASE_INSENSITIVE);

    private static final int MIN_CHOICES = 3;

    /**
     * Repairs and validates one generated question.
     *
     * @return a {@link Result} holding either an answerable question or a rejection reason.
     */
    public static Result sanitize(GeneratedQuestion q) {
        if (q == null) {
            return Result.reject("question was null");
        }
        String prompt = collapse(q.prompt());
        if (prompt.isEmpty()) {
            return Result.reject("prompt is empty");
        }
        String type = q.type() == null ? "SHORT_ANSWER" : q.type().trim().toUpperCase(Locale.ROOT);

        if (!"MULTIPLE_CHOICE".equals(type)) {
            String key = collapse(stripMarkers(q.correctAnswer()));
            if (key.isEmpty()) {
                return Result.reject("short answer has no correct answer");
            }
            return Result.ok(new GeneratedQuestion(type, q.difficulty(), prompt, q.choices(), key, q.solution()));
        }

        // ── Multiple choice ──────────────────────────────────────────────────
        if (q.choices() == null || q.choices().isEmpty()) {
            return Result.reject("multiple-choice question has no options");
        }

        // The model sometimes returns all four options as one string; split them back apart
        // before anything else, otherwise they render as a single unclickable button.
        List<String> options = new ArrayList<>();
        for (String raw : q.choices()) {
            options.addAll(explode(raw));
        }

        // Clean each option: drop answer-revealing annotations and normalize whitespace.
        List<String> cleaned = new ArrayList<>();
        for (String option : options) {
            String c = collapse(stripMarkers(option));
            if (!c.isEmpty() && !stripLabel(c).isEmpty()) {
                cleaned.add(c);
            }
        }
        if (cleaned.size() < MIN_CHOICES) {
            return Result.reject("only " + cleaned.size() + " usable option(s)");
        }
        if (hasDuplicates(cleaned)) {
            return Result.reject("two options are identical");
        }

        // Options are often repeated inside the prompt; remove them so the child reads the
        // question once, not twice. This works on the raw text, before newlines are collapsed.
        String cleanPrompt = collapse(stripEmbeddedOptions(q.prompt()));
        if (cleanPrompt.isEmpty()) {
            cleanPrompt = prompt;
        }

        // Resolve the key onto exactly one option, or reject.
        String rawKey = collapse(stripMarkers(q.correctAnswer()));
        if (rawKey.isEmpty()) {
            return Result.reject("no correct answer given");
        }
        if (countLabels(rawKey) > 1 || q.correctAnswer().contains("\n")) {
            return Result.reject("answer key names more than one option: '" + rawKey + "'");
        }

        String resolved = resolveKey(rawKey, cleaned);
        if (resolved == null) {
            return Result.reject("answer key '" + rawKey + "' is not one of the options");
        }
        return Result.ok(new GeneratedQuestion(type, q.difficulty(), cleanPrompt, cleaned, resolved, q.solution()));
    }

    /**
     * Resolves a stored answer key onto the exact text of the option it names, or null when it
     * names none of them (or is ambiguous between two). Grading compares text, so questions
     * already in the bank whose key differs from its option only by a label ("B) 19" vs "19") or
     * is a bare letter ("A") are graded correctly through this rather than always marked wrong.
     */
    public static String resolveKeyToOption(String key, List<String> options) {
        if (key == null || options == null || options.isEmpty()) {
            return null;
        }
        return resolveKey(collapse(stripMarkers(key)), options);
    }

    /**
     * Matches the key to exactly one option, tightening tolerance step by step: exact, then
     * case/punctuation-insensitive, then ignoring option labels, then a bare letter naming a
     * position, then numeric equality. Returns the option's exact text, or null when the key
     * matches nothing — or matches more than one option, which is ambiguous and unsafe to guess.
     */
    private static String resolveKey(String key, List<String> options) {
        for (String option : options) {
            if (option.equals(key)) {
                return option;
            }
        }
        String match = uniqueMatch(options, o -> soft(o).equals(soft(key)));
        if (match != null) {
            return match;
        }
        // "B) 19" vs "19": compare the values with any option label removed.
        String bareKey = soft(stripLabel(key));
        if (!bareKey.isEmpty()) {
            match = uniqueMatch(options, o -> soft(stripLabel(o)).equals(bareKey));
            if (match != null) {
                return match;
            }
        }
        // A bare letter key ("A", "C)"): the option carrying that label, else that position.
        String letter = bareLetter(key);
        if (letter != null) {
            match = uniqueMatch(options, o -> letter.equals(labelOf(o)));
            if (match != null) {
                return match;
            }
            int index = letter.charAt(0) - 'a';
            if (index >= 0 && index < options.size() && !anyLabelled(options)) {
                return options.get(index);
            }
            return null;
        }
        // Same number written differently: "0.50" vs "0.5", "1,000" vs "1000".
        if (bareKey.matches(".*\\d.*")) {
            String k = stripLabel(key);
            return uniqueMatch(options, o -> MathAnswerChecker.numericEquals(stripLabel(o), k));
        }
        return null;
    }

    /** The single option satisfying the test, or null when none or several do. */
    private static String uniqueMatch(List<String> options, java.util.function.Predicate<String> test) {
        String found = null;
        for (String option : options) {
            if (test.test(option)) {
                if (found != null) {
                    return null; // ambiguous — never guess between two options
                }
                found = option;
            }
        }
        return found;
    }

    /**
     * Splits a run-together choice blob ("A) 23 B) 41 C) 45 D) 67") into separate options. A
     * string holding fewer than two option labels is a normal option and is returned unchanged.
     */
    static List<String> explode(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        String s = raw.trim();
        if (countLabels(s) < 2) {
            return List.of(s);
        }
        List<Integer> starts = new ArrayList<>();
        if (LABEL_AT_START.matcher(s).find()) {
            starts.add(0);
        }
        Matcher m = EMBEDDED_LABEL.matcher(s);
        while (m.find()) {
            starts.add(m.start());
        }
        if (starts.size() < 2) {
            return List.of(s);
        }
        List<String> parts = new ArrayList<>();
        for (int i = 0; i < starts.size(); i++) {
            int end = (i + 1 < starts.size()) ? starts.get(i + 1) : s.length();
            String part = s.substring(starts.get(i), end).trim();
            if (!part.isEmpty()) {
                parts.add(part);
            }
        }
        return parts.size() >= 2 ? parts : List.of(s);
    }

    /** How many distinct option labels ("A)", "b.") the text carries. */
    static int countLabels(String s) {
        if (s == null || s.isBlank()) {
            return 0;
        }
        int count = LABEL_AT_START.matcher(s).find() ? 1 : 0;
        Matcher m = EMBEDDED_LABEL.matcher(s);
        while (m.find()) {
            count++;
        }
        return count;
    }

    /** Removes whole lines that merely restate the options, so the prompt asks the question once. */
    static String stripEmbeddedOptions(String prompt) {
        if (prompt == null || !prompt.contains("\n")) {
            return prompt == null ? "" : prompt.trim();
        }
        StringBuilder kept = new StringBuilder();
        for (String line : prompt.split("\n")) {
            if (OPTION_LINE.matcher(line).matches()) {
                continue;
            }
            if (!line.isBlank()) {
                if (kept.length() > 0) {
                    kept.append(' ');
                }
                kept.append(line.trim());
            }
        }
        return kept.toString().trim();
    }

    private static boolean hasDuplicates(List<String> options) {
        Set<String> seen = new LinkedHashSet<>();
        for (String option : options) {
            if (!seen.add(soft(stripLabel(option)))) {
                return true;
            }
        }
        return false;
    }

    /** True when at least one option carries an explicit "A)"-style label. */
    private static boolean anyLabelled(List<String> options) {
        for (String option : options) {
            if (labelOf(option) != null) {
                return true;
            }
        }
        return false;
    }

    /** The lowercase label letter an option carries, or null when it is unlabelled. */
    static String labelOf(String option) {
        if (option == null) {
            return null;
        }
        Matcher m = LABEL_AT_START.matcher(option.trim());
        return m.find() ? m.group(1).toLowerCase(Locale.ROOT) : null;
    }

    /** The key read as a bare option letter ("B", "c)", "(D)"), or null when it is a value. */
    static String bareLetter(String key) {
        if (key == null) {
            return null;
        }
        String k = key.trim();
        return k.matches("(?i)^\\(?[A-Da-d]\\)?[).:\\-]?$") ? k.replaceAll("(?i)[^A-Da-d]", "").toLowerCase(Locale.ROOT) : null;
    }

    /** Strips answer-revealing annotations such as "(Correct)" or a trailing checkmark. */
    static String stripMarkers(String s) {
        return s == null ? "" : CORRECTNESS_MARKER.matcher(s).replaceAll(" ");
    }

    /** Removes a leading option label such as "A)", "B.", "(C)", "d:". */
    static String stripLabel(String s) {
        return s == null ? "" : LABEL_AT_START.matcher(s.trim()).replaceFirst("").trim();
    }

    /** Collapses runs of whitespace (including newlines) to single spaces and trims. */
    static String collapse(String s) {
        return s == null ? "" : s.replaceAll("\\s+", " ").trim();
    }

    /** Comparison form: lowercase, whitespace-collapsed, trailing sentence punctuation removed. */
    static String soft(String s) {
        String n = collapse(s).toLowerCase(Locale.ROOT);
        while (n.endsWith(".") || n.endsWith("!")) {
            n = n.substring(0, n.length() - 1).trim();
        }
        return n;
    }
}
