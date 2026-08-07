from __future__ import annotations
import os, sqlite3, struct
from pathlib import Path
from typing import Any
from .container import DEMO_APPLICATION_ID, ArqFileError, sha256_file

SQLITE_HEADER = b"SQLite format 3\x00"
MAX_DEMO_BYTES = 64 * 1024 * 1024


def bounded_header_preflight(path: Path, max_bytes: int = MAX_DEMO_BYTES) -> dict[str, Any]:
    if not path.exists() or not path.is_file():
        raise ArqFileError("ARQ5-FILE-0001", "file is missing")
    size = path.stat().st_size
    if size < 100:
        raise ArqFileError("ARQ5-FILE-0002", "file is truncated")
    if size > max_bytes:
        raise ArqFileError("ARQ5-LIMIT-0001", "file exceeds demonstrator byte limit")
    with path.open("rb") as f:
        header = f.read(100)
    if header[:16] != SQLITE_HEADER:
        raise ArqFileError("ARQ5-FILE-0004", "SQLite header mismatch")
    page_size = struct.unpack(">H", header[16:18])[0]
    if page_size == 1:
        page_size = 65536
    if page_size < 512 or page_size > 65536 or page_size & (page_size - 1):
        raise ArqFileError("ARQ5-SQLITE-0004", "invalid SQLite page size")
    file_format_write = header[18]
    file_format_read = header[19]
    app_id = struct.unpack(">I", header[68:72])[0]
    user_version = struct.unpack(">I", header[60:64])[0]
    return {
        "bytes": size,
        "page_size": page_size,
        "write_version": file_format_write,
        "read_version": file_format_read,
        "application_id": app_id,
        "user_version": user_version,
        "demo_application_id_match": app_id == DEMO_APPLICATION_ID,
        "sha256": sha256_file(path),
        "wal_sidecar_present": Path(str(path) + "-wal").exists(),
        "shm_sidecar_present": Path(str(path) + "-shm").exists(),
    }


def portable_sidecar_check(path: Path) -> None:
    info = bounded_header_preflight(path)
    if info["wal_sidecar_present"] or info["shm_sidecar_present"]:
        raise ArqFileError("ARQ5-PUB-0003", "portable publication has live SQLite sidecars")
