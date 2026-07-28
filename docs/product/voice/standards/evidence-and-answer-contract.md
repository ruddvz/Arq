# Evidence and answer contract

This standard applies to support, documentation, marketing review and product
AI. It does not make technical provenance visible by default; it makes every
answer auditable and refreshable.

## One atomic assertion at a time

An answer may contain several facts only if each can be separately evaluated.
For each material assertion, resolve:

- canonical object and user context;
- question type and source precedence;
- claim ID and current claim state, where one exists;
- applicable conflict IDs;
- source-context digest and freshness result; and
- whether the action would exceed Arq's authority.

Never allow a true library-level fact to imply a user-reachable workflow.

## Required private evidence envelope

The answer service stores or passes this metadata with the answer, not necessarily
to the user:

```text
answerabilityOutcome
responseDisposition
claimIds[]
sourceIds[]
conflictIds[]
sourceDigest
languageContractVersion
assertionScope
redactionLevel
```

If a required field is unavailable, the system must not silently emit `ANSWER`.
It must use `QUALIFY`, `CONFLICT`, `UNKNOWN` or `REFUSE_AUTHORITY` as appropriate.

## Evidence freshness

Freshness is binary for a deployed context: the live source digest matches the
committed generated context, or it does not. Do not guess an expiry interval.
If it does not match, downgrade the response and ask the product system to
refresh the context before making a current-capability statement.

## Data minimisation

Support and AI collect only the minimum diagnostics needed for the stated next
step. Project content, credentials, private links and raw file bytes are not
requested in general conversation. Security reports use the approved private
security route. The evidence envelope records only source identity and policy
state, never user project content.
