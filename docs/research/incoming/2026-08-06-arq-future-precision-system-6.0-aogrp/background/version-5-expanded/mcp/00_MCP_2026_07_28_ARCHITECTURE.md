# MCP 2026-07-28 architecture

ARQ uses the current stateless MCP core as a transport boundary. Each call is independently authenticated, versioned, routable, and traceable. Application state is represented by explicit handles. The ARQ domain service remains independent of any one SDK so protocol migrations cannot change canonical semantics.

The server exposes discovery, read resources, narrow proposal tools, bounded analysis tasks, and review-status resources. It never exposes database mutation or deployment tools.
