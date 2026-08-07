# Sync, transfer, and offline behaviour

Peers exchange immutable object IDs, revision IDs, and pack segments. Transfer supports range requests, resumable chunks, verification, and explicit missing-object negotiation. Ordinary authoring remains available offline. Sync conflicts create branch or review states, not silent last-writer wins.
