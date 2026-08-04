# Files, storage, migration, and recovery language

This is one of ARQ's highest-risk vocabulary areas.

## Four distinct things

Do not merge:

1. **portable project file** (`.arq`);
2. **working copy** used during editing;
3. **local journal** used for persistence/recovery;
4. **remote sync state** when sync exists.

## Open does not mean compatible, and compatible does not mean opened

A file flow may establish different facts:

- bytes could be read;
- format was detected;
- file passed preflight;
- file is a compatible ARQ project;
- file can be read;
- file can be written;
- migration is required;
- file should open read-only;
- file is actually loaded as a live project.

Copy must name the strongest fact actually established.

Do not say **Project opened** when only preflight succeeded.

## Safe/open modes

User-facing translation should distinguish:

- unreadable file;
- corrupt file;
- interrupted previous write;
- readable but too new to edit;
- missing required project data;
- read-only safety mode;
- healthy/openable.

Do not display internal `ArqfsSafeModePlanKind` values as the main message.

## Read-only

Read-only copy must explain why and what remains possible.

Example:

> **Opened read-only**  
> This project was created with a newer writer version. You can inspect the project, but this build will not save changes to it.

Do not say “safe mode” alone. That is an internal mechanism, not enough user explanation.

## Migration

Before migration:

- show current format/schema version when meaningful;
- show target version;
- state whether an original/backup copy is retained;
- state that the project will not be replaced if verification fails, when this is actually guaranteed by the implementation;
- provide Cancel until mutation begins where supported.

After migration:

- report completion;
- report integrity verification if it ran;
- identify the resulting file/working copy;
- identify retained original/backup when applicable.

## Recovery

Recovery must identify the source:

- local journal;
- interrupted working copy;
- retained pre-migration original;
- explicit backup;
- remote snapshot when future sync supports it.

Do not use **Recovered project** when only uncommitted journal operations were replayed.

## Implementation-tier rule

When current UI reports an IndexedDB/Dexie plan journal, use **local journal**
in the visible status and support explanation. Reserve **Portable .arq file
updated** for a completed, verified native-file publication. A compatible
selected file is not a project that has been opened into a working copy.

Use the message IDs in `02-canonical/message-contract.json` for these states.

## Writer lock

A single-writer conflict is not generic “file busy”.

Preferred shape:

> **Project is already open for editing**  
> Another ARQ session owns the writable working copy. Open read-only, return to the other session, or close it before editing here.

Only offer actions the platform actually supports.
