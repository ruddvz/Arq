from __future__ import annotations
import json, hashlib

class CanonicalError(ValueError): pass

def _check(value, path="$"):
    if isinstance(value, float): raise CanonicalError(f"float forbidden at {path}")
    if value is None or isinstance(value,(bool,int,str)): return
    if isinstance(value,list):
        for i,v in enumerate(value): _check(v,f"{path}[{i}]")
        return
    if isinstance(value,dict):
        for k,v in value.items():
            if not isinstance(k,str): raise CanonicalError(f"non-string key at {path}")
            _check(v,f"{path}.{k}")
        return
    raise CanonicalError(f"unsupported type {type(value).__name__} at {path}")

def encode(value)->bytes:
    _check(value)
    return json.dumps(value,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode("utf-8")

def digest(domain:str, payload:bytes)->bytes:
    d=domain.encode("utf-8")
    return hashlib.sha256(len(d).to_bytes(4,"little")+d+len(payload).to_bytes(8,"little")+payload).digest()

def hex_digest(domain:str, value)->str:
    return digest(domain, encode(value)).hex()
