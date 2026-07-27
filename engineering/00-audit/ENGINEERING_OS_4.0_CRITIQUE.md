# Engineering OS 4.0 critique

## Verdict

4.0 had a strong senior-level direction: deterministic minimum safeguards,
risk lanes, recovery-first reasoning, and restraint about providers and
unproven checks. It was not ready to become Arq branch protection because
several essential controls were documentation only.

The problem was not lack of topics. It was the gap between policy language and
executable enforcement.

## Findings that 5.0 fixes

| Severity | Finding                                                                                          | Why it matters                                                             | 5.0 response                                                        |
| -------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Critical | Dependency edges were declared but classifier code never applied them.                           | A shared numeric or command module could evade document or recovery proof. | Executable dependency-edge matching with fixtures.                  |
| Critical | Required manual review did not fail the evidence decision.                                       | An L4 change could display a review reminder while the gate returned pass. | A separate needs_review decision blocks completion.                 |
| Critical | The reference workflow had placeholder commands.                                                 | A green workflow could prove only echo output.                             | Target-specific commands and a placeholder ban.                     |
| High     | The map was marked audit-required and had guessed globs.                                         | Unknown real paths can create false assurance.                             | Current Arq map, baseline commit, and repo-binding verification.    |
| High     | The final gate accepted skipped jobs before checking whether selected evidence required them.    | A conditional-job error could look green.                                  | Selected evidence is evaluated against concrete job results.        |
| High     | Package validation did not verify SHA256SUMS, a manifest, YAML intent, or source-hashed context. | Archive integrity and policy drift were not actually checked.              | Manifest, sums, context verification, map validation, and fixtures. |
| High     | The release model did not incorporate current public-site deployment.                            | Static Pages output could drift from source after deployment.              | Commit-bound static and live proof integration.                     |
| High     | No relationship to the existing Zeus 4.0 system was defined.                                     | Two classifiers can disagree and encourage tool shopping.                  | Authority boundary and consolidation plan.                          |
| Medium   | Generic policy treated active, library-only, and planned capabilities too similarly.             | Testable library code can become a misleading public or release claim.     | Active-surface register and exposure rules.                         |
| Medium   | Source ownership was assumed rather than checked.                                                | L4 approval cannot be meaningful with placeholder CODEOWNERS.              | Ownership blocker and activation gate.                              |
| Medium   | Existing CI commands were not mapped to named contracts.                                         | A test suite may run without proving the changed user contract.            | Evidence catalogue and critical-contract registry.                  |

## What remains good

Keep the 4.0 principles:

- deterministic safeguards are the minimum;
- semantic reasoning may escalate, never erase;
- geometry, persistence, recovery, imports, workers, and security deserve
  different proof;
- rollback is not recovery when document state changed;
- small UI work should stay fast;
- provider and deployment claims must be discovered, not invented.

## Governance conclusion

5.0 should not be enforced in one jump. First install it in shadow mode,
compare classifications against representative pull requests, fix observed
false negatives and false positives, assign owners, then make the stable
engineering-gate required.
