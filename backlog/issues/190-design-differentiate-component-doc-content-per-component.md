# design: differentiate component doc content per component

**Issue ID:** ARQ-190
**Phase:** Phase 0
**Epic:** Design system
**Priority:** high
**Suggested labels:** type: docs, area: design, priority: high, state: ready
**Dependencies:** ARQ-177

## Problem

All 84 files in `docs/components/` share byte-identical content after the "Purpose"
line (verified programmatically: `CMP-001-button.md` and `CMP-016-checkbox.md`, and
every other pair, are identical from "## Anatomy" onward). The same problem existed
for the 57 page specs in `docs/pages/` and was fixed under ARQ-175 with four
category-specific templates (PUB/AUTH/APP/PROJ). Components need the same treatment,
but per-component rather than per-category, since a Button and a Canvas have almost
nothing in common beyond both being "components."

## Scope

For each of the 84 components in `docs/components/COMPONENT-MAP.csv`, replace the
generic "Anatomy / Required states / Behaviour / Sizing / Keyboard and accessibility
/ Acceptance criteria" boilerplate with content specific to that component - what it
actually is, which states genuinely apply to it (a Toast doesn't have a meaningful
"Selected" state; a Canvas doesn't have "Hover" in the button sense), and its real
keyboard/accessibility contract (a Data table's keyboard model is not a Button's).

`component-harness/components.js` (ARQ-177) already has a `renderer` field per
component classifying ~40 of the 84 as mapping to simple native controls and ~44 as
layout chrome or engine-dependent - that classification is a reasonable starting
point for grouping this work, not a reason to skip it.

## Non-goals

- Do not expand into full visual mockups (that's ARQ-175/176's territory, not this).
- Do not introduce a frontend framework choice while doing this - it's a content fix.

## Acceptance criteria

- [ ] No two component docs are byte-identical after "Purpose" unless they are
      genuinely the same kind of control with no meaningful difference.
- [ ] Required states reflect what actually applies to each component, not a
      copy-pasted universal list.
- [ ] `component-harness/components.js` states arrays are regenerated from the
      corrected docs and the harness still renders without errors.

## Evidence

Programmatic diff showing all 84 files are byte-identical after "Purpose" (same
method used to verify the ARQ-175 finding for pages).
