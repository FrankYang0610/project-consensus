from __future__ import annotations

import json
import os
import time
import warnings
from typing import Iterator, Optional

import redis
from django.conf import settings


# ==================== Redis-backed Pub/Sub for Notifications ====================
# Features:
# - Per-user Redis Pub/Sub channel for real-time events
# - Monotonic event IDs per user (Redis INCR)
# - Short backlog in Redis Sorted Set (ZSET) to support efficient Last-Event-ID replay on reconnect
# - SSE-formatted output with id: and data: lines

_REDIS_CLIENT: Optional[redis.Redis] = None


def _get_redis() -> redis.Redis:
    global _REDIS_CLIENT
    if _REDIS_CLIENT is not None:
        return _REDIS_CLIENT
    url = getattr(settings, "NOTIFICATIONS_REDIS_URL", None)
    if url is None:
        url = "redis://localhost:6379/1"
        warnings.warn(
            "Notifications Redis client is using default URL without authentication. "
            "This is insecure for production; configure NOTIFICATIONS_REDIS_URL.",
            RuntimeWarning,
        )
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


class _RedisSubscriber:
    def __init__(self, user_id: str, last_event_id: Optional[int] = None):
        self.user_id = user_id
        self.last_event_id = last_event_id
        self._r = _get_redis()
        self._pubsub = self._r.pubsub(ignore_subscribe_messages=True)
        self._pubsub.subscribe(_chan(user_id))
        self._closed = False

    def close(self) -> None:
        self._closed = True
        try:
            self._pubsub.close()
        except Exception:
            pass

    def _replay(self) -> Iterator[str]:
        if self.last_event_id is None:
            return
        try:
            # Use ZSET ZRANGEBYSCORE to efficiently fetch only events > last_event_id
            # Score is event_id, fetch in ascending order (oldest first)
            raw_items = self._r.zrangebyscore(
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
                    # ignore malformed entries
                    continue
        except Exception:
            # best-effort replay; ignore errors
            return

    def listen(self, keepalive_seconds: int = 25) -> Iterator[str]:
        # First deliver replay if any
        yield from self._replay()
        last = time.time()
        try:
            while not self._closed:
                # Use non-blocking polling to allow keepalives
                msg = self._pubsub.get_message(timeout=1.0)
                if msg and msg.get("type") == "message":
                    try:
                        data = json.loads(msg.get("data") or "{}")
                        event_id = int(data.get("id", 0))
                        payload = _extract_payload(data)
                        yield _sse_format(event_id, payload)
                        last = time.time()
                    except Exception:
                        # ignore malformed messages
                        pass
                    continue

                # keepalive if idle
                now = time.time()
                if now - last >= keepalive_seconds:
                    yield ": keep-alive\n\n"
                    last = now
        finally:
            self.close()


def subscribe(user_id: str, last_event_id: Optional[int] = None) -> _RedisSubscriber:
    return _RedisSubscriber(user_id=user_id, last_event_id=last_event_id)


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
