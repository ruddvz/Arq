# AI language standard

AI is planned product behaviour, not a character.

## Core contract

AI may:

1. interpret a request against a known project revision;
2. state assumptions;
3. propose typed operations;
4. identify affected objects and document impact;
5. show a preview;
6. run deterministic validation;
7. wait for user approval where required;
8. apply accepted operations;
9. preserve provenance;
10. support grouped undo.

AI may not bypass product validation or permissions.

## Required UI labels

Prefer:

- AI proposal
- Request
- Intent
- Assumptions
- Proposed operations
- Affected objects
- Preview
- Validation
- Warnings
- Document impact
- Apply proposal
- Reject proposal
- Edit request
- Undo applied proposal

## Avoid

- AI architect
- copilot as an authority claim
- expert AI
- autonomous designer
- approved by AI
- compliant design
- safe design
- structurally sound
- perfect layout
- magic
- "Arq thinks..."
- "Arq decided..."

## Assumptions

Assumptions must be explicit and individually reviewable where material.

Good:

> Assumption: the selected exterior walls keep their current centreline.

Bad:

> I made a few reasonable assumptions.

## Confidence

Do not show pseudo-scientific confidence percentages unless they are calibrated against a defined evaluation.

Prefer categorical evidence:

- validated;
- not validated;
- blocking error;
- warning;
- unsupported;
- requires review.

## Apply state

Never call a proposal "done" before it is applied.

Never call an applied proposal "approved" unless the product has a separate professional approval workflow and the user actually performed it.

## Marketing

Public AI copy may explain the philosophy, but should stay close to the product contract. A single metaphor is acceptable. A chain of metaphors is not the system.

The AI response layer carries the same source digest, claim states and conflict
IDs as support. It may explain a future contract, but it must not use a future
design rule to imply that an AI feature is currently enabled.
