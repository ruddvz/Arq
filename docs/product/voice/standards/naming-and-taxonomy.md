# Naming and taxonomy standard

Naming is a product contract, not a copy preference.

## Rule

One concept gets one canonical visible name per context.

Aliases may improve search, support understanding, import mapping, or migration. They do not automatically become second UI labels.

## Brand

- **Arq**: running prose and UI.
- **ARQ**: wordmark reproduction, formal all-caps asset/spec identifiers, or an existing identifier that is literally uppercase.
- **`.arq`**: native file extension.
- Do not use **Arc** as the product name. `arc` remains a legitimate geometry term when referring to an actual curve primitive.

## Product layers

Use these words precisely:

- **project**: the semantic architectural project.
- **project file**: the portable `.arq` file.
- **working copy**: session-local working representation used while editing.
- **local journal**: ordered local persistence/recovery record where applicable.
- **local save**: persistence on the user's device.
- **sync**: remote synchronisation.
- **recovery**: restoration after interruption or failed session.
- **snapshot**: recorded project state for system/history purposes.
- **revision**: meaningful project state used for review/comparison.
- **view definition**: semantic saved view.
- **view tab**: one open UI instance of a view.
- **derived data**: recomputable projection, mesh, index, thumbnail, or similar cache.

Do not collapse these terms.

## Architectural objects

Use semantic nouns where the model knows the object:

- Site
- Building
- Level
- Grid
- Wall
- Opening
- Door
- Window
- Slab
- Room
- View
- Sheet
- Annotation
- Dimension

Do not call a semantic wall a “line” merely because it renders as linework.

Do not call an underlay a “model”.

## Type and instance

Use:

- **Type** for reusable type-level definition/properties.
- **Instance** for the placed object.
- **Inherited** for a value from its type.
- **Override** for an instance-level departure.
- **Calculated** for a derived read-only value.
- **Imported** for a value retained from external data.
- **Missing** for absent required/expected data.
- **Invalid** for a value that exists but fails a rule.

## UI layers

Canonical mode names:

- Design
- Document
- Inspect
- Review
- Present

Canonical panel names and tabs come from workspace registries.

Do not rename a panel in help text because a more conversational word sounds nicer.

## Tool names

Tool names come from the workspace tool registry.

Command palette entries may be action phrases:

- Tool: **Wall**
- Command: **Activate Wall tool**
- Search aliases: wall draw, draw wall

Only the first is the visible tool noun.

## Review nouns

- **Comment**: discussion.
- **Issue**: actionable tracked problem.
- **Warning**: non-blocking detected condition.
- **Validation error**: blocking condition.
- **Model health**: grouped status/report, not a quality score.
- **Revision compare**: comparison between project revisions.

Do not call every problem an “issue” if the product distinguishes validation, warning, comment, and issue.

## Files and exchange

- **Underlay**: reference-only image/PDF.
- **Import**: external data entering Arq through a conversion/mapping process.
- **Import report**: what was preserved, converted, approximated, flattened, omitted, unsupported, opaque, or failed.
- **Export**: external representation written from Arq.
- **Export report**: what was included, omitted, warned, or failed.
- **Native project**: `.arq`.
- **Reference file**: external input retained as reference.
- **Source file**: external input before conversion.

## Naming new things

Before adding a new visible noun:

1. search machine registries;
2. search this ontology;
3. check whether it is a state, action, object, role, format, or surface;
4. reuse the canonical word if meaning matches;
5. if meaning differs, define the distinction;
6. add aliases only for search/support;
7. add the term to canonical structured data;
8. add a drift test where possible.

Do not solve ambiguity by adding adjectives everywhere. Solve the underlying taxonomy.
