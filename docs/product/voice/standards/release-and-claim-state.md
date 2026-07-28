# Release and claim-state language

Every capability claim belongs to one of these states.

## CURRENT

User-reachable in the current product flow and backed by code/tests.

Present tense is allowed.

## LIBRARY_ONLY

Implemented/tested as a package or internal component but not reachable end to end by users.

Required phrasing includes the reachability limit.

## DESIGNED_GATED

UX/spec/registry exists, but capability is not enabled by current implementation evidence.

Do not use as a shipping claim.

## PLANNED

Committed in current release scope/approved plan.

Use future/roadmap language.

## DEFERRED

Explicitly postponed beyond current releases.

Do not say “coming soon”.

## NOT_COMMITTED

Discussed or supported through an external strategy, but not promised.

Use this state for current DWG/RVT positioning.

## PROHIBITED

Claim conflicts with product/professional/safety boundaries.

May appear only in negation/disclaimer/context where needed.

## UNKNOWN

No product decision exists.

Pricing is a canonical example until approved.

## VOLATILE

True now but likely to drift quickly:

- exact test counts;
- package counts;
- performance values;
- benchmark numbers;
- supported environment lists;
- user/project counts.

A VOLATILE public claim requires generated data or a freshness guard.

## Evidence requirement

A public CURRENT claim should record:

- evidence source;
- reachability proof;
- last verified date/commit where practical.

If evidence is ambiguous, weaken the claim before strengthening the evidence.
