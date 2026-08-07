# Assets, chunks, and large arrays

Assets are content-addressed chunks with media type, codec, size, privacy class, and optional external location. Large arrays use chunk grids and registered codec chains. Semantic objects reference asset manifests, not mutable paths. Missing required chunks produce a bounded diagnostic and preserve the source.
