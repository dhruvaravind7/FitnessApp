# FitCoach

Search 1,300+ exercises with videos, log workouts as sessions, watch volume / streaks / records / per-exercise progress,
and chat with an AI coach that pulls your real training data through an MCP server.

**Stack:** FastAPI + Postgres · React 19 + Vite · Gemini + Model Context Protocol.

## Quick start

Prerequisites: Python 3.12, Node 20, a Postgres database (hosted, SSL), a RapidAPI key for
[ExerciseDB](https://rapidapi.com/ascendapi/api/edb-with-videos-and-images-by-ascendapi) and a Gemini API key.

```bash
# 1. backend
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env          # fill in DB_*, EDB_KEY, JWT_SECRET_KEY, GEMINI_API_KEY
.venv/bin/uvicorn main:app --reload --port 8000

# 2. frontend (new terminal)
cd frontend
npm install
npm run dev                   # open http://localhost:5173
```

The schema in `backend/schema.sql` is applied automatically on startup. API docs: http://localhost:8000/docs.

### Or with Docker

Needs only Docker — no Python, Node or venv on the host. Postgres is still yours to provide (the compose file
does not start one); see [Deployment](#deployment) for the Supabase connection settings.

```bash
cp backend/.env.example backend/.env    # fill in DB_*, EDB_KEY, JWT_SECRET_KEY, GEMINI_API_KEY
docker compose up --build               # frontend http://localhost:5173 · API http://localhost:8000
```

Source is bind-mounted, so edits on the host hot-reload in both containers exactly as they do above. Run the
backend tests in the container with `docker compose exec backend python -m pytest`.

The backend image is the same one that runs in production; `docker-compose.yml` just overrides its start
command to add `--reload`. That one line is the whole dev/prod difference.

`frontend/Dockerfile` is local-only — Vercel builds the frontend from source and never uses Docker.

## Features
- **Exercise library** – name search, filters (body part, equipment, target muscle, type), videos, instructions, form tips.
- **Sessions** – start a session, add exercises from the library, finish from the sticky bar; or quick-log a single exercise
  with a chosen date. Edit sets/reps/weight/notes, rename or re-date sessions, delete anything.
- **Dashboard** – sessions this week, monthly volume, streak, last workout, 8-week volume chart, muscle balance, PRs.
- **History** – sessions grouped by month with date filtering and inline editing.
- **Coach** – persistent conversations; Gemini answers using MCP tools over your log (sessions, progress, records, balance).
- **kg / lbs** toggle (weights are stored in lbs).

## MCP server
The coach's tools are also served at `POST http://localhost:8000/mcp` (streamable HTTP). Authenticate with
`Authorization: Bearer <your JWT>` (get one from `POST /auth/login`). Example with the MCP inspector:

```bash
npx @modelcontextprotocol/inspector --transport http --server-url http://localhost:8000/mcp \
  --header "Authorization: Bearer $TOKEN"
```

## Deployment

Three services, each deploying from this repo on push to `main`:

| Piece | Host | Notes |
| --- | --- | --- |
| React SPA | **Vercel** | Root Directory `frontend`. Vercel runs `npm run build` and CDN-serves `dist/`; Docker is not involved. |
| FastAPI API + `/mcp` | **Railway** | Root Directory `backend`, builds `backend/Dockerfile`. Needs a long-running process for the connection pool and the up-to-90s Gemini call. |
| Postgres | **Supabase** | Connect via the **session pooler** — see `backend/.env.example` for the exact settings and the IPv6 gotcha. |

Frontend and backend sit on separate origins, so CORS applies. Set these in the platform dashboards, not
in a file — `backend/.env` is git-ignored and never deployed:

- **Railway** — all `DB_*` values, `EDB_KEY`, `GEMINI_API_KEY`, a *fresh* `JWT_SECRET_KEY`, and
  `FRONTEND_ORIGIN` set to the Vercel URL. Leave `PORT` unset; Railway injects it and the Dockerfile
  reads `${PORT:-8000}`.
- **Vercel** — `VITE_API_URL` set to the Railway URL. This is baked in at build time, so changing it
  requires a redeploy, not just an env var edit.

Chicken-and-egg: deploy Railway first, then Vercel, then come back and set `FRONTEND_ORIGIN`.

`schema.sql` is applied on every backend boot, so the Supabase tables are created automatically the first
time it starts — there is no migration step.

## Tests
```bash
cd backend && .venv/bin/pytest            # uses an isolated `fitcoach_test` schema on your DB
cd frontend && npm run lint && npm test && npm run build
```

See `CLAUDE.md` for architecture notes and conventions.
