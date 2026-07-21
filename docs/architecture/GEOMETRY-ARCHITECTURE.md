# Geometry architecture

The first wall and room engine uses purpose-built planar geometry.

`geometry-2d`:

- robust predicates;
- intersections;
- offsets;
- polygons;
- nearest point;
- room graph;
- spatial index interface.

`geometry-3d`:

- derived display meshes;
- transforms;
- boxes;
- normals;
- validation.

`geometry-occt`:

- optional exact solids;
- STEP;
- advanced booleans;
- isolated from core semantics.
