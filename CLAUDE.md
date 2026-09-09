# FitCoach

Personal fitness app: search an exercise database, log workouts as sessions, track stats, and chat with an
AI coach that reads the user's real training data through an MCP server.

## Stack
- **Backend** (`backend/`): Python 3.12, FastAPI, psycopg 3 + `psycopg_pool`, hosted Postgres (SSL), argon2 password
  hashing, `python-jose` JWTs, `httpx` → ExerciseDB (RapidAPI), `google-genai` (Gemini) + `mcp` (FastMCP).
- **Frontend** (`frontend/`): Vite 8, React 19, react-router 7, axios, recharts, react-markdown, lucide-react, date-fns.
  Plain CSS with design tokens (dark theme only). Tests: Vitest + Testing Library.
- No Docker. `postgres/init.sql` is a copy of `backend/schema.sql` for bootstrapping a fresh DB by hand.

## Run it
```bash
# backend (from backend/)
cp .env.example .env            # fill in values
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --reload --port 8000      # docs at http://localhost:8000/docs

# frontend (from frontend/)
npm install
npm run dev                     # http://localhost:5173 (VITE_API_URL defaults to http://localhost:8000)
```
Tests: `cd backend && .venv/bin/pytest` · `cd frontend && npm run lint && npm test && npm run build`.

## Layout
```
backend/
  main.py          app factory, CORS, routers, lifespan (pool + schema + MCP session manager), /mcp ASGI route
  config.py        pydantic-settings Settings (reads backend/.env); get_settings() is cached
  db.py            ConnectionPool, get_conn() context manager, apply_schema()
  schema.sql       idempotent DDL, applied on every startup (CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
  deps.py          create_access_token / decode_token / get_current_user (HTTP bearer)
  models.py        Pydantic request/response models
  routers/         auth, exercises, sessions, stats, coach  (thin: validation + call a service)
  services/        exercisedb (upstream client), workouts (sessions + entries), stats (aggregates), coach (Gemini+MCP)
  mcp_server.py    FastMCP instance + tools; `current_user_id` ContextVar scopes every tool
  tests/           pytest; conftest creates schema `fitcoach_test` on the same DB and drops it afterwards
frontend/src/
  api/             axios client (token header, 401 → logout) + one module per resource
  context/         AuthContext, UnitContext (kg/lbs), SessionContext (active session), ToastContext
  components/      AppLayout, Navbar (sidebar + mobile bottom nav), ActiveSessionBar, SessionCard/EntryRow,
                   EditModals, ExerciseCard, ui.jsx (Modal, ConfirmDialog, StatCard, EmptyState…), charts/
  pages/           Auth, Dashboard, Search, ExerciseDetail, History, SessionDetail, Coach, NotFound
  lib/             units.js (lbs↔kg), format.js (dates), validation.js (form rules)
  styles/          tokens.css (CSS variables), global.css (reset + primitives: .btn .card .input .tag …)
```

## Domain rules (do not break)
- **Everything is a session.** `workouts` rows (one exercise entry) always belong to a `workout_sessions` row.
  A user has at most one *active* session (`ended_at IS NULL`, enforced by a partial unique index).
  `POST /sessions/quick-log` creates an already-finished one-exercise session.
- **Weights are stored in lbs** (`NUMERIC(6,2)`). The frontend converts to/from kg via `UnitContext`; the API never sees kg.
- **Volume** = sets × reps × weight(lbs); bodyweight entries (weight NULL) contribute 0 volume but still count sets.
- Stats endpoints accept `?today=YYYY-MM-DD` so week/streak math uses the client's local date.
- Every DB query is scoped by `user_id`. Never add an MCP tool or endpoint that takes a user id as input.
- Session `date` is the source of truth; `PATCH /sessions/{id}` with a new date also re-dates its entries.

## API conventions
- REST, JSON, real status codes: 201 create, 204 delete, 401 auth, 404 not-yours-or-missing, 409 conflict, 422 validation,
  502 upstream (ExerciseDB/Gemini) failures, 503 missing API key.
- Auth: `Authorization: Bearer <jwt>`; token payload has `user_id`, `username`, `exp` (7 days).
- Exercise objects are normalised by `services/exercisedb.normalize()` to
  `{exerciseId, name, imageUrl, videoUrl, bodyParts, equipments, targetMuscles, secondaryMuscles, exerciseType, instructions, overview, exerciseTips}`.
- ExerciseDB quirks (probed live): name search returns 10 items with only id/name/image and no paging; the filtered list
  returns full objects, max 25 per page, cursor pagination via `after=<meta.nextCursor>` (`offset` is ignored);
  filter values are case-insensitive and combine with AND.

## AI coach + MCP
- `services/coach.py` opens an **in-process** MCP `ClientSession` to the FastMCP server (`mcp.shared.memory`), sets
  `current_user_id`, and passes the session as a tool to `client.aio.models.generate_content` — google-genai runs the
  tool-call loop. Conversation history comes from `coach_messages` (roles `user`/`model`).
- The same server is exposed at **`POST /mcp`** (streamable HTTP, stateless, JSON responses) behind the bearer JWT
  (`main.MCPEndpoint`). DNS-rebinding protection is disabled on purpose because auth already gates it.
  Connect an external client with header `Authorization: Bearer <token>`.
- Tools: `get_today`, `get_recent_sessions`, `get_session`, `get_active_session`, `get_exercise_history`,
  `get_exercise_progress`, `get_personal_records`, `get_weekly_summary`, `get_muscle_group_breakdown`, `search_exercises`.
  Add new tools in `mcp_server.py`; reuse `services/*` rather than writing SQL there.
- `POST /coach/conversations/{id}/messages` accepts `today` (client local date); it is bound to the `current_today`
  ContextVar so `get_today` and the summary tools resolve "this week" in the user's timezone, not UTC.
- Model comes from `GEMINI_MODEL` (default `gemini-3.1-flash-lite-preview`). Check `client.models.list()` if it 404s.

## Frontend conventions
- Fetch with the `api/*` modules only; never hand-roll axios calls in components. Show errors with
  `useToast().error(errorMessage(e))`.
- Protected pages live under `<ProtectedRoute>` + `<AppLayout>` in `App.jsx`. `SessionContext.refresh()` after any
  mutation that could change the active session.
- Modals in `EditModals.jsx` initialise state from props once: remount them with a `key` when the target changes.
- Styling: use tokens and primitives from `styles/global.css`; one `.css` file next to each page/component;
  breakpoint 768px (sidebar → bottom nav) and 900–1100px for multi-column grids.
- The ESLint config disables `react-hooks/set-state-in-effect` (data-fetch effects) and allows `useX` hook exports
  from context modules.

## Testing notes
- Backend tests hit the real hosted Postgres in an isolated schema (`DB_SCHEMA=fitcoach_test`, set in `tests/conftest.py`),
  so they need `backend/.env`. ExerciseDB is mocked with `respx`; Gemini is replaced by a fake that still drives the real
  in-process MCP session.
- Frontend tests mock `api/*` modules with `vi.mock` and render through `src/test/utils.jsx` (`renderWithProviders`).

## Gotchas
- `backend/.env` holds real secrets and is git-ignored. Update `backend/.env.example` when adding a variable.
- `schema.sql` must stay idempotent; it runs on every boot. Add columns with `ADD COLUMN IF NOT EXISTS`, and guard
  constraint changes with a `DO $$ … END $$` block that checks `pg_constraint` first (see the workouts FK cascade fix).
- Deleting a user cascades to sessions, workouts and coach conversations; `tests/test_sessions.py` guards that.
- The DB server's timezone is US/Pacific; timestamps come back with `-07:00`/`-08:00` offsets.
- Pydantic model fields named `date` need the `Date` alias import (see `models.py`).
