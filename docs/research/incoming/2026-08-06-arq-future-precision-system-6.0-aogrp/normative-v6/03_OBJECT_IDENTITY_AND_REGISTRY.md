# Object identity and registry

ARQ separates stable entity IDs from immutable content IDs. Entity IDs support design continuity. Content IDs verify exact payloads. Type IDs and schema versions come from a governed registry. Extension namespaces cannot collide with core IDs. Unknown required types block editable open; unknown optional types are preserved opaquely when safe.
