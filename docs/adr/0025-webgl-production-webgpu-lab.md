# ADR-0025: WebGL production path and WebGPU laboratory path

**Status:** Approved for Release 1
**Date:** 2026-07-21

## Decision

Use Three.js `WebGLRenderer` as the first production 3D renderer. Maintain a separate
`WebGPURenderer` capability branch and benchmark harness.

Do not make a Release 1 authoring function depend on WebGPU. Promote the newer
renderer only after visual, device, performance and context-loss parity passes.

## Reason

The official Three.js guidance still describes `WebGPURenderer` as experimental and
notes missing features or cases where `WebGLRenderer` performs better, despite its
WebGL 2 fallback.
