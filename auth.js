'use strict';

// Teacher authentication helpers — password hashing, session tokens and a
// self-hosted captcha. Deliberately dependency-free (Node crypto only) so the
// platform keeps no third-party trackers and nothing leaves the server.

const crypto = require('crypto');

// ---------------------------------------------------------------- passwords

// scrypt parameters. N=16384 keeps a hash around ~50-100ms on a small VM.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) => {
      if (err) return reject(err);
      resolve(`scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('hex')}$${key.toString('hex')}`);
    });
  });
}

function verifyPassword(password, stored) {
  return new Promise((resolve) => {
    if (typeof stored !== 'string') return resolve(false);
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return resolve(false);
    const [, N, r, p, saltHex, keyHex] = parts;
    let salt, expected;
    try { salt = Buffer.from(saltHex, 'hex'); expected = Buffer.from(keyHex, 'hex'); }
    catch (_) { return resolve(false); }
    crypto.scrypt(password, salt, expected.length, { N: +N, r: +r, p: +p }, (err, key) => {
      if (err) return resolve(false);
      resolve(key.length === expected.length && crypto.timingSafeEqual(key, expected));
    });
  });
}

// A password policy that is strict enough to matter without being theatre.
function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 10) return 'password_too_short';
  if (password.length > 200) return 'password_too_long';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return 'password_too_simple';
  return null;
}

// Deliberately permissive: the point is to catch typos, not to police addresses.
function normaliseEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}
function emailLooksValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

// ---------------------------------------------------------------- tokens

const newId = () => crypto.randomBytes(16).toString('hex');
const newSessionToken = () => crypto.randomBytes(32).toString('hex');

// Class codes go in a URL students type or click, so keep the alphabet
// unambiguous (no 0/O/1/I) like the participant codes.
const CLASS_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeClassCode(len = 8) {
  let c = '';
  for (let i = 0; i < len; i++) c += CLASS_ALPHABET[crypto.randomInt(CLASS_ALPHABET.length)];
  return c;
}

// ---------------------------------------------------------------- captcha

// Stateless challenge: the answer travels inside an HMAC-signed token, so no
// server-side store is needed. Solved tokens are remembered briefly so one
// solution cannot be replayed across several sign-ups.
const CAPTCHA_SECRET = process.env.CAPTCHA_SECRET || crypto.randomBytes(32).toString('hex');
const CAPTCHA_TTL_MS = 10 * 60 * 1000;
const usedCaptchas = new Map();  // token -> expiry, pruned lazily

function sign(payload) {
  return crypto.createHmac('sha256', CAPTCHA_SECRET).update(payload).digest('hex').slice(0, 32);
}

function makeCaptcha() {
  const a = crypto.randomInt(2, 10);
  const b = crypto.randomInt(2, 10);
  const plus = crypto.randomInt(2) === 0;
  // Keep the result positive so the answer is always a small natural number.
  const [x, y] = plus || a >= b ? [a, b] : [b, a];
  const answer = plus ? x + y : x - y;
  const expires = Date.now() + CAPTCHA_TTL_MS;
  // The nonce keeps two challenges issued in the same millisecond with the same
  // answer from colliding into one token (which replay protection would reject).
  const payload = `${answer}.${expires}.${crypto.randomBytes(8).toString('hex')}`;
  const token = `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;
  return { token, svg: captchaSvg(`${x} ${plus ? '+' : '−'} ${y} = ?`), expiresIn: CAPTCHA_TTL_MS / 1000 };
}

// `consume: false` validates without burning the challenge, so a user who fumbles
// another field on the form does not have to solve a fresh image. The caller
// consumes it once the rest of the request has passed.
function checkCaptcha(token, answer, { consume = true } = {}) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const now = Date.now();
  for (const [k, exp] of usedCaptchas) if (exp < now) usedCaptchas.delete(k);
  if (usedCaptchas.has(token)) return false;

  const idx = token.lastIndexOf('.');
  const payload = Buffer.from(token.slice(0, idx), 'base64url').toString();
  const mac = token.slice(idx + 1);
  const expectedMac = sign(payload);
  if (mac.length !== expectedMac.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expectedMac))) return false;

  const [expected, expires] = payload.split('.');
  if (!expires || Number(expires) < now) return false;
  if (String(answer).trim() !== expected) return false;
  if (consume) usedCaptchas.set(token, Number(expires));
  return true;
}

function consumeCaptcha(token) {
  const idx = String(token).lastIndexOf('.');
  const payload = Buffer.from(String(token).slice(0, idx), 'base64url').toString();
  const expires = Number(payload.split('.')[1]);
  if (expires) usedCaptchas.set(token, expires);
}

// Rendered rather than sent as text, so the challenge is not simply read out of
// the JSON response. Characters are jittered and crossed with noise lines.
function captchaSvg(text) {
  const W = 200, H = 64;
  const rnd = (min, max) => min + crypto.randomInt(Math.max(1, Math.round((max - min) * 100))) / 100;
  const chars = [...text].map((ch, i) => {
    const x = 16 + i * (168 / Math.max(1, text.length));
    const y = H / 2 + rnd(-5, 5);
    const rot = rnd(-18, 18);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"`
      + ` font-family="Georgia, serif" font-size="${rnd(22, 30).toFixed(1)}" font-weight="700"`
      + ` fill="#0c4a6e" dominant-baseline="middle">${ch === '&' ? '&amp;' : ch}</text>`;
  }).join('');
  const noise = Array.from({ length: 5 }, () =>
    `<line x1="${rnd(0, W).toFixed(0)}" y1="${rnd(0, H).toFixed(0)}" x2="${rnd(0, W).toFixed(0)}" y2="${rnd(0, H).toFixed(0)}"`
    + ` stroke="#1668a7" stroke-opacity="0.25" stroke-width="${rnd(1, 2).toFixed(1)}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">`
    + `<rect width="${W}" height="${H}" rx="10" fill="#eef3f8"/>${noise}${chars}</svg>`;
}

// ---------------------------------------------------------------- rate limiting

// In-memory sliding window. Good enough for a single-process research server;
// behind several replicas this would need to move into the database.
const attempts = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const hits = (attempts.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    attempts.set(key, hits);
    return { allowed: false, retryAfter: Math.ceil((windowMs - (now - hits[0])) / 1000) };
  }
  hits.push(now);
  attempts.set(key, hits);
  if (attempts.size > 5000) for (const [k, v] of attempts) if (!v.some((t) => now - t < windowMs)) attempts.delete(k);
  return { allowed: true };
}

// ---------------------------------------------------------------- cookies

const SESSION_COOKIE = 'tsid';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function sessionCookie(token, maxAgeSec) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`
    + (COOKIE_SECURE ? '; Secure' : '');
}
const clearSessionCookie = () => sessionCookie('', 0);

module.exports = {
  hashPassword, verifyPassword, passwordProblem, normaliseEmail, emailLooksValid,
  newId, newSessionToken, makeClassCode,
  makeCaptcha, checkCaptcha, consumeCaptcha,
  rateLimit,
  parseCookies, sessionCookie, clearSessionCookie, SESSION_COOKIE, SESSION_TTL_MS,
};
