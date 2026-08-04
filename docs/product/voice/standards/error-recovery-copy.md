# Error, validation, recovery, and conflict language

## The five-part contract

Every consequential failure should make these facts recoverable by the user:

1. What happened.
2. Why.
3. What was affected.
4. What remains safe.
5. What the user can do.

A short message may combine parts, but must not omit the safety state when data could be at risk.

## Error title formula

`[Object/action] + [failed state]`

Examples:

- Wall was not added
- Project could not be opened
- Local save failed
- Import stopped
- Export omitted 2 views
- Sync rejected 4 operations

Avoid generic titles.

## "No change was applied"

Use this exact idea only when the operation really is atomic and rejected before mutation.

Do not use it after a partial import, partial export, migration, or recovery where some work may have completed.

## Partial failure

Partial failure copy must separate completed and incomplete work.

Example:

> **Import completed with omissions**  
> 218 entities were imported. 14 hatches were not supported and were omitted. The imported objects are in the project. The source file was not changed.  
> **Open import report**

## File opening

Never collapse these into one error:

- unreadable bytes;
- unsupported format;
- newer schema;
- failed migration;
- integrity failure;
- writer lock;
- permission failure;
- interrupted recovery.

Each has a different safe next action.

## Migration

Before migration, tell the user:

- source version;
- target version;
- backup/original retention behaviour;
- whether the operation is reversible;
- what happens on failure.

Completion should confirm integrity verification if it actually ran.

## Recovery

Recovery copy must identify the source:

- local journal;
- working copy;
- backup;
- previous project file;
- synced snapshot.

Example only when the implementation can prove both statements:

> **Recovered local edits**  
> ARQ replayed 12 journalled operations from the interrupted session. This recovery step did not modify the portable project file.

## Sync conflict

Do not frame a conflict as "which one is correct?"

Use factual alternatives:

- Keep local version
- Use remote version
- Review 4 conflicting operations
- Save local copy before resolving

Show revision/time/user provenance where available.

## Import

Report fidelity:

- preserved;
- converted;
- approximated;
- flattened;
- omitted;
- unsupported;
- opaque;
- failed.

## Export

Report:

- output format;
- scope;
- included items;
- omitted items;
- warnings;
- destination;
- validation state.

"Export successful" alone is not enough for professional documents.

## Diagnostics

Human copy first, stable code second.

Example:

> **Project could not be opened**  
> The file uses schema version 4, but this build supports up to version 3.  
> Code: `ARQFS_SCHEMA_NEWER_THAN_APP`

Do not make the code the title.
