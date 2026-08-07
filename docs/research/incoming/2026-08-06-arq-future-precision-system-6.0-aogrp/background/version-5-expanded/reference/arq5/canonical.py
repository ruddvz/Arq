from __future__ import annotations
import hashlib, json, struct, unicodedata
from typing import Any

class CanonicalError(ValueError):
    pass

def normalize_quantity(coefficient: int, scale: int, unit: str) -> dict[str, Any]:
    if isinstance(coefficient, bool) or not isinstance(coefficient, int):
        raise CanonicalError("coefficient must be an integer")
    if isinstance(scale, bool) or not isinstance(scale, int) or not -18 <= scale <= 18:
        raise CanonicalError("scale outside demo range")
    if not isinstance(unit, str) or not unit:
        raise CanonicalError("unit required")
    unit = unicodedata.normalize("NFC", unit)
    if coefficient == 0:
        return {"coefficient": 0, "scale": 0, "unit": unit}
    while coefficient % 10 == 0 and scale < 18:
        coefficient //= 10
        scale += 1
    return {"coefficient": coefficient, "scale": scale, "unit": unit}

def _normalise(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int)):
        return value
    if isinstance(value, float):
        raise CanonicalError("floating-point values are forbidden in demo canonical payloads")
    if isinstance(value, str):
        return unicodedata.normalize("NFC", value)
    if isinstance(value, bytes):
        return {"$bytes_hex": value.hex()}
    if isinstance(value, list):
        return [_normalise(x) for x in value]
    if isinstance(value, tuple):
        return [_normalise(x) for x in value]
    if isinstance(value, dict):
        out = {}
        for key, item in value.items():
            if not isinstance(key, str):
                raise CanonicalError("canonical map keys must be strings in this demo")
            nk = unicodedata.normalize("NFC", key)
            if nk in out:
                raise CanonicalError("duplicate key after normalisation")
            out[nk] = _normalise(item)
        return out
    raise CanonicalError(f"unsupported canonical type: {type(value).__name__}")

def canonical_bytes(value: Any) -> bytes:
    """Deterministic JSON demo projection.

    Production candidate encoding is deterministic CBOR, but this package avoids an
    unpinned external dependency. Golden vectors prove ordering, normalisation, and
    float rejection only.
    """
    normal = _normalise(value)
    return json.dumps(normal, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")

def digest(domain: str, value: Any) -> str:
    db = domain.encode("utf-8")
    payload = value if isinstance(value, bytes) else canonical_bytes(value)
    preimage = b"ARQ5-DEMO\x00" + struct.pack(">I", len(db)) + db + struct.pack(">Q", len(payload)) + payload
    return hashlib.sha256(preimage).hexdigest()

def state_root(components: list[dict[str, Any]], relations: list[dict[str, Any]]) -> str:
    c = []
    for item in components:
        c.append({
            "object_id": item["object_id"],
            "schema_id": item["schema_id"],
            "schema_version": item["schema_version"],
            "payload_digest": digest("component-payload-v1", item["payload"]),
        })
    r = []
    for item in relations:
        r.append({
            "relation_id": item["relation_id"],
            "type_id": item["type_id"],
            "source_id": item["source_id"],
            "target_id": item["target_id"],
            "role": item["role"],
            "ordinal": item.get("ordinal", 0),
            "payload_digest": digest("relation-payload-v1", item.get("payload", {})),
        })
    c.sort(key=lambda x: (x["object_id"], x["schema_id"]))
    r.sort(key=lambda x: x["relation_id"])
    return digest("semantic-state-root-v1", {"components": c, "relations": r})
