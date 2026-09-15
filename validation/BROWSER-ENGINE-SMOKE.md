# Browser engine smoke validation

Tracking: #358. Parent support-matrix decision: #219.

The product support source is `validation/BROWSER-AND-DEVICE-MATRIX.csv`. This smoke check supplies one evidence layer for that matrix. It does not replace real-browser or physical-device validation.

## Run it

Install the browsers once:

```sh
pnpm exec playwright install chromium firefox webkit
```

Run all three engines:

```sh
node scripts/run-browser-matrix-smoke.mjs
```

Run one engine, which is also how CI executes the matrix:

```sh
node scripts/run-browser-matrix-smoke.mjs --browser chromium
node scripts/run-browser-matrix-smoke.mjs --browser firefox
node scripts/run-browser-matrix-smoke.mjs --browser webkit
```

Reports are written to `benchmarks/results/browser-matrix-smoke*.json` and include the exact Playwright browser version, user agent, capability result and failures. CI also uploads each engine's JSON report as a separate workflow artifact so the exact run evidence remains inspectable.

## What counts as a smoke pass

Each engine must:

1. load the production `apps/web` build without page or console errors;
2. render the workspace and a measurable primary viewport;
3. accept real keyboard focus through `Tab` on a visible interactive control;
4. avoid horizontal document overflow at the desktop smoke viewport.

GPU capability is evidence, not the pass condition for this engine smoke. The report separately records `webgpu-available`, `webgl2-fallback-available`, `webgl-fallback-available`, or `no-gpu-rendering-api` from runtime capability checks rather than browser-version assumptions.

If a headless CI runner exposes neither WebGPU nor WebGL, the engine smoke can still pass when the application shell and interaction checks pass. That result is recorded as `capabilityStatus: unavailable-in-runner`. It must not be relabelled as WebGPU support, fallback support, or a product browser-support decision. This distinction keeps unsupported or unavailable WebGPU honest without making the evidence harness itself a cross-browser support gate.

## Evidence boundary

Playwright Chromium, Firefox and WebKit are automated browser-engine evidence. In particular, Playwright WebKit is not shipping Safari certification. This check does not prove:

- physical macOS Safari behaviour;
- iPadOS Safari behaviour;
- Apple Pencil, touch hardware or trackpad behaviour;
- VoiceOver behaviour;
- a particular physical GPU or driver configuration;
- sustained real-device performance.

Real Safari/iPad hardware evidence is tracked separately by #359. Firefox product-support policy by OS is tracked by #360. The matrix must keep those distinctions visible rather than promoting this automated smoke result into a broader support claim.
