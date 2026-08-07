# Garbage collection and repack

Reachability begins at retained revision refs, recovery checkpoints, signed releases, pinned external references, and recovery policy roots. Repack may reorder, compress, shard, or delta-encode objects without changing content IDs. Deletion requires a retention policy and source-preserving evidence. Interrupted repack cannot damage the existing file.
