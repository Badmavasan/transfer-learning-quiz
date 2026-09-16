'use strict';

// Minimal SMTP client — enough to send the platform's own transactional mail
// (address confirmation, password reset) without pulling in a dependency.
// Supports implicit TLS (port 465) and STARTTLS (587), with AUTH LOGIN / PLAIN.

const tls = require('tls');
const net = require('net');
const crypto = require('crypto');

// ---------------------------------------------------------------- config

require('./env.js');   // ensure .env is in process.env before reading it

const CONFIG = {
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE !== 'false',      // implicit TLS
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASSWORD || '',
  from: process.env.MAIL_FROM || process.env.SMTP_USER || '',
  timeoutMs: Number(process.env.SMTP_TIMEOUT_MS || 20000),
};

const isConfigured = () => !!(CONFIG.host && CONFIG.user && CONFIG.pass);

// "Name <a@b.c>" -> "a@b.c"; a bare address passes straight through.
function envelopeAddress(from) {
  const m = String(from).match(/<([^>]+)>/);
  return (m ? m[1] : String(from)).trim();
}

// Header addresses must be ASCII, so an accented display name ("Littératie IA")
// is encoded while the <address> itself is left alone.
function formatFrom(from) {
  const raw = String(from).replace(/^"|"$/g, '').trim();
  const m = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (!m) return raw;
  const name = m[1].trim().replace(/^"|"$/g, '');
  return name ? `${encodeHeader(name)} <${m[2].trim()}>` : `<${m[2].trim()}>`;
}

// ---------------------------------------------------------------- encoding

// RFC 2047 for non-ASCII headers, so accented subjects survive.
function encodeHeader(value) {
  const s = String(value);
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}
// Base64 bodies sidestep both line-length limits and SMTP dot-stuffing:
// no base64 line can begin with a '.'.
function base64Body(text) {
  return (Buffer.from(text, 'utf8').toString('base64').match(/.{1,76}/g) || []).join('\r\n');
}

function buildMessage({ to, subject, text, html }) {
  const boundary = 'b' + crypto.randomBytes(16).toString('hex');
  const headers = [
    `From: ${formatFrom(CONFIG.from)}`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${envelopeAddress(CONFIG.from).split('@')[1] || 'localhost'}>`,
    'MIME-Version: 1.0',
    'Auto-Submitted: auto-generated',
  ];
  if (!html) {
    headers.push('Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64');
    return headers.join('\r\n') + '\r\n\r\n' + base64Body(text);
  }
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  return [
    headers.join('\r\n'), '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64', '',
    base64Body(text), '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64', '',
    base64Body(html), '',
    `--${boundary}--`, '',
  ].join('\r\n');
}

// ---------------------------------------------------------------- SMTP

// One command/response exchange at a time. SMTP replies can span several lines
// ("250-..." continuation, "250 ..." final), so buffer until the final line.
function smtpSession(socket) {
  let buffer = '';
  let waiter = null;
  socket.setEncoding('utf8');
  socket.on('data', (chunk) => {
    buffer += chunk;
    const m = buffer.match(/^(?:\d{3}-[^\n]*\n)*(\d{3}) [^\n]*\r?\n$/);
    if (m && waiter) {
      const { resolve } = waiter;
      const reply = { code: Number(m[1]), text: buffer };
      buffer = ''; waiter = null;
      resolve(reply);
    }
  });
  return {
    read: () => new Promise((resolve, reject) => { waiter = { resolve, reject }; }),
    send(line) { socket.write(line + '\r\n'); return this.read(); },
    raw(data) { socket.write(data); },
  };
}

function expect(reply, codes, step) {
  if (!codes.includes(reply.code)) {
    throw new Error(`SMTP ${step} failed: ${reply.text.trim()}`);
  }
}

async function sendMail({ to, subject, text, html }) {
  if (!isConfigured()) throw new Error('SMTP is not configured');

  const socket = await new Promise((resolve, reject) => {
    const opts = { host: CONFIG.host, port: CONFIG.port };
    const s = CONFIG.secure
      ? tls.connect(Object.assign({ servername: CONFIG.host }, opts), () => resolve(s))
      : net.connect(opts, () => resolve(s));
    s.setTimeout(CONFIG.timeoutMs, () => s.destroy(new Error('SMTP timeout')));
    s.once('error', reject);
  });

  try {
    let smtp = smtpSession(socket);
    expect(await smtp.read(), [220], 'greeting');
    let reply = await smtp.send(`EHLO ${envelopeAddress(CONFIG.from).split('@')[1] || 'localhost'}`);
    expect(reply, [250], 'EHLO');

    // Plain connection on 587: upgrade before authenticating.
    let sock = socket;
    if (!CONFIG.secure) {
      expect(await smtp.send('STARTTLS'), [220], 'STARTTLS');
      sock = await new Promise((resolve, reject) => {
        const u = tls.connect({ socket, servername: CONFIG.host }, () => resolve(u));
        u.once('error', reject);
      });
      sock.setTimeout(CONFIG.timeoutMs, () => sock.destroy(new Error('SMTP timeout')));
      smtp = smtpSession(sock);
      reply = await smtp.send(`EHLO ${envelopeAddress(CONFIG.from).split('@')[1] || 'localhost'}`);
      expect(reply, [250], 'EHLO (TLS)');
    }

    const offersPlain = /AUTH[^\n]*PLAIN/i.test(reply.text);
    if (offersPlain) {
      const token = Buffer.from(`\0${CONFIG.user}\0${CONFIG.pass}`, 'utf8').toString('base64');
      expect(await smtp.send(`AUTH PLAIN ${token}`), [235], 'AUTH PLAIN');
    } else {
      expect(await smtp.send('AUTH LOGIN'), [334], 'AUTH LOGIN');
      expect(await smtp.send(Buffer.from(CONFIG.user, 'utf8').toString('base64')), [334], 'AUTH user');
      expect(await smtp.send(Buffer.from(CONFIG.pass, 'utf8').toString('base64')), [235], 'AUTH password');
    }

    expect(await smtp.send(`MAIL FROM:<${envelopeAddress(CONFIG.from)}>`), [250], 'MAIL FROM');
    expect(await smtp.send(`RCPT TO:<${to}>`), [250, 251], 'RCPT TO');
    expect(await smtp.send('DATA'), [354], 'DATA');
    smtp.raw(buildMessage({ to, subject, text, html }) + '\r\n.\r\n');
    const accepted = await smtp.read();
    expect(accepted, [250], 'message body');
    await smtp.send('QUIT').catch(() => {});
    return { ok: true, response: accepted.text.trim() };
  } finally {
    socket.destroy();
  }
}

// Verifies host, TLS and credentials without delivering anything.
async function verifyConnection() {
  if (!isConfigured()) throw new Error('SMTP is not configured');
  const socket = await new Promise((resolve, reject) => {
    const s = CONFIG.secure
      ? tls.connect({ host: CONFIG.host, port: CONFIG.port, servername: CONFIG.host }, () => resolve(s))
      : net.connect({ host: CONFIG.host, port: CONFIG.port }, () => resolve(s));
    s.setTimeout(CONFIG.timeoutMs, () => s.destroy(new Error('SMTP timeout')));
    s.once('error', reject);
  });
  try {
    const smtp = smtpSession(socket);
    expect(await smtp.read(), [220], 'greeting');
    const reply = await smtp.send(`EHLO ${envelopeAddress(CONFIG.from).split('@')[1] || 'localhost'}`);
    expect(reply, [250], 'EHLO');
    if (/AUTH[^\n]*PLAIN/i.test(reply.text)) {
      const token = Buffer.from(`\0${CONFIG.user}\0${CONFIG.pass}`, 'utf8').toString('base64');
      expect(await smtp.send(`AUTH PLAIN ${token}`), [235], 'AUTH PLAIN');
    } else {
      expect(await smtp.send('AUTH LOGIN'), [334], 'AUTH LOGIN');
      expect(await smtp.send(Buffer.from(CONFIG.user, 'utf8').toString('base64')), [334], 'AUTH user');
      expect(await smtp.send(Buffer.from(CONFIG.pass, 'utf8').toString('base64')), [235], 'AUTH password');
    }
    await smtp.send('QUIT').catch(() => {});
    return { ok: true, host: CONFIG.host, port: CONFIG.port, from: CONFIG.from };
  } finally {
    socket.destroy();
  }
}

module.exports = { sendMail, verifyConnection, isConfigured, CONFIG, buildMessage, envelopeAddress, formatFrom };
