# ArqScript specification v0 (ARQ-166)

ArqScript is a deterministic, unit-aware language for architectural operations.

It is not the only project representation and does not execute arbitrary code.

This document defines the v0 grammar itself (blueprint section 98's example
script, section 99's command list). The AST shape below is implemented in
`@arq/arqscript` (`arqscript-command.ts`, `arqscript-document.ts`); turning
source text like the example into that AST is a separate, later step
(ARQ-167, "implement ArqScript parser") - no lexer or parser exists yet.

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

## Grammar (EBNF-ish)

```ebnf
document   = "version" string, { command } ;
command    = units | level | wall | update_wall | door | window
           | room | dimension | select_id | select_category | rename ;

units      = "units" unit ;
level      = "level" string "elevation" length ;
wall       = "wall" string "{" "from" ":" point "to" ":" point
             [ "type" ":" string ] [ "height" ":" length ] "}" ;
update_wall= "update" "wall" string "{" [ "type" ":" string ]
             [ "height" ":" length ] "}" ;
door       = "door" string "{" "host" ":" string
             [ "width" ":" length ] [ "height" ":" length ]
             "offset" ":" length "}" ;
window     = "window" string "{" "host" ":" string
             [ "width" ":" length ] [ "height" ":" length ]
             [ "sill" ":" length ] "offset" ":" length "}" ;
room       = "room" string "{" "name" ":" string
             "boundary" ":" "[" point, { "," point } "]" "}" ;
dimension  = "dimension" string "{" "from" ":" point "to" ":" point "}" ;
select_id  = "select" "id" string, { "," string } ;
select_category = "select" "category" string ;
rename     = "rename" string "to" string ;

point      = "point" "(" length "," length ")" ;
length     = number ( "mm" | "cm" | "m" | "in" | "ft" ) ;
unit       = "mm" | "cm" | "m" | "in" | "ft" ;
string     = '"' , { character } , '"' ;
```

A `[ ... ]` bracketed clause is optional; an omitted `wall`/`door`/`window`
field falls back to a documented default (see the command table below) and
is recorded as a visible assumption - never silently applied - per
blueprint section 97's AI workflow step 3 ("assumptions").

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
