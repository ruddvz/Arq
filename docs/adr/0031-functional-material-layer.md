# ADR-0031: Functional material layer on floating control surfaces

**Status:** Accepted
**Date:** 2026-08-06
**Owners:** design-system
**Decision:** A bounded, translucent material is permitted on floating control surfaces only. Blueprint section 14's prohibition is narrowed to decorative use.

## Context

Blueprint section 14 ("Visual direction") requires Arq to be "free from decorative
gradients, glass effects and excessive rounded cards". Read literally that forbids any
translucent surface anywhere.

An external design package (ARQ Liquid Glass Product System 12.0) proposes the opposite:
a translucent material layer that separates floating controls from model content, on the
argument that a material is a functional layer indicating "this is chrome above your
drawing", not decoration. The package never mentions section 14 and did not resolve the
conflict; its own authority ordering puts accepted repository contracts above itself.

The two positions are not actually opposed once "decorative" is taken seriously. Section
14's concern is a product that looks like a consumer dashboard: tinted cards, gradients
and depth used as styling. A material used to mark the boundary between the control layer
and the drawing is doing work that a flat surface does less well, because a CAD workspace
is edge-to-edge content with controls floating over it, and the reader needs to know at a
glance which is which.

What section 14 correctly rules out, and what this ADR keeps ruled out, is material used
anywhere that does not answer that question.

## Options

1. **Uphold section 14 literally.** No translucency anywhere. Cheapest, and loses the one
   case where a material carries information.
2. **Adopt the design package as written.** Material across the interface. Rejected: it is
   the dashboard outcome section 14 exists to prevent, and it puts blur behind content.
3. **Narrow the prohibition to decorative use.** Permit a single bounded material on
   floating control surfaces, with opaque fallbacks mandatory. Chosen.

## Decision

Section 14's "glass effects" prohibition is narrowed to _decorative_ glass effects. A
translucent material is permitted under all of these conditions, every one of which is
required:

- **Control layer only.** Model content, plan, 3D, sheets and PDF surfaces are never
  translucent and never sit behind a blur they own. Material marks chrome, nothing else.
- **Floating only.** A docked panel shares an edge with the canvas and is already
  distinguished by that edge. Material applies only to surfaces that overlap content.
- **Never nested.** A material surface inside another renders flat. Depth stops carrying
  meaning the moment it repeats, and the second blur costs GPU for nothing.
- **Bounded.** Material applies to discrete surfaces of known size. No full-viewport blur;
  the modal backdrop stays a plain scrim.
- **Opaque fallback is the default, not the exception.** Reduced transparency, increased
  contrast, forced colours and any browser without `backdrop-filter` all get a fully
  opaque surface that loses no control and no information.
- **One implementation.** `packages/design-system/src/appearance/material.css` is the only
  place `backdrop-filter` may appear. A second material system is a defect.

## Consequences

Depth becomes meaningful in the shell, which means it must stay rare. Any future surface
that wants material has to argue it is floating chrome over content.

The opaque fallback is the real design, not a degraded one: it is what a majority of
accessibility configurations will render, so it is specified with the same care and is
what the visual baselines cover first.

`backdrop-filter` has a GPU cost proportional to blurred area. Bounding material to
discrete surfaces keeps that cost bounded too, and the prohibition on nesting keeps it
from compounding.

## Validation

`packages/design-system/src/appearance/appearance-policy.test.ts` enforces every clause
that can be checked statically: the single-owner rule, the no-nesting rule, the presence
of all four fallbacks, and the absence of material on content surfaces. The test inverts
with the policy flag, so an accepted feature with no implementation fails just as loudly
as an unaccepted feature that shipped one.

Not yet verified, and deliberately not claimed: real `backdrop-filter` frame cost on
target hardware, and visual regression baselines at the four device widths.

## Rollback

Set `APPEARANCE_POLICY['translucent-material'].accepted` to `false` and delete
`material.css` plus the four `arq-material` class usages. The guard test then enforces the
original section 14 reading again. No data, file format or persisted state is involved, so
rollback is a revert with no migration.

## Related issues

Supersedes the "glass effects" clause of blueprint section 14 only. The rest of section 14
(monochromatic, calm, precise, no gradients, no excessive rounded cards) is unchanged and
still binding.
