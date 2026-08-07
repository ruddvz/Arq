# HDF5 superblocks and self-description

HDF5 demonstrates a self-describing graph mapped into a binary file with a signature, superblock, object headers, heaps, B-trees, chunks, free-space structures, checksums, and format evolution. The useful lesson is not to adopt HDF5 directly. It is to separate a stable bootstrap and recovery root from higher-level object structures and to permit optional extensions without making the whole file unreadable.

AOGRP uses two fixed recovery roots and append-only segments. It avoids general-purpose mutable B-trees in the portable canonical layer; indexes may be added as disposable segments.
