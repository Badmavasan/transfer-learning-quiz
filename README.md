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

## Project layout

| Path | Purpose |
|------|---------|
| `server.js` | HTTP API + static serving + scoring |
| `questions.js` | Bilingual question bank (rubric, difficulty, correct answer) |
| `profiles.json` | **The personas** — type + description (EN/FR), edit freely |
| `storage/` | Pluggable storage: `pg.js` (Postgres) or `file.js` (JSON files) |
| `public/` | Frontend (`index.html`, `app.js`, `styles.css`, `i18n.js`) |
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
