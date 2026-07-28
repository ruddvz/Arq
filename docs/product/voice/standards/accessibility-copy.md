# Accessibility copy rules

## Controls

A control must have a name that stands without its icon.

Good:

- Model health
- Fit view
- Export PDF
- Open project browser

Bad:

- Open
- More
- The icon on the left

## State

Do not rely on colour words.

Bad:

> Fix the red items.

Good:

> Resolve 3 blocking errors in Model health.

## Instructions

Do not encode layout position as the instruction when the layout changes by platform.

Bad:

> Use the panel on the right.

Good:

> Open Inspector, then choose Geometry.

## Keyboard

Show platform-adapted shortcuts from the keyboard registry. Do not hard-code Cmd labels across Windows or touch-only surfaces.

## Error association

Field errors belong next to the field and in the accessibility description.

Model-object errors should identify the object by meaningful display name, with stable ID available in diagnostics if needed.

## Touch

Do not use hover-only copy as the only explanation for a tool.

## Motion

Copy must remain understandable with reduced motion. Do not say "watch the highlighted line move" when the motion may be disabled.
