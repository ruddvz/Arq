# AI benchmarks (ARQ-168)

Reconciled against blueprint section 103 ("Evaluation") - this file
already existed with a shorter, differently-worded draft list (9
categories, 9 metrics) before this issue; the categories/metrics below are
section 103's exact wording, all ten of each.

## Categories (test)

- text to wall;
- modify wall;
- place opening;
- room adjacency;
- constraint satisfaction;
- ambiguous request;
- invalid request;
- multi-step revision;
- error explanation;
- schedule generation.

## Metrics (measure)

- dimensional accuracy;
- semantic accuracy;
- valid geometry;
- assumptions;
- user corrections;
- time saved;
- operation latency;
- rejection quality;
- crash rate;
- undo success.

## What is actually measured today

No live AI/natural-language layer exists in this repository (section
97's "user request" -> "intent extraction" steps are not implemented) -
`@arq/arqscript`'s real, deterministic pipeline (`parseArqScript`, ARQ-167)
is what these ten benchmarks measure, using a fixed ArqScript document per
category standing in for "what an AI would have produced." See
`packages/arqscript/src/arqscript-benchmark.test.ts` for the runnable
tests and `docs/research/AI-BENCHMARK-RESULTS.md` for the full write-up,
including three categories (constraint satisfaction, schedule generation,
and the cross-reference half of ambiguous request) whose honest,
deterministic result today is "not yet built" rather than a fabricated
pass - `user corrections` and `time saved` are real-usage metrics no
automated benchmark can measure at all and are marked not applicable
here, not estimated.
