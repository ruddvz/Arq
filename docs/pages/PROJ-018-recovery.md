# PROJ-018: Recovery

**Route or surface:** `/app/recovery/:projectId`
**Access:** editor
**Status:** Planned

## Goal

Restore locally journalled work safely.

## Entry points

- Direct navigation where appropriate
- Contextual action from the previous workflow step
- Command palette for signed-in application surfaces
- Deep link with permission validation

## Required regions

- Page or surface heading
- Primary content
- Primary action
- Supporting navigation
- Loading and progress region
- Error and validation region
- Help or documentation path

## Required states

- Default
- Empty where meaningful
- Loading
- Invalid
- Permission denied
- Offline where meaningful
- Partial failure
- Completed

## Behaviour

- Complete the page goal without hidden configuration.
- Cancel without committing incomplete destructive work.
- Preserve local project state when network access fails.
- Explain disabled actions and unavailable capabilities.
- Do not reveal private project existence through permission errors.

## Responsive behaviour

- Desktop uses the complete panel layout.
- iPad landscape preserves the canvas or primary content.
- Portrait collapses secondary panels to drawers or sheets.
- Public pages remain usable at 320 CSS pixels.
- Browser zoom to 200 percent preserves the primary action.

## Keyboard and accessibility

- Logical tab order and visible focus
- One page heading and appropriate landmarks
- Escape closes temporary layers only
- Enter activates a valid focused action
- Status is not communicated by colour alone
- Errors are associated with fields and affected model objects
- Canvas functionality has tree, inspector and command alternatives

## Analytics

Record page viewed, primary action result, stable failure code and coarse latency.
Do not record project geometry, names, addresses or raw prompts by default.

## Acceptance criteria

- [ ] All required states have designs.
- [ ] Permission and offline behaviour are defined.
- [ ] Keyboard and iPad behaviour are tested.
- [ ] Empty, loading, invalid and failure states exist.
- [ ] Copy follows product-copy rules.
- [ ] No unsupported product claim appears.
