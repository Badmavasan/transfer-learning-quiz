'use strict';

// PostgreSQL storage. Used when DATABASE_URL is set (the Docker / production path).
// Schema is created on init() so the app is self-bootstrapping.

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10),
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS participants (
  code         TEXT PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  lang         TEXT NOT NULL DEFAULT 'en',
  step         TEXT NOT NULL DEFAULT 'info',
  info         JSONB,
  completed_at TIMESTAMPTZ,
  profile_key  TEXT,
  score        JSONB
);
CREATE TABLE IF NOT EXISTS answers (
  code        TEXT NOT NULL REFERENCES participants(code) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  choice      TEXT NOT NULL,
  mouse       JSONB,
  timing      INTEGER,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (code, question_id)
);
`;

function up(code) { return String(code).toUpperCase(); }

async function init() {
  // The db container may not be ready the instant the backend boots.
  const retries = Number(process.env.DB_CONNECT_RETRIES || 30);
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      await pool.query(SCHEMA);
      console.log('PostgreSQL storage ready.');
      return;
    } catch (err) {
      if (i === retries) throw err;
      console.log(`Waiting for PostgreSQL (${i}/${retries})… ${err.code || err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function exists(code) {
  const r = await pool.query('SELECT 1 FROM participants WHERE code = $1', [up(code)]);
  return r.rowCount > 0;
}

async function readMeta(code) {
  const r = await pool.query('SELECT completed_at FROM participants WHERE code = $1', [up(code)]);
  return r.rowCount ? { completedAt: r.rows[0].completed_at } : null;
}

async function read(code) {
  const r = await pool.query('SELECT * FROM participants WHERE code = $1', [up(code)]);
  if (!r.rowCount) return null;
  const row = r.rows[0];
  const a = await pool.query('SELECT question_id, choice, mouse, timing FROM answers WHERE code = $1', [up(code)]);
  const answers = {}, mouse = {}, timing = {};
  for (const x of a.rows) {
    answers[x.question_id] = x.choice;
    if (x.mouse) mouse[x.question_id] = x.mouse;
    if (x.timing != null) timing[x.question_id] = x.timing;
  }
  return {
    code: row.code,
    createdAt: row.created_at,
    lang: row.lang,
    step: row.step,
    info: row.info,
    answers, mouse, timing,
    completedAt: row.completed_at,
    profileKey: row.profile_key,
    score: row.score,
  };
}

async function register(o) {
  await pool.query(
    `INSERT INTO participants (code, created_at, lang, step, info, completed_at, profile_key, score)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb)`,
    [up(o.code), o.createdAt, o.lang, o.step,
     o.info ? JSON.stringify(o.info) : null, o.completedAt,
     o.profileKey, o.score ? JSON.stringify(o.score) : null],
  );
}

async function saveMeta(code, { lang, step, info }) {
  await pool.query(
    `UPDATE participants SET
       lang = COALESCE($2, lang),
       step = COALESCE($3, step),
       info = COALESCE($4::jsonb, info)
     WHERE code = $1`,
    [up(code), lang || null, step || null, info ? JSON.stringify(info) : null],
  );
}

async function saveAnswer(code, { questionId, choice, mouse, timing }) {
  await pool.query(
    `INSERT INTO answers (code, question_id, choice, mouse, timing)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (code, question_id)
     DO UPDATE SET choice = EXCLUDED.choice, mouse = EXCLUDED.mouse,
                   timing = EXCLUDED.timing, answered_at = now()`,
    [up(code), questionId, choice,
     Array.isArray(mouse) ? JSON.stringify(mouse) : null,
     typeof timing === 'number' ? timing : null],
  );
}

async function complete(code, { score, profileKey, step, completedAt }) {
  await pool.query(
    `UPDATE participants SET score = $2::jsonb, profile_key = $3, step = $4, completed_at = $5
     WHERE code = $1`,
    [up(code), score ? JSON.stringify(score) : null, profileKey, step, completedAt],
  );
}

module.exports = { kind: 'pg', init, exists, read, readMeta, register, saveMeta, saveAnswer, complete };
