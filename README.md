# AI Literacy Platform 🤖

A bilingual (EN/FR) AI-literacy questionnaire. Participants acknowledge the study,
receive a reusable code, answer ~20 multiple-choice questions split into three rubrics
(**General / Technical / Ethics**), and unlock a fun persona at the end. Mouse movement
is recorded per question for research.

## Architecture

Three containers, classic 3-tier:

```
 browser ──▶ frontend (nginx)  ──/api──▶  backend (Node.js)  ──▶  db (PostgreSQL)
            static UI + proxy            HTTP API + scoring        participants + answers + mouse
```

- **frontend** — `nginx`, serves `public/` and reverse-proxies `/api/*` to the backend.
- **backend** — zero-framework Node.js HTTP server (`server.js`). Scores answers
  server-side so correct answers never reach the browser; assigns a persona.
- **db** — PostgreSQL. Tables (`participants`, `answers`) are auto-created on boot.

## Run with Docker (recommended)

```bash
cp .env.example .env        # optional: tweak ports / credentials
docker compose up --build
```

Then open **http://localhost:8080** (change with `WEB_PORT` in `.env`).

Data persists in the `dbdata` volume. To wipe everything: `docker compose down -v`.

## Run locally without Docker (dev)

No database needed — storage falls back to JSON files under `data/participants/`:

```bash
node server.js
# open http://localhost:3000
```

Set `DATABASE_URL` to use Postgres instead, e.g.:

```bash
DATABASE_URL=postgres://app:app@localhost:5432/ailit node server.js
```

## Showing participants how their profile was worked out

After finishing, participants see the per-theme rule (**more than half correct = Strong**),
the combination that selected their persona, and every question with the answer they gave.

By default the correct answer is also shown for the questions they got wrong. If that risks
contaminating the sample while the study is running, hide the answer key — right/wrong marks
and the profile explanation stay:

```bash
REVEAL_ANSWERS=false node server.js      # or set it in .env for docker compose
```

## Email: confirmation and password reset

A new teacher account is inactive until the address is confirmed. Sign-up sends a
link (valid 24 h); opening it activates the account and signs them in. Signing in
before that lands on a "check your inbox" screen with a resend button.

"Forgotten your password?" sends a one-hour, single-use link. Using it sets the new
password, signs that person in, and **invalidates every other session** for the
account, so a stolen session cannot outlive the password it was created under.

Reset and confirmation tokens are stored only as SHA-256 hashes: a copy of the
database cannot be turned into a working link. `/api/teacher/forgot` answers the
same way whether or not the address has an account.

Configure SMTP in `.env` (see `.env.example`). **Leave `SMTP_HOST` empty and no mail
is sent — the links are written to the server log instead**, which is what you want
in development. `PUBLIC_URL` must be the address teachers actually use, because the
request's own `Host` header is not trustworthy.

Check the credentials without sending anything:

```bash
node -e "require('./mailer.js').verifyConnection().then(console.log, e => { console.error(e.message); process.exit(1); })"
```

`.env` is gitignored — keep real credentials there, never in a committed file.

## Settings

| Variable | Default | What it does |
|----------|---------|--------------|
| `PORT` | `3000` | Port the backend listens on |
| `DATABASE_URL` | — | Use Postgres; unset means JSON files under `data/` |
| `REVEAL_ANSWERS` | `true` | Show the correct answer on questions a student got wrong |
| `MIN_CLASS_REPORTING` | `3` | Finished students needed before class results are shown |
| `CAPTCHA_SECRET` | random per boot | Signs the anti-robot challenge |
| `COOKIE_SECURE` | `false` | Send the teacher session cookie over HTTPS only |
| `SIGNUP_PER_HOUR` | `20` | Teacher sign-ups allowed per hour per IP |
| `PUBLIC_URL` | `http://localhost:PORT` | Base URL for links inside emails |
| `SMTP_HOST` | — | SMTP server; empty disables sending (links go to the log) |
| `SMTP_PORT` / `SMTP_SECURE` | `465` / `true` | `true` = implicit TLS; `false` uses STARTTLS |
| `SMTP_USER` / `SMTP_PASSWORD` | — | SMTP credentials |
| `MAIL_FROM` | `SMTP_USER` | `From:` header, e.g. `Name <noreply@example.org>` |

## Two ways in: students and teachers

**Students** can answer on their own at `/` — no account, just the anonymous code
they already get. Nothing about that flow changed.

**Teachers** sign in at `/teacher` (email + password, with a self-hosted anti-robot
check — no third-party captcha, so no student or teacher data leaves the server).
At sign-up a teacher says what they teach and where: for a French lycée they pick
their establishment from a searchable copy of the Ministry of Education directory,
otherwise they type the institution in.

A teacher then creates classes (name + subject) and shares each class's link:

```
https://your-host/?c=3HAC9TSD
```

Anyone who opens that link and answers is attached to that class automatically —
still without an account, and still anonymously. The teacher sees, per class, how
many joined and finished, the average score per theme, and how many students landed
on each persona. Never a name, never an individual answer sheet.

> Class results stay hidden until `MIN_CLASS_REPORTING` students (3 by default) have
> finished: below that, a "class average" would simply be one identifiable student.

### Refreshing the lycée directory

`reference/lycees.json` is a trimmed local copy of the
[Annuaire de l'éducation](https://www.data.gouv.fr/datasets/annuaire-de-leducation)
open dataset (Licence Ouverte / Etalab). To refresh it:

```bash
node scripts/fetch-annuaire.js .
```

## Project layout

| Path | Purpose |
|------|---------|
| `server.js` | HTTP API + static serving + scoring + class stats |
| `auth.js` | Teacher passwords (scrypt), sessions, captcha, rate limiting |
| `mailer.js` | Dependency-free SMTP client (implicit TLS or STARTTLS) |
| `emails.js` | Confirmation / reset email bodies, EN + FR |
| `env.js` | Loads `.env` before any module reads its configuration |
| `questions.js` | Bilingual question bank (rubric, difficulty, correct answer) |
| `profiles.json` | **The personas** — type + description (EN/FR), edit freely |
| `reference/lycees.json` | Local copy of the public education directory |
| `scripts/fetch-annuaire.js` | Rebuilds that copy from data.education.gouv.fr |
| `storage/` | Pluggable storage: `pg.js` (Postgres) or `file.js` (JSON files) |
| `public/` | Student app (`index.html`, `app.js`) and teacher app (`teacher.html`, `teacher.js`) |
| `Dockerfile` / `Dockerfile.frontend` | Backend / frontend images |
| `docker-compose.yml` | The three-service stack |
| `docker/nginx.conf` | nginx static + `/api` proxy config |

## How the questionnaire works

- Personal info first: first name, last name, age, level of study (dropdown:
  high school, licence, master, engineering, medicine, PhD, other) and field/_filière_ (free text).
- The three rubrics are shown up front, then taken **one at a time**; within each
  rubric the question order is **randomised** (seeded by the participant code so it is
  stable across reconnects).
- A 6-character code lets a participant pause and reconnect, or view their persona again,
  from the welcome screen.

## The personas

Eight personas, keyed by strength (`H`/`L`) in General/Technical/Ethics — see
`profiles.json`. Examples: 🐣 The AI Hatchling, 🦜 The Buzzword Parrot,
🔧 The Mad Tinkerer, 🧭 The Moral Compass, 🏎️ The Helmetless Engineer,
🦉 The Plugged-in Philosopher, 🥷 The Virtuous Hacker, 🧙 The Algorithm Sage.

## API quick reference

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | liveness + active storage backend |
| GET | `/api/bootstrap` | rubrics + questions (no correct answers) |
| POST | `/api/register` | create participant, return code |
| POST | `/api/login` | reconnect with a code |
| POST | `/api/save` | save info / a single answer + mouse path |
| POST | `/api/complete` | score, assign persona, lock |
| GET | `/api/result?code=` | fetch a stored persona |
