# Arq language governance

The language system is part of product architecture. It is versioned and reviewed like an interface contract.

## Owners by change type

A code owner or designated reviewer should approve changes that affect:

- canonical terminology;
- current/planned capability state;
- permissions;
- file compatibility or migration;
- import/export fidelity;
- professional/safety claims;
- AI authority or mutation rules;
- privacy/telemetry wording;
- destructive actions;
- support escalation.

## Change classes

### Editorial

Meaning is unchanged. Examples: grammar, punctuation, shorter equivalent wording.

Editorial changes to public copy still require a public-inventory review when
they add, remove or alter an assertion. A phrase-level pattern match does not
establish authorship and must not be used as an authorship label.

### Semantic

A visible term, state meaning, consequence, permission or claim changes.

### Capability

Something becomes current, gated, planned, deferred, unsupported or removed.

### Safety/professional

Affects data-loss expectations, project integrity, security, professional responsibility or AI authority.

Semantic, capability and safety/professional changes require impact review.

## Required PR evidence

For any non-editorial language change, record:

1. source of truth;
2. previous meaning;
3. new meaning;
4. affected surfaces;
5. compatibility/deprecation effect;
6. tests or machine guards changed;
7. support/AI effect;
8. docs/marketing effect.
9. source-set digest refresh requirement;
10. claim bindings and rendered-site impact;
11. support/AI evidence-envelope impact;
12. consumer-contract compatibility impact.
13. public-copy inventory and standalone-fragment impact.
14. editorial-review acknowledgement, evidence path and expiry when applicable.

## Conflicts

A conflict between authoritative sources is a product issue, not a copywriting choice.

Mark the fact `CONFLICTED`, avoid the stronger public claim, open/attach the engineering decision, and remove the conflict only after authoritative sources agree.

## Versioning

Increment the language-system version when a consumer contract, canonical state taxonomy, terminology meaning or machine schema changes.

Editorial-only changes do not require a major/minor semantic version change unless they affect generated artefacts.

Follow `01-standards/language-release-compatibility.md`. A canonical ID removal,
state-meaning change, required message-slot change, answerability change or
source-precedence change is a major consumer-contract change.

## Release gate ownership

An active conflict cannot be closed by a copy-only change. Its resolution record
must identify the required source correction and evidence. A context refresh is
reviewed output, not a clerical self-heal.
