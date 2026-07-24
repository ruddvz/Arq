# CMP-005: Tool rail

## Purpose

Expose stable tool categories and active tool.

## Anatomy

- Fixed set of tool category icons
- Active-tool indicator
- Optional flyout for tools with sub-options

## Required states

- Default
- Hover
- Focus visible
- Active tool (pressed + selected)
- Disabled (tool unavailable in current mode)

## Behaviour

- Exactly one tool is active at a time; selecting a new tool always deactivates the previous one.
- Active tool is indicated by shape/icon change and a text label on hover/focus, never colour alone (this exact defect was found and fixed in the static prototype - issue ARQ-211/#211).
- A tool that does not apply to the current view (e.g. a 3D-only tool while in plan view) is disabled with a reason, not hidden, so the rail does not reflow.

## Sizing

- Fixed width regardless of viewport; icons meet the 44pt iPad hit target.
- On iPad landscape the rail persists; on iPad portrait it collapses into the tool selection surface documented for the portrait shell.

## Keyboard and accessibility

- Arrow Up/Down (or Left/Right if rendered horizontally) moves the roving tabindex between tools; Tab exits the rail entirely.
- A documented single-key shortcut per tool (matching the desktop CAD convention already in `packages/editor-shell`) activates it directly.
- Each tool button exposes `aria-pressed` reflecting the active tool.

## Acceptance criteria

- [ ] Active tool is programmatically determinable (`aria-pressed`), not shape/colour-only.
- [ ] Disabled tools state why via `aria-describedby`, not just a visual dim.
- [ ] Roving tabindex keeps the rail a single Tab stop from the rest of the page.
