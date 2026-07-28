# Search, command palette and help language

The command palette is a translation layer, not a second command naming system.

## Result labels

Display the canonical action name from the command/tool registry.

Search synonyms may include familiar external or colloquial terms, but a synonym must not replace the canonical visible label.

Example:

- query synonym: `zoom extents`
- canonical result: `Fit view`

## Disabled results

Keep a result discoverable when that helps the user understand the product, but show the actual disabled reason.

Reasons must distinguish:

- capability not available in this build;
- insufficient role;
- invalid current selection;
- project read-only;
- offline dependency;
- unsupported format;
- blocking validation;
- no project open.

Do not use `Unavailable` alone when a specific reason is known.

## Help search

Help content may recognise aliases and incumbent-software terms. It should answer using Arq concepts first, then explain the mapping.

## No-result state

Say what was searched and provide a safe next step without implying the command exists.

Example:

> No Arq command matches “array path”. Try `Array`, or search documentation.

Telemetry may record only the approved coarse query category, not raw project content or raw prompts.
