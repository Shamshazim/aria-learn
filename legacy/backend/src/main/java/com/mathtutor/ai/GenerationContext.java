package com.mathtutor.ai;

/** Curriculum context passed into AI generation prompts. Subject is parameterized
 *  so the same machinery works for future subjects, not just math.
 *  learnerNote personalizes content to the individual child's level (knowledge/examples). */
public record GenerationContext(
        String subjectName,
        String gradeName,
        String topicName,
        String objectives,
        String learnerNote) {

    /** Convenience for generators that are not personalized per child. */
    public GenerationContext(String subjectName, String gradeName, String topicName, String objectives) {
        this(subjectName, gradeName, topicName, objectives, null);
    }
}
