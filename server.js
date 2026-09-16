'use strict';

// AI Literacy Platform: zero-dependency HTTP layer.
// Storage is pluggable: PostgreSQL when DATABASE_URL is set (Docker), else local JSON files.
// Run with: node server.js   (then open http://localhost:3000)

require('./env.js');   // must come first: the modules below read config at load time

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { RUBRICS, RUBRIC_ORDER, QUESTIONS } = require('./questions.js');
const PROFILES = JSON.parse(fs.readFileSync(path.join(__dirname, 'profiles.json'), 'utf8')).profiles;
const store = require('./storage');
const auth = require('./auth.js');
const mailer = require('./mailer.js');
const emails = require('./emails.js');

// Local copy of the "Annuaire de l'éducation" open dataset, used for the
// searchable establishment picker at teacher sign-up. Refresh it with
// `node scripts/fetch-annuaire.js .`
const LYCEES = (() => {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'reference', 'lycees.json'), 'utf8'));
    return raw.lycees.map((l) => Object.assign({}, l, { _s: fold(`${l.nom} ${l.commune} ${l.cp} ${l.depNom}`) }));
  } catch (_) {
    console.warn('reference/lycees.json missing, the lycée picker will fall back to free text.');
    return [];
  }
})();
// Accent- and case-insensitive so "lycee jean moulin" finds "Lycée Jean Moulin".
function fold(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const PORT = process.env.PORT || 3000;
// The result screen explains how each answer fed into the profile. Set
// REVEAL_ANSWERS=false to show only right/wrong and keep the answer key hidden
// (useful if participants might share it while the study is still running).
const REVEAL_ANSWERS = process.env.REVEAL_ANSWERS !== 'false';
const SIGNUP_PER_HOUR = Number(process.env.SIGNUP_PER_HOUR || 20);
// Students are told their teacher sees class results, never individual answers.
// Below this many finished questionnaires an "aggregate" would be one identifiable
// student, so the breakdown is withheld until the class is big enough.
const MIN_CLASS_REPORTING = Number(process.env.MIN_CLASS_REPORTING || 3);
// Absolute base for links inside emails; the request's own Host header is not
// trustworthy and may be an internal container name.
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
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

// Questions without the "correct" field, safe to send to the browser.
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

// ---------------------------------------------------------------- class stats

// Aggregate a class: how many landed on each persona, and the average score per
// theme. Only completed participants count towards averages.
function classStats(participants) {
  const done = participants.filter((p) => p.completedAt && p.score);
  const profiles = Object.keys(PROFILES).map((key) => ({
    key,
    emoji: PROFILES[key].emoji,
    name: PROFILES[key].name,
    count: done.filter((p) => p.profileKey === key).length,
  }));
  const rubrics = RUBRIC_ORDER.map((rkey) => {
    const rows = done.map((p) => (p.score.rubrics || []).find((r) => r.key === rkey)).filter(Boolean);
    const total = rows.length ? rows[0].total : QUESTIONS.filter((q) => q.rubric === rkey).length;
    const sum = rows.reduce((acc, r) => acc + r.correct, 0);
    return {
      key: rkey,
      label: RUBRICS[rkey].label,
      emoji: RUBRICS[rkey].emoji,
      total,
      average: rows.length ? +(sum / rows.length).toFixed(2) : 0,
      percent: rows.length ? Math.round((sum / rows.length / total) * 100) : 0,
      strong: rows.filter((r) => r.level === 'high').length,
    };
  });
  const totalSum = done.reduce((acc, p) => acc + (p.score.totalCorrect || 0), 0);
  const enough = done.length >= MIN_CLASS_REPORTING;
  return {
    students: participants.length,
    completed: done.length,
    totalQuestions: QUESTIONS.length,
    // Counts of who joined and finished are always safe; the breakdown is not.
    suppressed: !enough,
    minReporting: MIN_CLASS_REPORTING,
    profiles: enough ? profiles : [],
    rubrics: enough ? rubrics : [],
    averageTotal: enough ? +(totalSum / done.length).toFixed(2) : null,
    averagePercent: enough ? Math.round((totalSum / done.length / QUESTIONS.length) * 100) : null,
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
  if (urlPath === '/teacher' || urlPath === '/teacher/') urlPath = '/teacher.html';
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
    // A participant arriving through a class link is attached to that class.
    // An unknown code is dropped rather than refused: a broken link should never
    // stop someone taking part, it just means their answers count as independent.
    const wanted = String(body.classCode || '').trim().toUpperCase();
    const classCode = wanted && await store.classExists(wanted) ? wanted : null;
    const p = {
      code,
      createdAt: new Date().toISOString(),
      lang: body.lang === 'fr' ? 'fr' : 'en',
      step: 'info',
      info: null,
      answers: {}, mouse: {}, timing: {},
      completedAt: null, profileKey: null, score: null,
      classCode,
    };
    await store.register(p);
    return sendJSON(res, 200, { code, classCode });
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

  // ---------------------------------------------------------------- teachers

  if (pathname === '/api/captcha' && req.method === 'GET') {
    return sendJSON(res, 200, auth.makeCaptcha());
  }

  // Searchable establishment picker (local copy of the education directory).
  if (pathname === '/api/lycees' && req.method === 'GET') {
    const q = fold((new URL(req.url, 'http://x').searchParams.get('q') || '').trim());
    if (q.length < 2) return sendJSON(res, 200, { results: [], total: LYCEES.length });
    const terms = q.split(/\s+/);
    const hits = [];
    for (const l of LYCEES) {
      if (terms.every((t) => l._s.includes(t))) {
        hits.push({ uai: l.uai, nom: l.nom, commune: l.commune, cp: l.cp, dep: l.dep, depNom: l.depNom, statut: l.statut });
        if (hits.length >= 25) break;
      }
    }
    return sendJSON(res, 200, { results: hits, total: LYCEES.length });
  }

  if (pathname === '/api/teacher/signup' && req.method === 'POST') {
    const body = await readBody(req);
    // Schools sit behind one NAT address, so several teachers may legitimately
    // sign up from the same IP in one sitting; the captcha is the real gate here.
    const limit = auth.rateLimit(`signup:${clientIp(req)}`, SIGNUP_PER_HOUR, 60 * 60 * 1000);
    if (!limit.allowed) return sendJSON(res, 429, { error: 'too_many_attempts', retryAfter: limit.retryAfter });

    if (!auth.checkCaptcha(body.captchaToken, body.captchaAnswer, { consume: false })) {
      return sendJSON(res, 400, { error: 'captcha_failed' });
    }
    const email = auth.normaliseEmail(body.email);
    if (!auth.emailLooksValid(email)) return sendJSON(res, 400, { error: 'email_invalid' });
    const pwProblem = auth.passwordProblem(body.password);
    if (pwProblem) return sendJSON(res, 400, { error: pwProblem });
    if (body.password !== body.passwordConfirm) return sendJSON(res, 400, { error: 'password_mismatch' });

    const subjects = String(body.subjects || '').trim();
    if (!subjects) return sendJSON(res, 400, { error: 'subjects_required' });
    const affiliationType = body.affiliationType === 'lycee' ? 'lycee' : 'other';
    let affiliation = String(body.affiliation || '').trim();
    let lyceeUai = null;
    if (affiliationType === 'lycee') {
      const found = LYCEES.find((l) => l.uai === String(body.lyceeUai || ''));
      if (!found) return sendJSON(res, 400, { error: 'lycee_required' });
      lyceeUai = found.uai;
      affiliation = `${found.nom}, ${found.commune} (${found.dep})`;
    } else if (!affiliation) {
      return sendJSON(res, 400, { error: 'affiliation_required' });
    }

    if (await store.findTeacherByEmail(email)) return sendJSON(res, 409, { error: 'email_taken' });
    const teacher = {
      id: auth.newId(), email,
      passwordHash: await auth.hashPassword(body.password),
      fullName: String(body.fullName || '').trim() || null,
      subjects, affiliationType, affiliation, lyceeUai,
    };
    teacher.emailVerified = false;
    await store.createTeacher(teacher);
    auth.consumeCaptcha(body.captchaToken);   // one account per solved challenge
    const sent = await mailToken(teacher, 'verify', await issueToken(teacher, 'verify'), body.lang);
    // No session until the address is confirmed.
    return sendJSON(res, 200, { pendingVerification: true, email: teacher.email, mailSent: sent });
  }

  if (pathname === '/api/teacher/verify' && req.method === 'POST') {
    const body = await readBody(req);
    const found = await store.readToken(hashToken(body.token || ''), 'verify');
    if (!found) return sendJSON(res, 400, { error: 'link_invalid' });
    const teacher = await store.findTeacherById(found.teacherId);
    if (!teacher) return sendJSON(res, 400, { error: 'link_invalid' });
    await store.setEmailVerified(teacher.id);
    await store.deleteTokens(teacher.id, 'verify');
    teacher.emailVerified = true;
    return startSession(res, teacher);       // confirming signs them straight in
  }

  if (pathname === '/api/teacher/resend' && req.method === 'POST') {
    const body = await readBody(req);
    const email = auth.normaliseEmail(body.email);
    const limit = auth.rateLimit(`resend:${clientIp(req)}:${email}`, 5, 60 * 60 * 1000);
    if (!limit.allowed) return sendJSON(res, 429, { error: 'too_many_attempts', retryAfter: limit.retryAfter });
    const teacher = await store.findTeacherByEmail(email);
    if (teacher && !teacher.emailVerified) {
      await mailToken(teacher, 'verify', await issueToken(teacher, 'verify'), body.lang);
    }
    // Same answer either way: whether an address has an account is not public.
    return sendJSON(res, 200, { ok: true });
  }

  if (pathname === '/api/teacher/forgot' && req.method === 'POST') {
    const body = await readBody(req);
    const email = auth.normaliseEmail(body.email);
    const limit = auth.rateLimit(`forgot:${clientIp(req)}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) return sendJSON(res, 429, { error: 'too_many_attempts', retryAfter: limit.retryAfter });
    if (!auth.checkCaptcha(body.captchaToken, body.captchaAnswer, { consume: false })) {
      return sendJSON(res, 400, { error: 'captcha_failed' });
    }
    auth.consumeCaptcha(body.captchaToken);
    const teacher = await store.findTeacherByEmail(email);
    if (teacher) await mailToken(teacher, 'reset', await issueToken(teacher, 'reset'), body.lang);
    return sendJSON(res, 200, { ok: true });   // never reveals whether it exists
  }

  if (pathname === '/api/teacher/reset' && req.method === 'POST') {
    const body = await readBody(req);
    const found = await store.readToken(hashToken(body.token || ''), 'reset');
    if (!found) return sendJSON(res, 400, { error: 'link_invalid' });
    const pwProblem = auth.passwordProblem(body.password);
    if (pwProblem) return sendJSON(res, 400, { error: pwProblem });
    if (body.password !== body.passwordConfirm) return sendJSON(res, 400, { error: 'password_mismatch' });
    const teacher = await store.findTeacherById(found.teacherId);
    if (!teacher) return sendJSON(res, 400, { error: 'link_invalid' });

    await store.updatePassword(teacher.id, await auth.hashPassword(body.password));
    await store.deleteTokens(teacher.id, 'reset');
    // Whoever reset the password gets a fresh session; every other one dies,
    // so a stolen session cannot outlive the password it was created under.
    await store.deleteSessionsForTeacher(teacher.id);
    // Reaching the mailbox proves the address, so confirm it here too.
    if (!teacher.emailVerified) { await store.setEmailVerified(teacher.id); teacher.emailVerified = true; }
    return startSession(res, teacher);
  }

  if (pathname === '/api/teacher/login' && req.method === 'POST') {
    const body = await readBody(req);
    const email = auth.normaliseEmail(body.email);
    const limit = auth.rateLimit(`login:${clientIp(req)}:${email}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) return sendJSON(res, 429, { error: 'too_many_attempts', retryAfter: limit.retryAfter });

    const teacher = await store.findTeacherByEmail(email);
    // Verify against a dummy hash when the account is unknown so a wrong email
    // and a wrong password take the same time to answer.
    const ok = await auth.verifyPassword(String(body.password || ''),
      teacher ? teacher.passwordHash : DUMMY_HASH);
    if (!teacher || !ok) return sendJSON(res, 401, { error: 'bad_credentials' });
    if (!teacher.emailVerified) return sendJSON(res, 403, { error: 'email_not_verified', email: teacher.email });
    return startSession(res, teacher);
  }

  if (pathname === '/api/teacher/logout' && req.method === 'POST') {
    const token = auth.parseCookies(req.headers.cookie)[auth.SESSION_COOKIE];
    if (token) await store.deleteSession(token);
    res.setHeader('Set-Cookie', auth.clearSessionCookie());
    return sendJSON(res, 200, { ok: true });
  }

  if (pathname === '/api/teacher/me' && req.method === 'GET') {
    const teacher = await currentTeacher(req);
    if (!teacher) return sendJSON(res, 401, { error: 'not_signed_in' });
    return sendJSON(res, 200, { teacher: teacherView(teacher) });
  }

  // ---------------------------------------------------------------- classes

  if (pathname === '/api/teacher/classes' && req.method === 'GET') {
    const teacher = await currentTeacher(req);
    if (!teacher) return sendJSON(res, 401, { error: 'not_signed_in' });
    return sendJSON(res, 200, { classes: await store.listClasses(teacher.id) });
  }

  if (pathname === '/api/teacher/classes' && req.method === 'POST') {
    const teacher = await currentTeacher(req);
    if (!teacher) return sendJSON(res, 401, { error: 'not_signed_in' });
    const body = await readBody(req);
    const name = String(body.name || '').trim().slice(0, 120);
    const subject = String(body.subject || '').trim().slice(0, 120);
    if (!name) return sendJSON(res, 400, { error: 'class_name_required' });
    if (!subject) return sendJSON(res, 400, { error: 'class_subject_required' });
    let code;
    do { code = auth.makeClassCode(); } while (await store.classExists(code));
    const klass = { code, teacherId: teacher.id, name, subject };
    await store.createClass(klass);
    return sendJSON(res, 200, { class: Object.assign({ students: 0, completed: 0 }, klass) });
  }

  const classMatch = pathname.match(/^\/api\/teacher\/classes\/([A-Za-z0-9]{1,16})(\/stats)?$/);
  if (classMatch) {
    const teacher = await currentTeacher(req);
    if (!teacher) return sendJSON(res, 401, { error: 'not_signed_in' });
    const klass = await store.readClass(classMatch[1]);
    if (!klass || klass.teacherId !== teacher.id) return sendJSON(res, 404, { error: 'unknown_class' });

    if (classMatch[2] && req.method === 'GET') {
      const stats = classStats(await store.classParticipants(klass.code));
      return sendJSON(res, 200, { class: klass, stats });
    }
    if (!classMatch[2] && req.method === 'DELETE') {
      await store.deleteClass(klass.code);
      return sendJSON(res, 200, { ok: true });
    }
  }

  // What a student sees when they open a class link, with no teacher identity.
  const publicClass = pathname.match(/^\/api\/class\/([A-Za-z0-9]{1,16})$/);
  if (publicClass && req.method === 'GET') {
    const klass = await store.readClass(publicClass[1]);
    if (!klass) return sendJSON(res, 404, { error: 'unknown_class' });
    return sendJSON(res, 200, { class: { code: klass.code, name: klass.name, subject: klass.subject } });
  }

  return sendJSON(res, 404, { error: 'not_found' });
}

// A pre-computed hash of a random string, compared against when an email is
// unknown so that login timing does not reveal which accounts exist.
const DUMMY_HASH = 'scrypt$16384$8$1$' + '0'.repeat(32) + '$' + '0'.repeat(128);

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.socket.remoteAddress || 'unknown';
}

async function startSession(res, teacher) {
  const token = auth.newSessionToken();
  await store.createSession(token, teacher.id, new Date(Date.now() + auth.SESSION_TTL_MS));
  res.setHeader('Set-Cookie', auth.sessionCookie(token, auth.SESSION_TTL_MS / 1000));
  return sendJSON(res, 200, { teacher: teacherView(teacher) });
}

async function currentTeacher(req) {
  const token = auth.parseCookies(req.headers.cookie)[auth.SESSION_COOKIE];
  if (!token) return null;
  const session = await store.readSession(token);
  if (!session) return null;
  return store.findTeacherById(session.teacherId);
}

// Tokens are handed out in the clear and stored only as a hash, so a database
// copy cannot be turned into an account takeover.
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

async function issueToken(teacher, kind) {
  const token = crypto.randomBytes(32).toString('hex');
  const ttl = kind === 'verify' ? VERIFY_TTL_MS : RESET_TTL_MS;
  await store.deleteTokens(teacher.id, kind);      // one live link per purpose
  await store.createToken(hashToken(token), teacher.id, kind, new Date(Date.now() + ttl));
  return token;
}

// Delivery failures must not break the request: the account already exists and
// the teacher can ask for another link. They are logged, loudly.
async function mailToken(teacher, kind, token, lang) {
  const url = `${PUBLIC_URL}/teacher?${kind === 'verify' ? 'verify' : 'reset'}=${token}`;
  if (!mailer.isConfigured()) {
    console.warn(`SMTP not configured, ${kind} link for ${teacher.email}: ${url}`);
    return false;
  }
  try {
    await mailer.sendMail(Object.assign({ to: teacher.email }, emails.build(kind, lang, url)));
    return true;
  } catch (err) {
    console.error(`Failed to send ${kind} email to ${teacher.email}:`, err.message);
    return false;
  }
}

// Never let the password hash leave the server.
function teacherView(t) {
  return {
    id: t.id, email: t.email, fullName: t.fullName || null, subjects: t.subjects,
    affiliationType: t.affiliationType, affiliation: t.affiliation, lyceeUai: t.lyceeUai || null,
    emailVerified: t.emailVerified === true,
  };
}

function clientView(p) {
  return {
    code: p.code, lang: p.lang, step: p.step, info: p.info,
    answers: p.answers, completed: !!p.completedAt,
  };
}

function resultPayload(p) {
  const profile = PROFILES[p.profileKey] || PROFILES.LLL;
  return {
    code: p.code, profileKey: p.profileKey, profile, score: p.score,
    revealAnswers: REVEAL_ANSWERS,
    // Per-question breakdown so the participant can see which answers produced
    // their profile. Question/option wording already lives in the browser's
    // bootstrap, so only the keys travel here.
    review: QUESTIONS.map((q) => {
      const chosen = (p.answers && p.answers[q.id]) || null;
      const item = { id: q.id, rubric: q.rubric, chosen, isCorrect: chosen === q.correct };
      if (REVEAL_ANSWERS) item.correct = q.correct;
      return item;
    }),
  };
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
