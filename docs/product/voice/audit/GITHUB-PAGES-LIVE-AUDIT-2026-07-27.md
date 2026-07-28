# GitHub Pages live audit, 2026-07-27

## Result

The deployed site at `https://ruddvz.github.io/Arq/` was checked route by
route using `docs/pages/ROUTE-MAP.csv`. All 17 public routes were inspected.
Sixteen contain U+2014. The total is 46. `Status` is the only public route
with zero occurrences.

This is not evidence about who wrote the copy. The supplied editorial reference
is explicit that stylistic signs are descriptive and insufficient to establish
authorship. Here, U+2014 is a deliberate Arq house-style rule because it is
overused in the current public copy, not a detector target.

## Why 4.0 was not sufficient

4.0 made U+2014 a review warning only for product UI. It did not inspect public
marketing source, static output or deployed HTML. Its public-copy inventory
listed eight modules while the current route registry serves seventeen public
pages and a 404 page. A source-only clean result could therefore coexist with
a stale or non-compliant deployed site.

4.1 corrects all four gaps:

1. U+2014 is a hard error in authored public and UI copy.
2. The inventory covers every current public content module, including legal,
   status, documentation, changelog and 404 content.
3. A post-build checker validates every generated public HTML route and writes
   a hash proof into the deploy artifact.
4. A post-deploy checker verifies the proof commit and page hashes before
   reporting the live site as passing.

## Route-level result

| Route                | U+2014 count | Highest-priority remediation                                                                    |
| -------------------- | -----------: | ----------------------------------------------------------------------------------------------- |
| `/`                  |            2 | Separate the local journal from portable `.arq` publication and compatibility preflight.        |
| `/product`           |            5 | Do not present conflicted 3D reachability or a volatile test count as current.                  |
| `/architects`        |            8 | Remove lifetime guarantees and forced negative contrast.                                        |
| `/students`          |            3 | Remove the unbounded hardware statement and qualify semantic authoring.                         |
| `/collaboration`     |            1 | Keep release scope visibly future-facing.                                                       |
| `/ai`                |            5 | Replace metaphor with the future AI proposal contract; do not call it a current kernel feature. |
| `/interoperability`  |            1 | Separate tested adapters from a reachable workflow; use Arq fidelity terms.                     |
| `/ipad`              |            2 | State verified browser behaviour and planned native work separately.                            |
| `/pricing`           |            2 | Remove lifetime access guarantees and self-attesting language.                                  |
| `/security`          |            3 | Replace absolute network claims with verified, scoped privacy facts.                            |
| `/docs`              |            1 | Label the help centre as planned and avoid volatile inventory counts.                           |
| `/changelog`         |            8 | Reconcile 3D and file-opening assertions before publishing them as release facts.               |
| `/status`            |            0 | Remove the absolute outage guarantee despite its clean punctuation.                             |
| `/contact`           |            2 | State the repository channels without claiming they are "real" or staffed.                      |
| `/legal/privacy`     |            1 | Do not publish a complete privacy practice claim before an approved notice and evidence.        |
| `/legal/terms`       |            1 | Keep pre-release terms clearly provisional until legal review.                                  |
| `/legal/open-source` |            1 | Keep generated notice data tied to the deployed artifact and its source revision.               |

The machine-readable audit is `github-pages-live-audit-2026-07-27.json`.

## Release blocker

Do not describe the live public site as language-system compliant until the
4.1 source, static-build and post-deploy gates all pass from the same commit.
The current build has not passed those gates.
