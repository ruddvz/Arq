# Persistence and recovery

First storage:

- Dexie;
- IndexedDB;
- append-only journal;
- periodic snapshots;
- `.arq` archive.

Commit order:

1. validate;
2. apply transaction;
3. write journal;
4. publish committed state;
5. schedule snapshot and sync.

Recovery discards replaceable caches before discarding model data.
