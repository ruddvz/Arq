import test from 'node:test';
import assert from 'node:assert/strict';

import {
  localRustModuleCandidates,
  rustFacts,
  rustModuleCandidates,
  typescriptFacts,
  wasmBridgeMemberReferences,
} from './lib/zeus-repository-symbols.mjs';

test('extracts TypeScript declarations, imports, reexports and namespace member references', () => {
  const facts = typescriptFacts(`
    import type { Project as ProjectType } from './contract';
    import { modelRevision, type ModelId } from '@arq/bim-core';
    import * as core from '../wasm/arq_core.js';
    export interface Wall { id: ModelId }
    export const wall = modelRevision;
    export { ProjectType as PublicProject };
    export { modelRevision as revision } from '@arq/bim-core';
    core.semanticHash(new Uint8Array());
  `);

  assert(facts.exports.some((item) => item.name === 'Wall'));
  assert(facts.exports.some((item) => item.name === 'wall'));
  assert(facts.exports.some((item) => item.name === 'PublicProject'));
  assert(facts.exports.some((item) => item.name === 'revision'));
  assert(
    facts.imports.some(
      (item) =>
        item.source === '@arq/bim-core' && item.imported === 'modelRevision' && item.local === 'modelRevision',
    ),
  );
  assert(
    facts.imports.some(
      (item) => item.source === '@arq/bim-core' && item.imported === 'ModelId' && item.local === 'ModelId',
    ),
  );
  assert(
    facts.imports.some(
      (item) =>
        item.source === '../wasm/arq_core.js' &&
        item.imported === 'semanticHash' &&
        item.kind === 'namespace-member',
    ),
  );
  assert.deepEqual(facts.reexports, [
    { source: '@arq/bim-core', imported: 'modelRevision', exported: 'revision' },
  ]);
});

test('extracts Rust public symbols, module dependencies, use paths and wasm-bindgen names', () => {
  const facts = rustFacts(`
    use crate::hashing::semantic_hash;
    use crate::units::{canonical_micrometres_to_mm, mm_to_canonical_micrometres};
    mod local_geometry;
    pub struct CanonicalPoint { pub x: i64 }
    pub type ModelId = String;

    #[wasm_bindgen(js_name = semanticHash)]
    pub fn semantic_hash_js(bytes: &[u8]) -> String {
      semantic_hash(bytes)
    }
  `);

  assert(facts.exports.some((item) => item.name === 'CanonicalPoint'));
  assert(facts.exports.some((item) => item.name === 'ModelId'));
  assert(facts.exports.some((item) => item.name === 'semantic_hash_js'));
  assert.deepEqual(facts.modules, ['local_geometry']);
  assert(facts.uses.includes('crate::hashing::semantic_hash'));
  assert(facts.uses.includes('crate::units::canonical_micrometres_to_mm'));
  assert(facts.uses.includes('crate::units::mm_to_canonical_micrometres'));
  assert.deepEqual(facts.wasmExports, [{ jsName: 'semanticHash', rustName: 'semantic_hash_js' }]);
});

test('resolves Rust crate, self and local module file candidates deterministically', () => {
  assert.deepEqual(rustModuleCandidates('rust/arq-core/src/wasm_bindings.rs', 'crate::units::value'), [
    'rust/arq-core/src/units.rs',
    'rust/arq-core/src/units/mod.rs',
  ]);
  assert.deepEqual(rustModuleCandidates('rust/arq-core/src/nested/mod.rs', 'self::geometry::Point'), [
    'rust/arq-core/src/nested/geometry.rs',
    'rust/arq-core/src/nested/geometry/mod.rs',
  ]);
  assert.deepEqual(localRustModuleCandidates('rust/arq-core/src/lib.rs', 'hashing'), [
    'rust/arq-core/src/hashing.rs',
    'rust/arq-core/src/hashing/mod.rs',
  ]);
});

test('recognises generated wasm bridge member usage only in wasm-aware sources', () => {
  const names = ['semanticHash', 'canonicalSortIds'];
  assert.deepEqual(
    wasmBridgeMemberReferences(
      `const pkgDir = 'rust/arq-core/pkg'; mod.semanticHash(bytes); mod.canonicalSortIds(ids);`,
      names,
    ),
    ['canonicalSortIds', 'semanticHash'],
  );
  assert.deepEqual(wasmBridgeMemberReferences('object.semanticHash(bytes);', names), []);
});
