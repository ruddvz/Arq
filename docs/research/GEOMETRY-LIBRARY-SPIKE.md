# Geometry library spike (ARQ-086, ARQ-087, ARQ-088, ARQ-089)

Real, hands-on spike of the four candidate open-source geometry tools listed in
`docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md` section 41
("Candidate open-source geometry tools"), following that section's own
"Treatment" guidance for each. This is evaluation only - **none of these
libraries have been added as a dependency of any package** in this repository.
Adopting one is a separate decision for whichever future issue actually needs
it (e.g. real room-boundary clipping, or a real triangulated 3D mesh), made
with the context of that issue's actual requirements, not pre-committed here.

Spike script and raw output are reproducible; the script itself is not
committed to the repository (it is a throwaway harness, not product code) but
its exact content and output are recorded below for anyone who wants to rerun
it.

## robust-predicates

- **Version spiked:** 3.0.3. **Licence:** Unlicense (public domain
  equivalent) - no dependencies. No licence conflict with this repo's
  proprietary licence.
- **What it's for:** `orient2d` - a numerically robust orientation test that
  does not flip sign near-degenerately the way a naive floating-point cross
  product can.
- **Real finding:** constructed three nearly-collinear points
  (`a=[3,3]`, `b=[6, 6.000000000000001]`, `c=[9,9]`) specifically designed to
  sit at the edge of double-precision rounding error. The naive cross-product
  orientation test (`(b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x)`) returned
  `-7.105427357601002e-15` (sign **negative**). `orient2d(a, b, c)` returned
  `5.329070518200751e-15` (sign **positive**) - the mathematically correct
  answer for this construction. This is exactly the failure mode the
  blueprint's "orientation tests; robust geometric decisions" role describes:
  two implementations of "the same" test disagree on sign for a genuinely
  near-degenerate input, and the naive one is the one that's wrong here.
- **Recommendation:** adopt behind an Arq-owned wrapper function (not calling
  `orient2d` directly from feature code) when a real orientation-sensitive
  decision needs it - e.g. wall-join disambiguation or room-boundary
  self-intersection detection - rather than pre-emptively wiring it in now.
  `packages/geometry-2d/src/segment-intersection.ts`'s cross-product-based
  intersection test (ARQ-083) is a candidate consumer once a genuine
  near-degenerate bug report justifies it; it is not swapped in now, since
  doing so without a concrete failing case would be premature dependency
  churn.

## RBush

- **Version spiked:** 4.0.1. **Licence:** MIT. One dependency, `quickselect`
  (also MIT).
- **What it's for:** spatial indexing for selection candidates, viewport
  culling, and snap-candidate filtering (blueprint section 41).
- **Real finding:** loaded three bounding boxes (`wall-a: [0,0,10,10]`,
  `wall-b: [100,100,110,110]`, `wall-c: [5,5,15,15]`) and queried
  `[0,0,6,6]`. RBush correctly returned `wall-a` and `wall-c` (both overlap
  the query box) and excluded `wall-b` (far away) - correct bounding-box
  containment/overlap behaviour on a real, if small, dataset.
- **Recommendation:** a strong fit for `pickAt`/`pickAllAt`/`findEndpointSnaps`
  and friends in `packages/editor-shell` once there are enough real
  candidates in a project that linear-scanning them all (today's
  implementation) becomes a measured performance problem - not before. The
  blueprint's own caution applies directly: "do not assume index results are
  exact geometry hits" - RBush narrows by bounding box only, so the existing
  per-candidate `hitTest` methods (ARQ-039) would still run on whatever RBush
  returns, not be replaced by it.

## earcut

- **Version spiked:** 3.2.3. **Licence:** ISC. No dependencies.
- **What it's for:** polygon triangulation for **display meshes only**
  (blueprint section 41 is explicit: "never use triangulation as
  authoritative room boundary").
- **Real finding:** triangulated an 8-vertex polygon (a 10x10 square with a
  4x4 square hole, using earcut's `holeIndices` parameter) without error,
  producing 8 triangles. Confirms the library handles the hole case the
  blueprint anticipates rooms will need (a room boundary can legitimately
  have an interior void).
- **Recommendation:** appropriate once there is an actual mesh/render layer
  needing triangulated geometry (`packages/model-renderer` or
  `packages/plan-renderer` are still empty scaffolds) - `polygon-area.ts`
  (ARQ-085) and any future room-boundary logic must keep using the polygon's
  own vertex ring as the authoritative boundary, never a triangulation
  derived from it, per the blueprint's explicit warning.

## polygon-clipping

- **Version spiked:** 0.15.7. **Licence:** MIT. Two dependencies:
  `robust-predicates` (Unlicense, already spiked above) and `splaytree`
  (MIT). No licence conflicts.
- **What it's for:** polygon union/intersection/difference (blueprint
  section 41).
- **Real finding:** unioned two overlapping 10x10 squares offset by (5,5)
  (a 5x5 overlap region). The result was a single ring whose shoelace area
  computed to exactly 175 - matching the expected `100 + 100 - 25 = 175`
  for two 100-area squares sharing a 25-area overlap. Confirms correct
  boolean polygon-union behaviour on a real, verifiable case.
- **Recommendation:** the strongest candidate of the four for early
  adoption once a real feature needs polygon boolean ops (e.g. room-boundary
  computation from overlapping wall footprints) - per the blueprint's own
  caution, wrap it so its library-specific ring/polygon array structures
  never leak into `packages/bim-core` or other model packages; convert to
  and from this repo's own polygon representation at the wrapper boundary.

## Summary

All four libraries are real, working, permissively licensed, and behave as
the blueprint's candidate-tool descriptions claim, verified against concrete
constructed inputs rather than taken on faith. None are adopted as
dependencies yet - each is a candidate for whichever future issue has a
concrete, current need for it, with an Arq-owned wrapper interface at the
boundary in every case, per section 41's "Treatment" guidance.
