package com.mathtutor.tutor;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A configurable tutor personality. Rows drive the whole feature: a new persona
 * is added by inserting a row, and its style_prompt is appended to the AI system
 * prompt for any child assigned that mode. No code change required.
 */
@Entity
@Table(name = "tutor_modes")
public class TutorMode {

    @Id
    private String code;

    @Column(nullable = false)
    private String name;

    private String emoji;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "style_prompt", columnDefinition = "text", nullable = false)
    private String stylePrompt = "";

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(nullable = false)
    private boolean active = true;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getStylePrompt() { return stylePrompt; }
    public void setStylePrompt(String stylePrompt) { this.stylePrompt = stylePrompt; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
