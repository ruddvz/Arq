# Component harness

Open `index.html`. Renders every one of the 84 components in
`docs/components/COMPONENT-MAP.csv`, in every state its own `CMP-XXX.md` spec
requires, using the real tokens from `design/tokens.css`.

## What this is and isn't

**Framework-agnostic on purpose.** `open-source/TECHNOLOGY-MATRIX.csv` still lists
React Aria Components as "spike to adopt," not a locked decision - no ADR has chosen
a frontend framework yet. Building this harness in a real framework would have meant
silently making that call. Instead it's plain HTML/CSS/JS, matching `prototype/`'s
approach, so it stays useful regardless of what gets chosen later and doesn't
presuppose an answer to a decision that isn't this harness's to make.

**40 components render live** (button, fields, checkbox/radio/switch, select, tabs,
badges, cards, toasts, banners, and similar) - each state (`Default`, `Hover`,
`Focus visible`, `Disabled`, `Selected`, etc., pulled directly from that
component's own required-states list, not hardcoded) is shown side by side using a
`sim-*` class rather than requiring a real mouse hover, so every state is visible
in one static screenshot for visual regression.

**44 components are spec-only placeholders** - things that are either layout chrome
(top application bar, tool rail, context bar) or need a real rendering engine to
mean anything (canvas, view cube, minimap, model tree, selection outline). For
these the harness shows the component's purpose and its full required-states list
as text, so the spec stays visible and checkable even without a live render, rather
than faking a canvas in flat HTML.

## Regenerating `components.json`

The manifest is generated from `docs/components/COMPONENT-MAP.csv` plus each
`CMP-XXX.md`'s own "Required states" section - it is not hand-maintained. If a
component's states or renderer assignment need to change, that logic lives in the
build script referenced in the git history of this directory, not in this file
directly.
