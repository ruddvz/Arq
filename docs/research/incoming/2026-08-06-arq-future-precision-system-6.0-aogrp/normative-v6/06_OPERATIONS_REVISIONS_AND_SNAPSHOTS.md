# Operations, revisions, and snapshots

One accepted atomic operation group creates one revision. The group includes base revision, read set, write set, preconditions, typed payloads, affected domains, validation requirements, provenance, and inverse behaviour where meaningful. A failed group creates no revision and changes no accepted canonical state. Snapshots are canonical state objects linked to revisions, not untracked database dumps.
