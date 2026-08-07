# ARQ House 17.0 — live application hydration check

Closes the open item the Version 17.0 package recorded for itself:

> The live ARQ application still needs to be tested opening and hydrating every
> Version 17 semantic element.

The package was honest about this. Its own `validation/VALIDATION_REPORT_17_0.json`
carries `evidenceBoundary.productionARQWorkspaceHydrationVerified: false`. This
report is that verification, run against this repository at the current revision.

**Result: the container is sound and the live reader does not hydrate the file.**
`house.arq` passes every container gate, and `parseNativeProjectModel`
(`packages/project-loading/src/native-project-model.ts`) refuses it at the first
field. Fourteen blocking contract divergences separate the file from a project
this build can open, plus one that would be read past and silently lost.

Reproduce with:

```
pnpm check:arq-hydration <path-to>/house.arq --json out.json
```

Machine-readable evidence: [`HYDRATION_CHECK_17_0.json`](./HYDRATION_CHECK_17_0.json).

## What was verified independently

Package integrity was re-checked from the shipped ZIP rather than taken from the
package's own report. All four published SHA-256 values match:

| Artifact       | SHA-256                                                            | Matches |
| -------------- | ------------------------------------------------------------------ | ------- |
| Version 17 ZIP | `89fd58c4f4f2e4176f9c79650b21583cfeb36bb4e5b7cfa9344745d587768bf6` | yes     |
| `house.arq`    | `9db3c8b78aface94f13a21101514300ae89f07ac8d5ea807d147cfc1ab0a5c37` | yes     |
| 38-page PDF    | `6257754e5496d782a92cc732468cd1e5a75fe70bc8f2d1569d0dd57404724550` | yes     |
| `house.glb`    | `2c172ce8852bb677f3b484df89fad7cf14c92bc9dc7361d748c6a867ee5d052c` | yes     |

`unzip -t` reports no errors, and the package's own `CHECKSUMS.sha256` verifies
with zero mismatches across all 67 files.

## Container: passes

Read directly from the file, read-only:

| Check                      | Value                                        | Verdict                                                                               |
| -------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------- |
| `application_id`           | `1095913777` (`0x41525131`, `ARQ1`)          | matches `ARQ_APPLICATION_ID`                                                          |
| `user_version`             | `2`                                          | matches `ARQFS_SCHEMA_VERSION_V2`                                                     |
| `PRAGMA integrity_check`   | `ok`                                         | pass                                                                                  |
| `PRAGMA foreign_key_check` | 0 violations                                 | pass                                                                                  |
| arqfs v1 + v2 tables       | all 12 present                               | pass                                                                                  |
| `arqfs_meta`               | major 1, minor 0, min reader major 1         | readable by this build                                                                |
| `archive_entry` rows       | 68                                           | includes `manifest.json`, `model.json`, `views.json`, `sheets.json`, `checksums.json` |
| `manifest.json`            | `schemaVersion: 0`, all four required fields | parses                                                                                |

One observation, not a defect: the schema-v2 **named indexes** that
`migrateArqfsSchemaV1ToV2` creates (`idx_source_document_sha256`,
`idx_source_object_map_arq_element`, `idx_import_session_status`,
`idx_import_issue_severity`, `idx_resource_reference_owner`) are absent — only
SQLite's own autoindexes exist. The v2 _tables_ are all present. So the file
declares schema 2 and carries schema 2's shape, but was not produced by this
repository's own migration path. That affects lookup cost, not semantics.

## Hydration: refused

`views.json` parses cleanly — 6 views, 4 presentable (the two `analysis` views
are correctly reported as having no surface in this build). `model.json` is where
it stops.

The reader's verdict, verbatim:

```
model.json does not declare a modelSchema
```

That is the first gate only. Because the product reader is deliberately
fail-fast, it names one reason where fifteen apply. The full set, from
`checkArqModelConformance`:

| Section · field           | Found in 17.0                                                   | Reader requires                                                                           | Entries | Severity  |
| ------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------: | --------- |
| `model.modelSchema`       | absent                                                          | base `arq-bim-core-reference-v0`                                                          |       1 | blocking  |
| `model.project`           | absent; `id`, `name`, `revision`, `units` are flat at top level | a nested `project` record                                                                 |       1 | blocking  |
| `wallTypes.thickness`     | absent (a bare `width: 300`)                                    | `{ value, unit }` length                                                                  |       5 | blocking  |
| `wallTypes.defaultHeight` | absent                                                          | `{ value, unit }` length                                                                  |       5 | blocking  |
| `wallTypes.function`      | absent                                                          | `exterior` or `interior`                                                                  |       5 | blocking  |
| `walls.alignment`         | absent on 3 walls                                               | `centre` \| `interior` \| `exterior`                                                      |       3 | blocking  |
| `walls.joinStart`         | `union-solid`                                                   | `auto` \| `butt` \| `mitre` \| `disallow`                                                 |      68 | blocking  |
| `walls.joinEnd`           | `union-solid`                                                   | `auto` \| `butt` \| `mitre` \| `disallow`                                                 |      68 | blocking  |
| `walls.height`            | bare `3000`, `1100`, `2800`, `1600`                             | `heightOverride` as a length                                                              |      65 | **lossy** |
| `openings.kind`           | `sliding-door`, `pocket-door`, `opening`                        | `door` \| `window` \| `void`                                                              |      28 | blocking  |
| `doors.side`              | `configured`                                                    | `left` \| `right`                                                                         |      26 | blocking  |
| `doors.hand`              | `start`                                                         | `left` \| `right`                                                                         |      26 | blocking  |
| `doors.swingAngle`        | absent (a `swingDirection: 1` instead)                          | 0–180 degrees                                                                             |      26 | blocking  |
| `windows.side`            | `configured`                                                    | `left` \| `right`                                                                         |      13 | blocking  |
| `rooms.status`            | `coordinated-design-development`, `coordinated-17.0`            | `valid` \| `not-enclosed` \| `overlapping` \| `too-small` \| `invalid-polygon` \| `stale` |      48 | blocking  |

The `walls.height` row is the one to watch. It does not block opening, and that
is exactly why it is the dangerous one: were the blocking rows fixed and this one
left, all 65 walls would draw at their wall type's default height instead of the
height the file specifies, with nothing reported.

## Why the file diverges

The model records `repositoryContract.compatibilityRevision: 62c5e5cf7d9c…`.
That commit is real and is in this repository's history — _"Record the owner
decisions and enforce the identifiers they depend on"_. But
`packages/project-loading/src/native-project-model.ts` does not exist at that
revision: the native reader landed separately, in `d867e6a` (_"Make a native .arq
project openable, read-only, from the product"_), and neither commit is an
ancestor of the other.

So the 17.0 model was authored against a repository state that had no native
project-model reader to conform to. This is a divergence of two vocabularies
that were developed in parallel, not a regression and not a false claim.

The two vocabularies are visibly different in kind. 17.0 speaks in construction
terms — `union-solid` joins, `pocket-door` openings, `coordinated-17.0` room
status, `semanticRole`, `material`, `joinStartNodeId`. The reader speaks in the
closed sets `@arq/bim-core` defines and both renderers rely on. The repository's
own `fixtures/ARQ_Courtyard_House_Golden_Fixture_v2.arq` is the reference for
what the reader accepts, and it hydrates fully: 3 levels, 2 wall types, 79 walls,
30 openings, 14 doors, 16 windows, 34 rooms.

## What 17.0 carries that a reader would get

Counted from the file even though it does not hydrate — the content is there and
is being refused, not missing:

|    Section | Declared |
| ---------: | -------- |
|     levels | 3        |
| wall types | 5        |
|      walls | 68       |
|   openings | 47       |
|      doors | 26       |
|    windows | 13       |
|      rooms | 48       |

## Claims and their evidence state

| Claim                                                              | State                                                          |
| ------------------------------------------------------------------ | -------------------------------------------------------------- |
| ZIP, `house.arq`, PDF and GLB SHA-256 match the published values   | verified                                                       |
| ZIP integrity and the package's own 67-file checksum manifest pass | verified                                                       |
| `house.arq` is a structurally valid arqfs v2 container             | verified                                                       |
| `manifest.json` parses under `@arq/project-format`                 | verified                                                       |
| `views.json` hydrates — 6 views, 4 presentable                     | verified                                                       |
| The live application hydrates every 17.0 semantic element          | **failed** — refused at `modelSchema`; 14 blocking divergences |
| 65 wall heights would be silently lost even once opening succeeds  | verified                                                       |
| Schema-v2 named indexes are absent from the container              | verified                                                       |
| The 17.0 model's geometry is architecturally correct               | not inspected — outside this gate                              |
| Structural, electrical, plumbing, HVAC and construction approval   | not inspected — separate professional gates, unchanged         |

## Second artifact: the slimmed container

A second `house.arq` was submitted separately —
SHA-256 `c4fce9bf51a1e030bb018dbaf387ea4d9ba2f103c5e6b7b4291e6b3cff3e85a9`,
21.4 MB against the packaged file's 34.7 MB. Evidence:
[`HYDRATION_CHECK_SLIMMED_CONTAINER.json`](./HYDRATION_CHECK_SLIMMED_CONTAINER.json).

It is the same project with a cleaner container, and the container work is
genuinely good:

|                           | Packaged 17.0 | Slimmed |
| ------------------------- | ------------: | ------: |
| size                      |       34.7 MB | 21.4 MB |
| archive entries           |            68 |      65 |
| resources                 |            72 |      64 |
| resource references       |            67 |      65 |
| **orphaned resources**    |         **7** |   **0** |
| checksum records verified |       67 / 67 | 64 / 64 |

Three redundant entries were dropped — `model/canonical-model-17.0.json` (a byte
duplicate of `model.json`), its pretty-printed twin, and the QA contact sheet —
`checksums.json` was regenerated to match, and the seven orphaned resource rows
the packaged file carried are gone. Every remaining checksum and every resource
chunk hash verifies, with no dangling references.

**It changes nothing about hydration.** `model.json`, `views.json`,
`manifest.json` and `sheets.json` are byte-identical to the packaged file, so the
same 15 divergences apply at the same counts, and the reader still refuses at
`model.json does not declare a modelSchema`. The schema-v2 named indexes are
still absent from both.

So this is container housekeeping, not a fix for the gate above. The blocking
work remains the model vocabulary.

## What this does not change

`house.arq` was opened read-only and is byte-identical after this check; its
SHA-256 is unchanged. Nothing in the shipped package was modified. Making the
file hydrate requires a writer change or an explicit import adapter, and this
report deliberately stops short of either — translating `union-solid` to `auto`
or `configured` to `left` is a modelling decision about a real building, not a
mechanical rename, and it belongs to whoever owns the model.
