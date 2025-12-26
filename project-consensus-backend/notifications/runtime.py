from __future__ import annotations

import asyncio
import json
import logging
import time
import warnings
from typing import AsyncIterator, Optional

import redis
import redis.asyncio as redis_async
from django.conf import settings

logger = logging.getLogger(__name__)


# ==================== Redis-backed Pub/Sub for Notifications ====================
# Features:
# - Per-user Redis Pub/Sub channel for real-time events
# - Monotonic event IDs per user (Redis INCR)
# - Short backlog in Redis Sorted Set (ZSET) to support efficient Last-Event-ID replay on reconnect
# - SSE-formatted output with id: and data: lines
# - Async subscriber for ASGI/Uvicorn, sync publisher for Celery tasks

_REDIS_CLIENT: Optional[redis.Redis] = None


def _get_redis_url() -> str:
    """Get Redis URL from settings with fallback."""
    url = getattr(settings, "NOTIFICATIONS_REDIS_URL", None)
    if url is None:
        url = "redis://localhost:6379/1"
        warnings.warn(
            "Notifications Redis client is using default URL without authentication. "
            "This is insecure for production; configure NOTIFICATIONS_REDIS_URL.",
            RuntimeWarning,
        )
    return url


def _get_redis() -> redis.Redis:
    """Get sync Redis client for publish operations (used by Celery tasks)."""
    global _REDIS_CLIENT
    if _REDIS_CLIENT is not None:
        return _REDIS_CLIENT
    url = _get_redis_url()
    # decode_responses=True returns str instead of bytes
    _REDIS_CLIENT = redis.Redis.from_url(
        url,
        decode_responses=True,
        socket_timeout=float(getattr(settings, "NOTIFICATIONS_REDIS_SOCKET_TIMEOUT", 1.0)),
        socket_connect_timeout=float(getattr(settings, "NOTIFICATIONS_REDIS_SOCKET_CONNECT_TIMEOUT", 1.0)),
        health_check_interval=int(getattr(settings, "NOTIFICATIONS_REDIS_HEALTH_CHECK_INTERVAL", 30)),
        retry_on_timeout=True,
    )
    return _REDIS_CLIENT


def _chan(user_id: str) -> str:
    prefix = getattr(settings, "NOTIFICATIONS_REDIS_CHANNEL_PREFIX", "notifications:chan:")
    return f"{prefix}{user_id}"


def _seq_key(user_id: str) -> str:
    prefix = getattr(settings, "NOTIFICATIONS_REDIS_SEQ_PREFIX", "notifications:seq:")
    return f"{prefix}{user_id}"


def _backlog_key(user_id: str) -> str:
    prefix = getattr(settings, "NOTIFICATIONS_REDIS_BACKLOG_PREFIX", "notifications:backlog:")
    return f"{prefix}{user_id}"


def _backlog_size() -> int:
    return int(getattr(settings, "NOTIFICATIONS_REDIS_BACKLOG_SIZE", 200))


def _extract_payload(data: dict) -> dict:
    """Extract payload from event data. Supports both wrapped and legacy formats."""
    return data.get("payload") if "payload" in data else {k: v for k, v in data.items() if k != "id"}


def _sse_format(event_id: int, payload: dict) -> str:
    data = json.dumps(payload, ensure_ascii=False)
    return f"id: {event_id}\ndata: {data}\n\n"


class _AsyncRedisSubscriber:
    """Async Redis subscriber for use with ASGI servers (Uvicorn).
    
    This implementation is non-blocking and allows a single Uvicorn worker
    to handle thousands of concurrent SSE connections without exhausting
    thread pools or database connections.
    """
    
    def __init__(self, user_id: str, last_event_id: Optional[int] = None):
        self.user_id = user_id
        self.last_event_id = last_event_id
        self._closed = False
        self._r: Optional[redis_async.Redis] = None
        self._pubsub: Optional[redis_async.client.PubSub] = None

    async def _get_async_redis(self) -> redis_async.Redis:
        """Get or create async Redis connection."""
        if self._r is None:
            url = _get_redis_url()
            self._r = redis_async.from_url(
                url,
                decode_responses=True,
                socket_timeout=float(getattr(settings, "NOTIFICATIONS_REDIS_SOCKET_TIMEOUT", 5.0)),
                socket_connect_timeout=float(getattr(settings, "NOTIFICATIONS_REDIS_SOCKET_CONNECT_TIMEOUT", 5.0)),
            )
        return self._r

    async def close(self) -> None:
        """Close all connections."""
        self._closed = True
        try:
            if self._pubsub is not None:
                await self._pubsub.close()
        except Exception:
            pass
        try:
            if self._r is not None:
                await self._r.close()
        except Exception:
            pass

    async def _replay(self) -> AsyncIterator[str]:
        """Replay missed events from backlog."""
        if self.last_event_id is None:
            return
        try:
            r = await self._get_async_redis()
            # Use ZSET ZRANGEBYSCORE to efficiently fetch only events > last_event_id
            raw_items = await r.zrangebyscore(
                _backlog_key(self.user_id),
                min=f"({self.last_event_id}",  # exclusive lower bound
                max="+inf"
            )
            for raw in raw_items:
                try:
                    item = json.loads(raw)
                    event_id = int(item.get("id", 0))
                    payload = _extract_payload(item)
                    yield _sse_format(event_id, payload)
                except Exception:
                    continue
        except Exception:
            logger.warning("Replay failed for user %s", self.user_id, exc_info=True)
            return

    async def listen(self, keepalive_seconds: int = 25) -> AsyncIterator[str]:
        """Async generator that yields SSE-formatted events.
        
        This method:
        - First replays any missed events from backlog
        - Then subscribes to Redis pub/sub for live events
        - Sends keepalive comments to prevent connection timeouts
        - Properly cleans up on disconnect
        """
        # First deliver replay if any
        async for chunk in self._replay():
            yield chunk

        r = await self._get_async_redis()
        self._pubsub = r.pubsub(ignore_subscribe_messages=True)
        await self._pubsub.subscribe(_chan(self.user_id))

        last_activity = time.time()
        try:
            while not self._closed:
                try:
                    # Non-blocking get with timeout - releases event loop while waiting
                    msg = await asyncio.wait_for(
                        self._pubsub.get_message(ignore_subscribe_messages=True),
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    msg = None

                if msg and msg.get("type") == "message":
                    try:
                        data = json.loads(msg.get("data") or "{}")
                        event_id = int(data.get("id", 0))
                        payload = _extract_payload(data)
                        yield _sse_format(event_id, payload)
                        last_activity = time.time()
                    except Exception:
                        pass
                    continue

                # Send keepalive if idle
                now = time.time()
                if now - last_activity >= keepalive_seconds:
                    yield ": keep-alive\n\n"
                    last_activity = now

        except asyncio.CancelledError:
            raise  # Client disconnected - this is expected for sometime.
        finally:
            await self.close()


def subscribe_async(user_id: str, last_event_id: Optional[int] = None) -> _AsyncRedisSubscriber:
    """Create an async Redis subscriber for SSE endpoints.
    
    Use this with async def views under Uvicorn for efficient handling
    of many concurrent long-lived connections.
    """
    return _AsyncRedisSubscriber(user_id=user_id, last_event_id=last_event_id)


def publish(user_id: str, msg: dict) -> None:
    r = _get_redis()
    # Assign per-user event id, persist to backlog, then publish
    seq = r.incr(_seq_key(user_id))
    envelope = {"id": seq, "payload": msg}
    envelope_json = json.dumps(envelope, ensure_ascii=False)
    p = r.pipeline(transaction=False)
    # Use ZADD with event_id as score for efficient range queries
    p.zadd(_backlog_key(user_id), {envelope_json: seq})
    # Keep only the most recent N items using ZREMRANGEBYRANK
    # Keep items ranked 0 to (size-1), remove everything before that
    backlog_size = _backlog_size()
    p.zremrangebyrank(_backlog_key(user_id), 0, -(backlog_size + 1))
    p.publish(_chan(user_id), envelope_json)
    try:
        p.execute()
    finally:
        try:
            p.reset()
        except Exception:
            pass
