# CMP-057: Scale control

## Purpose

Show or select drawing scale.

## Anatomy

- Current drawing scale readout
- Scale selector (delegates to CMP-014 Select for a fixed list of standard scales)

## Required states

- Default
- Open (choosing a new scale)
- Custom scale entered

## Behaviour

- Changing scale affects sheet/print output and scale-dependent annotation sizing, not the underlying model geometry itself - it is a presentation setting, not a geometry edit.
- A custom (non-standard) scale is validated to a sane, positive, non-degenerate ratio before being accepted.

## Sizing

- Matches CMP-014 Select's sizing.

## Keyboard and accessibility

- Follows CMP-014's keyboard contract when acting as a picker; a typed custom value follows CMP-012 Numeric field's validation-on-commit rule.

## Acceptance criteria

- [ ] Never mutates underlying model geometry - verified to affect only presentation/output.
- [ ] Custom scale entry rejects a non-positive or degenerate ratio with a stated reason.
