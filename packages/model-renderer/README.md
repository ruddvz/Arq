# @arq/model-renderer

3D model rendering library (Three.js): scene assembly, camera state and
orbit/fit behaviour, implemented and unit-tested.

Not yet integrated: no app hosts a WebGL canvas yet, so this package
currently has zero consumers - constructing the actual renderer is a
browser-hosted component's job (see model-scene.ts's own doc comment). The
3D view arrives with the Release 1 "basic orthographic 3D" milestone once
`apps/web` gains a model tab surface.
