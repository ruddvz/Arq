# First repository vertical slice

## Outcome

A user selects an existing compatible `.arq`, receives a truthful compatibility report, opens it read-only, and creates a portable copy using a copy-on-write publisher. The source remains unchanged on every failure. The candidate is reopened by a fresh reader and compared with the expected semantic revision before promotion.

## Included

- Resolve actual production file identity and current schema from repository HEAD.
- Add bounded preflight with structured diagnostics.
- Add capability table or adapter only if consistent with accepted architecture.
- Implement portable candidate publication from the working database.
- Validate SQLite integrity and repository semantic invariants.
- Reopen in a fresh process or isolated worker.
- Compare expected project ID, revision, canonical state, and required assets.
- Promote atomically where platform supports it.
- Add golden healthy, truncated, wrong-ID, unsupported-required-capability, missing-asset, and failed-promotion fixtures.
- Add UI for verdict, publication phases, failure, source preservation, and details.

## Excluded

- New production application ID without repository decision.
- Wholesale schema replacement.
- Collaboration backend.
- General vehicle, aerospace, or city modelling.
- Proprietary imports.
- AI commit before Review Centre integration.

## Acceptance

1. Current repository tests remain green.
2. A healthy golden file opens and republishes to a byte-valid portable copy.
3. Fresh-reader semantic comparison passes.
4. Every damaged fixture returns the expected stable diagnostic.
5. Source and prior valid destination hashes remain unchanged on forced failure.
6. Browser tests cover the supported storage path and at least one mobile acquisition flow if mobile is in current release scope.
7. Evidence records name immutable HEAD, commands, exit codes, fixtures, and limitations.
