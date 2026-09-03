-- 011 — the legacy curricula join the skill graph
--
-- Every topic of the legacy Mathematics, English Writing, Math Adventures and Science curricula
-- is seeded as a skill row at boot. A topic knows the grade it was filed under, its unit and
-- lesson, its learning objectives and its teaching order; the authored skills leave these
-- empty. `strand` was sized for authored strand names and now holds a legacy unit name.

ALTER TABLE skill ALTER COLUMN strand TYPE TEXT;
ALTER TABLE skill ADD COLUMN grade VARCHAR(2);
ALTER TABLE skill ADD COLUMN unit TEXT;
ALTER TABLE skill ADD COLUMN lesson TEXT;
ALTER TABLE skill ADD COLUMN objectives TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE skill ADD COLUMN ordering INTEGER NOT NULL DEFAULT 0;
ALTER TABLE skill ADD CONSTRAINT skill_grade_valid
    CHECK (grade IS NULL OR grade IN ('TK', 'K', '1', '2', '3', '4', '5', '6', '7', '8'));

CREATE INDEX idx_skill_subject_grade ON skill (subject, grade, ordering);
