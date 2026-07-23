# Arq file format (ARQ-194)

Reserves the SQLite application ID and freezes the v1 format header referenced by
`contracts/arqfs.ts`'s `ArqFormatVersion` and by ADR-0019. This document defines the
header; it does not implement a reader or writer - see `packages/arqfs` (ARQ-195).

## Application ID

```
PRAGMA application_id = 0x41525131;
```

`0x41525131` is the four ASCII bytes `A` `R` `Q` `1` (`0x41 0x52 0x51 0x31`) - a
self-describing, distinctive value per SQLite's own recommended convention for
`application_id` (see the SQLite file format documentation's "The Application ID"
section). Any `.arq` file that does not carry this application ID is rejected before
any other read is attempted.

## Schema version

`PRAGMA user_version` holds the integer schema version and maps directly to
`ArqFormatVersion.schema`. Starts at `1` for the v1 schema (ARQ-195). A schema version
bump is a migration (ARQ-201), not a silent reinterpretation of existing tables.

## Frozen v1 header

| Field            | v1 value | Meaning                                                                 |
| ---------------- | -------- | ----------------------------------------------------------------------- |
| `major`          | 1        | Format major version. A reader must refuse to open across a major bump. |
| `minor`          | 0        | Format minor version. Additive and backward-compatible only.            |
| `schema`         | 1        | SQL schema version (`PRAGMA user_version`).                             |
| `minReaderMajor` | 1        | Oldest reader major version that can safely open this file.             |
| `minWriterMajor` | 1        | Oldest writer major version that can safely write this file.            |

A reader whose own major version is below a file's `minReaderMajor` must refuse to open
it at all. A writer whose own major version is below `minWriterMajor` must refuse to
open it read-write (`ArqOpenCapabilities.canWrite = false`, `safeModeRequired = true`)
rather than risk silently corrupting a newer file's semantics it does not fully
understand - see `contracts/arqfs.ts`'s `ArqOpenCapabilities`.

## Versioning rule

Once a major version ships, no existing field or table ever changes meaning. Only
additive, backward-compatible fields are allowed within a minor version. A breaking
change requires a major version bump plus a migration path (ARQ-201).

## Relationship to the existing `@arq/project-format` archive

`@arq/project-format` already defines the canonical _logical_ content of a `.arq`
project (ARQ-076 through ARQ-080): `manifest.json`, `model.json`,
`operations.ndjson`, `views.json`, `sheets.json`, `checksums.json`, each with its own
required/optional handling, checksum verification, and schema-version migration
registry (`createMigrationRegistry`). None of that changes or gets duplicated here.

What ADR-0019 adds is a second _physical container_ for that same logical content.
Today `exportArchive`/`importArchive` produce and consume a flat map of
path-to-bytes (naturally realized as a zip file) with no random access - reading
`model.json` alone still means decoding the whole archive. The SQLite file stores the
same logical entries as rows (one per manifest/model/operations/views/sheets, plus
resource blobs per `ArqResourceDescriptor`), giving random access, transactions and
progressive opening (ADR-0023) without changing what the bytes mean or how they
migrate.

Both physical containers stay valid, for different purposes:

- **`.arq` (SQLite, this document):** the live, working, user-visible project file -
  what the application actually opens, edits and saves day to day.
- **Portable zip archive (`@arq/project-format`, unchanged):** a portable,
  git-diffable interchange bundle - export/import, sharing outside the app, or a
  human-inspectable format that needs no SQLite runtime to read.

`packages/arqfs` (ARQ-195) depends on `@arq/project-format` and stores its existing
entry shapes inside SQLite tables/blobs; it does not reimplement manifest parsing,
checksum computation, or migration sequencing - those stay exactly where they are.

## Non-goals

- No reader or writer implementation here - that is `packages/arqfs` (ARQ-195).
- No opinion on the OPFS/Worker runtime strategy - that is ADR-0024 / ARQ-196.
