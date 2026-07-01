package com.mathtutor.curriculum;

import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "grades")
public class Grade {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "subject_id", nullable = false)
    private UUID subjectId;

    @Column(nullable = false)
    private String name;

    @Column(name = "level_order", nullable = false)
    private int levelOrder;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getSubjectId() { return subjectId; }
    public void setSubjectId(UUID subjectId) { this.subjectId = subjectId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getLevelOrder() { return levelOrder; }
    public void setLevelOrder(int levelOrder) { this.levelOrder = levelOrder; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
