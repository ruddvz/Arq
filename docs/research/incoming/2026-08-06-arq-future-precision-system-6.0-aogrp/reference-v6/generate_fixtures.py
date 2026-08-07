from pathlib import Path
import sys,shutil
sys.path.insert(0,str(Path(__file__).resolve().parent))
from arq6.format import *
ROOT=Path(__file__).resolve().parents[1]; F=ROOT/"fixtures-v6"; F.mkdir(exist_ok=True)
objs=[object_record("arq.level","level-1",{"elevation":{"coefficient":0,"scale":0,"unit":"mm"}}),object_record("arq.wall","wall-1",{"level":"level-1","start":[0,0],"end":[5000,0],"thickness":{"coefficient":200,"scale":0,"unit":"mm"}})]
ops=[operation_record("wall.create",{"entity_id":"wall-1"})]
healthy=F/"healthy.aogrp.arq"; create(healthy,objs,ops)
shutil.copy2(healthy,F/"corrupt-segment.aogrp.arq")
st=open_manifest(F/"corrupt-segment.aogrp.arq"); off=st["manifest"]["segments"][0]["offset"]+SEG.size
with (F/"corrupt-segment.aogrp.arq").open("r+b") as f: f.seek(off); b=f.read(1); f.seek(off); f.write(bytes([b[0]^1]))
(F/"bad-magic.aogrp.arq").write_bytes(b"NOTARQ!!"+healthy.read_bytes()[8:])
(F/"truncated.aogrp.arq").write_bytes(healthy.read_bytes()[:700])
create(F/"unknown-required.aogrp.arq",objs,ops,required=list(SUPPORTED_REQUIRED)+["arq.future.required"])
create(F/"unknown-optional.aogrp.arq",objs,ops,optional=["arq.future.optional"])
shutil.copy2(healthy,F/"one-root-corrupt.aogrp.arq"); append_revision(F/"one-root-corrupt.aogrp.arq",[object_record("arq.room","room-1",{"name":"Room"})])
with (F/"one-root-corrupt.aogrp.arq").open("r+b") as f: f.seek(BOOT_SIZE); f.write(b"X"*SB_SIZE)
shutil.copy2(healthy,F/"both-roots-corrupt.aogrp.arq")
with (F/"both-roots-corrupt.aogrp.arq").open("r+b") as f: f.seek(BOOT_SIZE); f.write(b"X"*(SB_SIZE*2))
shutil.copy2(healthy,F/"append-failure-tail.aogrp.arq")
try: append_revision(F/"append-failure-tail.aogrp.arq",[object_record("arq.room","room-x",{"name":"Unreachable"})],fail_before_root=True)
except RuntimeError: pass
append_revision(healthy,[object_record("arq.room","room-1",{"name":"Living"})])
compact_publish(healthy,F/"published-compact.aogrp.arq")
