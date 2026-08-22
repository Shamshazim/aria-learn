-- ===========================================================================
-- Multi-subject: students enroll in a grade PER subject. Each subject is tracked
-- separately. Existing students are migrated from their current_grade_id.
-- Also seeds a second subject (Science) so subject-switching is demonstrable.
-- ===========================================================================

CREATE TABLE enrollments (
    id         UUID PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students (id),
    subject_id UUID NOT NULL REFERENCES subjects (id),
    grade_id   UUID NOT NULL REFERENCES grades (id),
    active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_enrollment_student_subject ON enrollments (student_id, subject_id);
CREATE INDEX idx_enrollment_student ON enrollments (student_id);

-- Migrate every existing student into an enrollment for their current grade.
INSERT INTO enrollments (id, student_id, subject_id, grade_id, active, created_at)
SELECT gen_random_uuid(), s.id, g.subject_id, s.current_grade_id, TRUE, now()
FROM students s
JOIN grades g ON g.id = s.current_grade_id
WHERE s.current_grade_id IS NOT NULL;

-- Seed a Science subject so there is something to switch to ------------------
INSERT INTO subjects (id, name, slug, description, is_active) VALUES
    ('aaaaaaa1-0000-0000-0000-000000000001', 'Science', 'science',
     'Elementary science', TRUE);

INSERT INTO grades (id, subject_id, name, level_order, is_active) VALUES
    ('aaaaaaa1-0000-0000-0000-000000000002',
     'aaaaaaa1-0000-0000-0000-000000000001', 'Grade 4 Science', 4, TRUE);

INSERT INTO units (id, grade_id, name, ordering, is_active) VALUES
    ('aaaaaaa1-0000-0000-0000-000000000003',
     'aaaaaaa1-0000-0000-0000-000000000002', 'Living Things', 1, TRUE);

INSERT INTO lessons (id, unit_id, name, ordering, is_active) VALUES
    ('aaaaaaa1-0000-0000-0000-000000000004',
     'aaaaaaa1-0000-0000-0000-000000000003', 'Animals', 1, TRUE);

INSERT INTO topics (id, lesson_id, name, ordering, learning_objectives, is_active) VALUES
    ('aaaaaaa1-0000-0000-0000-000000000005',
     'aaaaaaa1-0000-0000-0000-000000000004',
     'Animal Groups', 1,
     '["Sort animals into mammals, birds, fish, reptiles, and amphibians","Describe one feature of each group"]',
     TRUE),
    ('aaaaaaa1-0000-0000-0000-000000000006',
     'aaaaaaa1-0000-0000-0000-000000000004',
     'Habitats', 2,
     '["Explain what a habitat is","Match animals to their habitats"]',
     TRUE);
