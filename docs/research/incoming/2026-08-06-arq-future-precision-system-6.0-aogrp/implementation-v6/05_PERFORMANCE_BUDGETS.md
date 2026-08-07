# Performance budgets

Budgets require device and fixture qualification. Initial targets for experiments, not product claims:

- 4 KiB bounded preflight without allocation proportional to file size.
- Manifest open with at most two random reads after bootstrap when locally available.
- Range-open of a small project without downloading unrelated asset chunks.
- Rebuildable index, with canonical state unaffected by index deletion.
- Append publication cost proportional to changed objects plus manifest, not whole project.
- Repack may be whole-file background work and must remain cancellable.
