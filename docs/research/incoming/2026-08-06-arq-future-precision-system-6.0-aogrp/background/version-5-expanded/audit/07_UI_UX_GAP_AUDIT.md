# UI and UX gap audit

File-system UX is not a single Open dialog. It includes acquisition, compatibility, migration, repair, recovery, loading, save, publication, conflict, interchange, and review.

## Main defects to avoid

- Saying “compatible” after only checking the SQLite header.
- Loading the workspace before deep validation completes.
- Overwriting the only source during migration or repair.
- Showing a generic “failed” state without the previous safe state.
- Hiding approximations made during import or export.
- Treating recovery data as the same as a clean portable save.
- Allowing an AI proposal to change after approval.
- Presenting background analysis as professionally verified.
- Blocking the canvas with enterprise-style panels for ordinary edits.

Version 5 extends the UX contracts with a file health centre, compatibility details, source retention, task state, partial loading, and accessible diagnostics.
