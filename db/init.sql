-- ---------------------------------------------------------------------------
--  The bot's memory: one row per round played.
--
--  IMPORTANT (a classic Docker gotcha):
--  PostgreSQL runs files in /docker-entrypoint-initdb.d ONLY when the data
--  directory is EMPTY, i.e. the very first time, or after `docker compose down -v`.
--  If you edit this file later, nothing changes until you delete the volume.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rounds (
    id          SERIAL      PRIMARY KEY,
    player_move TEXT        NOT NULL CHECK (player_move IN ('rock', 'paper', 'scissors')),
    bot_move    TEXT        NOT NULL CHECK (bot_move    IN ('rock', 'paper', 'scissors')),
    predicted   TEXT        CHECK (predicted IN ('rock', 'paper', 'scissors')),  -- what the bot expected (NULL = guessing)
    strategy    TEXT        NOT NULL DEFAULT 'random',                           -- random | frequency | pattern
    result      TEXT        NOT NULL CHECK (result IN ('win', 'lose', 'draw')),  -- from the PLAYER's point of view
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
