'use strict';

// File-based storage: one JSON file per participant under data/participants/.
// Used automatically when DATABASE_URL is NOT set (handy for `node server.js` dev runs).

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data', 'participants');

function file(code) {
  return path.join(DATA_DIR, `${String(code).toUpperCase()}.json`);
}
function readRaw(code) {
  try { return JSON.parse(fs.readFileSync(file(code), 'utf8')); }
  catch (_) { return null; }
}
function writeRaw(obj) {
  fs.writeFileSync(file(obj.code), JSON.stringify(obj, null, 2));
}

async function init() { fs.mkdirSync(DATA_DIR, { recursive: true }); }
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

module.exports = { kind: 'file', init, exists, read, readMeta, register, saveMeta, saveAnswer, complete };
