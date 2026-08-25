-- 006 — runtime skill graph and learner skill state

CREATE TABLE skill (
    code VARCHAR(32) PRIMARY KEY,
    subject VARCHAR(32) NOT NULL,
    strand VARCHAR(32) NOT NULL,
    name TEXT NOT NULL,
    band VARCHAR(16) NOT NULL,
    prerequisites TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE skill_state (
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    skill_code VARCHAR(32) NOT NULL REFERENCES skill (code) ON DELETE CASCADE,
    strength NUMERIC(4,3) NOT NULL DEFAULT 0 CHECK (strength BETWEEN 0 AND 1),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    correct_streak INTEGER NOT NULL DEFAULT 0 CHECK (correct_streak >= 0),
    last_seen_at TIMESTAMPTZ,
    next_due_at TIMESTAMPTZ,
    PRIMARY KEY (student_id, skill_code)
);

CREATE TABLE misconception (
    id UUID PRIMARY KEY,
    skill_code VARCHAR(32) NOT NULL REFERENCES skill (code) ON DELETE CASCADE,
    name TEXT NOT NULL,
    signature JSONB NOT NULL,
    remediation TEXT NOT NULL
);

CREATE TABLE student_misconception (
    student_id UUID NOT NULL REFERENCES student (id) ON DELETE CASCADE,
    misconception_id UUID NOT NULL REFERENCES misconception (id) ON DELETE CASCADE,
    seen_count INTEGER NOT NULL DEFAULT 0 CHECK (seen_count >= 0),
    first_seen_at TIMESTAMPTZ,
    cleared_at TIMESTAMPTZ,
    PRIMARY KEY (student_id, misconception_id)
);
