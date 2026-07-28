# Activation readiness

## Current classification

Engineering OS 5.0 is ready for shadow installation. It is not ready for
branch-protection enforcement until the blockers below are closed.

| Area                  | State                                           | Required before enforcement                                                            |
| --------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| Repository mapping    | verified at audited commit                      | refresh after structural changes                                                       |
| Classifier            | executable and fixture-covered                  | shadow against representative pull requests                                            |
| Evidence catalogue    | mapped to current commands                      | confirm command duration and reliability in CI                                         |
| Critical contracts    | mapped, but several exposure states are partial | owner assignment and missing end-to-end proof                                          |
| CODEOWNERS            | resolved                                        | every entry names the repository owner; extend with teams as maintainers are added     |
| Default-branch policy | resolved                                        | ci.yml push covers the actual default branch and declares merge_group                  |
| Manual L4 approval    | configuration required                          | create protected critical-change environment with non-self approval                    |
| Provider ledger       | incomplete                                      | record Pages, branch rules, deployment permissions, and any active observability state |
| Public-site proof     | installed and enforced                          | keep rendered and live verification bound to the exact deployed commit                 |
| Persistence decision  | unresolved                                      | resolve IndexedDB journal and SQLite/OPFS overlap through ADR                          |
| 3D status             | conflicted                                      | resolve from code and product-owner acceptance evidence                                |

## Shadow-mode exit criteria

Do not require the engineering-gate until all of these are true:

- at least ten representative pull requests or equivalent historical diffs have
  been classified;
- each L3 and L4 map rule has a fixture and no unresolved false negative;
- real commands replace every installation placeholder;
- the protected approval environment has been tested with an approval and a
  rejection;
- CODEOWNERS has actual maintainers for high-risk paths;
- the default-branch and merge-queue event paths have been exercised if used;
- public-site static proof has been generated and verified once after deploy;
- unresolved product conflicts remain explicit in the conflict registry.
