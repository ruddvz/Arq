# What Version 2.0 fixes in the first Arq voice system

## 1. “Voice” was still too prose-centric

Version 1.0 had strong writing rules but a thin canonical terminology list.

Version 2.0 adds a product ontology spanning:

- semantic model entities;
- modes;
- views/tabs;
- panels;
- tools;
- roles;
- state machines;
- file states;
- exchange formats;
- fidelity outcomes;
- claims;
- support intents;
- AI proposal states.

## 2. Snapshot facts could become a second source of truth

The old `canonical-facts.json` mixed normative rules with current repo facts.

Version 2.0 moves current facts into dated snapshots and adds refresh/freshness tooling.

## 3. No explicit conflict state existed

A support bot cannot safely handle contradictory sources by choosing one.

Version 2.0 introduces:

- `CONFLICTED` fact state;
- conflict register;
- “do not promote conflict to CURRENT” rule;
- generated-source hashing.

## 4. Future support was not defined

Support needs a different surface than marketing or UI.

Version 2.0 adds:

- support intent vocabulary;
- safe diagnostic information rules;
- current/planned handling;
- security escalation rules;
- alias resolution;
- bug versus limitation vocabulary.

## 5. Future product AI needed a stricter language contract

Version 2.0 makes the voice system consumable by future AI without granting the AI extra authority.

It defines:

- request;
- assumptions;
- base revision;
- proposed operations;
- affected objects;
- validation;
- document impact;
- approval;
- provenance;
- stale proposal;
- grouped undo.

## 6. Internal states lacked a canonical translation table

Version 1.0 told writers to be precise but did not map every known state.

Version 2.0 adds `state-language-map.json`, including workspace, save, sync, issue, AI, long-task, file flow, and `.arq` safe-mode states.

## 7. Permissions were not first-class

Version 2.0 imports the canonical five roles and action matrix so UI/support can distinguish:

- unavailable capability;
- permission denial;
- offline dependency;
- validation block;
- unconfigured service.

## 8. Interoperability needed a controlled vocabulary

Version 2.0 formalises:
preserved, converted, approximated, flattened, omitted, unsupported, opaque, failed.

## 9. No systematic “change impact” model

Version 2.0 maps canonical-source changes to all dependent language surfaces and future bot context.

## 10. Machine validation was too regex-heavy

Version 2.0 keeps conservative pattern checks, but adds structural checks:

- canonical JSON validation;
- repo registry drift verification;
- state coverage;
- role/permission freshness;
- source hashing;
- snapshot freshness;
- required high-risk templates.

## 11. CI freshness could be accidentally self-healing

A draft CI flow refreshed generated context before verifying freshness. That would hide stale committed context.

Version 2.0 corrects the sequence: CI verifies the committed context without refreshing it. Developers refresh intentionally after source changes and commit the reviewed result.

## 12. Persistence terminology needed tier awareness

The current IndexedDB journal and the native `.arq` SQLite/OPFS direction are not treated as interchangeable. The system now blocks the generic inference that any successful local persistence event means the portable project file itself has been published.

## 13. Support/AI needed answerability states

Version 2.0 defines ANSWER, QUALIFY, CONFLICT, UNKNOWN and REFUSE_AUTHORITY so future systems can distinguish uncertainty from capability and professional-authority limits.

## 14. Retrieval needed domain routing

The knowledge-domain map sends questions to the appropriate canonical sources instead of expecting one giant FAQ to contain every changing fact.
