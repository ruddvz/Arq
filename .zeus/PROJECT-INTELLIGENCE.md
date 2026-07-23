# Project intelligence

Build or refresh the incremental project index once, then query it.

```bash
node scripts/zeus.mjs index
node scripts/zeus.mjs context --query "centre snap viewport"
```

The index stores path, size, modified time, content hash, headings and bounded keywords.
It excludes `.git`, dependencies, builds, binaries, secrets and large generated files.
Writes are atomic and protected by a stale-aware lock.

Authority scoring favours live source, accepted ADRs, `.arq` specifications, current
README/START-HERE, contracts, schemas and tests. Screenshots and historical documents
rank lower for implementation facts.

Cache identity includes repository HEAD and worktree content fingerprints. A changed
file invalidates its context and check evidence. Critical public facts, permissions,
CI, deployment and production state are always fetched live.
