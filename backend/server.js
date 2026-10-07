'use strict';

const os = require('os');
const express = require('express');
const { Pool } = require('pg');
const { MOVES, judge, chooseMove } = require('./bot');

// ---------------------------------------------------------------------------
//  Settings come from environment variables (set in compose.yaml).
//  Notice DB_HOST: it is just "db", the SERVICE NAME from compose.yaml.
//  Docker's built-in DNS turns that name into the database container's address.
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT || 3000);
const DB = {
  host: process.env.DB_HOST || 'db',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'rps',
  password: process.env.DB_PASSWORD || 'devpass',
  database: process.env.DB_NAME || 'rps',
};

const pool = new Pool({ ...DB, max: 5, connectionTimeoutMillis: 2000 });
// If the database restarts, idle connections break. Log it instead of crashing.
pool.on('error', (err) => console.error('[backend] idle database connection error:', err.message));

const app = express();
app.use(express.json());

// ------------------------------------------------------------------ health
// Compose uses this endpoint as the backend's healthcheck.
// It only says "ok" when the database really answers.
app.get('/api/health', async (req, res) => {
  try {
    const r = await pool.query('SELECT version() AS v');
    const dbVersion = r.rows[0].v.split(' ').slice(0, 2).join(' '); // e.g. "PostgreSQL 16.4"
    res.json({ status: 'ok', db: 'up', dbVersion, host: os.hostname(), uptimeSeconds: Math.round(process.uptime()) });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'down', host: os.hostname() });
  }
});

// -------------------------------------------------------------------- stats
async function getStats() {
  const [totals, moves, recent, acc] = await Promise.all([
    pool.query('SELECT result, COUNT(*)::int AS n FROM rounds GROUP BY result'),
    pool.query('SELECT player_move, COUNT(*)::int AS n FROM rounds GROUP BY player_move'),
    pool.query('SELECT player_move, bot_move, result, predicted, strategy FROM rounds ORDER BY id DESC LIMIT 50'),
    pool.query(`SELECT COUNT(*) FILTER (WHERE predicted IS NOT NULL)::int AS tried,
                       COUNT(*) FILTER (WHERE predicted = player_move)::int AS correct
                FROM rounds`),
  ]);

  const byResult = { win: 0, lose: 0, draw: 0 };
  totals.rows.forEach((r) => { byResult[r.result] = r.n; });
  const moveCounts = { rock: 0, paper: 0, scissors: 0 };
  moves.rows.forEach((r) => { moveCounts[r.player_move] = r.n; });
  const total = byResult.win + byResult.lose + byResult.draw;
  const { tried, correct } = acc.rows[0];

  return {
    total,
    wins: byResult.win,        // rounds YOU won
    losses: byResult.lose,     // rounds the BOT won
    draws: byResult.draw,
    winRate: total ? byResult.win / total : null,
    moves: moveCounts,
    botAccuracy: tried ? correct / tried : null,   // how often the bot guessed your move
    botGuesses: tried,
    recent: recent.rows.reverse(),                 // oldest first
  };
}

app.get('/api/stats', async (req, res) => {
  try {
    res.json(await getStats());
  } catch (err) {
    console.error('[backend] /api/stats failed:', err.message);
    res.status(503).json({ error: 'database unavailable' });
  }
});

// --------------------------------------------------------------------- play
app.post('/api/play', async (req, res) => {
  const move = req.body && req.body.move;
  if (!MOVES.includes(move)) {
    return res.status(400).json({ error: 'move must be rock, paper or scissors' });
  }
  try {
    // 1. What did this player play in the past? (oldest first)
    const past = await pool.query('SELECT player_move FROM rounds ORDER BY id DESC LIMIT 200');
    const history = past.rows.map((r) => r.player_move).reverse();

    // 2. The bot decides, using only the past.
    const brain = chooseMove(history);
    const result = judge(move, brain.move);

    // 3. Save the round. This is the bot's memory.
    await pool.query(
      'INSERT INTO rounds (player_move, bot_move, predicted, strategy, result) VALUES ($1, $2, $3, $4, $5)',
      [move, brain.move, brain.predicted, brain.strategy, result]
    );

    res.json({
      player: move,
      bot: brain.move,
      result,
      predicted: brain.predicted,
      strategy: brain.strategy,
      confidence: brain.confidence,
      context: brain.context,
      stats: await getStats(),
    });
  } catch (err) {
    console.error('[backend] /api/play failed:', err.message);
    res.status(503).json({ error: 'database unavailable' });
  }
});

// -------------------------------------------------------------------- reset
// "Wipe the bot's memory": delete all rounds.
app.post('/api/reset', async (req, res) => {
  try {
    await pool.query('TRUNCATE rounds RESTART IDENTITY');
    res.json({ ok: true });
  } catch (err) {
    console.error('[backend] /api/reset failed:', err.message);
    res.status(503).json({ error: 'database unavailable' });
  }
});

// -------------------------------------------------------------------- start
async function start() {
  // Fail fast: if the database is not reachable, say so clearly and exit.
  // (compose.yaml uses depends_on + a healthcheck so this does not happen.
  //  Remove them and you will see this message. That is Exercise 3!)
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.error(`[backend] cannot reach the database at ${DB.host}:${DB.port} (${err.code || err.message})`);
    console.error('[backend] is the "db" container running and healthy? Exiting.');
    process.exit(1);
  }
  const server = app.listen(PORT, () => {
    console.log(`[backend] connected to database "${DB.database}" at ${DB.host}:${DB.port}`);
    console.log(`[backend] listening on port ${PORT}`);
  });

  // Stop quickly when Docker says "docker compose stop / down".
  const shutdown = (signal) => {
    console.log(`[backend] ${signal} received, shutting down`);
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();
