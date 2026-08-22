package com.mathtutor.enrollment;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "enrollments")
public class Enrollment {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "student_id", nullable = false)
    private UUID studentId;

    @Column(name = "subject_id", nullable = false)
    private UUID subjectId;

    @Column(name = "grade_id", nullable = false)
    private UUID gradeId;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getStudentId() { return studentId; }
    public void setStudentId(UUID studentId) { this.studentId = studentId; }
    public UUID getSubjectId() { return subjectId; }
    public void setSubjectId(UUID subjectId) { this.subjectId = subjectId; }
    public UUID getGradeId() { return gradeId; }
    public void setGradeId(UUID gradeId) { this.gradeId = gradeId; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
