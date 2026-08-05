# Golden `.arq` fixture

`ARQ_Courtyard_House_Golden_Fixture_v2.arq` is the non-trivial residential project
the native read-only open path is proven against, in unit tests and in
`pnpm benchmark:native-open`.

- SHA-256: `0afd9a9785b99ba4338e73067a1af383079363893c30fdc6d538c7e44ed87bd6`
- Size: 1,036,288 bytes
- SQLite application ID: `0x41525131`, `user_version` (arqfs schema): `2`
- arqfs format: major 1, minor 0, `min_reader_major` 1, `min_writer_major` 1
- Journal mode as supplied: `delete` (no `-wal` sidecar dependency)
- Project: `proj-house-courtyard-001`, revision `191`, working copy `clean`
- Semantic model: 3 levels, 2 wall types, 79 walls (37 on the ground floor),
  30 openings, 34 rooms, 5 linear dimensions, 4 views, 1 sheet

Use it unchanged. The hash above is asserted by
`packages/project-loading/src/native-open-pipeline.test.ts` before and after every
open, so a test that mutates the file fails instead of quietly rewriting the
evidence. Never regenerate this file to make a test pass: the bytes are the
control, and a regenerated fixture proves only that the code agrees with itself.

The model declares its own limits (`fixtureMetadata` in `model.json`): it is a
compatibility fixture, not release evidence, not construction documentation, and
its views and sheet material include reference shapes for which canonical schemas
do not yet exist.
