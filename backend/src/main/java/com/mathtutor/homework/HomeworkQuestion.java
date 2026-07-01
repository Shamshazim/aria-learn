package com.mathtutor.homework;

import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "homework_questions")
public class HomeworkQuestion {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "homework_id", nullable = false)
    private UUID homeworkId;

    @Column(name = "question_id", nullable = false)
    private UUID questionId;

    @Column(nullable = false)
    private int ordering;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getHomeworkId() { return homeworkId; }
    public void setHomeworkId(UUID homeworkId) { this.homeworkId = homeworkId; }
    public UUID getQuestionId() { return questionId; }
    public void setQuestionId(UUID questionId) { this.questionId = questionId; }
    public int getOrdering() { return ordering; }
    public void setOrdering(int ordering) { this.ordering = ordering; }
}
