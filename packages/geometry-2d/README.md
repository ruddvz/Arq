# @arq/geometry-2d

Purpose-built 2D planar geometry (the authoritative first layer - see
docs/adr/0007-purpose-built-planar-geometry.md).

Implemented: the world/screen coordinate system and `Viewport` transform
(ARQ-032), vectors, segments, line and segment intersection, nearest point on
segment, segment offset, polygon area and point-in-polygon (single-ring
scope), butt/mitre/T/cross wall joins, room boundary graph and gap detection,
plus adversarial fixtures for degenerate inputs. Fully unit-tested; consumed
by editor-shell, plan-renderer, bim-core and apps/web.
