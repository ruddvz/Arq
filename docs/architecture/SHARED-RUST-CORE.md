# Shared Rust core

## Why

A shared compiled core reduces platform drift in operations, migrations, units,
hashing and validation.

## Public API style

Use a small versioned interface.

Inputs and outputs are:

- primitive values;
- stable IDs;
- canonical CBOR or JSON payloads;
- byte buffers;
- explicit result and error types.

Do not expose internal Rust pointers or SQLite handles to the UI.

## WASM

- run in a dedicated Worker;
- use transferable buffers;
- avoid frequent small calls across the JS and WASM boundary;
- batch queries and operations;
- expose cancellation;
- report progress.

## Native

- desktop shell calls the Rust core directly;
- iPad uses a generated stable FFI layer;
- server uses the same validation and migration crates.

## Determinism

The same model operation must produce the same semantic result and model hash on all
supported targets.

Do not use platform-dependent floating-point formatting as a canonical value.
