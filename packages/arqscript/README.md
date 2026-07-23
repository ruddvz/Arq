# @arq/arqscript

ArqScript v0: a human-readable, versioned, unit-aware, deterministic operation language (see §98-99).

`arqscript-command.ts` + `arqscript-document.ts` (ARQ-166) define the
grammar itself - the AST shape of a valid ArqScript v0 document - for
blueprint section 99's eleven commands: define units, create level,
create wall, update wall, place door, place window, create room, add
dimension, select by ID, select by category, rename.

The lexer/parser modules (`arqscript-lexer.ts`, `arqscript-token-cursor.ts`,
`arqscript-value-parser.ts`, `arqscript-parser.ts`, ARQ-167) turn
ArqScript v0 source text into that AST: `parseArqScript(source, scriptId)`
tokenizes, parses per `docs/ai/ARQSCRIPT-GRAMMAR.ebnf`'s statement
grammar, and delegates every command's required/optional field
validation to its own `arqscript-command.ts` constructor (so defaults/
assumptions live in exactly one place). A hand-written recursive-descent
parser, not a parser-generator library - this issue's own non-goal rules
out an unreviewed dependency, and the grammar is simple enough not to
need one.

The canonical syntax grammar lives in `docs/ai/ARQSCRIPT-GRAMMAR.ebnf` - a
draft that already existed before this issue (7 of the 11 commands),
completed here with the three missing statements (`update wall`,
`select`, `rename`) and reconciled with these AST types, including
`units`'s `'metric' | 'imperial'` value (a project-wide measurement
_system_, matching `@arq/bim-core`'s `ProjectUnitsPreference`) rather than
a per-length `mm`/`cm`/`m`/`in`/`ft` suffix.

- **"Output is a previewable typed operation"**: every command carries an
  `operationType` field naming the `@arq/operations` `ModelOperation` type
  it will eventually produce (e.g. a `wall` command's `operationType` is
  `'CreateWall'`) - real, checkable data today
  (`operationTypesUsed(document)`), even though constructing and
  previewing the actual operation is later work.
- **"Assumptions ... are visible"**: a constructor that fills in a
  documented default for an omitted value (e.g. a wall's height, a door's
  width) records that as a human-readable string in the command's own
  `assumptions` array (`collectAssumptions(document)` flattens them across
  a whole document) - matching blueprint section 97's AI workflow step 3
  ("assumptions"), never silently applied.
- **"Grouped undo ... are visible"**: every `ArqScriptDocument` carries a
  `scriptId`, the eventual grouped-undo key every command it contains
  will share. `@arq/operations`' `undo-stack.ts` currently pushes one
  (forward, inverse) pair at a time with no multi-operation batch concept
  yet - adding that grouping support is later work; `scriptId` makes the
  grouping unit visible in the grammar without pretending it is already
  wired up.

No dependency on `@arq/bim-core`: lengths are plain millimetre `number`s,
not `@arq/bim-core`'s `Length` type, since nothing in this package
validates geometry or project state yet.

`parseArqScript` never throws - every syntax error or semantic-validation
error (from a `create*Command` constructor, e.g. an empty wall id) is
caught and returned as a well-formed `'rejected'` result carrying a source
position, the same safe-failure boundary `@arq/dxf-adapter`'s `parseDxf`
and `@arq/project-format`'s `importArchive` already use. AI guardrail "No
arbitrary code execution" (`docs/ai/AI-GUARDRAILS.md`) holds: this parser
only ever produces plain AST data, with no `eval`/`Function`/dynamic
dispatch on source text anywhere.

`wall-edit-proposal.ts` (ARQ-170) prototypes blueprint section 100
Feature 2's own example ("Change the selected walls to 150 mm"):
`proposeWallHeightEdit` takes the already-parsed intent a caller supplies
(no NL/intent-extraction layer exists here either) and builds section
101's "AI proposal panel" data - original request, parsed intent,
before/after values, and one `UpdateWallCommand` per target wall
assembled into a single `ArqScriptDocument` sharing one `scriptId` -
reusing this package's own grammar rather than inventing a parallel
"proposal operation" shape. `warnings` is honestly always empty: no
semantic/geometry validation is wired to this data-layer prototype.
