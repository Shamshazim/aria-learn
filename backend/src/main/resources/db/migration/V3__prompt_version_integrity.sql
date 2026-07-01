-- ===========================================================================
-- Milestone 2: prompt versioning integrity.
-- Each prompt name may have many versions (rows), but only ONE active at a time.
-- This partial unique index enforces that invariant at the database level.
-- ===========================================================================

CREATE UNIQUE INDEX uq_prompt_active_per_name
    ON prompt_templates (name)
    WHERE is_active;

-- Each (name, version) pair must be unique so version numbers are stable identifiers.
CREATE UNIQUE INDEX uq_prompt_name_version
    ON prompt_templates (name, version);
