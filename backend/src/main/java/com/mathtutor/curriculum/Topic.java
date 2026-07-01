package com.mathtutor.curriculum;

import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "topics")
public class Topic {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "lesson_id", nullable = false)
    private UUID lessonId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private int ordering;

    /** JSON array of learning objectives, stored as text for portability. */
    @Column(name = "learning_objectives", columnDefinition = "text")
    private String learningObjectives;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getLessonId() { return lessonId; }
    public void setLessonId(UUID lessonId) { this.lessonId = lessonId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getOrdering() { return ordering; }
    public void setOrdering(int ordering) { this.ordering = ordering; }
    public String getLearningObjectives() { return learningObjectives; }
    public void setLearningObjectives(String learningObjectives) { this.learningObjectives = learningObjectives; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
