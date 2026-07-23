# arq-core FFI boundary (ARQ-205)

## Purpose

ADR-0020: "desktop shell calls the Rust core directly; iPad uses a generated stable
FFI layer; server uses the same validation and migration crates." This documents
`rust/arq-core/src/ffi.rs`'s design and, honestly, what was and was not verified
about it in this sandboxed environment.

## Design

A plain C ABI (`extern "C"`, `#[no_mangle]`) - the lowest common denominator any
native caller (Swift via a bridging header, a desktop shell, a server process) can
call without needing a Rust-specific toolchain of its own. Kept deliberately
separate from `wasm_bindings.rs` (ARQ-204, a different calling convention for a
different target) even though both wrap the same underlying `units`/`ordering`/
`hashing` logic.

Per ADR-0020's "do not expose internal Rust pointers or SQLite handles to the UI":

- Numeric functions (`arq_core_mm_to_canonical_micrometres`,
  `arq_core_canonical_micrometres_to_mm`) take/return plain `f64`/`i64` - no
  allocation, no ownership question. An invalid/non-finite input returns
  `ARQ_CORE_FFI_INVALID_MICROMETRES` (`i64::MIN`, not a real-world micrometre
  quantity) rather than a Rust-specific `Option` a C caller has no way to represent.
- `arq_core_semantic_hash` returns a newly heap-allocated, NUL-terminated string the
  caller must free via `arq_core_free_string` - an explicit, documented ownership
  transfer, not an implicit one.
- `arq_core_canonical_sort_order` deliberately does **not** sort C strings in place
  or take ownership of the caller's pointers. It is read-only: given `count`
  caller-owned strings, it writes the sorted _permutation of indices_ into a
  caller-allocated output buffer, touching no string memory and transferring no
  ownership in either direction. An earlier draft of this function took ownership of
  each input pointer to sort in place (matching a possible strcmp-vs-qsort mental
  model) - rejected specifically because this boundary has no real Swift/C caller to
  test that riskier ownership contract against, and a read-only design cannot leak
  or double-free regardless of what the actual caller does with its own strings
  afterward.

## What is verified

- **Native (`cargo test`, Linux x86_64):** all 8 FFI-specific tests pass, including
  round-tripping a hash through the C-string boundary, the null-pointer/zero-count
  no-op cases, and that `arq_core_canonical_sort_order` genuinely leaves the input
  strings untouched (not merely "should," checked directly).
- **`cargo check --target aarch64-apple-ios`:** the exact `extern "C"` signatures in
  `ffi.rs` type-check against the real iOS target's ABI and type layout - this is
  more than a hope that "C-compatible Rust cross-compiles fine"; it is Rust's own
  compiler validating these specific function signatures for that specific target.
- **`cargo build --target wasm32-unknown-unknown --release`:** confirms adding this
  module did not break the separate WASM build (ARQ-204) sharing the same crate.

## What is not verified

- **No actual Swift build or Swift-side FFI call.** Generating and compiling a
  Swift bridging header, then calling into this library from real Swift code,
  requires Xcode on macOS - unavailable in this sandboxed Linux container. The ABI
  _type-checks_ for the target; a real call was never made.
- **No linked iOS binary.** `cargo check` type-checks without codegen/linking;
  producing and linking an actual `.a`/`.dylib` for a real iOS app needs Apple's own
  linker and SDK.
- **No physical iPad hardware**, consistent with every other native-iPad item in
  this repository (RoomPlan, Pencil input, hover) - there is none in this sandbox.

Matches this repository's established practice for native-iPad work: build and test
everything that is genuinely buildable and testable here, and state plainly what
still needs a real device or a real Apple toolchain, rather than assuming either
would "probably just work."
