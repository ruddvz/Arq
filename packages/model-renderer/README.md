# @arq/model-renderer

3D model rendering library (Three.js): scene assembly, camera state and
orbit/fit behaviour, implemented and unit-tested.

Consumed by `apps/web/src/ModelCanvas.tsx`: the workspace's 3D tab hosts a
real `THREE.WebGLRenderer` over this package's scene/camera/orbit state,
with selection shared with the plan view via `applySharedSelection` -
Release 1's "basic orthographic 3D" and "selection synchronisation".
