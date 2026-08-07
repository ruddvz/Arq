# Segments, packs, and codecs

Defined candidate segment families: Manifest, Semantic Objects, Operation Groups, Revisions, Geometry Recipes, Kernel Payloads, Assets, Evidence, Index, Signature, and Extension.

Canonical segments MUST use registered deterministic encodings. Derived index and cache segments MAY use optimised encodings. Codecs have stable registry IDs, versions, limits, and licence metadata. A reader MUST reject duplicate canonical object IDs with different bytes.
