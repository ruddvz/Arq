// Semantic selection ID pass.
//
// Configure the first pass with a fresh depth32float depth attachment and an
// r32uint color attachment. Configure each inspection pass with a different
// depth32float depth attachment and bind the prior pass's depth texture as
// texture_depth_2d. A texture cannot be sampled while it is also the active
// render attachment, so depth targets must ping-pong between passes.

struct SelectionUniforms {
  viewProjection: mat4x4<f32>,
  peelEpsilon: f32,
  _padding: vec3<f32>,
};

@group(0) @binding(0) var<uniform> uniforms: SelectionUniforms;
@group(0) @binding(1) var previousDepth: texture_depth_2d;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) drawId: u32,
};

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) @interpolate(flat) drawId: u32,
};

@vertex
fn selectionVertex(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.viewProjection * vec4<f32>(input.position, 1.0);
  output.drawId = input.drawId;
  return output;
}

// Entry point for the first visible layer. The normal depth attachment performs
// the depth test and records the nearest surface.
@fragment
fn firstLayerFragment(input: VertexOutput) -> @location(0) u32 {
  return input.drawId;
}

// Entry point for each explicitly requested inspect-through layer. Fragment
// position is in framebuffer pixel coordinates, so it directly indexes the
// prior depth target. The CPU must set a small tolerance-aware epsilon derived
// from the view and document precision policy, not a universal magic constant.
@fragment
fn peelLayerFragment(input: VertexOutput) -> @location(0) u32 {
  let pixel = vec2<i32>(floor(input.position.xy));
  let priorDepth = textureLoad(previousDepth, pixel, 0);
  let currentDepth = input.position.z;
  if (currentDepth <= priorDepth + uniforms.peelEpsilon) {
    discard;
  }
  return input.drawId;
}
