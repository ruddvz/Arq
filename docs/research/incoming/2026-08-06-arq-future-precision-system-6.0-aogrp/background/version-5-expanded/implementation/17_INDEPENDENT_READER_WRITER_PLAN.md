# Independent reader and writer plan

A format is not proven by one implementation reading its own output. Build a minimal Rust reader and a TypeScript reader against published test vectors. At least one should not share canonical encoding code with the writer. Compare identity, capabilities, exact quantities, components, relations, revisions, assets, unknown optional data, and diagnostics.
