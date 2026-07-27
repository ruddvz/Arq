# @arq/web

Main browser product - the primary authoring surface (desktop + iPad
browsers). Vite + React + TypeScript (ADR-0026).

`src/App.tsx` hosts the full workspace shell from `@arq/design-system` and
`@arq/workspace` (top bar, tab strip, mode/tool rails, browser and inspector
panels, context and status bars, command palette, touch compositions), and
`src/PlanCanvas.tsx` is an interactive plan surface wired to
`@arq/editor-shell`: pan (pan tool, middle-drag, space-drag, two-pointer
touch), zoom (wheel at cursor, pinch), wall drawing with the chain tool over
the endpoint/midpoint/grid snap pipeline, hit-test selection, and fit.

Edits go to an in-memory plan document (`src/canvas/plan-document.ts`) as
typed operations with real inverses on the `@arq/operations` undo stack -
drawn walls appear in the model tree with measured lengths and in the
inspector with calculated geometry. No `.arq` project can be opened into the
workspace yet (the file-open flow verifies files but does not construct the
OPFS worker), so save state honestly reports `no-project` and sync `offline`.

```
pnpm --filter @arq/web dev      # local dev server
pnpm --filter @arq/web build    # production build
pnpm --filter @arq/web preview  # preview a production build
```
