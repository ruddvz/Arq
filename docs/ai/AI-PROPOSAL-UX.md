# AI proposal UX

Show:

- original request;
- parsed intent;
- assumptions;
- affected elements;
- exact operations;
- before and after;
- warnings;
- visual preview;
- Apply;
- Edit request;
- Reject.

First public AI feature:

- explain the selected object and its warnings.

`explainSelection` (`packages/operations/src/explain-selection.ts`, ARQ-169)
prototypes this: what the object is, inherited properties, overrides,
host, relationships, and warnings - all built from property groups this
repository already computes (ARQ-130 through ARQ-134), not a new data
source. "Effect of changing a property" (section 100's own list) is
deliberately not included - it needs a real preview of a hypothetical
property change's invalidation set, which does not exist anywhere in this
repository yet; see the module's own doc comment.

Second:

- one bounded modification.

Do not begin with automatic whole-building generation.
