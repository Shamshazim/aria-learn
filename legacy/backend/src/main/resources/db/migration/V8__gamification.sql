-- ===========================================================================
-- Milestone 7: gamification — XP, levels, achievements, streaks, goals.
-- ===========================================================================

CREATE TABLE xp_ledger (
    id         UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students (id),
    amount     INTEGER NOT NULL,
    reason     VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_xp_student ON xp_ledger (student_id);

CREATE TABLE student_levels (
    id         UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students (id),
    level      INTEGER NOT NULL DEFAULT 1,
    xp_total   INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_student_level ON student_levels (student_id);

CREATE TABLE achievements (
    id          UUID PRIMARY KEY,
    code        VARCHAR(48) NOT NULL UNIQUE,
    name        VARCHAR(128) NOT NULL,
    description VARCHAR(255) NOT NULL,
    icon        VARCHAR(16) NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE student_achievements (
    id             UUID PRIMARY KEY,
    student_id     UUID NOT NULL REFERENCES students (id),
    achievement_id UUID NOT NULL REFERENCES achievements (id),
    earned_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_student_achievement ON student_achievements (student_id, achievement_id);

CREATE TABLE streaks (
    id              UUID PRIMARY KEY,
    student_id      UUID NOT NULL REFERENCES students (id),
    current_days    INTEGER NOT NULL DEFAULT 0,
    longest_days    INTEGER NOT NULL DEFAULT 0,
    last_active_date DATE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_streak_student ON streaks (student_id);

CREATE TABLE goals (
    id           UUID PRIMARY KEY,
    student_id   UUID NOT NULL REFERENCES students (id),
    period       VARCHAR(16) NOT NULL,
    metric       VARCHAR(32) NOT NULL,
    target       INTEGER NOT NULL,
    progress     INTEGER NOT NULL DEFAULT 0,
    period_start DATE NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_goal_student_period ON goals (student_id, period);

-- Seed achievement catalog --------------------------------------------------
INSERT INTO achievements (id, code, name, description, icon, sort_order) VALUES
    (gen_random_uuid(), 'FIRST_LESSON',  'Curious Mind',    'Opened your first lesson',        '📖', 1),
    (gen_random_uuid(), 'FIRST_QUIZ',    'Quiz Taker',      'Completed your first quiz',       '✏️', 2),
    (gen_random_uuid(), 'QUIZ_ACE',      'Perfect Score',   'Scored 100% on a quiz',           '💯', 3),
    (gen_random_uuid(), 'HOMEWORK_HERO', 'Homework Hero',   'Completed your first homework',   '🏠', 4),
    (gen_random_uuid(), 'FIRST_MASTERY', 'Topic Master',    'Mastered your first topic',       '🏆', 5),
    (gen_random_uuid(), 'STREAK_3',      'On a Roll',       'Kept a 3-day learning streak',    '🔥', 6),
    (gen_random_uuid(), 'STREAK_7',      'Unstoppable',     'Kept a 7-day learning streak',    '⚡', 7),
    (gen_random_uuid(), 'XP_500',        'Point Collector', 'Earned 500 XP',                   '⭐', 8),
    (gen_random_uuid(), 'LEVEL_5',       'Rising Star',     'Reached level 5',                 '🌟', 9);
