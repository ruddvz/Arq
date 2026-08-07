# Operations, snapshots, and undo

ARQ should not choose between an operation log and snapshots as if only one can exist. Typed operation groups provide intent, provenance, validation, collaboration, and grouped undo. Canonical snapshots bound replay cost and preserve independently verifiable state. Revision objects reference both accepted operation groups and a semantic state root.

Operations that depend on unstable geometry must record selectors and preconditions. Replaying invalid history must stop rather than silently producing a different model.
