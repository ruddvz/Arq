# @arq/geometry-3d

3D geometry derived from the 2D semantic model: wall and opening mesh
generation (convex/fan triangulation scope), implemented and unit-tested.

Not yet integrated: nothing converts these meshes to `THREE.BufferGeometry`
for display yet - that wiring lands with the 3D view surface in `apps/web`
(see `@arq/model-renderer`).
