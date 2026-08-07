# Version 4 package audit

The prior ZIP is retained at `background/prior_package/` with SHA-256 `716b5ff6fcd84dc49da460f550af82131dbe66123153cf149d759dbf058492c0`.

## Mechanical findings

- Actual files: 134
- Python bytecode: 12
- Superseded MCP references: 2
- Fixed package timestamp references: 1

The package had a valid manifest and useful executable content, but build artefacts and stale standards weakened reproducibility. Version 5 regenerates all inventories after final validation and excludes caches, bytecode, temporary files, and platform metadata.
