package com.mathtutor.homework;

import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "homework_answers")
public class HomeworkAnswer {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "homework_id", nullable = false)
    private UUID homeworkId;

    @Column(name = "question_id", nullable = false)
    private UUID questionId;

    @Column(columnDefinition = "text")
    private String response;

    @Column(nullable = false)
    private boolean correct;

    @Column(name = "partial_credit", nullable = false)
    private int partialCredit;

    @Column(columnDefinition = "text")
    private String feedback;

    @Column(columnDefinition = "text")
    private String misconception;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getHomeworkId() { return homeworkId; }
    public void setHomeworkId(UUID homeworkId) { this.homeworkId = homeworkId; }
    public UUID getQuestionId() { return questionId; }
    public void setQuestionId(UUID questionId) { this.questionId = questionId; }
    public String getResponse() { return response; }
    public void setResponse(String response) { this.response = response; }
    public boolean isCorrect() { return correct; }
    public void setCorrect(boolean correct) { this.correct = correct; }
    public int getPartialCredit() { return partialCredit; }
    public void setPartialCredit(int partialCredit) { this.partialCredit = partialCredit; }
    public String getFeedback() { return feedback; }
    public void setFeedback(String feedback) { this.feedback = feedback; }
    public String getMisconception() { return misconception; }
    public void setMisconception(String misconception) { this.misconception = misconception; }
}
