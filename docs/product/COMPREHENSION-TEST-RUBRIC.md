# Comprehension-test rubric for the public site

The UI/UX audit's comprehension tests ask whether a reader can correctly
answer a specific, factual question after roughly ten seconds on a page,
using only what is visible without scrolling: the hero and the first note
below it (the state marker, on a capability page).

Genuine reading comprehension cannot be automated; there is no reader to
test. What this document does instead is two things a self-check can
actually verify:

1. State the rubric: for each page family, what question a first-viewport
   read should let a reader answer, and why that question is the right one
   for that family.
2. Run a grounded self-check: quote each page's actual hero and first-note
   text as it renders today, and judge whether that text answers the
   family's question without requiring the reader to infer, guess, or
   scroll further.

A "pass" below means the actual copy states the answer plainly. A page
would fail this check if the hero and first note left the question
genuinely ambiguous, contradicted each other, or answered a different
question than the one the family rubric asks. Any failure found here would
need a copy fix, not a rubric change, since the rubric is what the language
system's claim bindings already require these pages to state.

## The rubric, by family

Families are the `family` field on `PageMeta`
(`apps/marketing/src/site.ts`), rendered as `family-story`,
`family-capability`, `family-operational` and `family-reference` on
`<main>`. Each family carries a different reader question because each
answers a different kind of doubt.

| Family                                                             | Reader's doubt on arrival                              | First-viewport question the page must answer                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `story` (home, product, architects, students)                      | "What is this, and is it for me?"                      | What is ARQ, and does it currently do the thing I'd want it for?                  |
| `capability` (collaboration, ai, interoperability, ipad, security) | "Does this specific feature work today?"               | For this one capability, what exists now versus what is planned?                  |
| `operational` (pricing, changelog, status, contact)                | "What is the current state of this operational fact?"  | What is true right now (a date, a price, a status), stated without a sales pitch? |
| `reference` (docs, privacy, terms, open-source)                    | "Is this an authoritative document or informal notes?" | What is this document's own status, and where is the authoritative version?       |

Capability pages are the sharpest case because they are where an overclaim
is most damaging: a reader deciding whether to rely on a specific feature.
That is why capability pages, and only capability pages, carry a `kind:
'state'` marker on the first note (`apps/marketing/src/components.ts`) as a
structural signal, not just a copy choice, that the first thing after the
hero is a state statement.

## Self-check: capability pages (hero + state-marker note)

### `/security`

- Hero: "Your drawings are the asset. Act like it." / "ARQ's strongest
  security property is architectural: there is no account system and no
  ARQ server, so the most common cloud failure modes have nothing to
  reach."
- State note ("What the current architecture means"): "The development
  build has no account system, no ARQ backend and no sync transport. It
  stores its work on your device... There is no server on ARQ's side to
  breach because there is no server."
- Question: does ARQ have server-side security exposure today?
- **Pass.** The hero and the state note both state, in plain declarative
  sentences, that there is no server and no account system today. A
  reader cannot come away thinking there is a cloud backend to worry
  about.

### `/ai`

- Hero: "AI has to show its working before it changes anything." / "No
  AI-driven authoring is available in the ARQ product."
- State note ("What exists in the repository"): "This is library code, not
  a product feature. The web application does not provide its project
  host... A proposal cannot change a user's project through the current
  product."
- Question: can AI currently edit my ARQ project from the product?
- **Pass.** The hero's second sentence is a direct negative answer before
  the reader even reaches the note, and the note repeats it from a
  different angle (library code versus product feature) rather than
  softening it.

### `/collaboration`

- Hero: "Review first. Co-authoring when it is safe." / "ARQ is scoped to
  build that first, and treats simultaneous editing as the hard problem it
  is."
- State note ("The order of arrival"): "Everything in this list is release
  scope. None of it is available in the current development build."
- Question: can I share a project or co-edit with someone today?
- **Pass.** The note's opening sentence is an explicit blanket negative
  ("none of it is available") stated before the list of future features,
  so a skim cannot mistake the list for current capability.

### `/interoperability`

- Hero: "Format support, stated exactly." / "This table is mirrored from
  the repository's format support matrix, and the site's tests fail if a
  claim here outruns it."
- First note ("The support matrix"): "The scope column is release scope.
  It states when a format is planned to become usable in the product, not
  what the current development build can open today."
- Question: which file formats can I actually open in ARQ right now?
- **Pass.** The prose already draws the "scope" versus "library adapter"
  versus "product feature" distinction correctly. This page's first note
  did not carry the `kind: 'state'` marker its sibling capability pages
  have (it predates that marker's introduction); that has been corrected
  as part of this check so the structural signal now matches the other
  four capability pages.

### `/ipad`

- Hero: "The site desk is a desk too." / "The browser build already lays
  itself out for touch. The native features that need Apple's APIs come
  later, in the open."
- State note ("In the browser now"): "The development build's workspace
  detects a coarse pointer and re-composes... The layout is exercised by a
  headless-browser check in the repository across the viewport set... That
  check is the evidence behind this paragraph."
- Question: does ARQ have real native iPad features (Files, Pencil,
  RoomPlan) today, or just a responsive browser layout?
- **Pass.** The hero draws the browser/native line before the note, and
  the note names the actual current capability (touch-responsive browser
  layout) with its evidence, leaving native features to the second note
  which is explicitly titled "Native, when it can be real."

All five capability pages pass: a reader who reads only the hero and
first note can correctly answer whether the specific capability works
today.

## Self-check: story, operational and reference families (hero only)

These families don't carry a `state` marker convention, so the check here
is lighter: does the hero alone correctly frame the family's question.

| Page             | Family      | Hero states                                                                                                                                                            |
| ---------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`              | story       | "the current development build lets you draw walls in a plan and keeps those edits on your own device" — current scope named plainly.                                  |
| `/product`       | story       | "ARQ starts where architectural work starts: the floor plan" plus an explicit release-ladder pointer — what it is and that more is scoped, not shipped.                |
| `/architects`    | story       | "aimed at residential work and small practices... it is still pre-release" — audience and status both stated.                                                          |
| `/students`      | story       | "ARQ has no separate student edition. It is one pre-release tool with one set of stated limits" — pre-empts the "is there a student version" question directly.        |
| `/pricing`       | operational | "Not priced yet." / "no published plans, no tiers and no prices" — a one-line current fact, no sales framing.                                                          |
| `/status`        | operational | "No hosted service is running." — the operational fact stated as the heading itself.                                                                                   |
| `/changelog`     | operational | "No public release has shipped. Until one does, this is the development log." — status before the entries.                                                             |
| `/contact`       | operational | "ARQ is pre-release and has no sales team or support desk." — sets the expectation before listing routes.                                                              |
| `/docs`          | reference   | "Documented before it is finished." — names the documentation's own maturity.                                                                                          |
| `/legal/privacy` | reference   | "No formal notice yet. Here is what can be stated." — states its own non-authoritative status in the heading.                                                          |
| `/legal/terms`   | reference   | "No published terms yet." / "none of it is an agreement" — same pattern.                                                                                               |
| `/open-source`   | reference   | "This list is generated from the software bill of materials for this build" — names its own generation source, establishing it as a record rather than marketing copy. |

All twelve pass their family's question from the hero alone. The pattern
across every family is the same one the language system enforces
structurally: the first thing a reader sees states current status before
any forward-looking scope, so a ten-second read cannot mistake plan for
fact.
