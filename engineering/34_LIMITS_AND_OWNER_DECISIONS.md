# Limits and Owner Decisions

No process can honestly promise a software product is permanently perfect.
Arq will change, providers will change, and a repository can contain evidence
that has not yet been collected. The useful standard is stronger: the system
must show when it is no longer aligned with the product and prevent unsupported
claims from passing as certainty.

## Decisions that require authorised owners

| Decision                       | Why an agent cannot decide it                                                                    | Required owner evidence                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Product persistence authority  | The repository currently has both IndexedDB journal recovery and a native SQLite/OPFS direction. | Approved architecture decision, implemented path, migration and recovery proof.  |
| Current 3D capability          | Code and status records disagree.                                                                | Reconciled source record, consumer proof, browser test, release decision.        |
| Public commercial promises     | Pricing, entitlement, uptime, and legal commitments are business and legal authority decisions.  | Approved policy, terms, billing implementation, and support escalation route.    |
| Security posture               | Target security architecture is not current deployed security proof.                             | Deployed controls, threat model, owner sign-off, and negative tests.             |
| Protected reviewers and bypass | These define who may approve critical risk.                                                      | Named teams or people, GitHub Environment policy, incident process.              |
| Data retention and telemetry   | Privacy outcomes depend on actual collection and provider configuration.                         | Approved privacy policy, implementation inventory, deletion and access controls. |
| Interoperability fidelity      | Fidelity labels must reflect real importer/exporter behavior and fixture coverage.               | Supported-version matrix, corpus results, and owner approval.                    |

## Non-negotiable limits

- Do not convert an unassigned owner into an inferred owner.
- Do not replace an unresolved source conflict with the most flattering claim.
- Do not declare native file, sync, collaboration, server security, or AI
  behavior current until it has implementation and runtime evidence.
- Do not count a local test run in an incompatible runtime as a product failure
  or a production pass. Record the environment and run the declared CI runtime.
- Do not disclose secrets, personal data, or private repository details in
  evidence artifacts.

## How 5.0 stays current

The generated context hashes declared policy sources and, when bound to the
repository, core source files and ADRs. The verifier fails on a changed hash.
The conflict registry, active-surface register, contracts, evidence catalog,
map fixtures, and public-site validation must be updated together when a
capability changes. That is the maintenance cost of keeping support, product
AI, UI, documentation, marketing, CI, and release evidence aligned.
