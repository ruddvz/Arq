# @arq/geometry-3d

3D geometry derived from the 2D semantic model: wall and opening mesh
generation (convex/fan triangulation scope), implemented and unit-tested.

Consumed by `apps/web/src/ModelCanvas.tsx`, which converts these meshes to
`THREE.BufferGeometry` for the workspace's 3D tab - drawn walls extrude at
the demo type's 100 mm thickness and 2400 mm height.
