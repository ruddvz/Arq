# AI benchmark results (ARQ-168)

## Purpose

Blueprint section 103's ten evaluation categories and ten metrics, measured
against the real, deterministic pipeline that exists in this repository today

- `@arq/arqscript`'s `parseArqScript` (ARQ-167) - not a live AI. No
  natural-language/intent-extraction layer exists anywhere in this repository
  (section 97's steps 1-2 are not implemented), so each category uses a fixed
  ArqScript document standing in for "what an AI would have produced" for that
  scenario. Runnable as `packages/arqscript/src/arqscript-benchmark.test.ts`,
  a normal Vitest suite, no browser or live model needed.

## Method

Ten `it()` blocks, one per section 103 category, each parsing a real,
representative ArqScript document through the real `parseArqScript` and
asserting a genuine outcome against the metrics that category can actually
demonstrate. An eleventh block asserts the crash-rate metric (0%) across a
mixed sample spanning both parsed and rejected categories.

## Results (2026-07-23)

| #   | Category (section 103)  | Real, measured result                                                                                                                                                   | Metrics demonstrated                                       |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | Text to wall            | Parses to `CreateWall` with exact dimensions; median latency 0.0175ms, max 1.24ms over 500 trials                                                                       | dimensional accuracy, semantic accuracy, operation latency |
| 2   | Modify wall             | Parses to `UpdateWall`; zero assumptions when the change is explicit                                                                                                    | semantic accuracy, assumptions                             |
| 3   | Place opening           | Parses to `PlaceDoor`; 2 assumptions recorded for the omitted width/height, never silently applied                                                                      | assumptions                                                |
| 4   | Room adjacency          | Two room boundaries sharing a vertex are both parsed and detected as adjacent by a benchmark-local proxy check (not the full `room-boundary-graph.ts` feature)          | valid geometry                                             |
| 5   | Constraint satisfaction | Correctly **rejected** - `"unknown statement"` (no constraint syntax exists in ArqScript v0)                                                                            | rejection quality, crash rate                              |
| 6   | Ambiguous request       | **Parses successfully** despite a meaningless cross-reference (a door's `host` naming no wall anywhere in the document) - a real, documented gap, not a fabricated pass | assumptions (honestly: none caught)                        |
| 7   | Invalid request         | Correctly **rejected** - reason names the exact offending field (`"door host must not be empty"`)                                                                       | rejection quality                                          |
| 8   | Multi-step revision     | 3 commands from one document all share one `scriptId` - the eventual grouped-undo key                                                                                   | undo success (grouping visible)                            |
| 9   | Error explanation       | Rejection reason names the unrecognized statement and its exact source line                                                                                             | rejection quality                                          |
| 10  | Schedule generation     | Correctly **rejected** - `"unknown statement"` (no schedule-generation statement or code exists)                                                                        | rejection quality, crash rate                              |

**Crash rate: 0%** across every category above, parsed or rejected -
`parseArqScript` never throws (verified directly, not assumed).

**Not applicable to an automated deterministic benchmark:** `user
corrections` and `time saved` are real-usage/product-analytics metrics that
require live user interaction data no automated test can produce - marked
not applicable here rather than estimated or fabricated.

## Honest gaps (not silently hidden)

Three of the ten categories have no real capability behind them yet:

- **Constraint satisfaction** - no constraint declaration syntax exists in
  ArqScript v0's grammar, and no constraint solver exists anywhere in this
  repository. `open-source/TECHNOLOGY-MATRIX.csv` records `KittyCAD ezpz`
  as an early-stage reference for this later.
- **Schedule generation** - no schedule (door/window/room table) generation
  code exists yet; blueprint section 99/CMD catalog do not name it as a v0
  command.
- **Ambiguous request (cross-reference half)** - `parseArqScript` validates
  syntax and each command's own field shapes, but not cross-references
  between commands (e.g. a door naming a wall id that does not exist
  anywhere in the document) - that is section 97 step 5's "semantic
  validation," separate, later work.

For all three, the deterministic, reproducible result reported above is
today's real behaviour - correctly rejecting an unrecognized statement (5, 10) or correctly _not yet_ catching a meaningless reference (6) - rather
than a claim that the underlying capability exists.

## Regression tracking

Not added to `benchmarks/PERFORMANCE-BUDGETS.json`'s `ciBaselines`: that
file tracks renderer/geometry performance regressions against an absolute
target (fps, ms). These ten benchmarks are correctness/coverage
demonstrations against blueprint section 103's evaluation categories, not a
single scalar performance number to regress-test - `arqscript-benchmark.test.ts`
itself, run in every CI pass, is the regression guard.
