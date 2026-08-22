-- ===========================================================================
-- Tutor Personality Modes. A per-child setting that flavours every AI-generated
-- lesson, explanation, quiz, homework, hint, and feedback. Personas live in a
-- table (not code) so new personalities are added with a single row — the
-- style_prompt is appended to the AI system prompt at generation time.
-- ===========================================================================

CREATE TABLE tutor_modes (
    code         VARCHAR(40) PRIMARY KEY,
    name         VARCHAR(80)  NOT NULL,
    emoji        VARCHAR(16),
    description  TEXT,
    style_prompt TEXT NOT NULL DEFAULT '',
    sort_order   INT  NOT NULL DEFAULT 0,
    active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- BALANCED is the neutral default (empty style => no change to Aria's normal voice).
INSERT INTO tutor_modes (code, name, emoji, description, style_prompt, sort_order) VALUES
('BALANCED', 'Balanced', '🦉',
 'Aria''s normal, friendly teaching voice.',
 '', 0),
('FUNNY', 'Funny', '😄',
 'Fun and playful, with age-appropriate jokes and light humour.',
 'You are Aria in FUNNY mode. Teach every concept in a fun, engaging way. Sprinkle in age-appropriate jokes, light humour, silly examples, and playful encouragement throughout — but never let the fun get in the way of the actual learning. Keep all humour clearly appropriate for the child''s grade level and kind in spirit.',
 1),
('STRICT', 'Strict', '🎯',
 'Disciplined and focused, clear and to the point.',
 'You are Aria in STRICT mode. Use a disciplined, focused teaching style. Keep explanations clear, direct, and well structured, and cut out unnecessary chit-chat. Encourage concentration, keep the child on task, and motivate them to work carefully and finish what they start.',
 2);

-- Per-child selection. Existing children default to the neutral Balanced voice.
ALTER TABLE students ADD COLUMN tutor_mode_code VARCHAR(40) NOT NULL DEFAULT 'BALANCED'
    REFERENCES tutor_modes(code);
