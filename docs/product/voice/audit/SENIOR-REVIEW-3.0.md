# Senior review of Arq Language System 2.0

## Verdict

2.0 has the right product instinct: language is a product contract, not a
marketing layer. It correctly separates local save from sync, compatibility
from opening, library capability from reachable product capability, and AI
proposal from autonomous authority.

It is not yet safe to call it a fully self-enforcing knowledge foundation. The
main risk is not wording quality. It is incomplete traceability from a changed
repository source to the specific claims, state labels and answer behaviour that
must change with it.

## Findings that 3.0 closes

| Priority | Finding                                                                                         | Why it matters                                                                | 3.0 control                                                         |
| -------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| P0       | Fixed snapshot counts are asserted as permanent facts.                                          | Normal product growth can fail CI or encourage stale snapshots.               | Dynamic coverage validation and snapshot index.                     |
| P0       | The integration map omits files consumed by the bundle builder.                                 | A fresh install can be incomplete even when copy steps look correct.          | Install-map verifier and complete required-artifact map.            |
| P0       | `STATUS.md` contains mutually incompatible 3D claims.                                           | Support or marketing can choose a convenient truth.                           | Resolution-gated conflict record.                                   |
| P0       | Public `.arq` copy says a file opens in browser while the app stops at compatibility preflight. | It overstates a user-reachable workflow.                                      | Claim binding, concrete remediation and file-message contract.      |
| P0       | The app exposes IndexedDB journal states outside the workspace save registry.                   | The system can pass state coverage while missing visible persistence meaning. | State-adapter map plus journal state coverage.                      |
| P1       | Freshness ignores several live marketing and UI sources.                                        | Generated support/AI context can stay fresh while public claims drift.        | Source contract with file and directory tracking.                   |
| P1       | `--ci` suppresses all warning findings.                                                         | High-risk warnings can disappear from the main release signal.                | Review-required finding process and expiring acknowledgements.      |
| P1       | Conflicts have no acceptance criteria or blocked surface list.                                  | They are easy to remember and easy to ignore.                                 | Required resolution evidence and conflict gate expansion.           |
| P1       | Support/AI answerability has no evidence payload.                                               | A correct answer cannot be traced, refreshed or safely handed off.            | Evidence envelope and response disposition.                         |
| P1       | UI rules are broad but not message-specific.                                                    | "Compatible", "saved" and "recovered" can be translated into misleading copy. | Message contract and accessibility/localisation invariants.         |
| P2       | Package manifest detects accidental drift but is not tamper evidence.                           | A modified archive can regenerate its own manifest.                           | Explicit integrity boundary and release-checksum instruction.       |
| P2       | The source registry treats any ADR path as top authority.                                       | Draft or superseded ADRs could be accidentally promoted.                      | Accepted-ADR qualification in source contract and integration gate. |

## Current repository facts that must remain qualified

1. The live code contains `ModelCanvas` and wires a `3d` tab in `App.tsx`, but
   `STATUS.md` later says the 3D stack has zero consumers. Treat 3D reachability
   as conflicted until `STATUS.md` is reconciled in the same change as evidence.
2. The app journals demo-plan edits to IndexedDB and recovers them on startup.
   That does not mean the portable `.arq` project file has been written.
3. File preflight can establish that a selected `.arq` file is compatible. The
   current UI explicitly says full in-browser opening is not wired. "Compatible"
   is therefore not a synonym for "open".
4. The DXF/IFC/PDF adapters exist as tested libraries, but current source says
   import/export is not reachable end-to-end through the product UI.
5. Current public content includes unsupported present-tense or universal
   statements about file opening, imports, hardware and data transfer. They are
   enumerated in `PUBLIC-COPY-RECONCILIATION.md`.

## Architectural recommendation

Install 3.0 only with the source reconciliation change. Do not enable it as a
passive documentation folder. The minimum release gate is:

1. resolve or retain every conflict with its explicit blocked claim state;
2. apply the public-copy corrections or bind each reviewed assertion;
3. refresh source context from the real checkout;
4. run context, state-adapter, conflict, claim-binding, rendered-site and core
   product gates in CI; and
5. publish the support/AI context only from a passing build artifact.
