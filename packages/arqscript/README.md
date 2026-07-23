# @arq/arqscript

ArqScript v0: a human-readable, versioned, unit-aware, deterministic operation language (see §98-99).

`arqscript-command.ts` + `arqscript-document.ts` (ARQ-166) define the
grammar itself - the AST shape of a valid ArqScript v0 document - for
blueprint section 99's eleven commands: define units, create level,
create wall, update wall, place door, place window, create room, add
dimension, select by ID, select by category, rename. Turning ArqScript
source text into these AST nodes is a separate, later step (ARQ-167,
"implement ArqScript parser"); this package has no lexer or parser yet.

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
not `@arq/bim-core`'s `Length` type, since nothing in this grammar-only
package validates geometry or project state yet.
