'use strict';

// Loads .env into process.env before anything else reads it. Required first by
// server.js, because auth.js, storage/ and mailer.js all read configuration at
// module load, and a .env value arriving later would simply be ignored.
// Real environment variables always win over the file.

const fs = require('fs');
const path = require('path');

let loaded = false;
function load(file) {
  if (loaded) return;
  loaded = true;
  let text;
  try { text = fs.readFileSync(file || path.join(__dirname, '.env'), 'utf8'); }
  catch (_) { return; }
  for (const line of text.split('\n')) {
    if (/^\s*(#|$)/.test(line)) continue;
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

load();
module.exports = { load };
