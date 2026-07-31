---
name: zeus-method-selection
version: 5.0.0
project: Arq
---

# Method selection

Zeus 4 routed domain knowledge but never selected a reasoning method, so how hard to
think was left entirely implicit. Zeus 5 selects a method stack the same way it selects
modules: deterministically, from a registry, with the selection visible.

`.zeus/method-registry.json` holds 98 retained methods (94 distinct behaviours plus 4
aliases) in 8 families.

## How a stack is built

1. **Scope gate.** Each method declares scopes: `eng`, `arch`, `prod`, `comm`, `mkt`,
   `learn`, `fmt`. The task's scope set comes from its mode and its routed modules. A
   method is selectable only if a scope matches. This is why `/viralhooks` is never
   offered for a geometry defect, and it is the main improvement over a flat list.
2. **Primary.** The highest-scoring triggered method, if it scores at least 2.
   Otherwise the mode default: `DEBUG` for a defect, `REVERSEENGINEER` for an
   implementation with no defect signal, `/critique` for an audit, `CHECKLIST` for a
   release, `OODA` for an incident, `/firstprinciples` for a plan.
3. **Supporting.** Triggered methods by score, capped by the tier budget: 2 for fast, 4
   for standard, 8 for deep.
4. **Risk-mandated.** High risk adds `RISKMAP` and `SECONDORDER`. Critical adds
   `REDTEAM`, `BLACKSWAN` and `/reverse` on top.
5. **Formatting last.** Formatting methods only appear when the request actually asks
   for that shape.

## Inspecting a selection

```bash
node scripts/zeus.mjs method --task "the wall join breaks at obtuse angles"
node scripts/zeus.mjs method --list --family decide
```

`method` prints why each entry is in the stack: which trigger fired, or which mode or
risk level mandated it.

## Selection discipline

- Select a method because it changes the result, not to look rigorous.
- Never display method labels in operator-facing output as decoration. The operator
  asked for working software, not a list of acronyms.
- Evidence and the invariant register outrank every creative or persuasive method. A
  method cannot argue a claim into being verified.
- `/godmode` means full appropriate rigour within the requested scope. It does not mean
  unlimited scope, unlimited budget, or claims beyond the evidence.

## Why all 98 were kept

The reference package insisted on retaining all 98, including growth-marketing methods
with no place in a CAD kernel. Retaining them costs nothing as data, and this repository
does ship `apps/marketing`, so some genuinely apply there. The fix is not deletion but
scope gating: coverage without noise. Aliases (`HOOK10`, `TESTME`, `/socratic`,
`/stepbystep`) are marked with `aliasOf` rather than pretending to be distinct methods,
so the honest count of distinct behaviours is 94.
