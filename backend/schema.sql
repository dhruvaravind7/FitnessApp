-- FitCoach schema. Every statement is idempotent; db.apply_schema() runs this on startup.

CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(100) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    email       VARCHAR(100) UNIQUE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE users ALTER COLUMN password TYPE VARCHAR(255);

CREATE TABLE IF NOT EXISTS workout_sessions (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT,
    date        DATE NOT NULL DEFAULT CURRENT_DATE,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at    TIMESTAMPTZ,
    notes       TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON workout_sessions (user_id, date DESC);
-- at most one active (unfinished) session per user
CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_one_active ON workout_sessions (user_id) WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS workouts (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    exercise_id     VARCHAR(100) NOT NULL,
    exercise_name   VARCHAR(100) NOT NULL,
    target_muscles  TEXT[] NOT NULL,
    body_parts      TEXT[] NOT NULL,
    exercise_data   JSONB,
    sets            INTEGER NOT NULL,
    reps            INTEGER NOT NULL,
    weight          NUMERIC(6,2),
    date            DATE NOT NULL,
    notes           TEXT
);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES workout_sessions(id) ON DELETE CASCADE;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE workouts ALTER COLUMN exercise_name TYPE VARCHAR(200);
-- legacy rows logged before sessions existed have no session; they are disposable
DELETE FROM workouts WHERE session_id IS NULL;
ALTER TABLE workouts ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE workouts ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workouts_session ON workouts (session_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_workouts_user_exercise ON workouts (user_id, exercise_id);

CREATE TABLE IF NOT EXISTS coach_conversations (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL DEFAULT 'New conversation',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON coach_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS coach_messages (
    id              SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES coach_conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'model')),
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON coach_messages (conversation_id, created_at);
