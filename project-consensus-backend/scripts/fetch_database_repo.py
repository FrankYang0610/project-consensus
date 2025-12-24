from __future__ import annotations

import os
import shutil
import sys
import tarfile
import tempfile
import urllib.error
import urllib.request
from pathlib import Path


def _require_env(name: str) -> str:
    value = os.getenv(name)
    if value:
        return value
    raise RuntimeError(f"Missing required env var: {name}")


def _download(url: str, *, headers: dict[str, str], out_path: Path) -> None:
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp, out_path.open("wb") as fp:
            shutil.copyfileobj(resp, fp)
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        raise RuntimeError(f"Download failed: {e.code} {e.reason} {body}") from e


def _safe_write_path(base_dir: Path, rel_path: Path) -> Path:
    base = base_dir.resolve()
    target = (base_dir / rel_path).resolve()
    if target == base or base in target.parents:
        return target
    raise RuntimeError(f"Unsafe path in archive: {rel_path}")


def _extract_tar_gz_strip_first_component(tar_path: Path, *, dest_dir: Path) -> None:
    with tarfile.open(tar_path, mode="r:gz") as tf:
        for member in tf.getmembers():
            if not member.name or member.name.startswith("/"):
                continue
            parts = Path(member.name).parts
            if len(parts) <= 1:
                continue

            rel = Path(*parts[1:])
            if rel.parts and rel.parts[0] == "..":
                continue

            out_path = _safe_write_path(dest_dir, rel)

            if member.isdir():
                out_path.mkdir(parents=True, exist_ok=True)
                continue

            if member.issym() or member.islnk():
                continue

            out_path.parent.mkdir(parents=True, exist_ok=True)
            extracted = tf.extractfile(member)
            if extracted is None:
                continue
            with extracted, out_path.open("wb") as fp:
                shutil.copyfileobj(extracted, fp)


def main() -> int:
    repo = os.getenv("DATABASE_REPO", "FivespeedDoc/project-consensus-database").strip()
    ref = os.getenv("DATABASE_REF", "main").strip()

    token = os.getenv("DATABASE_GITHUB_TOKEN") or os.getenv("GITHUB_TOKEN")
    if not token:
        sys.stderr.write(
            "Missing DATABASE_GITHUB_TOKEN (or GITHUB_TOKEN). "
            "For private repos, set a GitHub token with read access.\n"
        )
        return 2

    url = f"https://api.github.com/repos/{repo}/tarball/{ref}"

    backend_root = Path(__file__).resolve().parents[1]
    dest_dir = backend_root / "database"

    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "project-consensus-backend",
        "Authorization": f"token {token}",
    }

    with tempfile.TemporaryDirectory() as td:
        tar_path = Path(td) / "database.tar.gz"
        _download(url, headers=headers, out_path=tar_path)

        if dest_dir.exists():
            if dest_dir.is_dir():
                shutil.rmtree(dest_dir)
            else:
                dest_dir.unlink()
        dest_dir.mkdir(parents=True, exist_ok=True)

        _extract_tar_gz_strip_first_component(tar_path, dest_dir=dest_dir)

    sys.stdout.write(f"Fetched {repo}@{ref} -> {dest_dir}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
