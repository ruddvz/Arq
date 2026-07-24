# CMP-059: Underlay control

## Purpose

Calibrate, lock and change opacity.

## Anatomy

- Underlay thumbnail/name
- Opacity slider (delegates to CMP-019)
- Lock toggle
- Calibration action

## Required states

- Default (unlocked)
- Locked (position/scale fixed)
- Calibrating (mid-calibration flow)

## Behaviour

- Locking prevents the underlay from being accidentally moved/rescaled by a subsequent pointer drag meant for real model geometry.
- Calibration (setting the underlay's real-world scale from two reference points) is a distinct, explicit flow the user opts into - never inferred automatically.

## Sizing

- Compact panel, typically hosted in CMP-006 Context bar when the underlay tool is active.

## Keyboard and accessibility

- Opacity slider follows CMP-019's keyboard contract; lock toggle follows CMP-018 Switch's.

## Acceptance criteria

- [ ] Locked underlays cannot be moved/rescaled by an ordinary drag meant for model geometry.
- [ ] Calibration never runs automatically without explicit user initiation.
