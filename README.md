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

## Tests
```bash
cd backend && .venv/bin/pytest            # uses an isolated `fitcoach_test` schema on your DB
cd frontend && npm run lint && npm test && npm run build
```

See `CLAUDE.md` for architecture notes and conventions.
