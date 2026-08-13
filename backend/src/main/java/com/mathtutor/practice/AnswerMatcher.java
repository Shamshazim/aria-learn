package com.mathtutor.practice;

import com.mathtutor.ai.MathAnswerChecker;

/** Normalizes and compares free-text answers. Shared by practice, guided, and quiz grading. */
public final class AnswerMatcher {

    private AnswerMatcher() {
    }

    public static boolean matches(String response, String correct) {
        return normalize(response).equals(normalize(correct));
    }

    /**
     * Compares a chosen option against a stored answer key, tolerating the ways the two can
     * disagree in form while naming the same option: an option label on one side but not the
     * other ("B) 19" vs "19"), and the same number written differently ("0.50" vs "0.5").
     *
     * <p>Used for multiple choice, where a key that differs from its option only cosmetically
     * would otherwise mark every child wrong however they answered. Options are distinct — the
     * sanitizer rejects questions with duplicates — so ignoring labels cannot make a wrong option
     * match the right one.
     */
    public static boolean matchesChoice(String response, String correct) {
        if (matches(response, correct)) {
            return true;
        }
        String r = stripLabel(response);
        String c = stripLabel(correct);
        if (!r.isEmpty() && matches(r, c)) {
            return true;
        }
        return MathAnswerChecker.numericEquals(r, c);
    }

    public static String normalize(String s) {
        if (s == null) {
            return "";
        }
        String n = s.trim().toLowerCase().replaceAll("\\s+", " ");
        while (n.endsWith(".")) {
            n = n.substring(0, n.length() - 1).trim();
        }
        return n;
    }

    /** Removes a leading option label such as "A)", "B.", "(C)", "d:" so values can be compared. */
    public static String stripLabel(String s) {
        if (s == null) {
            return "";
        }
        return s.trim().replaceFirst("(?i)^\\(?[a-d]\\)?[).:\\-]?\\s+", "").trim();
    }
}
