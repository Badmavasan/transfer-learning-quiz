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
CREATE TABLE IF NOT EXISTS teachers (
  id               TEXT PRIMARY KEY,
  email            TEXT NOT NULL UNIQUE,
  password_hash    TEXT NOT NULL,
  full_name        TEXT,
  subjects         TEXT NOT NULL DEFAULT '',
  affiliation_type TEXT NOT NULL DEFAULT 'other',
  affiliation      TEXT NOT NULL DEFAULT '',
  lycee_uai        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS teacher_sessions (
  token      TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
-- Email confirmation and password-reset tokens. Only a hash is stored, so a
-- leaked database cannot be used to take over accounts.
CREATE TABLE IF NOT EXISTS teacher_tokens (
  token_hash TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS classes (
  code       TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  subject    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Participants joined through a class link carry its code; independent
-- participants leave it NULL, which is why there is no foreign key here.
ALTER TABLE participants ADD COLUMN IF NOT EXISTS class_code TEXT;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS participants_class_code_idx ON participants (class_code);
CREATE INDEX IF NOT EXISTS classes_teacher_idx ON classes (teacher_id);
CREATE INDEX IF NOT EXISTS teacher_sessions_expiry_idx ON teacher_sessions (expires_at);
CREATE INDEX IF NOT EXISTS teacher_tokens_owner_idx ON teacher_tokens (teacher_id, kind);
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
    classCode: row.class_code || null,
  };
}

async function register(o) {
  await pool.query(
    `INSERT INTO participants (code, created_at, lang, step, info, completed_at, profile_key, score, class_code)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb, $9)`,
    [up(o.code), o.createdAt, o.lang, o.step,
     o.info ? JSON.stringify(o.info) : null, o.completedAt,
     o.profileKey, o.score ? JSON.stringify(o.score) : null, o.classCode || null],
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

// ---------------------------------------------------------------- teachers

async function findTeacherByEmail(email) {
  const r = await pool.query('SELECT * FROM teachers WHERE email = $1', [String(email).toLowerCase()]);
  return r.rowCount ? teacherRow(r.rows[0]) : null;
}
async function findTeacherById(id) {
  const r = await pool.query('SELECT * FROM teachers WHERE id = $1', [id]);
  return r.rowCount ? teacherRow(r.rows[0]) : null;
}
function teacherRow(row) {
  return {
    id: row.id, email: row.email, passwordHash: row.password_hash, fullName: row.full_name,
    subjects: row.subjects, affiliationType: row.affiliation_type, affiliation: row.affiliation,
    lyceeUai: row.lycee_uai, createdAt: row.created_at,
    emailVerified: row.email_verified === true,
  };
}
async function createTeacher(t) {
  await pool.query(
    `INSERT INTO teachers (id, email, password_hash, full_name, subjects, affiliation_type, affiliation, lycee_uai, email_verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [t.id, t.email, t.passwordHash, t.fullName || null, t.subjects || '',
     t.affiliationType || 'other', t.affiliation || '', t.lyceeUai || null, t.emailVerified === true],
  );
}
async function setEmailVerified(id) {
  await pool.query('UPDATE teachers SET email_verified = true WHERE id = $1', [id]);
}
async function updatePassword(id, passwordHash) {
  await pool.query('UPDATE teachers SET password_hash = $2 WHERE id = $1', [id, passwordHash]);
}

// ---------------------------------------------------------------- tokens

async function createToken(tokenHash, teacherId, kind, expiresAt) {
  await pool.query(
    'INSERT INTO teacher_tokens (token_hash, teacher_id, kind, expires_at) VALUES ($1, $2, $3, $4)',
    [tokenHash, teacherId, kind, expiresAt]);
}
async function readToken(tokenHash, kind) {
  const r = await pool.query(
    'SELECT teacher_id FROM teacher_tokens WHERE token_hash = $1 AND kind = $2 AND expires_at > now()',
    [tokenHash, kind]);
  return r.rowCount ? { teacherId: r.rows[0].teacher_id } : null;
}
async function deleteTokens(teacherId, kind) {
  await pool.query('DELETE FROM teacher_tokens WHERE teacher_id = $1 AND kind = $2', [teacherId, kind]);
}
async function deleteSessionsForTeacher(teacherId) {
  await pool.query('DELETE FROM teacher_sessions WHERE teacher_id = $1', [teacherId]);
}

async function createSession(token, teacherId, expiresAt) {
  await pool.query('INSERT INTO teacher_sessions (token, teacher_id, expires_at) VALUES ($1, $2, $3)',
    [token, teacherId, expiresAt]);
}
async function readSession(token) {
  const r = await pool.query(
    'SELECT teacher_id, expires_at FROM teacher_sessions WHERE token = $1 AND expires_at > now()', [token]);
  return r.rowCount ? { teacherId: r.rows[0].teacher_id, expiresAt: r.rows[0].expires_at } : null;
}
async function deleteSession(token) {
  await pool.query('DELETE FROM teacher_sessions WHERE token = $1', [token]);
}

// ---------------------------------------------------------------- classes

function classRow(row) {
  return {
    code: row.code, teacherId: row.teacher_id, name: row.name,
    subject: row.subject, createdAt: row.created_at,
  };
}
async function createClass(c) {
  await pool.query('INSERT INTO classes (code, teacher_id, name, subject) VALUES ($1, $2, $3, $4)',
    [c.code, c.teacherId, c.name, c.subject || '']);
}
async function classExists(code) {
  const r = await pool.query('SELECT 1 FROM classes WHERE code = $1', [up(code)]);
  return r.rowCount > 0;
}
async function readClass(code) {
  const r = await pool.query('SELECT * FROM classes WHERE code = $1', [up(code)]);
  return r.rowCount ? classRow(r.rows[0]) : null;
}
async function listClasses(teacherId) {
  const r = await pool.query(
    `SELECT c.*,
            (SELECT count(*) FROM participants p WHERE p.class_code = c.code) AS n_students,
            (SELECT count(*) FROM participants p WHERE p.class_code = c.code AND p.completed_at IS NOT NULL) AS n_done
       FROM classes c WHERE c.teacher_id = $1 ORDER BY c.created_at DESC`, [teacherId]);
  return r.rows.map((row) => Object.assign(classRow(row), {
    students: Number(row.n_students), completed: Number(row.n_done),
  }));
}
async function deleteClass(code) {
  // Participants keep their answers; they simply stop being attached to a class.
  await pool.query('UPDATE participants SET class_code = NULL WHERE class_code = $1', [up(code)]);
  await pool.query('DELETE FROM classes WHERE code = $1', [up(code)]);
}

// Participants of a class, trimmed to what the stats need (no mouse paths).
async function classParticipants(code) {
  const r = await pool.query(
    `SELECT code, info, completed_at, profile_key, score FROM participants
      WHERE class_code = $1 ORDER BY created_at ASC`, [up(code)]);
  return r.rows.map((row) => ({
    code: row.code, info: row.info, completedAt: row.completed_at,
    profileKey: row.profile_key, score: row.score,
  }));
}

module.exports = {
  kind: 'pg', init, exists, read, readMeta, register, saveMeta, saveAnswer, complete,
  findTeacherByEmail, findTeacherById, createTeacher, setEmailVerified, updatePassword,
  createToken, readToken, deleteTokens,
  createSession, readSession, deleteSession, deleteSessionsForTeacher,
  createClass, classExists, readClass, listClasses, deleteClass, classParticipants,
};
