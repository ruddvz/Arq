# Selection and snapping

Selection:

- Tap or click selects the highest-priority eligible object.
- Tab cycles candidates.
- Shift toggles selection.
- Left-to-right drag selects enclosed objects.
- Right-to-left drag selects intersected objects.
- Hidden objects do not receive canvas hits.
- Inspector, tree, plan and 3D use the same stable IDs.

Snapping:

- Endpoint
- Intersection
- Midpoint
- Perpendicular
- Centre
- Grid
- Extension
- Nearest

Snap results are calculated outside the renderer and include source, priority,
screen distance and suggested constraint.
