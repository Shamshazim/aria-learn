package com.mathtutor.practice;

/** Normalizes and compares free-text answers. Shared by practice, guided, and quiz grading. */
public final class AnswerMatcher {

    private AnswerMatcher() {
    }

    public static boolean matches(String response, String correct) {
        return normalize(response).equals(normalize(correct));
    }

    public static String normalize(String s) {
        if (s == null) {
            return "";
        }
        String n = s.trim().toLowerCase();
        while (n.endsWith(".")) {
            n = n.substring(0, n.length() - 1).trim();
        }
        return n;
    }
}
