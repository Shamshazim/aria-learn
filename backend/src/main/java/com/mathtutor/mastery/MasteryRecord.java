package com.mathtutor.mastery;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/** Per (student, topic) mastery state, updated as the student learns. */
@Entity
@Table(name = "mastery_records")
public class MasteryRecord {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "student_id", nullable = false)
    private UUID studentId;

    @Column(name = "topic_id", nullable = false)
    private UUID topicId;

    /** 0–100, or null if the lesson has not been opened yet. */
    @Column(name = "knowledge_score")
    private Integer knowledgeScore;

    @Column(name = "practice_correct", nullable = false)
    private int practiceCorrect = 0;

    @Column(name = "practice_total", nullable = false)
    private int practiceTotal = 0;

    /** Best quiz score so far, or null if no quiz taken. */
    @Column(name = "quiz_best_score")
    private Integer quizBestScore;

    @Column(name = "homework_score")
    private Integer homeworkScore;

    @Column(name = "total_score", nullable = false)
    private int totalScore = 0;

    @Column(name = "is_mastered", nullable = false)
    private boolean mastered = false;

    @Column(name = "achieved_at")
    private Instant achievedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getStudentId() { return studentId; }
    public void setStudentId(UUID studentId) { this.studentId = studentId; }
    public UUID getTopicId() { return topicId; }
    public void setTopicId(UUID topicId) { this.topicId = topicId; }
    public Integer getKnowledgeScore() { return knowledgeScore; }
    public void setKnowledgeScore(Integer v) { this.knowledgeScore = v; }
    public int getPracticeCorrect() { return practiceCorrect; }
    public void setPracticeCorrect(int v) { this.practiceCorrect = v; }
    public int getPracticeTotal() { return practiceTotal; }
    public void setPracticeTotal(int v) { this.practiceTotal = v; }
    public Integer getQuizBestScore() { return quizBestScore; }
    public void setQuizBestScore(Integer v) { this.quizBestScore = v; }
    public Integer getHomeworkScore() { return homeworkScore; }
    public void setHomeworkScore(Integer v) { this.homeworkScore = v; }
    public int getTotalScore() { return totalScore; }
    public void setTotalScore(int v) { this.totalScore = v; }
    public boolean isMastered() { return mastered; }
    public void setMastered(boolean mastered) { this.mastered = mastered; }
    public Instant getAchievedAt() { return achievedAt; }
    public void setAchievedAt(Instant achievedAt) { this.achievedAt = achievedAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
