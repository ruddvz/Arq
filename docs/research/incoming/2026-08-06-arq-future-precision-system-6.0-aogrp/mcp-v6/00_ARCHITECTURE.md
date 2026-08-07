# MCP architecture for ARQ-native packs

MCP exposes ARQ domain resources and tools, not pack implementation details.

Resources include revision-pinned project summary, type registry, selected entities, diagnostics, fidelity reports, and proposal artefacts. Tools include begin proposal, add typed operation, validate, preview, request bounded analysis, submit review, and inspect migration. Raw segment write, raw SQL, raw file mutation, approval, and commit bypass are not model-callable.

Long-running imports, geometry, repack, and simulations use explicit tasks. Task outputs remain isolated until reviewed. Grants bind project, revision, object scope, operation types, domain packs, byte limits, task limits, export rights, and expiry.
