# RoomPlan conversion (ARQ-173)

## Purpose

Blueprint section 109 ("LiDAR and RoomPlan") requires a specific
11-step conversion pipeline from an Apple RoomPlan capture into Arq
operations, and explicitly warns: "Arq must not assume that RoomPlan
output is a complete editable BIM model." This documents exactly which
steps `@arq/roomplan-adapter` (ARQ-173) implements, which it honestly
does not, and why.

## What this is, and what it is not

**No physical iPad or LiDAR hardware exists in this sandboxed
environment**, and Apple RoomPlan is a native ARKit/Swift framework with
no web or Node binding at all - nothing in this repository captures a
room. `roomplan-captured-room.ts`'s types mirror RoomPlan's real, public
`CapturedRoom` output shape (walls and openings, each with a stable
identifier and a `.low`/`.medium`/`.high` confidence level, per Apple's
own public documentation), but this repository only ever consumes an
already-captured room as plain data - real on-device capture and
accuracy were not tested here, matching section 109's own warning:
"Accuracy claims require device and environment testing. Do not call it
survey-grade by default." No accuracy claim is made anywhere in this
package.

## Pipeline step by step

| #   | Step                          | Status             | Notes                                                                                                                                      |
| --- | ----------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Capture                       | Out of scope       | Needs real LiDAR hardware + native RoomPlan API. Not available here.                                                                       |
| 2   | Confidence                    | Implemented        | Preserved per element (`ConvertedElement.confidence`).                                                                                     |
| 3   | Unit and coordinate check     | Implemented        | Metres -> millimetres, and every wall point translated so the room's bounding-box minimum sits at (0, 0) - see "the coordinate bug" below. |
| 4   | Detect walls and openings     | RoomPlan's own job | This module's input already has them; nothing to add.                                                                                      |
| 5   | Simplify                      | Not implemented    | See "why not simplify/intersections/validation yet" below.                                                                                 |
| 6   | Resolve intersections         | Not implemented    | Same.                                                                                                                                      |
| 7   | Show uncertainty              | Implemented        | `lowConfidenceElementIds` - never hidden or averaged away.                                                                                 |
| 8   | Let user correct              | Out of scope       | UI concern, same as ARQ-170's Apply/Edit/Reject - a data-layer prototype has no UI.                                                        |
| 9   | Convert to Arq operations     | Implemented        | One `CreateWall`/`PlaceDoor`/`PlaceWindow` `@arq/arqscript` command per captured element.                                                  |
| 10  | Validate rooms                | Not implemented    | Same as steps 5-6.                                                                                                                         |
| 11  | Retain source scan provenance | Implemented        | `ConvertedElement.scanObjectId` - RoomPlan's own stable identifier.                                                                        |

## The coordinate bug (caught before shipping, not assumed away)

The first version of the converter passed captured metre coordinates
straight through to `createWallCommand` after converting to millimetres.
`@arq/arqscript`'s `createWallCommand` rejects a negative coordinate
(verified directly by reading its source, not assumed) - and RoomPlan/
ARKit's world-space origin is wherever the device physically started
scanning, not the room's own corner, so real captured coordinates are
routinely negative. Converting a real capture without a coordinate-space
translation step would have incorrectly failed for most real scans -
exactly the kind of "unit and coordinate check" section 109 step 3 names.
Fixed by computing the room's own bounding-box minimum across every wall
endpoint and translating the whole room to a non-negative origin before
building any ArqScript command (`findMinimumCorner` /
`RoomPlanConversionResult.originMeters`, kept visible on the result
rather than applied invisibly). A dedicated test
(`translates negative RoomPlan world-space coordinates...`) covers this
directly with a wall whose real captured coordinates are negative.

## Why not simplify / resolve intersections / validate rooms yet

These three steps need real geometry infrastructure - `@arq/geometry-2d`'s
wall-join resolution (`t-join.ts` and friends, ARQ-095-098) and
room-boundary tracing (`room-boundary-graph.ts`, ARQ-111) - applied
across a whole converted project, not a single captured element. That is
meaningfully larger scope than "convert a RoomPlan capture to ArqScript
commands," and building it against hand-written synthetic test data now
risks tuning it to fit made-up numbers rather than a real scan's actual
characteristics (real RoomPlan output has its own particular noise
patterns - near-duplicate walls, slightly-misaligned corners - that
cannot be faithfully synthesized without a real device). Left as an
honest, explicit gap rather than a fabricated pass, matching this
package's own "never assume a complete editable BIM model" discipline.

## Failure handling

A captured element that fails to convert (e.g. a wall with degenerate
geometry, or an opening naming a host wall id that turns out empty) is
recorded in `failedElements` with its own reason, not thrown past
`convertCapturedRoomToArqScript` - one bad captured surface never blocks
the rest of the scan from converting. Verified directly by test.
