# Proof Gaps and Closure Plan

This register separates code that exists from behavior that has been proven in
the product. A gap is not a defect by itself. It becomes a release blocker
when a change or claim relies on the unproven behavior.

| Gap                        | Current safe statement                                                                                                         | Closure work                                                                                                               | Completion evidence                                                                                                           | Release effect                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Browser journal recovery   | Edits are journaled locally for recovery.                                                                                      | Add a restart test that edits, closes or reloads, recovers, and distinguishes journal recovery from portable project save. | `browser_journal_recovery` passes with a deterministic fixture.                                                               | Do not state that recovery proves `.arq` save.                                     |
| Native `.arq` opening      | Native storage code exists, but the browser opening pipeline is not current product flow.                                      | Wire Worker, OPFS, migration, read-only, integrity, and error states into one user path.                                   | `e2e_arq_open` covers valid, corrupt, old-reader, read-only, cancel, and recovery outcomes.                                   | Block opening and portable-file capability claims.                                 |
| 3D model surface           | Source records conflict.                                                                                                       | Reconcile `STATUS.md`, consumer wiring, and active test coverage.                                                          | `conflict_resolution_3d`, `browser_model_canvas`, and visual fixture pass.                                                    | Block current 3D availability claims.                                              |
| Import and export          | Adapters and worker code exist.                                                                                                | Add user-facing ingress and egress with fidelity-result states.                                                            | `e2e_import_export` covers preserved, converted, approximated, flattened, omitted, unsupported, opaque, and failure outcomes. | Block end-to-end interchange claims.                                               |
| Pages truth proof          | Closed: Language System 4.1 is installed; artifact proof runs in CI and the Pages build, live proof in `verify-live-language`. | Keep rendered and live verification bound to the exact deployed commit.                                                    | `language_contract`, `rendered_public_site`, and `deployed_public_site` pass for the same commit.                             | Block release of material marketing claims.                                        |
| Protected L4 approval      | No configured Engineering OS critical-change environment is evidenced.                                                         | Create a GitHub Environment with designated reviewers and limited deployment permissions.                                  | `protected_l4_approval` job succeeds only after environment approval.                                                         | Block L4 merge or release gate.                                                    |
| CI default-branch coverage | Closed: `ci.yml` push covers the actual default branch and declares `merge_group`.                                             | Prove the merge-group path in a shadow run before enabling a merge queue.                                                  | A shadow run proves both PR and merge-group paths.                                                                            | Do not rely on merge-group coverage until a shadow run proves it.                  |
| Source ownership           | Closed: every CODEOWNERS entry names the repository owner; no placeholders remain.                                             | Extend entries with teams as maintainers are added; enforcement waits on branch protection requiring code-owner review.    | No placeholder entries and a review test or manual confirmation.                                                              | Do not claim code-owner enforcement is active until branch protection requires it. |

## Closure discipline

For each closed gap, update all of these together in one reviewed change:

1. The source implementation and its test fixture.
2. The applicable contract state in `ops/critical-contracts.v5.json`.
3. The evidence-catalog state from `missing` to `available`.
4. The active-surface user-safe description.
5. The conflict record if the gap resolves a conflict.
6. Language System canonical truth and public-site claim rules if the product
   capability is newly promotable.
7. The generated engineering context and package manifest after verification.

Never change a status field alone to close a gap.
