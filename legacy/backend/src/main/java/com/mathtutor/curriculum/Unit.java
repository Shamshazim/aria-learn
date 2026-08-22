package com.mathtutor.curriculum;

import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "units")
public class Unit {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "grade_id", nullable = false)
    private UUID gradeId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private int ordering;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getGradeId() { return gradeId; }
    public void setGradeId(UUID gradeId) { this.gradeId = gradeId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getOrdering() { return ordering; }
    public void setOrdering(int ordering) { this.ordering = ordering; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
