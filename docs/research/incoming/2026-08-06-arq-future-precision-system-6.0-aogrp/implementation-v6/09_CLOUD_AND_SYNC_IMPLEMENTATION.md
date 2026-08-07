# Cloud and sync implementation

The cloud stores immutable objects, revisions, pack segments, and refs. It may keep indexes in a database. It does not require clients to upload the whole file for each change. Authorization is project and revision scoped. Offline changes create revisions that merge through semantic operations.
