-- 031 — P3-04: the skill scheduler's state
--
-- P3-04 reserved 012 for this. The runner refuses a migration numbered behind one already
-- applied, and 028–030 are, so it takes the next free number (see the P3-01 ticket's Status).
--
-- Every statement is IF NOT EXISTS: the migration can be re-run over itself.

-- ── Skill state: what the strength → interval table needs ───────────────────────────────
--
-- `interval_days` is the gap the scheduler last chose, kept so a parent view or a rebuild can
-- see *why* a skill is due when it is, not only that it is. Fractional because the long
-- intervals stretch by ×1.5 (21 → 31.5 → 47.25 days); the due date itself is whole days.
--
-- `lapses` counts wrong answers ever. It is not the streak: the streak says how long the
-- current run is, a lapse says the run has been broken, and the interval multiplier needs both.
ALTER TABLE skill_state
    ADD COLUMN IF NOT EXISTS interval_days NUMERIC(6,2) NOT NULL DEFAULT 0
        CHECK (interval_days >= 0),
    ADD COLUMN IF NOT EXISTS lapses INTEGER NOT NULL DEFAULT 0 CHECK (lapses >= 0);

-- ── Misconceptions: when a wrong idea counts as unlearned ────────────────────────────────
--
-- Cleared after three right answers on the skill without the signature coming back. Counted
-- here rather than derived from the session log, because the three can span sessions, and a
-- sighting resets it to zero in the same statement that records the sighting.
ALTER TABLE student_misconception
    ADD COLUMN IF NOT EXISTS correct_since_seen INTEGER NOT NULL DEFAULT 0
        CHECK (correct_since_seen >= 0);

-- ── The child's day ──────────────────────────────────────────────────────────────────────
--
-- "Tomorrow" is the child's tomorrow: a session at 23:30 and one at 00:10 are different days.
-- An IANA name ('America/Los_Angeles'). Nullable, because no signup flow asks for it yet
-- (X-02 will, from the parent's account); the scheduler reads a missing or unknown value as UTC.
ALTER TABLE student
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(64);

-- `session.plan` is already JSONB (004). The scheduler's steps go inside it, beside the
-- `skillCode` and `checkIn` it already carries, so no column is added for them.
