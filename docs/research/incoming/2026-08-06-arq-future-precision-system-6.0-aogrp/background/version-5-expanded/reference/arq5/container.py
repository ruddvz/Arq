from __future__ import annotations
import hashlib, json, os, sqlite3, tempfile, uuid
from pathlib import Path
from typing import Any
from .canonical import canonical_bytes, digest, state_root

DEMO_APPLICATION_ID = 0x41525135  # ASCII ARQ5, package-only. Never allocate to production.
DEMO_USER_VERSION = 5000
MAX_DEMO_FILE_BYTES = 64 * 1024 * 1024
SQLITE_HEADER = b"SQLite format 3\x00"

class ArqFileError(RuntimeError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code

def sha256_file(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):
            h.update(chunk)
    return h.hexdigest()

def connect_ro(path: Path) -> sqlite3.Connection:
    uri = f"file:{path.resolve().as_posix()}?mode=ro&immutable=1"
    con = sqlite3.connect(uri, uri=True)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    con.execute("PRAGMA trusted_schema=OFF")
    return con

def preflight(path: Path, supported_capabilities: set[str] | None = None) -> dict[str, Any]:
    supported_capabilities = supported_capabilities or {"arq/core"}
    if not path.exists() or not path.is_file():
        raise ArqFileError("ARQ5-FILE-0001", "file is missing")
    size = path.stat().st_size
    if size < 100:
        raise ArqFileError("ARQ5-FILE-0002", "file is truncated or not SQLite")
    if size > MAX_DEMO_FILE_BYTES:
        raise ArqFileError("ARQ5-LIMIT-0001", "file exceeds demonstrator byte limit")
    with path.open("rb") as f:
        if f.read(16) != SQLITE_HEADER:
            raise ArqFileError("ARQ5-FILE-0004", "SQLite header mismatch")
    try:
        con=connect_ro(path)
    except sqlite3.Error as e:
        raise ArqFileError("ARQ5-SQLITE-0001", f"cannot open SQLite: {e}") from e
    try:
        app_id=con.execute("PRAGMA application_id").fetchone()[0]
        user_version=con.execute("PRAGMA user_version").fetchone()[0]
        if app_id != DEMO_APPLICATION_ID:
            raise ArqFileError("ARQ5-FILE-0003", "application ID mismatch")
        integrity=con.execute("PRAGMA integrity_check(1)").fetchone()[0]
        if integrity != "ok":
            raise ArqFileError("ARQ5-SQLITE-0002", f"integrity check failed: {integrity}")
        projects=con.execute("SELECT * FROM arq_project").fetchall()
        if len(projects)!=1:
            raise ArqFileError("ARQ5-MODEL-0001", "exactly one project row required")
        caps=[dict(r) for r in con.execute("SELECT * FROM arq_capability ORDER BY namespace")]
        missing=[c["namespace"] for c in caps if c["requirement"]=="required" and c["namespace"] not in supported_capabilities]
        project=dict(projects[0])
        return {
            "verdict":"read-only-preserving" if missing else "editable-demo",
            "application_id":app_id,"user_version":user_version,
            "project":project,"capabilities":caps,"missing_required":missing,
            "file_sha256":sha256_file(path),
        }
    except sqlite3.Error as e:
        raise ArqFileError("ARQ5-SQLITE-0003", f"required schema unavailable: {e}") from e
    finally:
        con.close()

def _load_state(con: sqlite3.Connection):
    components=[]
    for r in con.execute("SELECT object_id,schema_id,schema_version,payload FROM arq_component ORDER BY object_id,schema_id"):
        components.append({"object_id":r[0],"schema_id":r[1],"schema_version":r[2],"payload":json.loads(r[3])})
    relations=[]
    for r in con.execute("SELECT relation_id,type_id,source_id,target_id,role,ordinal,payload FROM arq_relation ORDER BY relation_id"):
        relations.append({"relation_id":r[0],"type_id":r[1],"source_id":r[2],"target_id":r[3],"role":r[4],"ordinal":r[5],"payload":json.loads(r[6])})
    return components,relations

def validate(path: Path, supported_capabilities: set[str] | None = None) -> dict[str, Any]:
    result=preflight(path,supported_capabilities)
    con=connect_ro(path)
    try:
        fk=con.execute("PRAGMA foreign_key_check").fetchall()
        if fk:
            raise ArqFileError("ARQ5-MODEL-0002", "foreign-key violations")
        components,relations=_load_state(con)
        calculated=state_root(components,relations)
        current=result["project"]["current_revision"]
        rev=con.execute("SELECT state_root FROM arq_revision WHERE revision_id=?",(current,)).fetchone()
        if not rev:
            raise ArqFileError("ARQ5-REV-0001", "current revision missing")
        if rev[0]!=calculated:
            raise ArqFileError("ARQ5-REV-0002", "semantic state root mismatch")
        publication=con.execute("SELECT semantic_root FROM arq_publication").fetchone()
        if not publication or publication[0]!=calculated:
            raise ArqFileError("ARQ5-PUB-0001", "publication root mismatch")
        missing_assets=[]
        for r in con.execute("SELECT asset_id,sha256,required,data FROM arq_asset"):
            if r[2] and r[3] is None: missing_assets.append(r[0])
            if r[3] is not None and hashlib.sha256(r[3]).hexdigest()!=r[1]:
                raise ArqFileError("ARQ5-ASSET-0001", f"asset hash mismatch: {r[0]}")
        if missing_assets:
            raise ArqFileError("ARQ5-ASSET-0002", "required assets missing")
        result.update({"semantic_root":calculated,"component_count":len(components),"relation_count":len(relations),"validated":True})
        return result
    finally:
        con.close()

def create_demo(path: Path, schema_path: Path) -> dict[str,Any]:
    path.parent.mkdir(parents=True,exist_ok=True)
    if path.exists(): path.unlink()
    con=sqlite3.connect(path)
    con.execute(f"PRAGMA application_id={DEMO_APPLICATION_ID}")
    con.execute(f"PRAGMA user_version={DEMO_USER_VERSION}")
    con.execute("PRAGMA foreign_keys=ON")
    con.executescript(schema_path.read_text(encoding='utf-8'))
    project_id=str(uuid.uuid4()); obj_id=str(uuid.uuid4()); group_id=str(uuid.uuid4()); op_id=str(uuid.uuid4()); pub_id=str(uuid.uuid4())
    component={"object_id":obj_id,"schema_id":"arq.demo/point","schema_version":1,"payload":{"x":{"coefficient":0,"scale":0,"unit":"mm"},"y":{"coefficient":0,"scale":0,"unit":"mm"}}}
    root=state_root([component],[])
    op_payload={"operation_id":op_id,"type":"arq.demo/create-point","schema_version":1,"payload":component}
    group_payload={"group_id":group_id,"project_id":project_id,"base_revision":"0"*64,"actor":{"class":"system","id":"fixture-generator"},"operations":[op_payload]}
    revision=digest("revision-v1",{"parents":[],"group":digest("operation-group-v1",group_payload),"state_root":root})
    now="2026-08-06T15:58:00Z"
    with con:
        con.execute("INSERT INTO arq_project VALUES(?,?,?,?,?,?,?)",(project_id,"ARQ 5 demo",5000,5000,5000,5000,revision))
        con.execute("INSERT INTO arq_capability VALUES(?,?,?,?,?)",("arq/core","5.0.0","required","interpreted","ARQ demo"))
        con.execute("INSERT INTO arq_object VALUES(?,?,?,NULL)",(obj_id,"arq.demo/point",revision))
        payload=canonical_bytes(component["payload"])
        con.execute("INSERT INTO arq_component VALUES(?,?,?,?,?)",(obj_id,component["schema_id"],1,payload,digest("component-payload-v1",component["payload"])))
        gp=canonical_bytes(group_payload)
        con.execute("INSERT INTO arq_operation_group VALUES(?,?,?,?,?,?,?,?)",(group_id,project_id,"0"*64,"system","fixture-generator",gp,digest("operation-group-v1",group_payload),now))
        opb=canonical_bytes(op_payload)
        con.execute("INSERT INTO arq_operation VALUES(?,?,?,?,?,?,?)",(group_id,0,op_id,op_payload["type"],1,opb,digest("operation-payload-v1",op_payload)))
        con.execute("INSERT INTO arq_revision VALUES(?,?,NULL,NULL,?,?,?)",(revision,project_id,group_id,root,now))
        con.execute("INSERT INTO arq_publication VALUES(?,?,?,?,?,?)",(pub_id,project_id,revision,"arq5-demo",now,root))
    con.execute("PRAGMA journal_mode=DELETE")
    con.close()
    return validate(path)

def publish(source: Path, destination: Path, supported_capabilities: set[str] | None = None, fail_before_promote: bool=False) -> dict[str,Any]:
    source_validation=validate(source,supported_capabilities)
    destination.parent.mkdir(parents=True,exist_ok=True)
    prior_hash=sha256_file(destination) if destination.exists() else None
    fd,tmp=tempfile.mkstemp(prefix=destination.name+'.candidate.',dir=destination.parent)
    os.close(fd); candidate=Path(tmp)
    try:
        src=connect_ro(source); dst=sqlite3.connect(candidate)
        try:
            src.backup(dst)
            dst.execute("PRAGMA journal_mode=DELETE")
            dst.commit()
        finally:
            dst.close(); src.close()
        with candidate.open('rb+') as f:
            f.flush(); os.fsync(f.fileno())
        candidate_validation=validate(candidate,supported_capabilities)
        if candidate_validation["semantic_root"]!=source_validation["semantic_root"]:
            raise ArqFileError("ARQ5-PUB-0002","candidate semantic root differs")
        if fail_before_promote:
            raise ArqFileError("ARQ5-PUB-0099","injected failure before promotion")
        os.replace(candidate,destination)
        try:
            dfd=os.open(destination.parent,os.O_RDONLY)
            try: os.fsync(dfd)
            finally: os.close(dfd)
        except OSError:
            pass
        final=validate(destination,supported_capabilities)
        final.update({"promoted":True,"prior_destination_sha256":prior_hash})
        return final
    except Exception:
        if destination.exists() and prior_hash is not None and sha256_file(destination)!=prior_hash:
            raise AssertionError("prior destination changed during failed publication")
        raise
    finally:
        candidate.unlink(missing_ok=True)
