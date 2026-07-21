# Rendering architecture

2D options require a spike:

- Canvas 2D;
- PixiJS WebGL;
- CanvasKit if needed.

3D:

- Three.js;
- WebGL first;
- WebGPU capability path;
- no WebGPU-only authoring feature in Release 1.

Project data never stores renderer objects.
