# ADR-0032: Dark appearance for the UI chrome

**Status:** Accepted
**Date:** 2026-08-06
**Owners:** design-system
**Decision:** The dark-appearance milestone is opened. Dark is a designed token set with measured contrast, never an inversion.

## Context

Blueprint section 15 ("Appearance policy") locked Release 1 to a light appearance and made
dark mode a separate milestone. Its stated reasons were scope control, the convention that
technical plans read clearly on light, and one substantive engineering objection:

> dark mode should not be shipped as an untested token inversion.

That objection is the real content of section 15. The others are scheduling. Section 15
never argued dark mode was wrong for the product; it argued that a cheap dark mode was.

`shell-tokens.css` has carried an empty `prefers-color-scheme: dark` block since the token
set was written, with a comment recording the lock. Meanwhile `brand.v4.css` already
swaps two brand tokens under the same query, so the repository was not uniformly light in
the first place, only unfinished.

## Options

1. **Keep the lock.** Defers the work again and leaves the empty block as a standing
   invitation for someone to fill it in without evidence.
2. **Invert the light palette.** Exactly what section 15 forbids. Produces grey text on
   grey surfaces and destroys the contrast relationships the light set was tuned for.
3. **Design a dark set and prove it.** Chosen.

## Decision

Open the milestone. Dark appearance ships under these conditions:

- **Designed, not derived.** Every `--arq-ui-*` value in the dark block is chosen for dark,
  not computed from its light counterpart. The surface ramp reverses direction, because a
  raised surface is lighter in dark and darker in light; an inversion gets this backwards.
- **Paper is not black.** Pure black against thin CAD linework produces halation and makes
  1px strokes shimmer. Dark paper is a near-black neutral.
- **Text is not pure white.** Maximum-contrast white on near-black is fatiguing over the
  long sessions blueprint section 14 asks the product to support.
- **Contrast is measured, not asserted.** Every token pair the interface actually renders
  is checked against WCAG 2.2 in an automated test: 4.5:1 for body text, 3:1 for non-text
  boundaries and controls. This is the evidence section 15 asked for and is the condition
  on which the milestone opens.
- **Accent is re-picked for dark.** Phthalo green at its brand value reaches only 2.8:1
  against dark paper, below the 3:1 a focus ring must meet. Dark gets a lighter tint of the
  same hue so the brand relationship survives while the ring stays visible.

Scope is the UI chrome. Drawing surfaces (plan, 3D, sheets, PDF) keep their own colour
model and are out of scope for this ADR; a dark canvas is a separate decision with its own
legibility and printing consequences.

## Consequences

Two appearances now need visual regression coverage, roughly doubling baseline count for
shell components. That cost was the honest half of section 15's scope argument and is
accepted here rather than denied.

The contrast test becomes a real constraint on future token edits: changing a surface value
can fail a pair it was not obviously related to. That is the intent.

Because the drawing surfaces stay light for now, a user in dark appearance sees light
canvas inside dark chrome. That is a deliberate intermediate state, not an oversight, and
it matches how several professional drawing tools ship.

## Validation

`packages/design-system/src/appearance/dark-appearance.test.ts` computes WCAG relative
luminance from the declared token values and asserts every rendered pair meets its
threshold in both appearances. It also asserts the dark ramp is not an inversion of the
light ramp, so the specific failure section 15 named cannot pass.

Not yet verified, and deliberately not claimed: appearance on physical displays, and
visual regression baselines.

## Rollback

Set `APPEARANCE_POLICY['dark-appearance'].accepted` to `false` and empty the dark block in
`shell-tokens.css`. The guard test then enforces the light-only rule again. No persisted
state is involved.

## Related issues

Supersedes blueprint section 15. Section 14's visual direction is unchanged.
