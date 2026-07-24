// Optional mega-site vertex path.
//
// positionHigh + positionLow and originHigh + originLow encode f64-like
// values. viewProjectionLocal must expect coordinates relative to the origin.
// Do not also use a matrix that applies the world-space origin translation.

struct ViewUniforms {
  viewProjectionLocal : mat4x4<f32>,
  originHigh : vec3<f32>,
  originLow : vec3<f32>,
};

@group(0) @binding(0) var<uniform> view : ViewUniforms;

struct VertexInput {
  @location(0) positionHigh : vec3<f32>,
  @location(1) positionLow : vec3<f32>,
};

@vertex
fn vsMain(input : VertexInput) -> @builtin(position) vec4<f32> {
  let localPosition =
    (input.positionHigh - view.originHigh) +
    (input.positionLow - view.originLow);

  return view.viewProjectionLocal * vec4<f32>(localPosition, 1.0);
}
