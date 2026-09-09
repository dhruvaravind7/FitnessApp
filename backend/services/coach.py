"""AI coach: Gemini + the in-process FitCoach MCP server.

Instead of pasting the whole training history into the prompt, the model is handed the MCP tools and
pulls exactly the data it needs (google-genai runs the tool-call loop automatically).
"""
import asyncio
import logging

from fastapi import HTTPException
from google import genai
from google.genai import types
from mcp.shared.memory import create_connected_server_and_client_session

from config import get_settings
from db import get_conn
from mcp_server import current_user_id, mcp

log = logging.getLogger("fitcoach.coach")

SYSTEM_PROMPT = """You are FitCoach, a knowledgeable, encouraging personal fitness coach inside a workout-tracking app.
You have tools that read the user's real training data (sessions, exercise history, records, weekly summary,
muscle breakdown) and search an exercise database. Rules:
- Before giving advice about the user's training, call the relevant tools and base your answer on the actual data.
  Call get_today first when the question involves relative dates ("this week", "lately").
- Be specific: reference the exercises, weights, reps and dates you found. Weights are in lbs.
- If the user has little or no history, say so and give sensible general guidance.
- Keep answers concise and skimmable: short paragraphs or bullet points, Markdown allowed. No giant essays.
- Suggest concrete next steps (e.g. progressive overload targets, muscle groups to add) and safety cues.
- You are not a doctor: for pain or injury questions, give conservative advice and recommend a professional.
- Only ever discuss the current user's data; never invent workouts that are not in the tools' output."""

_client: genai.Client | None = None


def _gemini() -> genai.Client:
    global _client
    if _client is None:
        key = get_settings().gemini_api_key
        if not key:
            raise HTTPException(status_code=503, detail="AI coach is not configured (GEMINI_API_KEY missing)")
        _client = genai.Client(api_key=key)
    return _client


def _history_to_contents(messages: list[dict]) -> list[types.Content]:
    return [types.Content(role=m["role"], parts=[types.Part(text=m["content"])]) for m in messages]


async def generate_reply(user_id: int, history: list[dict]) -> str:
    """`history` is the full ordered message list (role/content) ending with the new user message."""
    token = current_user_id.set(user_id)
    try:
        async with create_connected_server_and_client_session(mcp) as session:
            config = types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                tools=[session],
                temperature=0.4,
                automatic_function_calling=types.AutomaticFunctionCallingConfig(maximum_remote_calls=12),
            )
            try:
                response = await asyncio.wait_for(
                    _gemini().aio.models.generate_content(
                        model=get_settings().gemini_model, contents=_history_to_contents(history), config=config),
                    timeout=90,
                )
            except asyncio.TimeoutError:
                raise HTTPException(status_code=504, detail="The coach took too long to respond. Please try again.")
            except Exception as exc:  # network / quota / model errors
                log.exception("Gemini call failed")
                raise HTTPException(status_code=502, detail=f"AI coach error: {exc.__class__.__name__}: {str(exc)[:200]}")
    finally:
        current_user_id.reset(token)
    text = (response.text or "").strip()
    return text or "I couldn't come up with a response. Could you rephrase your question?"


# ---- persistence ----
CONV_COLS = ("c.id, c.title, c.created_at, c.updated_at, "
             "(SELECT COUNT(*) FROM coach_messages m WHERE m.conversation_id = c.id) AS message_count")


def list_conversations(user_id: int) -> list[dict]:
    with get_conn() as conn:
        return conn.execute(f"SELECT {CONV_COLS} FROM coach_conversations c WHERE c.user_id = %s "
                            "ORDER BY c.updated_at DESC", (user_id,)).fetchall()


def get_conversation(user_id: int, conversation_id: int) -> dict:
    with get_conn() as conn:
        row = conn.execute(f"SELECT {CONV_COLS} FROM coach_conversations c WHERE c.id = %s AND c.user_id = %s",
                           (conversation_id, user_id)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        msgs = conn.execute("SELECT id, conversation_id, role, content, created_at FROM coach_messages "
                            "WHERE conversation_id = %s ORDER BY created_at, id", (conversation_id,)).fetchall()
    return {**row, "messages": msgs}


def create_conversation(user_id: int, title: str | None = None) -> dict:
    with get_conn() as conn:
        row = conn.execute("INSERT INTO coach_conversations (user_id, title) VALUES (%s, %s) RETURNING id",
                           (user_id, (title or "").strip() or "New conversation")).fetchone()
    return get_conversation(user_id, row["id"])


def delete_conversation(user_id: int, conversation_id: int) -> None:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM coach_conversations WHERE id = %s AND user_id = %s", (conversation_id, user_id))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Conversation not found")


def _add_message(conn, conversation_id: int, role: str, content: str) -> dict:
    return conn.execute("INSERT INTO coach_messages (conversation_id, role, content) VALUES (%s, %s, %s) "
                        "RETURNING id, conversation_id, role, content, created_at",
                        (conversation_id, role, content)).fetchone()


async def send_message(user_id: int, conversation_id: int, content: str) -> dict:
    conv = get_conversation(user_id, conversation_id)
    history = [{"role": m["role"], "content": m["content"]} for m in conv["messages"]]
    history.append({"role": "user", "content": content})
    reply = await generate_reply(user_id, history)
    with get_conn() as conn:
        with conn.transaction():
            user_msg = _add_message(conn, conversation_id, "user", content)
            model_msg = _add_message(conn, conversation_id, "model", reply)
            title_sql = ""
            if not conv["messages"] and conv["title"] == "New conversation":
                title_sql = ", title = %s"
            params = [content.strip()[:60] + ("…" if len(content.strip()) > 60 else "")] if title_sql else []
            conn.execute(f"UPDATE coach_conversations SET updated_at = NOW(){title_sql} WHERE id = %s",
                         params + [conversation_id])
        row = conn.execute(f"SELECT {CONV_COLS} FROM coach_conversations c WHERE c.id = %s", (conversation_id,)).fetchone()
    return {"user_message": user_msg, "model_message": model_msg, "conversation": row}
