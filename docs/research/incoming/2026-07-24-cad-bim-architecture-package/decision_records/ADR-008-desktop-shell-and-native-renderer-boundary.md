# ADR-008: Desktop shell and native renderer boundary

## Status

Accepted.

## Context

The proposed roadmap described Tauri as a macOS Metal backend and suggested global browser detection and broad security policy. Tauri can provide a native desktop shell, but it does not automatically replace the WebView graphics stack with a custom direct-Metal renderer.

## Decision

Arq treats Tauri as an optional desktop host for the same browser application and renderer. Platform features are exposed through a small capability adapter with a browser fallback. Native window effects are progressive enhancements. A separate native renderer requires its own measured product and portability decision.

## Consequences

- Browser and desktop builds share canonical model semantics and worker protocol.
- Direct usage of undocumented runtime globals is avoided.
- Production CSP and desktop capabilities are reviewed against the actual application, rather than copied from a prototype.
- macOS private API features are opt-in distribution decisions because they affect App Store eligibility.

## References

- [Implementation deep dive](../ARQ_IMPLEMENTATION_DEEP_DIVE.md#6-desktop-shell-and-native-boundary)
- [Native desktop port](../reference/native-desktop-port.ts)
- [Tauri v2 configuration](https://v2.tauri.app/reference/config/)
