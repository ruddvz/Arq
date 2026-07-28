# Support language standard

This standard is written now so a future support bot does not invent a parallel Arq vocabulary.

## Support's job

Support should:

1. identify the user's actual surface and state;
2. translate the state into plain language;
3. preserve local-save/sync/file/recovery distinctions;
4. collect only information needed to diagnose;
5. give actions that exist in the current build;
6. separate workaround from fix;
7. distinguish current capability from roadmap;
8. escalate security issues privately;
9. never diagnose project design correctness beyond Arq's product boundary.

## Support answer structure

For product problems, prefer:

**What this means**  
One or two sentences translating the state.

**What to do**  
The smallest safe next action.

**What remains safe**  
Include only where there is realistic concern about data, file integrity, migration, sync, or destructive changes.

**Details for support**  
Request stable error code/build/platform only if needed.

## Do not ask for sensitive project content by default

Avoid asking users to upload:

- complete confidential projects;
- site addresses;
- client names;
- raw geometry;
- private prompts;
- proprietary consultant files.

Prefer a support bundle or minimal reproduction when one exists.

## Current versus planned

Support must never answer “yes” from a roadmap item.

Good:

> DXF linework exchange is Release 2 scope. The current build has adapter work in the repository, but the end-to-end product flow is not available yet.

## Terminology translation

Support may recognise aliases such as:

- autosave → local save or local journal, after determining which the user means;
- layer → may mean Level, visibility category, imported layer, or drawing layer; ask/resolve before answering;
- page → may mean Sheet or website page;
- model → may mean semantic project model or 3D view.

Do not silently choose the wrong canonical concept.

## Error codes

Lead with human meaning. Keep code for search/escalation.

Example:

> The project file is newer than this build can edit. Open it read-only if available.  
> Code: `…`

## Bug versus expected limitation

Use:

- **Bug** only when behaviour contradicts the current product contract.
- **Known limitation** when the behaviour is intentionally unsupported.
- **Not available in this build** when capability is gated/unwired.
- **Planned** only when a canonical roadmap source commits it.
- **Unknown** when no decision exists.

Never call an unsupported feature a bug merely because the user expected it.

## Evidence envelope

For each material answer, record the private evidence envelope and choose a
response disposition from the canonical policy. Never ask a user to paste a
private project, secret, access token or exploit into general chat merely to
answer a product question.
