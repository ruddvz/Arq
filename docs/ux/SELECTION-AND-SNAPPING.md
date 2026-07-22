# Selection and snapping

Selection:

- Tap or click selects the highest-priority eligible object.
- Tab cycles candidates.
- Shift toggles selection.
- Left-to-right drag selects enclosed objects.
- Right-to-left drag selects intersected objects.
- Hidden objects do not receive canvas hits.
- Inspector, tree, plan and 3D use the same stable IDs.

Snapping, in priority order:

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

## Centre snap definition

For Phase 1, Centre snap applies only to explicit circular geometry supplied through
`CircularCandidate`:

- a circle snaps to its authored centre;
- an arc snaps to the centre of its parent circle.

Arq does not infer a rectangular candidate's bounding-box centre. That point may be
visually central while having no authored geometric meaning, and it would overlap
with Midpoint behaviour for segment-based candidates.

The candidate contract contains only shape kind, world-space centre and radius. It
must not expose renderer objects, imported-format classes or canonical BIM element
classes. Non-finite centres and non-positive or non-finite radii are ignored.

Escape clears a pending snap suggestion. Enter commits the current valid preview;
neither key mutates project state through the snap source itself.
