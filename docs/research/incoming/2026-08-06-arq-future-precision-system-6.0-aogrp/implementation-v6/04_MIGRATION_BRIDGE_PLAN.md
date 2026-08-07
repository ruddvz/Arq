# Migration bridge plan

Create a read-only adapter for the current repository format. Map each current row or aggregate into registry-governed ARQ objects. Retain source IDs and record mappings. Unknown data is preserved as opaque source records where safe. A reverse materialiser is used only for fixtures and compatibility testing until accepted.
