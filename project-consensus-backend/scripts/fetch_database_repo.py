from __future__ import annotations

import os
import shutil
import sys
import tarfile
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

_MAX_MEMBER_BYTES = int(os.getenv("DATABASE_TARBALL_MAX_MEMBER_BYTES", str(500 * 1024 * 1024)))
_MAX_TOTAL_BYTES = int(os.getenv("DATABASE_TARBALL_MAX_TOTAL_BYTES", str(1024 * 1024 * 1024)))
_MAX_FILES = int(os.getenv("DATABASE_TARBALL_MAX_FILES", "20000"))


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


def _assert_safe_dest_dir(*, backend_root: Path, dest_dir: Path) -> None:
    backend_root_resolved = backend_root.resolve()
    dest_dir_resolved = dest_dir.resolve()
    if dest_dir_resolved.name != "database":
        raise RuntimeError(f"Refusing to delete unexpected directory: {dest_dir_resolved}")
    if dest_dir_resolved.parent != backend_root_resolved:
        raise RuntimeError(f"Refusing to delete directory outside backend root: {dest_dir_resolved}")


def _extract_tar_gz_strip_first_component(tar_path: Path, *, dest_dir: Path) -> None:
    with tarfile.open(tar_path, mode="r:gz") as tf:
        total_bytes = 0
        files_count = 0
        for member in tf.getmembers():
            if not member.name or member.name.startswith("/"):
                continue
            parts = Path(member.name).parts
            if len(parts) <= 1:
                continue

            rel = Path(*parts[1:])
            if ".." in rel.parts:
                continue

            out_path = _safe_write_path(dest_dir, rel)

            if member.isdir():
                out_path.mkdir(parents=True, exist_ok=True)
                continue

            if member.issym() or member.islnk():
                continue

            if not member.isreg():
                continue

            if member.size < 0 or member.size > _MAX_MEMBER_BYTES:
                raise RuntimeError(f"Archive member too large: {member.name} ({member.size} bytes)")

            files_count += 1
            if files_count > _MAX_FILES:
                raise RuntimeError(f"Archive contains too many files (> {_MAX_FILES})")

            total_bytes += member.size
            if total_bytes > _MAX_TOTAL_BYTES:
                raise RuntimeError(f"Archive expands beyond size limit (> {_MAX_TOTAL_BYTES} bytes)")

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
    _assert_safe_dest_dir(backend_root=backend_root, dest_dir=dest_dir)

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
