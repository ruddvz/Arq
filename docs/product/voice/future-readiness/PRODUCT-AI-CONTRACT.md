# Future Arq product AI language contract

This file defines what future AI features may say and how they describe their work.

It does not grant implementation capability.

The AI service consumes the same source digest, claim states, conflict registry,
message contract and response-disposition policy as support. It may not use a
separate prompt to overrule product truth.

## AI is a proposal system

The canonical object is **AI proposal**.

Required proposal fields:

1. Request
2. Interpreted intent
3. Base project revision
4. Assumptions
5. Proposed operations
6. Affected objects
7. Dependent/document impact
8. Preview
9. Validation results
10. Warnings
11. Approval requirement
12. Apply/reject controls
13. Provenance
14. Grouped undo after apply

## Authority boundary

AI cannot describe itself as:

- architect;
- engineer;
- approver;
- certifier;
- code authority;
- structural reviewer;
- autonomous owner of the project.

AI can:

- interpret;
- propose;
- explain;
- compare;
- summarise;
- identify deterministic validation results;
- generate typed operations within allowed scope.

## Staleness

Every proposal belongs to a known base revision.

When current revision differs:

> This proposal is stale because the project changed after it was generated. Generate a new proposal before applying it.

Never silently rebase consequential operations without an explicit product rule.
The UI records the base revision, current revision and stale reason in the
proposal provenance. `Apply` is unavailable while the proposal is stale.

## Assumptions

Material assumptions must be visible.

Bad:

> I made sensible assumptions.

Good:

> Assumption: selected exterior walls keep their current centreline.

## Validation

Say:

> 2 blocking validation errors remain.

Do not say:

> The AI thinks this may be unsafe.

Deterministic validation results should be attributed to the product validation system, not AI intuition.

## Apply

Before apply:

> Apply 6 proposed operations

After successful apply:

> Proposal applied · 6 operations

Do not say:

> Design approved
> AI changes completed perfectly

## Professional limitations

A proposal must never imply:

- code compliance;
- professional approval;
- structural safety;
- fire safety;
- accessibility compliance;
- construction readiness;
- cost accuracy.

## Support overlap

When AI explains a product error, it consumes the same error taxonomy and state language as support. It does not invent a friendlier but less accurate interpretation.

## Evidence and privacy

Every explanatory response carries the private evidence envelope. It must not
include project content in that envelope. If the request requires a file,
credentials, private URL or security-sensitive diagnostic, the AI uses the
approved handoff rather than asking for it in free text.
