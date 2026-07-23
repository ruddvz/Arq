//! arq-core: the shared deterministic core ADR-0020 calls for - canonical numeric
//! normalisation, deterministic record ordering, and semantic hashing only. Compiled
//! to native (this crate, tested here) and WebAssembly (ARQ-204) targets. Does not
//! replace TypeScript UI or renderer code, and deliberately does not yet implement
//! the full module list `docs/architecture/SHARED-RUST-CORE.md` describes
//! (ids/model/operations/sync/geometry2d/diagnostics) - only what ARQ-195-199's
//! file-system prototype actually needs, per ADR-0020's own narrow framing.

pub mod ffi;
pub mod hashing;
pub mod ordering;
pub mod units;
pub mod wasm_bindings;
