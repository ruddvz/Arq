# ArqScript specification v0 (ARQ-166)

ArqScript is a deterministic, unit-aware language for architectural operations.

It is not the only project representation and does not execute arbitrary code.

This document defines the v0 grammar itself (blueprint section 98's example
script, section 99's command list), reconciled against
`docs/ai/ARQSCRIPT-GRAMMAR.ebnf` - a draft this issue started from (it
already existed, covering 7 of section 99's 11 commands) and completed
here with the three missing statements (`update wall`, `select`, `rename`).
The AST shape below is implemented in `@arq/arqscript`
(`arqscript-command.ts`, `arqscript-document.ts`). Turning source text
like the example into that AST (ARQ-167, "implement ArqScript parser") is
implemented in `arqscript-lexer.ts`/`arqscript-value-parser.ts`/
`arqscript-parser.ts` - `parseArqScript(source, scriptId)` parses this
exact example into the three commands the AST node table below names.

## Example (section 98)

```arq
version "0.1"

level "Ground Floor" elevation 0mm

wall "W1" {
  from: point(0mm, 0mm)
  to: point(6000mm, 0mm)
  type: "Exterior 230"
  height: 3000mm
}

door "D1" {
  host: "W1"
  width: 900mm
  height: 2100mm
  offset: 1200mm
}
```

## Grammar

The canonical, single-source grammar is `docs/ai/ARQSCRIPT-GRAMMAR.ebnf`
(reproduced below in full - do not let this copy drift from that file):

```ebnf
document      = version_decl, { statement } ;
version_decl  = "version", string ;
statement     = units_decl | level_decl | wall_decl | update_wall_decl |
                door_decl | window_decl | room_decl | dimension_decl |
                select_id_decl | select_category_decl | rename_decl ;
units_decl    = "units", ("metric" | "imperial") ;
level_decl    = "level", string, "elevation", length ;
wall_decl     = "wall", string, "{", { property }, "}" ;
update_wall_decl = "update", "wall", string, "{", { property }, "}" ;
door_decl     = "door", string, "{", { property }, "}" ;
window_decl   = "window", string, "{", { property }, "}" ;
room_decl     = "room", string, "{", { property }, "}" ;
dimension_decl = "dimension", string, "{", { property }, "}" ;
select_id_decl = "select", "id", string, { ",", string } ;
select_category_decl = "select", "category", string ;
rename_decl   = "rename", string, "to", string ;
property      = identifier, ":", value ;
value         = string | number | length | point | array ;
point         = "point", "(", length, ",", length, ")" ;
array         = "[", [ value, { ",", value } ], "]" ;
length        = number, unit ;
unit          = "mm" | "cm" | "m" | "in" | "ft" ;
identifier    = letter, { letter | digit | "_" } ;
string        = '"', { character }, '"' ;
number        = [ "-" ], digit, { digit | "." } ;
```

Note `units_decl`'s `("metric" | "imperial")` is the project's measurement
_system_ (matching `@arq/bim-core`'s already-shipped
`ProjectUnitsPreference`, project.ts, ARQ-061) - a distinct concept from
`unit` (`"mm" | "cm" | "m" | "in" | "ft"`), which is the suffix on an
individual `length` value like `3000mm`. `property`'s generic
`identifier: value` shape means the grammar itself does not hard-code
which named fields (`from`/`to`/`type`/`height`, `host`/`width`/...) a
`wall`/`door`/`window`/`room`/`dimension` block must contain - that
per-command required/optional field validation happens one layer up, in
the AST construction functions (`arqscript-command.ts`'s `createWallCommand`
and friends), which is also where an omitted optional field falls back to
a documented default (see the command table below) and is recorded as a
visible assumption - never silently applied - per blueprint section 97's
AI workflow step 3 ("assumptions").

## Commands (section 99), AST node and typed-operation mapping

| Grammar command   | AST node (`arqscript-command.ts`) | `operationType`      | Optional fields with a default                      |
| ----------------- | --------------------------------- | -------------------- | --------------------------------------------------- |
| `units`           | `UnitsCommand`                    | `DefineProjectUnits` | -                                                   |
| `level`           | `LevelCommand`                    | `CreateLevel`        | -                                                   |
| `wall`            | `WallCommand`                     | `CreateWall`         | `type` (`Generic 100`), `height` (2700mm)           |
| `update wall`     | `UpdateWallCommand`               | `UpdateWall`         | -                                                   |
| `door`            | `DoorCommand`                     | `PlaceDoor`          | `width` (900mm), `height` (2100mm)                  |
| `window`          | `WindowCommand`                   | `PlaceWindow`        | `width` (1200mm), `height` (1200mm), `sill` (900mm) |
| `room`            | `RoomCommand`                     | `CreateRoom`         | -                                                   |
| `dimension`       | `DimensionCommand`                | `AddDimension`       | -                                                   |
| `select id`       | `SelectByIdCommand`               | `Select`             | -                                                   |
| `select category` | `SelectByCategoryCommand`         | `Select`             | -                                                   |
| `rename`          | `RenameCommand`                   | `Rename`             | -                                                   |

`operationType` is section 98/ADR-0014's "AI creates previewable typed
operations through ArqScript" made checkable today
(`@arq/arqscript`'s `operationTypesUsed`), even though actually
constructing and previewing a real `@arq/operations` `ModelOperation` from
a command - including semantic and geometry validation - is later work.

## Grouped undo

Every command parsed from one ArqScript document shares that document's
`scriptId` (`ArqScriptDocument.scriptId`) - the eventual grouped-undo key.
`@arq/operations`' `undo-stack.ts` (ARQ-056/057) currently pushes one
(forward, inverse) pair at a time with no multi-operation batch concept
yet; adding real grouping support there is separate, later work. `scriptId`
makes the grouping unit visible in the grammar now rather than pretending
it is already wired up.

ArqScript is:

- an interchange and operation language;
- not the only project representation;
- schema validated;
- parsed without arbitrary code execution;
- safe to diff;
- suitable for benchmarks.
