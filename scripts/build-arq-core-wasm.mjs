#!/usr/bin/env node
/**
 * ARQ-204: compile arq-core to a WebAssembly Worker target.
 *
 * Rebuilds rust/arq-core/pkg/ from source (cargo build --target
 * wasm32-unknown-unknown, then wasm-bindgen --target web) - a regenerable build
 * artifact, not committed (see .gitignore). Requires the Rust toolchain, the
 * wasm32-unknown-unknown target (`rustup target add wasm32-unknown-unknown`), and
 * wasm-bindgen-cli matching the wasm-bindgen crate version in
 * rust/arq-core/Cargo.toml (`cargo install wasm-bindgen-cli --version <x>`).
 *
 * Usage: node scripts/build-arq-core-wasm.mjs
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const rustDir = path.join(repoRoot, 'rust');
const crateDir = path.join(rustDir, 'arq-core');
const outDir = path.join(crateDir, 'pkg');
const wasmPath = path.join(rustDir, 'target/wasm32-unknown-unknown/release/arq_core.wasm');

function run(command, args, cwd) {
  console.log(`$ ${command} ${args.join(' ')}`);
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

mkdirSync(outDir, { recursive: true });
run(
  'cargo',
  ['build', '--target', 'wasm32-unknown-unknown', '--release', '-p', 'arq-core'],
  rustDir,
);
run('wasm-bindgen', ['--target', 'web', '--out-dir', outDir, wasmPath], repoRoot);

console.log(
  `\nBuilt ${path.relative(repoRoot, outDir)}/ from rust/arq-core (see scripts/verify-arq-core-wasm-parity.mjs to check it).`,
);
