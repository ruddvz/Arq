from __future__ import annotations
import os, io, json, uuid, struct, hashlib, zlib, shutil, tempfile
from pathlib import Path
from .canonical import encode, digest, hex_digest, CanonicalError

MAGIC=b"\x89ARQ\r\n\x1a\n"
BOOT_MAGIC=MAGIC
SB_MAGIC=b"ARQSB006"
SEG_MAGIC=b"ARQSG006"
BOOT_SIZE=256
SB_SIZE=512
DATA_START=4096
ALIGN=64
PROFILE="arq.aogrp.demo.v1"
SUPPORTED_REQUIRED={"arq.core.semantic.v1","arq.ops.v1","arq.revision.v1"}
BOOT=struct.Struct("<8sHHI16sB7s32s184s")
SB=struct.Struct("<8sQQQ32s32sIIQ368s32s")
SEG=struct.Struct("<8sHHIQQII32s32s24s")
SEG_MANIFEST=1; SEG_OBJECTS=2; SEG_OPERATIONS=3; SEG_REVISIONS=4; SEG_ASSET=5; SEG_INDEX=6
CODEC_NONE=0; CODEC_ZLIB=1

class ArqFormatError(ValueError): pass
class Limits:
    max_file=1<<30; max_segments=100000; max_segment_stored=1<<28; max_segment_uncompressed=1<<30; max_objects=2_000_000
    # Bug 4 fix: per-segment caps alone don't bound total memory across a validation
    # pass - up to max_segments segments each near max_segment_uncompressed could
    # force far more decompressed data into memory than the on-disk file size would
    # suggest (zip-bomb amplification). This caps the running total across one pass.
    max_total_uncompressed=1<<31

def align(n,a=ALIGN): return (n+a-1)//a*a

def _profile_hash(): return digest("arq6-profile",PROFILE.encode())

def _pack_boot(file_uuid:bytes, active:int=0):
    return BOOT.pack(BOOT_MAGIC,6,0,BOOT_SIZE,file_uuid,active,b"\0"*7,_profile_hash(),b"\0"*184)

def _pack_sb(generation,manifest_offset,manifest_len,manifest_hash,semantic_root,segment_count,flags=0,created_ns=0):
    zero=SB.pack(SB_MAGIC,generation,manifest_offset,manifest_len,manifest_hash,semantic_root,segment_count,flags,created_ns,b"\0"*368,b"\0"*32)
    checksum=digest("arq6-superblock",zero[:-32])
    return zero[:-32]+checksum

def _unpack_sb(raw:bytes):
    if len(raw)!=SB_SIZE: return None
    vals=SB.unpack(raw)
    if vals[0]!=SB_MAGIC: return None
    if digest("arq6-superblock",raw[:-32])!=vals[-1]: return None
    return {"generation":vals[1],"manifest_offset":vals[2],"manifest_len":vals[3],"manifest_hash":vals[4],"semantic_root":vals[5],"segment_count":vals[6],"flags":vals[7]}

def _pack_segment(seg_type:int,payload:bytes,object_count=0,codec=CODEC_ZLIB,semantic_hash=b"\0"*32):
    if codec==CODEC_ZLIB: stored=zlib.compress(payload,9)
    elif codec==CODEC_NONE: stored=payload
    else: raise ArqFormatError("unsupported codec")
    ph=digest(f"arq6-segment-{seg_type}",payload)
    header=SEG.pack(SEG_MAGIC,seg_type,codec,0,len(stored),len(payload),object_count,0,ph,semantic_hash,b"\0"*24)
    return header+stored,ph,len(stored),len(payload)

def _read_segment(f,offset:int,limits=Limits,budget=None):
    f.seek(offset); raw=f.read(SEG.size)
    if len(raw)!=SEG.size: raise ArqFormatError("truncated segment header")
    v=SEG.unpack(raw)
    if v[0]!=SEG_MAGIC: raise ArqFormatError("bad segment magic")
    seg_type,codec,stored_len,raw_len,obj_count=v[1],v[2],v[4],v[5],v[6]
    if stored_len>limits.max_segment_stored or raw_len>limits.max_segment_uncompressed: raise ArqFormatError("segment budget exceeded")
    # Bug 4 fix: check the *cumulative* decompressed-byte budget for this validation
    # pass before decompressing this segment, not just this segment's own cap - a
    # per-segment-only check lets many near-maximal segments amplify far past any
    # single limit before the loop that calls us ever sees a total.
    if budget is not None:
        if budget["used"]+raw_len>limits.max_total_uncompressed:
            raise ArqFormatError("aggregate decompression budget exceeded")
        budget["used"]+=raw_len
    stored=f.read(stored_len)
    if len(stored)!=stored_len: raise ArqFormatError("truncated segment payload")
    if codec==CODEC_ZLIB:
        payload=zlib.decompress(stored)
    elif codec==CODEC_NONE: payload=stored
    else: raise ArqFormatError("unknown codec")
    if len(payload)!=raw_len: raise ArqFormatError("uncompressed length mismatch")
    if digest(f"arq6-segment-{seg_type}",payload)!=v[8]: raise ArqFormatError("segment hash mismatch")
    return {"type":seg_type,"codec":codec,"stored_len":stored_len,"raw_len":raw_len,"object_count":obj_count,"payload_hash":v[8].hex(),"semantic_hash":v[9].hex(),"payload":payload,"offset":offset}

def object_record(type_id:str,entity_id:str,payload:dict,schema_version=1):
    body={"type_id":type_id,"schema_version":schema_version,"entity_id":entity_id,"payload":payload}
    oid=hex_digest("arq6-object-v1",body)
    return {"id":oid,"body":body}

def operation_record(kind:str,payload:dict):
    body={"kind":kind,"payload":payload}
    return {"id":hex_digest("arq6-operation-v1",body),"body":body}

def revision_record(parents:list[str],op_ids:list[str],semantic_root:str):
    body={"parents":parents,"operation_groups":op_ids,"semantic_root":semantic_root,"capabilities":sorted(SUPPORTED_REQUIRED)}
    return {"id":hex_digest("arq6-revision-v1",body),"body":body}

def semantic_root(object_ids:list[str])->str:
    return hex_digest("arq6-semantic-root-v1",{"object_ids":sorted(set(object_ids))})

def _write_segment(f,seg_type,payload,obj_count=0,codec=CODEC_ZLIB,semantic_hash=b"\0"*32):
    off=align(f.tell()); f.write(b"\0"*(off-f.tell()))
    blob,ph,sl,rl=_pack_segment(seg_type,payload,obj_count,codec,semantic_hash)
    f.write(blob)
    return {"type":seg_type,"offset":off,"stored_length":sl,"uncompressed_length":rl,"payload_hash":ph.hex(),"object_count":obj_count,"codec":codec}

def create(path,objects,operations=None,required=None,optional=None,file_uuid=None):
    path=Path(path); operations=operations or []; required=sorted(required or SUPPORTED_REQUIRED); optional=sorted(optional or [])
    file_uuid=(file_uuid or uuid.uuid4()).bytes
    object_ids=[x["id"] for x in objects]
    sroot=semantic_root(object_ids)
    op_ids=[x["id"] for x in operations]
    rev=revision_record([],op_ids,sroot)
    with path.open("wb") as f:
        f.write(_pack_boot(file_uuid,0)); f.write(b"\0"*(SB_SIZE*2)); f.write(b"\0"*(DATA_START-f.tell()))
        segs=[]
        segs.append(_write_segment(f,SEG_OBJECTS,encode(objects),len(objects),CODEC_ZLIB,bytes.fromhex(sroot)))
        segs.append(_write_segment(f,SEG_OPERATIONS,encode(operations),len(operations)))
        segs.append(_write_segment(f,SEG_REVISIONS,encode([rev]),1,CODEC_NONE,bytes.fromhex(sroot)))
        manifest={"profile":PROFILE,"generation":1,"file_uuid":file_uuid.hex(),"required_capabilities":required,"optional_capabilities":optional,"segments":segs,"object_ids":sorted(object_ids),"head_revision":rev["id"],"semantic_root":sroot}
        moff=align(f.tell()); f.write(b"\0"*(moff-f.tell()))
        mblob,mhash,msl,mrl=_pack_segment(SEG_MANIFEST,encode(manifest),1,CODEC_NONE,bytes.fromhex(sroot)); f.write(mblob)
        f.flush(); os.fsync(f.fileno())
        f.seek(BOOT_SIZE); f.write(_pack_sb(1,moff,SEG.size+msl,mhash,bytes.fromhex(sroot),len(segs)+1)); f.flush(); os.fsync(f.fileno())
    return manifest

def _read_boot(f):
    f.seek(0); raw=f.read(BOOT_SIZE)
    if len(raw)!=BOOT_SIZE: raise ArqFormatError("truncated bootstrap")
    v=BOOT.unpack(raw)
    if v[0]!=BOOT_MAGIC: raise ArqFormatError("bad ARQ magic")
    if v[1]!=6: raise ArqFormatError("unsupported demo major")
    if v[3]!=BOOT_SIZE: raise ArqFormatError("invalid bootstrap size")
    if v[7]!=_profile_hash(): raise ArqFormatError("profile mismatch")
    return {"major":v[1],"minor":v[2],"uuid":v[4].hex(),"active":v[5]}

def open_manifest(path,known_required=None,limits=Limits):
    path=Path(path); size=path.stat().st_size
    if size>limits.max_file: raise ArqFormatError("file budget exceeded")
    with path.open("rb") as f:
        boot=_read_boot(f)
        roots=[]
        for i in range(2):
            f.seek(BOOT_SIZE+i*SB_SIZE); sb=_unpack_sb(f.read(SB_SIZE))
            if sb and sb["manifest_offset"]+sb["manifest_len"]<=size: roots.append((i,sb))
        if not roots: raise ArqFormatError("no valid recovery root")
        # Bug 1 fix: a root whose superblock struct is intact can still point at a
        # corrupt or truncated manifest segment - the struct's own checksum only
        # covers itself, not the content it references. Picking only the highest
        # generation and letting _read_segment's error propagate uncaught defeats
        # dual-root recovery's entire purpose whenever *that* root's target content
        # (not its struct) is what's damaged. Try every candidate root, newest
        # generation first, and fall back to the next one on any content-validation
        # failure; only fail once every root has been content-verified and rejected.
        last_error=None
        for slot,sb in sorted(roots,key=lambda x:x[1]["generation"],reverse=True):
            try:
                seg=_read_segment(f,sb["manifest_offset"],limits)
                if seg["type"]!=SEG_MANIFEST: raise ArqFormatError("root does not point to manifest")
                if bytes.fromhex(seg["payload_hash"])!=sb["manifest_hash"]: raise ArqFormatError("manifest hash differs from root")
                manifest=json.loads(seg["payload"].decode("utf-8"))
                if manifest.get("generation")!=sb["generation"]: raise ArqFormatError("generation mismatch")
                if manifest.get("semantic_root")!=sb["semantic_root"].hex(): raise ArqFormatError("semantic root differs from root")
                known=set(known_required or SUPPORTED_REQUIRED); missing=sorted(set(manifest.get("required_capabilities",[]))-known)
                mode="editable" if not missing else "preserving-read-only"
                return {"bootstrap":boot,"root_slot":slot,"root":sb,"manifest":manifest,"mode":mode,"missing_required":missing}
            except ArqFormatError as error:
                last_error=error
                continue
        raise ArqFormatError(f"no recovery root content-verifies: {last_error}")

def deep_validate(path,known_required=None,limits=Limits):
    result=open_manifest(path,known_required,limits); m=result["manifest"]
    objects=[]; revisions=[]; operations=[]
    budget={"used":0}
    with Path(path).open("rb") as f:
        if len(m["segments"])>limits.max_segments: raise ArqFormatError("segment count budget exceeded")
        for ent in m["segments"]:
            seg=_read_segment(f,ent["offset"],limits,budget)
            if seg["payload_hash"]!=ent["payload_hash"]: raise ArqFormatError("manifest segment hash mismatch")
            data=json.loads(seg["payload"].decode("utf-8"))
            if seg["type"]==SEG_OBJECTS: objects.extend(data)
            elif seg["type"]==SEG_OPERATIONS: operations.extend(data)
            elif seg["type"]==SEG_REVISIONS: revisions.extend(data)
    if len(objects)>limits.max_objects: raise ArqFormatError("object count budget exceeded")
    ids=[]
    seen={}
    for rec in objects:
        expected=hex_digest("arq6-object-v1",rec["body"])
        if expected!=rec["id"]: raise ArqFormatError("object ID mismatch")
        if rec["id"] in seen and seen[rec["id"]]!=rec["body"]: raise ArqFormatError("object ID collision in file")
        seen[rec["id"]]=rec["body"]; ids.append(rec["id"])
    if sorted(set(ids))!=sorted(m["object_ids"]): raise ArqFormatError("manifest object set mismatch")
    root=semantic_root(ids)
    if root!=m["semantic_root"]: raise ArqFormatError("semantic root mismatch")
    rev_by_id={r["id"]:r for r in revisions}
    if m["head_revision"] not in rev_by_id: raise ArqFormatError("head revision missing")
    if rev_by_id[m["head_revision"]]["body"]["semantic_root"]!=root: raise ArqFormatError("head revision root mismatch")
    result.update({"objects":objects,"operations":operations,"revisions":revisions,"validated":True})
    return result

def append_revision(path,new_objects,new_operations=None,fail_before_root=False):
    path=Path(path); state=deep_validate(path); m=state["manifest"]; new_operations=new_operations or []
    all_ids=sorted(set(m["object_ids"]+[x["id"] for x in new_objects])); sroot=semantic_root(all_ids)
    op_ids=[x["id"] for x in new_operations]
    rev=revision_record([m["head_revision"]],op_ids,sroot)
    with path.open("r+b") as f:
        f.seek(0,io.SEEK_END); segs=list(m["segments"])
        if new_objects: segs.append(_write_segment(f,SEG_OBJECTS,encode(new_objects),len(new_objects),CODEC_ZLIB,bytes.fromhex(sroot)))
        if new_operations: segs.append(_write_segment(f,SEG_OPERATIONS,encode(new_operations),len(new_operations)))
        segs.append(_write_segment(f,SEG_REVISIONS,encode([rev]),1,CODEC_NONE,bytes.fromhex(sroot)))
        generation=m["generation"]+1
        manifest={**m,"generation":generation,"segments":segs,"object_ids":all_ids,"head_revision":rev["id"],"semantic_root":sroot}
        moff=align(f.tell()); f.write(b"\0"*(moff-f.tell()))
        mblob,mhash,msl,mrl=_pack_segment(SEG_MANIFEST,encode(manifest),1,CODEC_NONE,bytes.fromhex(sroot)); f.write(mblob); f.flush(); os.fsync(f.fileno())
        if fail_before_root: raise RuntimeError("injected before recovery root")
        slot=(generation-1)%2
        f.seek(BOOT_SIZE+slot*SB_SIZE); f.write(_pack_sb(generation,moff,SEG.size+msl,mhash,bytes.fromhex(sroot),len(segs)+1)); f.flush(); os.fsync(f.fileno())
    return manifest

def compact_publish(source,destination,inject_failure=False):
    state=deep_validate(source)
    tmp=Path(str(destination)+".candidate")
    if tmp.exists(): tmp.unlink()
    try:
        create(tmp,state["objects"],state["operations"],state["manifest"]["required_capabilities"],state["manifest"].get("optional_capabilities",[]),uuid.UUID(hex=state["manifest"]["file_uuid"]))
        check=deep_validate(tmp)
        if check["manifest"]["semantic_root"]!=state["manifest"]["semantic_root"]: raise ArqFormatError("publication root mismatch")
        if inject_failure: raise RuntimeError("injected before promotion")
        os.replace(tmp,destination)
    finally:
        if tmp.exists(): tmp.unlink()
