package com.mathtutor.quiz;

import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "student_answers")
public class StudentAnswer {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "attempt_id", nullable = false)
    private UUID attemptId;

    @Column(name = "question_id", nullable = false)
    private UUID questionId;

    @Column(columnDefinition = "text")
    private String response;

    @Column(name = "is_correct", nullable = false)
    private boolean correct;

    @Column(name = "time_spent_sec")
    private Integer timeSpentSec;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getAttemptId() { return attemptId; }
    public void setAttemptId(UUID attemptId) { this.attemptId = attemptId; }
    public UUID getQuestionId() { return questionId; }
    public void setQuestionId(UUID questionId) { this.questionId = questionId; }
    public String getResponse() { return response; }
    public void setResponse(String response) { this.response = response; }
    public boolean isCorrect() { return correct; }
    public void setCorrect(boolean correct) { this.correct = correct; }
    public Integer getTimeSpentSec() { return timeSpentSec; }
    public void setTimeSpentSec(Integer timeSpentSec) { this.timeSpentSec = timeSpentSec; }
}
