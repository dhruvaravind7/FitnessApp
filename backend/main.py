"""FitCoach API. Run with: uvicorn main:app --reload --port 8000"""
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.datastructures import Headers
from starlette.routing import Route

import db
from config import get_settings
from deps import decode_token
from fastapi import HTTPException
from mcp_server import current_user_id, mcp
from routers import auth, coach, exercises, sessions, stats

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

# Building the streamable-HTTP app creates the session manager we drive from our own /mcp route below.
mcp.streamable_http_app()


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_pool()
    db.apply_schema()
    async with mcp.session_manager.run():
        yield
    db.close_pool()


app = FastAPI(title="FitCoach API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["mcp-session-id"],
)

for r in (auth.router, exercises.router, sessions.router, stats.router, coach.router):
    app.include_router(r)


@app.get("/", tags=["meta"])
def root():
    return {"status": "ok", "service": "FitCoach API", "docs": "/docs", "mcp": "/mcp"}


@app.get("/health", tags=["meta"])
def health():
    with db.get_conn() as conn:
        conn.execute("SELECT 1")
    return {"status": "ok"}


class MCPEndpoint:
    """ASGI endpoint for /mcp: requires `Authorization: Bearer <jwt>` and binds the user for the tools."""

    async def __call__(self, scope, receive, send):
        auth_header = Headers(scope=scope).get("authorization", "")
        if not auth_header.lower().startswith("bearer "):
            return await self._reject(send, 401, "Missing bearer token")
        try:
            user = decode_token(auth_header.split(" ", 1)[1].strip())
        except HTTPException as exc:
            return await self._reject(send, exc.status_code, exc.detail)
        token = current_user_id.set(user["id"])
        try:
            await mcp.session_manager.handle_request(scope, receive, send)
        finally:
            current_user_id.reset(token)

    @staticmethod
    async def _reject(send, status: int, detail: str):
        body = json.dumps({"detail": detail}).encode()
        await send({"type": "http.response.start", "status": status,
                    "headers": [(b"content-type", b"application/json"), (b"www-authenticate", b"Bearer")]})
        await send({"type": "http.response.body", "body": body})


app.router.routes.append(Route("/mcp", endpoint=MCPEndpoint(), methods=["GET", "POST", "DELETE"]))


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    logging.getLogger("fitcoach").exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=get_settings().port, reload=True)
