# CMP-042: Workspace switcher

## Purpose

Change active workspace.

## Anatomy

- Trigger showing the current workspace name
- Popup list of available workspaces
- Optional "create workspace" affordance

## Required states

- Closed
- Open
- Loading (workspace list still fetching)

## Behaviour

- Switching workspace is a heavier transition than switching project (CMP-041) since it can change available projects, permissions, and team context entirely - shows a brief loading state rather than an instant, possibly-incomplete swap.

## Sizing

- Same popup sizing rule as CMP-041.

## Keyboard and accessibility

- Follows CMP-014 Select's keyboard contract.

## Acceptance criteria

- [ ] Shows a genuine loading state during the heavier workspace-switch transition rather than flashing incomplete/stale content.
- [ ] Full keyboard operation matches CMP-014's contract.
