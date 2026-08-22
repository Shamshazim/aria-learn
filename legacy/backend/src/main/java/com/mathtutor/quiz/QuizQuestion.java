package com.mathtutor.quiz;

import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "quiz_questions")
public class QuizQuestion {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "quiz_id", nullable = false)
    private UUID quizId;

    @Column(name = "question_id", nullable = false)
    private UUID questionId;

    @Column(nullable = false)
    private int ordering;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getQuizId() { return quizId; }
    public void setQuizId(UUID quizId) { this.quizId = quizId; }
    public UUID getQuestionId() { return questionId; }
    public void setQuestionId(UUID questionId) { this.questionId = questionId; }
    public int getOrdering() { return ordering; }
    public void setOrdering(int ordering) { this.ordering = ordering; }
}
