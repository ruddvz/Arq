# Context assembly for future support and AI

## Goal

Future systems need one compact context without creating a second manual source of truth.

## Two bundles

### Normative language context

Built from:

- system map;
- product ontology;
- state map;
- roles/permissions;
- format language;
- aliases;
- claim registry;
- error taxonomy;
- surface contracts;
- surface register;
- knowledge-domain routing;
- answerability policy;
- change-impact/dependency maps;
- support intents.

This is created by:
`03-machine-layer/build-language-context.mjs`

### Live repository context

Generated from the actual repository using:
`03-machine-layer/refresh-repo-context.mjs`

This includes source hashes and machine registries.

## Required gate

A future bot must not treat changing repo facts as current unless:
`verify-repo-context.mjs` passes for the context it received.

## Retrieval order

For a question:

1. normative ontology/state map;
2. fresh live repo context;
3. relevant approved source document;
4. current code/test evidence for disputed reachability;
5. public copy only as a dependent example.

## Never retrieve by popularity

Do not prefer a sentence because it:

- appears on more pages;
- appears in marketing;
- is more recent without authority;
- is more confident;
- contains the user's exact wording.

Source authority and state control first.
