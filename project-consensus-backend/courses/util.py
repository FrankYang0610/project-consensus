from __future__ import annotations

import json
from typing import Iterable


def iter_json_array_objects(fp) -> Iterable[dict]:
    """Stream JSON objects from a large top-level JSON array.

    This scans byte-by-byte, tracking brace depth while respecting string
    literals and escape characters. Each balanced object is parsed with
    json.loads and yielded. Malformed objects are skipped.
    """
    in_string = False
    escape = False
    depth = 0
    started = False
    buf: list[str] = []

    while True:
        chunk = fp.read(65536)
        if not chunk:
            break
        for ch in chunk:
            # Inside a JSON string
            if in_string:
                buf.append(ch)
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_string = False
                continue

            # Entering a JSON string
            if ch == '"':
                in_string = True
                if started:
                    buf.append(ch)
                continue

            if not started:
                # Skip until first object begins
                if ch == '{':
                    started = True
                    depth = 1
                    buf = ['{']
                # else ignore whitespace, commas, brackets
                continue

            # Inside an object
            buf.append(ch)
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    obj_text = "".join(buf)
                    try:
                        yield json.loads(obj_text)
                    except Exception:
                        # Skip malformed object
                        pass
                    buf = []
                    started = False


