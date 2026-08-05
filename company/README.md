# Arq Company Layer

A senior-role workforce for Arq, layered on top of Zeus 5. Zeus classifies, routes,
executes and proves; a company role gives that execution a named senior owner with a
mandate, taste and boundaries. The layer is modeled on the two-layer workforce pattern
(engineering agents below, curated company roles above) and stays deliberately small:
every role earns its file by owning decisions no other role owns.

## How to activate a role

Address it in a prompt, by name:

> Act as the Arq CTO. <task>

The session then loads `.zeus/FAST-KERNEL.md` first (as `CLAUDE.md` already requires),
reads the role file under `company/roles/`, and runs the task through the normal Zeus
contract the `UserPromptSubmit` hook echoes. A role file is a context pack, not a
subagent: it changes judgement and priorities, never the safety rails.

## The three standing rules

1. **Zeus stays underneath.** Every role runs the same contract, evidence states and
   check ladders. A role may raise a tier or add a reviewer; it may never lower one.
2. **Authority is unchanged.** Engineering OS 5.0 owns the merge gate. The Arq Language
   System 4.1 owns public and product wording. The CEO role prioritises; it does not
   merge. The marketing role drafts; it does not re-decide vocabulary.
3. **Only engineering roles write code.** Executive, product and growth roles produce
   decisions, briefs and reviews. When code is needed they hand a linted execution
   package (`node scripts/zeus.mjs prompt-lint`) to an engineering role and show that
   prompt in full before dispatch.

## Files

- `ROSTER.md` - every role, one line each, with its Zeus binding.
- `ZEUS-BRIDGE.md` - how company roles map to `.zeus/role-registry.json` owner roles,
  routed modules and independent reviewer agents.
- `roles/<department>/<role>.md` - the role files.

## Where this layer stops

`business/` and `operations/` hold real business artifacts (pricing research, launch
readiness, support model). This directory holds working roles only; a role that needs a
business fact reads those files, it does not fork them.
