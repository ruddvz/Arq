# @arq/editor-shell

The editor's interaction library: viewport pan/zoom/fit (ARQ-033), hit-test
and point/region selection with candidate cycling, the eight snap sources of
docs/ux/SELECTION-AND-SNAPPING.md with the tie-break rule (ARQ-045..052),
numeric input overlays (metric and imperial), and the wall/door/window/room
drawing tools built on `@arq/command-system`'s lifecycle (ARQ-094 onwards).
Thoroughly unit-tested.

Consumed by `apps/web`'s `PlanCanvas`, which wires pan/zoom, wall drawing,
snapping, hit-test selection and fit into the workspace. Door/window/room
placement tools and region selection are implemented here but not yet wired
to the canvas.
