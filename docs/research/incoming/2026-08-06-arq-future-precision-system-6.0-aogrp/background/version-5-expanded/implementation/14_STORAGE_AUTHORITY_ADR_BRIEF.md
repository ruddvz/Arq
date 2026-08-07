# Storage authority ADR brief

Decide the roles of SQLite-WASM/OPFS, Dexie/IndexedDB, operation journal, recovery checkpoint, and portable file. Evaluate single-writer enforcement, atomic acknowledgement, crash windows, dual-write failure, quota, mobile suspension, tab races, migrations, export, backup, and removal of transitional code. The accepted ADR must provide a state machine and rollback.
