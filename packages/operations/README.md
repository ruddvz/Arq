# @arq/operations

The typed operation layer: operation and validation-result contracts,
create-element / update-property / door-flip operations with inverses
(property-tested), the undo/redo stack (ARQ-056/057), opening-overlap
validation, explain-selection, accessible selection descriptions, and the
warnings/history inspector property groups.

Operations are pure functions over caller-owned state: `apps/web` applies
them to its in-memory plan document (`apps/web/src/canvas/plan-document.ts`)
with real inverses on the undo stack. No persistent project/document store
exists yet - that integration arrives with the `.arq` open-project pipeline.
