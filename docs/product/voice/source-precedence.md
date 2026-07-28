# Source precedence and conflict policy

## Different questions have different authorities

Do not flatten all sources into one ranking.

### “What architecture/product decision is approved?”

1. Accepted ADR.
2. Approved/consolidated product blueprint where no ADR supersedes it.
3. Package/schema/specification for the relevant boundary.
4. Historical planning only as context.

### “What works in the product today?”

1. Working user-reachable code plus relevant tests.
2. Capability/runtime registries that accurately represent shipping reachability.
3. `STATUS.md`.
4. Changelog/current public copy.

A package parser existing is not user-reachability evidence.

### “What is the visible name?”

1. Machine registry owning that class of object.
2. This language system's canonical mapping/alias registry.
3. Existing UI/doc copy.

### “What is planned?”

1. Accepted ADR where scope decision is architectural.
2. Current release scope.
3. Current blueprint.
4. Public roadmap copy.

### “Who can do this?”

1. RBAC/security policy.
2. Product copy.

### “What format role/status is committed?”

1. Current format support matrix plus current adapter/product reachability.
2. Public interoperability copy.

## Conflict state

When two maintained sources disagree materially, the fact becomes `CONFLICTED`.

A retrieval system must not:

- choose the newer sentence merely because it is newer;
- choose the more confident sentence;
- average the two;
- silently convert one into a caveat.

Resolve with the correct authority for the question.

For current capability, working code/tests win over stale summary text.

## Public/support rule

A `CONFLICTED` fact cannot be promoted to a confident public/support CURRENT answer.

Allowed:

> Repository status text is inconsistent on whether this surface is currently wired. The working build/code is the deciding source.

Better: fix the source conflict and regenerate context.

## Existing copy

Existing copy is always a dependent, never an authority for underlying capability.

Repeated text does not become true through repetition.
