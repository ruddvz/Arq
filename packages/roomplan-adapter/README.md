# @arq/roomplan-adapter

Apple RoomPlan capture conversion into ArqScript operations (see §109).

Apple RoomPlan is a native ARKit/LiDAR framework with no web or Node
binding at all - nothing in this package captures a room, and no
physical iPad or LiDAR hardware exists in this sandboxed environment.
`roomplan-captured-room.ts` mirrors RoomPlan's real public output shape
(`CapturedRoom`: walls and openings, each with a stable `identifier` and
a `.low`/`.medium`/`.high` confidence level); `roomplan-converter.ts`
(ARQ-173) implements the buildable half of blueprint section 109's
required conversion pipeline, taking an already-captured room as plain
input and converting it into `@arq/arqscript` commands:

- **Confidence preserved** per element, and low-confidence elements
  surfaced explicitly (`lowConfidenceElementIds`) - never hidden or
  averaged away (section 109 step 7, "show uncertainty").
- **Unit and coordinate check** (step 3): converts metres to millimetres,
  and translates every wall point so the room's own bounding-box minimum
  sits at (0, 0) - not cosmetic. RoomPlan/ARKit's world-space origin is
  wherever the device started scanning, so real captures routinely
  include negative coordinates, and `@arq/arqscript`'s own
  `createWallCommand` rejects a negative coordinate (verified directly).
  Without this translation, converting a real capture would incorrectly
  fail for most real scans - caught and fixed during this issue, not
  assumed away.
- **Convert to Arq operations** (step 9): one `CreateWall`/`PlaceDoor`/
  `PlaceWindow` command per captured element, assembled into a single
  `ArqScriptDocument`.
- **Source scan provenance retained** (step 11): every `ConvertedElement`
  carries `scanObjectId`, RoomPlan's own stable identifier.
- **Never silently drops a captured element**: "Arq must not assume that
  RoomPlan output is a complete editable BIM model" (section 109) - a
  captured element that fails to convert (e.g. degenerate geometry) is
  recorded in `failedElements`, not thrown past this function, and does
  not prevent the rest of the room from converting.

**Explicitly not done here** (steps 5, 6, 10 - simplify, resolve
intersections, validate rooms): these need real geometry infrastructure
(`@arq/geometry-2d`'s wall-join resolution, room-boundary tracing)
applied to a whole converted project - meaningfully larger scope than
"convert a capture to ArqScript commands," and better done once real
captured data exists to validate the approach against rather than tuned
to fit synthetic numbers now. See `docs/research/ROOMPLAN-CONVERSION.md`
for the full pipeline write-up.

"Pencil, finger and keyboard roles are separated" and "native value
compared with browser behaviour" (this epic's shared acceptance
criteria) do not materially apply here - RoomPlan conversion has no
pointer-input surface of its own; that separation is ARQ-171/172's
concern.

No new dependencies (depends only on the existing `@arq/arqscript`
workspace package).
