from __future__ import annotations

import asyncio
import json
import os
from typing import AsyncIterator, Optional
import contextlib

from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse, PlainTextResponse

# Async Redis client (redis>=4 provides asyncio under redis.asyncio)
import redis.asyncio as aioredis  # type: ignore
import httpx


APP_TITLE = "Notifications SSE Server"
APP_DESCRIPTION = "Async SSE server for notifications using Redis pub/sub"

# Environment configuration
# Redis URL for pub/sub messaging - prefer dedicated notifications Redis, fallback to shared Redis broker
REDIS_URL = os.getenv("NOTIFICATIONS_REDIS_URL") or "redis://:redis_secure_password@127.0.0.1:6379/0"
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://127.0.0.1:8000")
KEEPALIVE_SECONDS = int(os.getenv("SSE_KEEPALIVE_SECONDS", "15"))
CONNECT_TIMEOUT_SECONDS = float(os.getenv("SSE_CONNECT_TIMEOUT_SECONDS", "5.0"))


app = FastAPI(title=APP_TITLE, description=APP_DESCRIPTION)


async def _fetch_current_user_id(request: Request) -> Optional[str]:
    """Validate session by calling Django API /api/accounts/me/ using incoming cookies.

    Returns user id as string on success, or None if unauthenticated.
    """
    # Forward cookies as-is; rely on Django session authentication
    cookie_header = request.headers.get("cookie", "")
    headers = {
        "accept": "application/json",
        "cookie": cookie_header,
    }
    url = f"{BACKEND_BASE_URL}/api/accounts/me/"
    try:
        async with httpx.AsyncClient(timeout=CONNECT_TIMEOUT_SECONDS, follow_redirects=False) as client:
            resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            return None
        data = resp.json()
        uid = data.get("id")
        if uid is None:
            return None
        return str(uid)
    except Exception:
        return None


async def _fetch_initial_unread_count(request: Request) -> Optional[int]:
    cookie_header = request.headers.get("cookie", "")
    headers = {
        "accept": "application/json",
        "cookie": cookie_header,
    }
    url = f"{BACKEND_BASE_URL}/api/notifications/unread_count/"
    try:
        async with httpx.AsyncClient(timeout=CONNECT_TIMEOUT_SECONDS, follow_redirects=False) as client:
            resp = await client.get(url, headers=headers)
        if resp.status_code != 200:
            return None
        data = resp.json()
        cnt = data.get("count")
        return int(cnt) if isinstance(cnt, int) else None
    except Exception:
        return None


async def _sse_event_generator(request: Request, user_id: str) -> AsyncIterator[bytes]:
    """Yield SSE events from Redis pub/sub with periodic keepalive comments."""
    redis_client: aioredis.Redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    pubsub = redis_client.pubsub()
    channel = f"notifications:{user_id}"
    await pubsub.subscribe(channel)

    last_ping = asyncio.get_event_loop().time()

    try:
        # Initial unread count event (best-effort)
        initial_unread = await _fetch_initial_unread_count(request)
        if isinstance(initial_unread, int):
            payload = json.dumps({"type": "notification", "unreadCount": initial_unread}, ensure_ascii=False)
            yield f"data: {payload}\n\n".encode("utf-8")

        # Listen loop with keepalive
        while True:
            # Check client disconnect frequently to stop work early
            if await request.is_disconnected():
                break

            try:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)  # type: ignore[arg-type]
            except Exception:
                message = None

            if message and message.get("type") == "message":
                data = message.get("data")
                if isinstance(data, (str, bytes)):
                    if isinstance(data, bytes):
                        try:
                            data = data.decode("utf-8", errors="ignore")
                        except Exception:
                            data = None
                    if data:
                        yield f"data: {data}\n\n".encode("utf-8")
                        last_ping = asyncio.get_event_loop().time()
                        continue

            # Keepalive comment every KEEPALIVE_SECONDS
            now = asyncio.get_event_loop().time()
            if now - last_ping >= KEEPALIVE_SECONDS:
                yield b": keep-alive\n\n"
                last_ping = now
    finally:
        try:
            with contextlib.suppress(Exception):
                await pubsub.unsubscribe(channel)
            with contextlib.suppress(Exception):
                await pubsub.close()
            with contextlib.suppress(Exception):
                await redis_client.close()
        except Exception:
            pass


@app.get("/health", response_class=PlainTextResponse)
async def health() -> str:
    return "ok"


@app.get("/api/notifications/stream/")
async def notifications_stream(request: Request) -> Response:
    # Authenticate via Django session
    user_id = await _fetch_current_user_id(request)
    if not user_id:
        return Response(status_code=401, content="Unauthorized")

    async def event_iterator() -> AsyncIterator[bytes]:
        async for chunk in _sse_event_generator(request, user_id):
            yield chunk

    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
    }

    # Optional CORS support for credentialed EventSource across subdomains
    origin = request.headers.get("origin")
    if origin:
        headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Allow-Origin"] = origin

    return StreamingResponse(event_iterator(), media_type="text/event-stream", headers=headers)


