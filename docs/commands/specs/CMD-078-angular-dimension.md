# CMD-078: Angular dimension

**Category:** Document
**Stage:** R2
**Typed operation:** `CreateAnnotation`
**Shortcut:** Unassigned

## Inputs

two directions.

## Lifecycle

1. Arm command.
2. Acquire inputs.
3. Show deterministic preview when applicable.
4. Validate geometry, semantics, permissions and project revision.
5. Commit one typed operation or grouped transaction.
6. Write durably to the local `.arq` working copy.
7. Invalidate only dependent derived systems.
8. Expose undo where the command edits the model.

## Invalid examples

parallel directions.

Invalid input must keep the committed project unchanged and identify the affected
object or parameter.

## Device behaviour

- Desktop: keyboard, mouse and numeric entry.
- iPad: Pencil for precision, finger for navigation and panels.
- Restricted device: hide the command or provide a safe simplified path.

## Accessibility

Command palette, keyboard route, status and model-tree alternative.

## Performance

normal feedback <=32 ms; common commit <=100 ms.

## Required tests

- normal case;
- cancel at every acquisition step;
- invalid value;
- undo and redo;
- reopen after commit;
- recovery after termination;
- keyboard-only path;
- high-density pointer and touch targets;
- model dependency update;
- permission rejection where relevant.
