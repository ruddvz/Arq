# Senior review of Arq Language System 3.0

## Verdict

3.0 made the language system traceable to source context, states, conflict gates
and claim bindings. It still left one public-facing failure mode: technically
governed copy could be generic, repetitive or falsely authoritative while
passing truth-state checks.

4.0 closes that gap without pretending a phrase matcher can identify authorship.
It treats the supplied editorial reference as a quality signal: copy must be
specific, evidence-led and reviewed by a person when judgement is required.

## Findings closed in 4.0

| Priority | Finding                                                                                                      | Risk                                                                               | 4.0 control                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| P0       | No explicit boundary between copy quality and AI-authorship detection.                                       | Teams can optimise for detector scores instead of truthful writing.                | Canonical editorial-authenticity policy with explicit non-goals.      |
| P0       | Public content bindings do not prove every marketing file has been reviewed.                                 | New or renamed pages can bypass claim governance.                                  | Exact public-copy inventory with a live directory completeness check. |
| P1       | 3.0 catches hype but not generic significance, vague attribution, canned assurance or formulaic conclusions. | Copy can sound polished while carrying little evidence.                            | Review-required editorial pattern rules and fixtures.                 |
| P1       | Review acknowledgements do not demand a reviewer role or evidence path.                                      | Warnings can become permanent exceptions.                                          | Thirty-day acknowledgement contract with evidence and role fields.    |
| P1       | The documented installation command has no integrated-check implementation.                                  | A team can run a reassuring command that does not verify the installed repository. | Standalone integration contract and repository installation verifier. |
| P2       | Public-page review has no explicit isolation test for headlines and cards.                                   | A short fragment can overclaim when detached from its body copy.                   | Page-evidence standard and review checklist.                          |

## Remaining repository blockers

The existing 3D, persistence, native-opening, import/export, hardware, privacy
and future-AI conflicts remain product decisions. 4.0 does not resolve them by
rewriting prose. Their claim gates still block stronger public language.

## Acceptance criteria

Activate 4.0 only when the live checkout passes source freshness, canonical data,
state adapters, conflicts, claim bindings, public-copy inventory, editorial
policy, rendered-page checks and the normal product test suite from one revision.
