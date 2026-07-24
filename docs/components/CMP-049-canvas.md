# CMP-049: Canvas

## Purpose

Render and interact with plan, model or sheet.

## Anatomy

- Rendering surface (plan/model/sheet view)
- Active tool cursor
- Selection/overlay layers (CMP-050/051/052/053/054 render on top of this)

## Required states

- Default (idle)
- Panning
- Zooming
- Active drawing command in progress
- Selection active

## Behaviour

- The primary authoring surface - every editing tool, snap, and selection interaction ultimately renders and resolves here.
- Never loses committed model state on a rendering failure - a canvas render error is recoverable and reported (delegates to CMP-070/071), never silently corrupts underlying data.
- Provides a keyboard-operable fallback path for every pointer-only gesture where one is required for accessibility compliance (see Keyboard section) - it is not treated as inherently pointer-only.

## Sizing

- Fills its available layout region and resizes live with the window/panel without discarding the current view/zoom state.

## Keyboard and accessibility

- Arrow keys pan the view; +/- (or a documented shortcut) zoom; a documented shortcut resets to fit.
- Tab moves focus to the canvas as a region, after which tool-specific keyboard commands (documented per tool, not here) take over.
- This is a real rendering engine surface, not something the flat-HTML component harness can render live - see the harness's own placeholder notice.

## Acceptance criteria

- [ ] A render failure never corrupts or loses committed model data.
- [ ] Keyboard-only pan/zoom/fit exists as a genuine fallback, not merely aspirational.
