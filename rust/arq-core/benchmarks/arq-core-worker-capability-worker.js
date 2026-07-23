// ARQ-204: real headless-Chromium capability check that the wasm-bindgen
// `--target web` build of arq-core genuinely works inside a real dedicated Worker
// (not just Node's WASM support, which is a different code path) - loads it exactly
// as a real production Worker would (ESM import, then the generated init function).
import init, { mmToCanonicalMicrometres, canonicalSortIds, semanticHash } from '/pkg/arq_core.js';

self.onmessage = async (event) => {
  try {
    await init();
    self.postMessage({
      ok: true,
      mmToCanonicalMicrometres4000: mmToCanonicalMicrometres(4000).toString(),
      canonicalSortIds: canonicalSortIds(['wall-2', 'wall-10', 'wall-1']),
      semanticHashEmpty: semanticHash(new Uint8Array()),
    });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
