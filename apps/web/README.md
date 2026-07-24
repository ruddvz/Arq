# @arq/web

Main browser product - the primary authoring surface (desktop + iPad browsers).

Vite + React + TypeScript app shell (ADR-0026). `src/App.tsx` renders the real
brand `Logo`, two `@arq/icons` components, and `PlanCanvas` - a Canvas 2D
surface (ADR-0008, `@arq/plan-renderer`'s `paintPlanScene`) that projects a
real `PlanScene` through a real `@arq/geometry-2d`/`@arq/editor-shell`
viewport. No project/document model exists yet, so `PlanCanvas` paints a
small hardcoded demo scene until a real one can be loaded - see its own
doc comment.

```
pnpm --filter @arq/web dev      # local dev server
pnpm --filter @arq/web build    # production build
pnpm --filter @arq/web preview  # preview a production build
```
