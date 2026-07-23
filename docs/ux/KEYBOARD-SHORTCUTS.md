# Keyboard shortcuts

Proposed baseline:

- V Select
- W Wall
- D Door (only while no Dimension tool exists - see below)
- M Move
- R Rotate
- O Offset
- TR Trim (through command sequence or command palette)
- Escape Cancel
- Enter Confirm
- Space Temporary pan
- Tab Cycle candidate or field
- Cmd or Ctrl Z Undo
- Cmd or Ctrl Shift Z Redo
- Cmd or Ctrl K Command palette
- F Fit selection
- Shift F Fit project

Final shortcuts require browser-conflict and architect testing.

## Wired vs not yet implemented (ARQ-152)

`@arq/input-system`'s `registerKeyboardBaseline` (`keyboard-baseline.ts`) wires
the shortcuts above against real command ids for every capability this
codebase currently implements:

- Select, Wall, Door (`V`/`W`/`D`)
- Undo, Redo, both `Ctrl+...` and `Cmd+...` (cross-platform)
- Fit selection, Fit project (`F`/`Shift+F`)
- Escape (cancel) and Enter (confirm) - reserved unconditionally by
  `keyboard-gesture.ts`'s own `dispatch`, regardless of what else is registered

Not yet backed by any tool in this codebase, and deliberately **not**
registered (a caller must not be told a shortcut succeeded when nothing is
there to handle it): Move, Rotate, Offset, Trim, and the command palette
itself. `KEYBOARD_BASELINE_NOT_YET_IMPLEMENTED` names these explicitly.

Space's "temporary pan" is a hold gesture (a mode active only while the key is
down), not a discrete dispatch - a different mechanism from this registry's
keydown-to-command-id lookup, and out of this issue's scope.

## The D / Dimension conflict

Section 29 itself notes "D Door only if it does not conflict with Dimension".
No interactive Dimension tool exists in this codebase yet (`dimension-reference.ts`/
`linear-dimension.ts`, ARQ-136/137, define the data model only, not an
editor-shell tool), so `D` is currently unambiguous.
`assertNoDimensionToolConflict` exists specifically so that the day an
interactive Dimension tool is added, whoever adds it is forced to re-check
this exact keybinding rather than the conflict silently reappearing.
