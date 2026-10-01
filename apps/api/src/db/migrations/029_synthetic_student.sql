-- 029 — X-04 part 2: telling a real child apart from a probe
--
-- One column. It exists because the numbers in master-plan.md §11 are promises about what a
-- *child* experienced, and X-04's synthetic probe is about to start driving whole sessions
-- through the same routes on a five-minute timer. Without a way to tell the two apart, every
-- report and every SLO would be a blend of real traffic and our own monitoring — and the
-- blend moves whenever we change how often the probe runs, which is the worst property a
-- measurement can have.
--
-- The migration is numbered 029 because 012–028 are reserved by name in
-- dev-docs/tickets/README.md for tickets that have not landed yet, and X-04 itself states no
-- number. It lands ahead of 012–027; the runner allows that with `--allow-gap`, and nothing
-- here depends on a table those will add (AGENT-INSTRUCTIONS §4).

-- ── Is this child one of ours? ──────────────────────────────────────────────────────────
--
-- Default false, so every row that already exists is what it has always been: a real child.
-- NOT NULL, because "we don't know whether this was a probe" is not a state any report should
-- have to render — a three-valued flag here would become a three-valued branch in every query
-- that filters on it.
--
-- It is on `student` rather than on `session` for the same reason a person's name is not on
-- their appointments: being synthetic is a property of the actor, not of one thing they did,
-- and putting it on the session would let the probe's student appear real on the sessions
-- somebody forgot to flag.
ALTER TABLE student
    ADD COLUMN is_synthetic BOOLEAN NOT NULL DEFAULT false;

-- The probe's own student is not created here. X-04 part 2 scopes the probe to a deployed
-- staging environment, and a migration that seeded a child would put a row in every
-- developer's database for a thing that cannot run there. Note also that `student.parent_id`
-- stays NOT NULL: X-04 describes the probe student as having "no parent", but the ON DELETE
-- CASCADE from `parent` is what makes master-plan.md §12.9 true of the schema rather than of
-- a cleanup script, and weakening it for one monitoring row would be a bad trade. The probe
-- gets a probe parent.

-- Partial, and on the rare value. Reports filter `WHERE NOT is_synthetic`, which no index
-- helps — it matches nearly every row. What an index does help is the other direction: the
-- cost report and the probe's own bookkeeping asking "which students are synthetic", where
-- the answer is a handful of rows out of all of them.
CREATE INDEX student_synthetic_idx ON student (id) WHERE is_synthetic;
