package com.mathtutor.ai;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Deterministic checker for the common, fully-computable math question families that the local
 * language model reliably gets wrong — decimal/whole-number place value. Where this class can
 * compute an answer with certainty, its result is authoritative (the LLM is not trusted for
 * arithmetic). Everything it cannot parse confidently returns empty / UNKNOWN so the caller can
 * fall back to the existing model-based verification. It never guesses: if a question is at all
 * ambiguous it defers, so it can only ever fix keys, never introduce a wrong one.
 *
 * Families handled:
 *   A. "What is the value of the digit D in (the number) N?"        -> D's place value
 *   B. "Which digit is in the ⟨place⟩ place of N?"                  -> the digit at that place
 *   C. "Which number has (a) D in the ⟨place⟩ place?" (numeric MC)  -> the matching choice
 */
public final class MathAnswerChecker {

    private MathAnswerChecker() {
    }

    public enum Outcome {
        /** A choice equals the computed answer; correctChoice holds it (may already be the stored key). */
        CORRECT,
        /** Every choice is numeric and none equals the computed answer — the question is broken. */
        NO_CORRECT_OPTION,
        /** Could not compute with certainty — defer to the model-based verifier. */
        UNKNOWN
    }

    public record Verdict(Outcome outcome, String correctChoice) {
        static final Verdict UNKNOWN = new Verdict(Outcome.UNKNOWN, null);
        static final Verdict NO_OPTION = new Verdict(Outcome.NO_CORRECT_OPTION, null);
        static Verdict correct(String choice) { return new Verdict(Outcome.CORRECT, choice); }
    }

    private static final Pattern NUMBER = Pattern.compile("\\d[\\d,]*(?:\\.\\d+)?");
    private static final Pattern PURE_NUMBER = Pattern.compile("-?\\d[\\d,]*(?:\\.\\d+)?");

    // A: value of the digit D in N
    private static final Pattern VALUE_OF_DIGIT = Pattern.compile(
            "value of\\s+(?:the\\s+)?digit\\s+(\\d)\\s+in\\s+(?:the\\s+number\\s+)?(\\d[\\d,]*(?:\\.\\d+)?)",
            Pattern.CASE_INSENSITIVE);

    // B: which digit is in the ⟨place⟩ place of/in N
    private static final Pattern WHICH_DIGIT_IN_PLACE = Pattern.compile(
            "which\\s+digit\\s+is\\s+in\\s+the\\s+([a-z\\- ]+?)\\s+place\\s+(?:of|in)\\s+(?:the\\s+number\\s+)?(\\d[\\d,]*(?:\\.\\d+)?)",
            Pattern.CASE_INSENSITIVE);

    // C: "... a D in the ⟨place⟩ place" (used when the choices are the numbers)
    private static final Pattern DIGIT_IN_PLACE = Pattern.compile(
            "(\\d)\\s+in\\s+the\\s+([a-z\\- ]+?)\\s+place",
            Pattern.CASE_INSENSITIVE);

    /**
     * Verify a multiple-choice question. Returns CORRECT with the exact choice text when the
     * computed answer matches exactly one choice, NO_CORRECT_OPTION when all choices are numeric
     * and none matches, or UNKNOWN when the question cannot be computed with certainty.
     */
    public static Verdict checkMultipleChoice(String prompt, List<String> choices) {
        if (prompt == null || choices == null || choices.isEmpty()) {
            return Verdict.UNKNOWN;
        }

        // Families A and B produce a single numeric answer; match it against the choices.
        Optional<BigDecimal> computed = computeNumericAnswer(prompt);
        if (computed.isPresent()) {
            return matchValueToChoices(computed.get(), choices);
        }

        // Family C: the answer is whichever numeric choice has digit D at the given place.
        Optional<int[]> digitPlace = parseDigitAndPlace(prompt);
        if (digitPlace.isPresent() && looksLikeWhichNumber(prompt)) {
            return matchWhichNumber(digitPlace.get()[0], digitPlace.get()[1], choices);
        }
        return Verdict.UNKNOWN;
    }

    /**
     * Solve a short-answer question deterministically when possible (families A and B).
     * Returns the canonical numeric answer, or empty when it cannot be computed with certainty.
     */
    public static Optional<BigDecimal> solveNumeric(String prompt) {
        return computeNumericAnswer(prompt);
    }

    /** Families A and B: a single numeric answer computed directly from the prompt. */
    private static Optional<BigDecimal> computeNumericAnswer(String prompt) {
        Matcher a = VALUE_OF_DIGIT.matcher(prompt);
        if (a.find()) {
            int digit = a.group(1).charAt(0) - '0';
            OptionalInt exp = uniqueDigitExponent(a.group(2), digit);
            if (exp.isPresent()) {
                return Optional.of(BigDecimal.valueOf(digit).movePointRight(exp.getAsInt()));
            }
            return Optional.empty();
        }
        Matcher b = WHICH_DIGIT_IN_PLACE.matcher(prompt);
        if (b.find()) {
            OptionalInt place = placeExponent(b.group(1));
            if (place.isPresent()) {
                OptionalInt d = digitAtExponent(b.group(2), place.getAsInt());
                if (d.isPresent()) {
                    return Optional.of(BigDecimal.valueOf(d.getAsInt()));
                }
            }
        }
        return Optional.empty();
    }

    private static boolean looksLikeWhichNumber(String prompt) {
        String p = prompt.toLowerCase(Locale.ROOT);
        return p.contains("which") && p.contains("number") && p.contains("place");
    }

    /** Family C: parse the (digit, place-exponent) the question asks about. */
    private static Optional<int[]> parseDigitAndPlace(String prompt) {
        Matcher m = DIGIT_IN_PLACE.matcher(prompt);
        if (m.find()) {
            int digit = m.group(1).charAt(0) - '0';
            OptionalInt exp = placeExponent(m.group(2));
            if (exp.isPresent()) {
                return Optional.of(new int[]{digit, exp.getAsInt()});
            }
        }
        return Optional.empty();
    }

    private static Verdict matchWhichNumber(int digit, int exponent, List<String> choices) {
        List<String> matches = new ArrayList<>();
        boolean allNumeric = true;
        for (String choice : choices) {
            String num = numericLiteral(choice);
            if (num == null) { allNumeric = false; continue; }
            OptionalInt d = digitAtExponent(num, exponent);
            if (d.isPresent() && d.getAsInt() == digit) {
                matches.add(choice);
            }
        }
        if (matches.size() == 1) {
            return Verdict.correct(matches.get(0));
        }
        if (matches.isEmpty() && allNumeric) {
            return Verdict.NO_OPTION;
        }
        return Verdict.UNKNOWN; // zero-with-word-choices, or ambiguous multi-match: defer
    }

    /** Match a computed numeric value against the choices (families A and B). */
    private static Verdict matchValueToChoices(BigDecimal value, List<String> choices) {
        List<String> matches = new ArrayList<>();
        boolean allNumeric = true;
        for (String choice : choices) {
            String num = numericLiteral(choice);
            if (num == null) { allNumeric = false; continue; }
            if (parseDecimal(num).map(v -> v.compareTo(value) == 0).orElse(false)) {
                matches.add(choice);
            }
        }
        if (matches.size() == 1) {
            return Verdict.correct(matches.get(0));
        }
        if (matches.isEmpty() && allNumeric) {
            return Verdict.NO_OPTION;
        }
        return Verdict.UNKNOWN;
    }

    // ── number / place-value primitives ──────────────────────────────────────

    /** The exponent (ones=0, tens=1, tenths=-1, …) of the sole occurrence of digit in literal, if unique. */
    static OptionalInt uniqueDigitExponent(String literal, int digit) {
        String lit = literal.replace(",", "");
        int dot = lit.indexOf('.');
        String intPart = dot < 0 ? lit : lit.substring(0, dot);
        String fracPart = dot < 0 ? "" : lit.substring(dot + 1);
        int found = 0;
        int foundExp = 0;
        for (int i = 0; i < intPart.length(); i++) {
            if (intPart.charAt(i) - '0' == digit) { found++; foundExp = intPart.length() - 1 - i; }
        }
        for (int j = 0; j < fracPart.length(); j++) {
            if (fracPart.charAt(j) - '0' == digit) { found++; foundExp = -(j + 1); }
        }
        return found == 1 ? OptionalInt.of(foundExp) : OptionalInt.empty();
    }

    /** The digit at the given place exponent within literal (0 when past the written digits). */
    static OptionalInt digitAtExponent(String literal, int exponent) {
        String lit = literal.replace(",", "");
        int dot = lit.indexOf('.');
        String intPart = dot < 0 ? lit : lit.substring(0, dot);
        String fracPart = dot < 0 ? "" : lit.substring(dot + 1);
        if (exponent >= 0) {
            int idxFromLeft = intPart.length() - 1 - exponent;
            if (idxFromLeft < 0) return OptionalInt.empty(); // asking for a place the number doesn't reach
            return OptionalInt.of(intPart.charAt(idxFromLeft) - '0');
        }
        int j = -exponent - 1;
        return j < fracPart.length() ? OptionalInt.of(fracPart.charAt(j) - '0') : OptionalInt.of(0);
    }

    /** Maps a place name ("tenths", "ten-thousands", "ones", …) to its power-of-ten exponent. */
    static OptionalInt placeExponent(String rawName) {
        String n = rawName.trim().toLowerCase(Locale.ROOT).replaceAll("[\\s]+", " ");
        switch (n) {
            case "hundred-thousandths": case "hundred thousandths": return OptionalInt.of(-5);
            case "ten-thousandths": case "ten thousandths": return OptionalInt.of(-4);
            case "thousandths": case "thousandth": return OptionalInt.of(-3);
            case "hundredths": case "hundredth": return OptionalInt.of(-2);
            case "tenths": case "tenth": return OptionalInt.of(-1);
            case "ones": case "one": case "units": case "unit": return OptionalInt.of(0);
            case "tens": case "ten": return OptionalInt.of(1);
            case "hundreds": case "hundred": return OptionalInt.of(2);
            case "thousands": case "thousand": return OptionalInt.of(3);
            case "ten-thousands": case "ten thousands": return OptionalInt.of(4);
            case "hundred-thousands": case "hundred thousands": return OptionalInt.of(5);
            case "millions": case "million": return OptionalInt.of(6);
            default: return OptionalInt.empty();
        }
    }

    /** The pure-number literal in a choice (after stripping an option label), or null if not numeric. */
    static String numericLiteral(String choice) {
        if (choice == null) return null;
        String s = stripLabel(choice).trim();
        return PURE_NUMBER.matcher(s).matches() ? s : null;
    }

    /** True when both strings are plain numbers of equal value (0.5 == 0.50, 1,000 == 1000). */
    public static boolean numericEquals(String a, String b) {
        String la = numericLiteral(a);
        String lb = numericLiteral(b);
        if (la == null || lb == null) {
            return false;
        }
        return parseDecimal(la)
                .flatMap(x -> parseDecimal(lb).map(y -> x.compareTo(y) == 0))
                .orElse(false);
    }

    static Optional<BigDecimal> parseDecimal(String literal) {
        if (literal == null) return Optional.empty();
        try {
            return Optional.of(new BigDecimal(literal.replace(",", "")));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    /** Removes a leading option label such as "A)", "B.", "(C)", "d:" so values can be compared. */
    static String stripLabel(String s) {
        if (s == null) return "";
        return s.trim().replaceFirst("(?i)^\\(?[a-d]\\)?[).:\\-]?\\s+", "").trim();
    }

    /** Extracts every number literal from text (utility for future families / tests). */
    static List<String> numbersIn(String text) {
        List<String> out = new ArrayList<>();
        Matcher m = NUMBER.matcher(text);
        while (m.find()) out.add(m.group());
        return out;
    }
}
