# arq-core

Shared deterministic core (ADR-0020, ARQ-203): canonical numeric normalisation,
deterministic record ordering, and semantic hashing. Deliberately narrow - does not
implement the full module list `docs/architecture/SHARED-RUST-CORE.md` describes
(ids/model/operations/sync/geometry2d/diagnostics), only what the file-system
prototype (ARQ-195-199) actually needs, and does not replace TypeScript UI or
renderer code.

## Modules

- `units.rs` (ARQ-224): `mm_to_canonical_micrometres`/`canonical_micrometres_to_mm` -
  the D-014 decision (float mm at runtime, integer µm i64 at the canonical/hash
  boundary), implemented once so every target uses the same rounding rule.
- `ordering.rs` (ARQ-225): `canonical_sort_ids` - byte-wise UTF-8 comparison, chosen
  specifically because JS's default string comparison (UTF-16 code units) can
  disagree with it for characters outside the Basic Multilingual Plane.
- `hashing.rs` (ARQ-200): `semantic_hash` - SHA-256 over already-canonicalised bytes.
- `wasm_bindings.rs` (ARQ-204): thin `#[wasm_bindgen]` wrappers, no logic of their
  own - `native ↔ WASM ↔ real browser Worker` parity is checked directly by
  `scripts/verify-arq-core-wasm-parity.mjs` and
  `scripts/run-arq-core-worker-capability-check.mjs`, not assumed.
- `ffi.rs` (ARQ-205): plain C ABI for a native desktop shell or a Swift bridging
  header - see `docs/architecture/ARQ-CORE-FFI-BOUNDARY.md` for what is and is not
  verified about it here (no real Xcode/Swift/iPad in this sandbox).

## Building

```sh
cargo test                                    # native tests (25 tests)
node ../../scripts/build-arq-core-wasm.mjs    # regenerates pkg/ (gitignored)
node ../../scripts/verify-arq-core-wasm-parity.mjs         # Node vs. native parity
node ../../scripts/run-arq-core-worker-capability-check.mjs # real browser Worker
```

`pkg/` is a regenerable build artifact (`wasm-bindgen` output), not committed - see
`.gitignore`.
