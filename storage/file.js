'use strict';

// File-based storage: one JSON file per participant under data/participants/.
// Used automatically when DATABASE_URL is NOT set (handy for `node server.js` dev runs).

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data', 'participants');
// Teacher accounts, their classes and login sessions live next to the
// participant files, one JSON document each.
const ROOT = path.join(DATA_DIR, '..');
const TEACHER_DIR = path.join(ROOT, 'teachers');
const CLASS_DIR = path.join(ROOT, 'classes');
const SESSION_DIR = path.join(ROOT, 'sessions');
const TOKEN_DIR = path.join(ROOT, 'tokens');

function file(code) {
  return path.join(DATA_DIR, `${String(code).toUpperCase()}.json`);
}

function readDoc(dir, name) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8')); }
  catch (_) { return null; }
}
function writeDoc(dir, name, obj) {
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(obj, null, 2));
}
function listDocs(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
      .map((f) => readDoc(dir, f.slice(0, -5))).filter(Boolean);
  } catch (_) { return []; }
}
// Names come from URLs and form input, so never let one escape its directory.
function safeName(x) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(String(x)) ? String(x) : null;
}
function readRaw(code) {
  try { return JSON.parse(fs.readFileSync(file(code), 'utf8')); }
  catch (_) { return null; }
}
function writeRaw(obj) {
  fs.writeFileSync(file(obj.code), JSON.stringify(obj, null, 2));
}

async function init() {
  for (const d of [DATA_DIR, TEACHER_DIR, CLASS_DIR, SESSION_DIR, TOKEN_DIR]) fs.mkdirSync(d, { recursive: true });
}
async function exists(code) { return fs.existsSync(file(code)); }
async function read(code) { return readRaw(code); }
async function readMeta(code) { const o = readRaw(code); return o ? { completedAt: o.completedAt } : null; }
async function register(obj) { writeRaw(obj); }

async function saveMeta(code, { lang, step, info }) {
  const o = readRaw(code);
  if (!o) return;
  if (lang) o.lang = lang;
  if (step) o.step = step;
  if (info) o.info = info;
  writeRaw(o);
}

async function saveAnswer(code, { questionId, choice, mouse, timing }) {
  const o = readRaw(code);
  if (!o) return;
  o.answers[questionId] = choice;
  if (Array.isArray(mouse)) o.mouse[questionId] = mouse;
  if (typeof timing === 'number') o.timing[questionId] = timing;
  writeRaw(o);
}

async function complete(code, { score, profileKey, step, completedAt }) {
  const o = readRaw(code);
  if (!o) return;
  o.score = score;
  o.profileKey = profileKey;
  o.step = step;
  o.completedAt = completedAt;
  writeRaw(o);
}

// ---------------------------------------------------------------- teachers

// Teachers are few in a study, so an email lookup scans the directory rather
// than maintaining a second index file that could drift out of sync.
async function findTeacherByEmail(email) {
  const want = String(email).toLowerCase();
  return listDocs(TEACHER_DIR).find((t) => t.email === want) || null;
}
async function findTeacherById(id) {
  const n = safeName(id);
  return n ? readDoc(TEACHER_DIR, n) : null;
}
async function createTeacher(t) {
  const n = safeName(t.id);
  if (!n) throw new Error('bad teacher id');
  writeDoc(TEACHER_DIR, n, Object.assign({ createdAt: new Date().toISOString(), emailVerified: false }, t));
}
async function setEmailVerified(id) {
  const n = safeName(id);
  const o = n && readDoc(TEACHER_DIR, n);
  if (o) { o.emailVerified = true; writeDoc(TEACHER_DIR, n, o); }
}
async function updatePassword(id, passwordHash) {
  const n = safeName(id);
  const o = n && readDoc(TEACHER_DIR, n);
  if (o) { o.passwordHash = passwordHash; writeDoc(TEACHER_DIR, n, o); }
}

// ---------------------------------------------------------------- tokens

async function createToken(tokenHash, teacherId, kind, expiresAt) {
  const n = safeName(tokenHash);
  if (!n) throw new Error('bad token');
  writeDoc(TOKEN_DIR, n, { teacherId, kind, expiresAt: new Date(expiresAt).toISOString() });
}
async function readToken(tokenHash, kind) {
  const n = safeName(tokenHash);
  const o = n ? readDoc(TOKEN_DIR, n) : null;
  if (!o || o.kind !== kind) return null;
  if (new Date(o.expiresAt).getTime() <= Date.now()) {
    try { fs.unlinkSync(path.join(TOKEN_DIR, `${n}.json`)); } catch (_) {}
    return null;
  }
  return { teacherId: o.teacherId };
}
async function deleteTokens(teacherId, kind) {
  for (const f of (fs.existsSync(TOKEN_DIR) ? fs.readdirSync(TOKEN_DIR) : [])) {
    if (!f.endsWith('.json')) continue;
    const o = readDoc(TOKEN_DIR, f.slice(0, -5));
    if (o && o.teacherId === teacherId && o.kind === kind) {
      try { fs.unlinkSync(path.join(TOKEN_DIR, f)); } catch (_) {}
    }
  }
}
async function deleteSessionsForTeacher(teacherId) {
  for (const f of (fs.existsSync(SESSION_DIR) ? fs.readdirSync(SESSION_DIR) : [])) {
    if (!f.endsWith('.json')) continue;
    const o = readDoc(SESSION_DIR, f.slice(0, -5));
    if (o && o.teacherId === teacherId) {
      try { fs.unlinkSync(path.join(SESSION_DIR, f)); } catch (_) {}
    }
  }
}

async function createSession(token, teacherId, expiresAt) {
  const n = safeName(token);
  if (!n) throw new Error('bad session token');
  writeDoc(SESSION_DIR, n, { token, teacherId, expiresAt: new Date(expiresAt).toISOString() });
}
async function readSession(token) {
  const n = safeName(token);
  const o = n ? readDoc(SESSION_DIR, n) : null;
  if (!o) return null;
  if (new Date(o.expiresAt).getTime() <= Date.now()) { await deleteSession(token); return null; }
  return { teacherId: o.teacherId, expiresAt: o.expiresAt };
}
async function deleteSession(token) {
  const n = safeName(token);
  if (n) { try { fs.unlinkSync(path.join(SESSION_DIR, `${n}.json`)); } catch (_) {} }
}

// ---------------------------------------------------------------- classes

const upClass = (code) => String(code).toUpperCase();

async function createClass(c) {
  const n = safeName(upClass(c.code));
  if (!n) throw new Error('bad class code');
  writeDoc(CLASS_DIR, n, Object.assign({ createdAt: new Date().toISOString() }, c, { code: n }));
}
async function classExists(code) {
  const n = safeName(upClass(code));
  return !!(n && readDoc(CLASS_DIR, n));
}
async function readClass(code) {
  const n = safeName(upClass(code));
  return n ? readDoc(CLASS_DIR, n) : null;
}
async function listClasses(teacherId) {
  const mine = listDocs(CLASS_DIR).filter((c) => c.teacherId === teacherId);
  const parts = listDocs(DATA_DIR);
  return mine
    .map((c) => {
      const inClass = parts.filter((p) => p.classCode === c.code);
      return Object.assign({}, c, {
        students: inClass.length,
        completed: inClass.filter((p) => p.completedAt).length,
      });
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
async function deleteClass(code) {
  const n = safeName(upClass(code));
  if (!n) return;
  for (const p of listDocs(DATA_DIR)) {
    if (p.classCode === n) { p.classCode = null; writeRaw(p); }
  }
  try { fs.unlinkSync(path.join(CLASS_DIR, `${n}.json`)); } catch (_) {}
}
async function classParticipants(code) {
  const n = safeName(upClass(code));
  if (!n) return [];
  return listDocs(DATA_DIR)
    .filter((p) => p.classCode === n)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .map((p) => ({
      code: p.code, info: p.info, completedAt: p.completedAt,
      profileKey: p.profileKey, score: p.score,
    }));
}

module.exports = {
  kind: 'file', init, exists, read, readMeta, register, saveMeta, saveAnswer, complete,
  findTeacherByEmail, findTeacherById, createTeacher, setEmailVerified, updatePassword,
  createToken, readToken, deleteTokens,
  createSession, readSession, deleteSession, deleteSessionsForTeacher,
  createClass, classExists, readClass, listClasses, deleteClass, classParticipants,
};
