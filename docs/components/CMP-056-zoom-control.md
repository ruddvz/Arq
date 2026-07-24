# CMP-056: Zoom control

## Purpose

Fit and change view scale.

## Anatomy

- Current zoom percentage/scale readout
- Zoom in/out controls
- "Fit to view" action

## Required states

- Default
- At minimum zoom
- At maximum zoom

## Behaviour

- At minimum/maximum zoom, the relevant in/out control is disabled with a reason rather than allowed to silently do nothing.
- "Fit to view" always frames the real current model extent, recalculated live, never a cached extent from an earlier state.

## Sizing

- Compact, typically docked in CMP-007 Status bar or as a floating canvas control.

## Keyboard and accessibility

- +/- keys (or the documented shortcuts) zoom in/out; a documented shortcut triggers fit-to-view, matching CMP-049 Canvas's own keyboard contract.

## Acceptance criteria

- [ ] Limit controls disable with a stated reason at min/max zoom rather than silently no-op-ing.
- [ ] Fit-to-view always reflects the real current model extent.
