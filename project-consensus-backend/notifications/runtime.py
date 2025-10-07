from __future__ import annotations

import json
import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Iterator

# Simple in-process pub/sub keyed by user_id (string)
# Not persistent; suitable for single-process development/demo.

_lock = threading.Lock()
_subscribers: Dict[str, set["_Subscriber"]] = defaultdict(set)


class _Subscriber:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self._queue: Deque[dict] = deque()
        self._cv = threading.Condition()
        self._closed = False

    def put(self, msg: dict) -> None:
        with self._cv:
            if self._closed:
                return
            self._queue.append(msg)
            self._cv.notify()

    def close(self) -> None:
        with self._cv:
            self._closed = True
            self._cv.notify_all()

    def __iter__(self) -> Iterator[str]:  # pragma: no cover (helper)
        return self.listen()

    def listen(self, keepalive_seconds: int = 25) -> Iterator[str]:
        """Yield SSE-formatted strings for events and periodic keepalive comments."""
        last = time.time()
        try:
            while True:
                with self._cv:
                    # Wait for new message or keepalive timeout
                    now = time.time()
                    timeout = max(0.1, keepalive_seconds - (now - last))
                    if not self._queue and not self._closed:
                        self._cv.wait(timeout=timeout)
                    if self._closed:
                        break
                    if self._queue:
                        msg = self._queue.popleft()
                        payload = json.dumps(msg, ensure_ascii=False)
                        yield f"data: {payload}\n\n"
                        last = time.time()
                        continue
                # Timeout: send keepalive comment
                now = time.time()
                if now - last >= keepalive_seconds:
                    yield ": keep-alive\n\n"
                    last = now
        finally:
            # Ensure cleanup
            unsubscribe(self)


def subscribe(user_id: str) -> _Subscriber:
    sub = _Subscriber(user_id)
    with _lock:
        _subscribers[user_id].add(sub)
    return sub


def unsubscribe(sub: _Subscriber) -> None:
    with _lock:
        subs = _subscribers.get(sub.user_id)
        if subs and sub in subs:
            subs.remove(sub)
        if subs is not None and len(subs) == 0:
            _subscribers.pop(sub.user_id, None)


def publish(user_id: str, msg: dict) -> None:
    # Snapshot subscribers to avoid holding the lock during put
    with _lock:
        targets = list(_subscribers.get(user_id, ()))
    for sub in targets:
        try:
            sub.put(msg)
        except Exception:
            # Ignore individual subscriber errors
            try:
                unsubscribe(sub)
            except Exception:
                pass
