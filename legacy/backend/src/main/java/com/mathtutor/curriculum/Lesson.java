package com.mathtutor.curriculum;

import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "lessons")
public class Lesson {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "unit_id", nullable = false)
    private UUID unitId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private int ordering;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getUnitId() { return unitId; }
    public void setUnitId(UUID unitId) { this.unitId = unitId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getOrdering() { return ordering; }
    public void setOrdering(int ordering) { this.ordering = ordering; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
