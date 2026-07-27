# Senior review of Arq Language System 4.1 after deployed-site inspection

## Verdict

4.0 has a sound canonical vocabulary, claim model and editorial policy. It was
not yet deploy-complete. It governed source language without proving that the
published GitHub Pages artifact carried the same language contract.

4.1 is the required correction. It makes the deployed public site a governed
consumer of the system rather than an external presentation layer.

## Findings and controls

| Priority | Finding                                                                   | Why it matters                                                                             | 4.1 control                                                         |
| -------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| P0       | U+2014 appears 46 times in live public copy.                              | The requested style constraint had no public enforcement.                                  | Hard source, static HTML and live HTML rule.                        |
| P0       | A passing deployment could be stale.                                      | A live scan without revision identity can approve old copy.                                | Commit-bound proof file plus route hashes.                          |
| P0       | Inventory covered eight of eighteen content modules.                      | Legal, status and changelog claims could bypass governance.                                | Exact content, route-map and page-registry coverage.                |
| P1       | Current copy turns unresolved implementation facts into reassuring prose. | Claims about file opening, persistence, 3D, imports, hardware, privacy and AI can mislead. | Expanded bindings, remediation catalog and existing conflict gates. |
| P1       | Style patterns were too narrow.                                           | Formulaic contrast and self-attestation can make unsupported claims sound persuasive.      | New review-required rules with short-lived acknowledgements.        |
| P2       | Public deployment had no independent audit record.                        | Teams cannot distinguish inspected production facts from assumptions.                      | Dated live-site audit in machine-readable and reviewer forms.       |

## Acceptance condition

The revised system is ready to integrate. The current Arq site is not ready to
claim compliance until the source conflicts are resolved, the remediation patch
is applied, and the source, static and live checks pass on one deployed commit.
