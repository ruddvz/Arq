import test from 'node:test';
import assert from 'node:assert/strict';

import {
  localRustModuleCandidates,
  rustDependencyCandidates,
  rustFacts,
  typescriptFacts,
  wasmBridgeImports,
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
        item.source === '@arq/bim-core' &&
        item.imported === 'modelRevision' &&
        item.local === 'modelRevision',
    ),
  );
  assert(
    facts.imports.some(
      (item) =>
        item.source === '@arq/bim-core' && item.imported === 'ModelId' && item.local === 'ModelId',
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

test('extracts Rust public symbols, aliases, reexports and wasm-bindgen names', () => {
  const facts = rustFacts(`
    use crate::hashing::semantic_hash;
    pub use crate::units::{canonical_micrometres_to_mm as to_mm, mm_to_canonical_micrometres};
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
  assert.deepEqual(facts.modules, [{ name: 'local_geometry', public: false }]);
  assert(
    facts.uses.some(
      (item) => item.path === 'crate::hashing::semantic_hash' && item.public === false,
    ),
  );
  assert(
    facts.uses.some(
      (item) =>
        item.path === 'crate::units::canonical_micrometres_to_mm' &&
        item.alias === 'to_mm' &&
        item.public === true,
    ),
  );
  assert(
    facts.uses.some(
      (item) =>
        item.path === 'crate::units::mm_to_canonical_micrometres' && item.public === true,
    ),
  );
  assert.deepEqual(facts.wasmExports, [{ jsName: 'semanticHash', rustName: 'semantic_hash_js' }]);
});

test('resolves Rust crate, self, super and local module candidates deterministically', () => {
  assert.deepEqual(
    rustDependencyCandidates('rust/arq-core/src/wasm_bindings.rs', 'crate::units::value').slice(0, 4),
    [
      'rust/arq-core/src/units/value.rs',
      'rust/arq-core/src/units/value/mod.rs',
      'rust/arq-core/src/units.rs',
      'rust/arq-core/src/units/mod.rs',
    ],
  );
  assert.deepEqual(
    rustDependencyCandidates('rust/arq-core/src/nested/mod.rs', 'self::geometry::Point').slice(0, 4),
    [
      'rust/arq-core/src/nested/geometry/Point.rs',
      'rust/arq-core/src/nested/geometry/Point/mod.rs',
      'rust/arq-core/src/nested/geometry.rs',
      'rust/arq-core/src/nested/geometry/mod.rs',
    ],
  );
  assert.deepEqual(
    rustDependencyCandidates('rust/arq-core/src/nested/mod.rs', 'super::units::value').slice(0, 4),
    [
      'rust/arq-core/src/units/value.rs',
      'rust/arq-core/src/units/value/mod.rs',
      'rust/arq-core/src/units.rs',
      'rust/arq-core/src/units/mod.rs',
    ],
  );
  assert.deepEqual(localRustModuleCandidates('rust/arq-core/src/lib.rs', 'hashing'), [
    'rust/arq-core/src/hashing.rs',
    'rust/arq-core/src/hashing/mod.rs',
  ]);
});

test('creates WASM bridge facts only from explicit imports with an ARQ-core module hint', () => {
  const names = ['semanticHash', 'canonicalSortIds'];
  const hints = ['arq_core', 'arq-core', '@arq/core-wasm'];

  assert.deepEqual(
    wasmBridgeImports(
      `
        import * as core from '../wasm/arq_core.js';
        core.semanticHash(bytes);
        core.canonicalSortIds(ids);
      `,
      names,
      hints,
    ),
    [
      {
        source: '../wasm/arq_core.js',
        jsName: 'semanticHash',
        local: 'core.semanticHash',
        kind: 'namespace-member',
      },
      {
        source: '../wasm/arq_core.js',
        jsName: 'canonicalSortIds',
        local: 'core.canonicalSortIds',
        kind: 'namespace-member',
      },
    ],
  );

  assert.deepEqual(
    wasmBridgeImports(
      `import { semanticHash as hash } from '@arq/core-wasm'; hash(bytes);`,
      names,
      hints,
    ),
    [
      {
        source: '@arq/core-wasm',
        jsName: 'semanticHash',
        local: 'hash',
        kind: 'named',
      },
    ],
  );

  assert.deepEqual(
    wasmBridgeImports(`object.semanticHash(bytes); const p = 'rust/arq-core/pkg';`, names, hints),
    [],
  );
  assert.deepEqual(
    wasmBridgeImports(`import { semanticHash } from '../wasm/other_core.js';`, names, hints),
    [],
  );
});
