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
README/START-HERE, contracts, schemas and tests. Large historical ledgers, changelogs and
archive/history paths are cold evidence: normal context retrieval excludes them, while
`--include-cold` makes them available when the task actually requires historical evidence.

Context retrieval has a stricter source cap inside each tier ceiling: 3 sources for fast,
6 for standard and 12 for deep. Snippet retrieval is query-centred and bounded, so a match
deep in a selected file returns the relevant window instead of always returning the start
of that file. The result reports used context characters and how many cold sources were
left out.

Cache identity includes repository HEAD and worktree content fingerprints. A changed
file invalidates its context and check evidence. Critical public facts, permissions,
CI, deployment and production state are always fetched live.
