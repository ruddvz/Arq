from __future__ import annotations
from typing import Any

def three_way_components(base:dict[Any,Any],left:dict[Any,Any],right:dict[Any,Any]):
    merged={}; conflicts=[]
    keys=set(base)|set(left)|set(right)
    missing=object()
    for key in sorted(keys,key=str):
        b=base.get(key,missing); l=left.get(key,missing); r=right.get(key,missing)
        lc=l!=b; rc=r!=b
        if lc and rc and l!=r:
            conflicts.append({'kind':'modify-modify' if l is not missing and r is not missing else 'delete-modify','key':str(key),'base':None if b is missing else b,'left':None if l is missing else l,'right':None if r is missing else r})
        else:
            value=l if lc else r if rc else b
            if value is not missing: merged[key]=value
    return merged,conflicts
