# Public Site and Language Interlock

The static marketing site is a production surface. A successful static build
does not establish that every page says only what the product can currently
do.

Engineering OS 5.0 delegates language truth to Arq Language System 4.1 and
adds release controls around it. This avoids two competing dictionaries while
ensuring that a claim change receives engineering evidence.

## Required proof chain

1. Classify source, route, build, brand, and Pages workflow changes.
2. Run Language System source and conflict validation before building context.
3. Build the exact Pages artifact with `SITE_BASE_PATH=/Arq` and
   `SITE_ORIGIN=https://ruddvz.github.io`.
4. Run rendered route coverage and public-claim checks on `apps/marketing/dist`.
5. Upload that checked artifact without regenerating it.
6. Record the deployment URL, commit SHA, and artifact identity.
7. Run deployed-route and deployed-claim verification after Pages serves the
   new artifact.

The check order matters. A context refresh before a freshness check can hide a
stale or invalid claim map. The public-site workflow must verify first and
refresh only in an explicit reviewed maintenance task.

## Current audit findings

The 2026-07-27 audit found 84 visible em dashes across the audited live route
set. More importantly, public copy promotes some intended or library-level
capabilities as current product behavior. Examples include portable local-file
claims, browser opening claims, 3D availability, end-to-end interoperability,
server-side security, and permanent entitlement guarantees.

Do not solve this with a blanket search-and-replace. Each statement needs a
truth outcome from the Language System:

| Outcome          | Required public behavior                                                            |
| ---------------- | ----------------------------------------------------------------------------------- |
| ANSWER           | Use the supported, current claim with canonical terminology.                        |
| QUALIFY          | State the bounded, evidenced condition and avoid promotion.                         |
| CONFLICT         | Do not choose a side in public copy. Resolve the source conflict.                   |
| UNKNOWN          | Say that the answer is not established and route to evidence.                       |
| REFUSE_AUTHORITY | Do not make a claim that belongs to a designated owner or legal/security authority. |

## Copy controls

- Avoid em dashes in authored public copy. Use a period, comma, colon, or
  parentheses where the relationship is clearer.
- Do not use vague completion language such as "fully", "seamless", "simply",
  "just", "obviously", or "works everywhere" unless a contract defines the
  condition and proof.
- Do not imply that local journal recovery means a `.arq` file is saved.
- Do not turn a compatible-file preflight into an open-project claim.
- Do not use the 3D surface as a current marketing proof while its source
  record is conflicted.
- Bind every deployed verification record to the exact deployment commit.

See `ops/public-site-contract.v5.json` and the supplied Language System 4.1
package for executable route, phrase, conflict, and deployed-site checks.
