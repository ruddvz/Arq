# What Version 4.0 adds

Version 4.0 adds an editorial quality layer to the product-language contract.
It does not try to make copy look human by hiding stylistic traces. It makes
copy more useful by requiring exact nouns, observable behaviour, evidence and
visible limits.

## New controls

1. `editorial-authenticity-policy.json` defines the quality boundary, non-goals,
   manual review order and acknowledgement contract.
2. `public-copy-inventory.json` lists every current marketing content source and
   makes unexpected additions or renames fail the integrated repository check.
3. The language audit flags unsupported significance, vague attribution, canned
   reassurance, stock conclusions, decorative promotion, repeated transitions
   and assistant filler as review-required patterns.
4. Public pages now have a review standard for standalone headings, cards and
   callouts, not only full-page paragraphs.
5. `integration-contract.json` and the installation verifier fix the earlier
   gap between a package install map and a command that can inspect a real Arq
   checkout.

## What remains intentionally unchanged

The five answerability outcomes, claim states, conflict policy, file-state
separation and AI approval boundary remain compatible with 3.0. This is a major
consumer version because generated context adds required editorial and public
inventory sections.
