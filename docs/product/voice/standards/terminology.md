# Arq terminology system

The canonical terminology system is split deliberately.

- `product-ontology.json` owns semantic product objects.
- live workspace registries own tools, panels, views, states, and surfaces.
- `terminology.json` owns cross-domain controlled vocabulary.
- `term-aliases.json` owns recognition/search aliases.
- `state-language-map.json` translates internal states into user-facing wording.
- `roles-permissions.json` owns role names and allowed action matrix.
- `format-language-map.json` owns format and fidelity vocabulary.

## Why split it

One giant glossary would become a stale second implementation registry.

Arq should reuse machine sources where they already exist and use the voice system to define meaning around them.

## High-risk distinctions

### Project / project file / working copy / journal

These refer to different layers. Do not say “file” when the project semantic state is meant, and do not say “project saved” when only a journal write is known.

### View / view tab

Closing a view tab does not delete the semantic view definition.

### Save / sync

Saved locally can coexist with Offline or Sync failed.

### Warning / validation error / Issue / Comment

These are four separate product concepts.

### Compatible / opened

A `.arq` file can pass compatibility/preflight checks without being loaded into a live project.

### Read-only / safe mode

“Safe mode” is internal mechanism vocabulary. User copy should say why the project is read-only.

### Import / underlay

An underlay remains reference-only. An imported semantic object has undergone a mapping/conversion process.

### Proposal / applied operation

An AI proposal is not a project change until accepted operations commit successfully.

### Revision / snapshot / app version / file-format version

Use the word matching the actual system concept.

## Tool vocabulary

Tools use exact registry names.

Do not create a second visible name to make copy sound more natural. Put alternate phrases into aliases/search synonyms.

## Support alias resolution

A future support bot may recognise non-canonical words, but must resolve ambiguity before giving instructions.

Examples:

“floor”

- Level/storey?
- floor/slab object?
- floor plan view?

“page”

- Sheet?
- PDF page?
- website page?

“model”

- semantic model?
- 3D view?
- imported reference/model?

“save”

- local save?
- export?
- download archive?
- remote sync?

The support system should clarify or infer from strong context, then answer with canonical terminology.
