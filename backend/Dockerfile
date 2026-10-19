# FitCoach API. This image is used both locally and in production (Railway).
# The only difference is the start command: docker-compose.yml overrides CMD to add
# --reload for local development. Production uses the CMD below as-is.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Must be /app: config.py reads env_file=".env" relative to the process CWD, and the
# backend imports flat (`import db`, `from config import ...`) rather than as a package.
WORKDIR /app

# Dependencies in their own layer so editing source doesn't reinstall them.
# psycopg[binary] ships prebuilt wheels, so no libpq-dev / build-essential is needed.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Fallback copy; compose mounts ./backend over this in normal use.
COPY . .

EXPOSE 8000

# --host 0.0.0.0: uvicorn's default 127.0.0.1 is unreachable from outside the container.
# Shell form (not exec form) so ${PORT} expands: Railway and most PaaS hosts inject the port
# they want the app to listen on. Falls back to 8000 when PORT is unset, as it is locally.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
