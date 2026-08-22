-- ===========================================================================
-- Milestone 11: notifications + per-user preferences.
-- ===========================================================================

CREATE TABLE notifications (
    id             UUID PRIMARY KEY,
    recipient_type VARCHAR(16) NOT NULL,   -- PARENT or STUDENT
    recipient_id   UUID NOT NULL,
    type           VARCHAR(32) NOT NULL,
    title          VARCHAR(255) NOT NULL,
    message        TEXT NOT NULL,
    link           VARCHAR(255),
    is_read        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_recipient ON notifications (recipient_type, recipient_id, is_read);
CREATE INDEX idx_notifications_recipient_time ON notifications (recipient_type, recipient_id, created_at DESC);

CREATE TABLE notification_preferences (
    id         UUID PRIMARY KEY,
    owner_type VARCHAR(16) NOT NULL,
    owner_id   UUID NOT NULL,
    type       VARCHAR(32) NOT NULL,
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_notif_pref ON notification_preferences (owner_type, owner_id, type);
