# APP-002: Shared with me

**Route or surface:** `/app/shared`
**Access:** signed-in
**Status:** Planned

## Goal

Show projects shared with the user.

## Entry points

- Primary application navigation
- Command palette
- Direct link (including deep links shared by another member)
- Redirect after sign-in or after leaving a project

## Required regions

- Page heading
- Primary content (list, grid, or form)
- Primary action
- Empty-state content
- Workspace context (current workspace, switcher)

## Required states

- Default (populated)
- Empty (first use / nothing yet)
- Loading
- Permission denied (role-gated pages - see `security/RBAC-MATRIX.csv`)
- Offline (cached list may be shown as stale rather than hidden)
- Partial failure (some items fail to load without blocking the rest)

## Behaviour

- Every gated action matches `security/RBAC-MATRIX.csv` for the user's workspace role
  (see `docs/product/DECISION-REGISTER.csv` D-011 for how that role applies across
  projects).
- Disabled actions explain why (role, plan entitlement, or offline), never fail silently.
- Switching workspaces returns the user to an equivalent, valid location rather than
  an error.

## Responsive behaviour

- Desktop uses the complete layout.
- iPad landscape preserves the primary list/grid with secondary panels visible.
- Portrait collapses secondary panels to drawers or sheets.
- Browser zoom to 200 percent preserves the primary action.

## Keyboard and accessibility

- Logical tab order and visible focus.
- Lists and grids are keyboard-navigable (arrow keys or standard tab order).
- One page heading and appropriate landmarks.
- Status is not communicated by colour alone.

## Analytics

Record page viewed and primary action result with a stable code and coarse latency.
Do not record project geometry, names, addresses, or raw prompts.

## Acceptance criteria

- [ ] Gated actions match `security/RBAC-MATRIX.csv` exactly.
- [ ] Empty, loading, permission-denied, and offline states have designs.
- [ ] Keyboard and iPad behaviour are tested.
- [ ] Copy follows the product-copy principles.
