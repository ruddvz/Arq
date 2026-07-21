# Package boundaries

- `bim-core` cannot import Three.js, PixiJS, IFC or DXF classes.
- Renderers consume renderer-neutral primitives.
- External formats map through adapters.
- Operations contain serialisable data.
- Local storage does not own geometry rules.
- UI state remains separate from project state.
- Exact-solid kernels remain behind `geometry-occt`.
