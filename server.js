'use strict';

// AI Literacy Platform — zero-dependency HTTP layer.
// Storage is pluggable: PostgreSQL when DATABASE_URL is set (Docker), else local JSON files.
// Run with: node server.js   (then open http://localhost:3000)

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { RUBRICS, RUBRIC_ORDER, QUESTIONS } = require('./questions.js');
const PROFILES = JSON.parse(fs.readFileSync(path.join(__dirname, 'profiles.json'), 'utf8')).profiles;
const store = require('./storage');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// ---------------------------------------------------------------- helpers

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Unambiguous alphabet (no 0/O/1/I) for human-friendly codes.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeCode() {
  let c = '';
  for (let i = 0; i < 6; i++) c += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return c;
}
async function uniqueCode() {
  let code;
  do { code = makeCode(); } while (await store.exists(code));
  return code;
}

// Questions without the "correct" field — safe to send to the browser.
function publicQuestions() {
  return QUESTIONS.map(({ correct, ...rest }) => rest);
}

// Score answers per rubric. answers = { questionId: "A".."D" }.
function scoreAnswers(answers) {
  const byRubric = {};
  for (const r of RUBRIC_ORDER) byRubric[r] = { correct: 0, total: 0 };
  let totalCorrect = 0;
  for (const q of QUESTIONS) {
    byRubric[q.rubric].total += 1;
    if (answers && answers[q.id] === q.correct) {
      byRubric[q.rubric].correct += 1;
      totalCorrect += 1;
    }
  }
  const letters = RUBRIC_ORDER.map((r) => {
    const { correct, total } = byRubric[r];
    return correct / total > 0.5 ? 'H' : 'L';
  });
  return {
    key: letters.join(''), // e.g. "HLH" (General/Technique/Éthique)
    totalCorrect,
    totalQuestions: QUESTIONS.length,
    rubrics: RUBRIC_ORDER.map((r) => ({
      key: r,
      label: RUBRICS[r].label,
      emoji: RUBRICS[r].emoji,
      correct: byRubric[r].correct,
      total: byRubric[r].total,
      level: byRubric[r].correct / byRubric[r].total > 0.5 ? 'high' : 'low',
    })),
  };
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) { // 5MB cap (mouse paths can be chunky)
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------- static files

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!filePath.startsWith(PUBLIC_DIR)) { // path traversal guard
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, (err, content) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ---------------------------------------------------------------- API

async function handleApi(req, res, pathname) {
  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJSON(res, 200, { ok: true, storage: store.kind });
  }

  if (pathname === '/api/bootstrap' && req.method === 'GET') {
    return sendJSON(res, 200, {
      rubrics: RUBRICS,
      rubricOrder: RUBRIC_ORDER,
      questions: publicQuestions(),
    });
  }

  if (pathname === '/api/register' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.acknowledged) return sendJSON(res, 400, { error: 'must_acknowledge' });
    const code = await uniqueCode();
    const p = {
      code,
      createdAt: new Date().toISOString(),
      lang: body.lang === 'fr' ? 'fr' : 'en',
      step: 'info',
      info: null,
      answers: {}, mouse: {}, timing: {},
      completedAt: null, profileKey: null, score: null,
    };
    await store.register(p);
    return sendJSON(res, 200, { code });
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    const body = await readBody(req);
    const p = await store.read((body.code || '').trim());
    if (!p) return sendJSON(res, 404, { error: 'unknown_code' });
    return sendJSON(res, 200, { participant: clientView(p) });
  }

  if (pathname === '/api/save' && req.method === 'POST') {
    const body = await readBody(req);
    const code = (body.code || '').trim();
    const meta = await store.readMeta(code);
    if (!meta) return sendJSON(res, 404, { error: 'unknown_code' });
    if (meta.completedAt) return sendJSON(res, 409, { error: 'already_completed' });

    const lang = typeof body.lang === 'string' ? (body.lang === 'fr' ? 'fr' : 'en') : null;
    const step = typeof body.step === 'string' ? body.step : null;
    const info = body.info && typeof body.info === 'object' ? body.info : null;
    if (lang || step || info) await store.saveMeta(code, { lang, step, info });

    if (body.answer && typeof body.answer === 'object') {
      const { questionId, choice, mouse, timing } = body.answer;
      const known = QUESTIONS.find((q) => q.id === questionId);
      if (known && ['A', 'B', 'C', 'D'].includes(choice)) {
        await store.saveAnswer(code, {
          questionId, choice,
          mouse: Array.isArray(mouse) ? mouse.slice(0, 20000) : null,
          timing: typeof timing === 'number' ? timing : null,
        });
      }
    }
    return sendJSON(res, 200, { ok: true });
  }

  if (pathname === '/api/complete' && req.method === 'POST') {
    const body = await readBody(req);
    const p = await store.read((body.code || '').trim());
    if (!p) return sendJSON(res, 404, { error: 'unknown_code' });
    if (!p.completedAt) {
      const score = scoreAnswers(p.answers);
      await store.complete(p.code, {
        score, profileKey: score.key, step: 'result', completedAt: new Date().toISOString(),
      });
      p.score = score; p.profileKey = score.key;
    }
    return sendJSON(res, 200, resultPayload(p));
  }

  if (pathname === '/api/result' && req.method === 'GET') {
    const code = (new URL(req.url, 'http://x').searchParams.get('code') || '').trim();
    const p = await store.read(code);
    if (!p || !p.completedAt) return sendJSON(res, 404, { error: 'no_result' });
    return sendJSON(res, 200, resultPayload(p));
  }

  return sendJSON(res, 404, { error: 'not_found' });
}

function clientView(p) {
  return {
    code: p.code, lang: p.lang, step: p.step, info: p.info,
    answers: p.answers, completed: !!p.completedAt,
  };
}

function resultPayload(p) {
  const profile = PROFILES[p.profileKey] || PROFILES.LLL;
  return { code: p.code, profileKey: p.profileKey, profile, score: p.score };
}

// ---------------------------------------------------------------- server

const server = http.createServer((req, res) => {
  const pathname = req.url.split('?')[0];
  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname).catch((err) => {
      sendJSON(res, 500, { error: 'server_error', detail: String(err && err.message || err) });
    });
    return;
  }
  serveStatic(req, res);
});

store.init()
  .then(() => server.listen(PORT, () => {
    console.log(`AI Literacy Platform running at http://localhost:${PORT}  (storage: ${store.kind})`);
  }))
  .catch((err) => {
    console.error('Failed to initialise storage:', err);
    process.exit(1);
  });
