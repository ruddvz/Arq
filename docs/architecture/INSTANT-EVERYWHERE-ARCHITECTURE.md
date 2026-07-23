# Instant-everywhere architecture

## Meaning of instant

Instant is a measurable interaction contract.

It means:

- the editor shell appears before the full project is loaded;
- the current view becomes useful before inactive levels and resources load;
- commands preview locally;
- common edits commit to durable local storage without a network round trip;
- derived geometry recalculates incrementally;
- expensive operations run in Workers or native background tasks;
- sync does not block authoring;
- low-capability devices degrade visual detail before they degrade input.

## Cross-platform rule

One project and operation model runs everywhere.

The interface adapts by device:

- workstation: dense full authoring;
- laptop: full authoring with adaptive detail;
- iPad: touch and Pencil authoring;
- phone: review, markup and selected light edits.

"Works on any device" means data fidelity, openability, recovery and appropriate
capabilities. It does not mean pretending a phone is a workstation.

## Shared core

`arq-core` is a deterministic Rust library.

Modules:

- `ids`
- `units`
- `model`
- `operations`
- `validation`
- `migration`
- `hashing`
- `sync`
- `geometry2d`
- `archive`
- `diagnostics`

Targets:

- `wasm32-unknown-unknown`
- `aarch64-apple-ios`
- `aarch64-apple-darwin`
- `x86_64-apple-darwin`
- `x86_64-pc-windows-msvc`
- `aarch64-pc-windows-msvc`
- server Linux targets

## UI boundary

The Rust core does not own:

- React state;
- canvas widgets;
- Three.js objects;
- platform menus;
- marketing pages;
- raw external IFC or DXF classes.

## Progressive opening

Minimum query set:

- `arq_meta`
- project identity
- level index
- last active view
- visible element bounding boxes
- plan primitive cache if valid
- warning count
- resource availability

The first view does not wait for:

- inactive levels;
- all operation history;
- 3D meshes outside the camera;
- full-resolution underlays;
- import source files;
- thumbnails;
- cloud sync.

## Adaptive performance

Signals:

- measured frame time;
- Worker queue latency;
- memory pressure;
- GPU context limits;
- project object count;
- visible primitive count;
- underlay resolution;
- device thermal or background state where available.

Degradation order:

1. reduce antialiasing and edge effects;
2. use lower-detail meshes;
3. suspend inactive views;
4. unload inactive levels;
5. reduce underlay resolution;
6. use bounding boxes during camera movement;
7. delay thumbnails and analytics;
8. switch to review mode before risking a crash.

## Non-negotiable

Arq must never trade model correctness for frame rate. It may reduce visual fidelity,
but it may not alter semantic geometry or dimensions.
