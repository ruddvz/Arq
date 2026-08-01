#!/usr/bin/env node
/**
 * ARQ-204: compile arq-core to a WebAssembly Worker target.
 *
 * Rebuilds rust/arq-core/pkg/ from source (cargo build --target
 * wasm32-unknown-unknown, then wasm-bindgen --target web) - a regenerable build
 * artifact, not committed (see .gitignore).
 *
 * The script provisions its own toolchain rather than documenting it as a
 * precondition, because two pieces of gate evidence depend on the output.
 * `wasm_parity` and `worker_core` (engineering/ops/evidence-catalog.v5.json)
 * both read rust/arq-core/pkg, no workflow ever built it, and neither
 * `rustup target add wasm32-unknown-unknown` nor a matching wasm-bindgen-cli is
 * present on a stock runner - so both evidences failed at "pkg does not exist"
 * on every change that selected them. That result measured the runner rather
 * than the change under review, which is worse than no evidence: a gate that
 * always fails for an environmental reason teaches its readers to ignore it.
 * Provisioning here fixes CI and a fresh developer machine with one code path.
 *
 * The wasm-bindgen CLI version is read from rust/Cargo.lock rather than pinned
 * separately. The CLI and the wasm-bindgen crate must match exactly - a
 * mismatch fails late, inside the generated glue, with a schema-version error
 * that reads as a code fault rather than a toolchain one - and Cargo.lock is
 * the only file that already knows the resolved version.
 *
 * Usage: node scripts/build-arq-core-wasm.mjs
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const rustDir = path.join(repoRoot, 'rust');
const crateDir = path.join(rustDir, 'arq-core');
const outDir = path.join(crateDir, 'pkg');
const lockPath = path.join(rustDir, 'Cargo.lock');
const wasmPath = path.join(rustDir, 'target/wasm32-unknown-unknown/release/arq_core.wasm');

function run(command, args, cwd) {
  console.log(`$ ${command} ${args.join(' ')}`);
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

function tryRun(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8' });
  } catch {
    return null;
  }
}

/**
 * The exact `wasm-bindgen` version Cargo resolved, from the lockfile's
 * `[[package]]` block for that name. Read by name rather than by position:
 * `wasm-bindgen-macro` and friends carry the same version and would match a
 * looser search.
 */
export function readWasmBindgenVersion(lockContents) {
  const blocks = lockContents.split(/^\[\[package\]\]$/mu);
  for (const block of blocks) {
    if (/^name = "wasm-bindgen"$/mu.test(block)) {
      const version = /^version = "([^"]+)"$/mu.exec(block);
      if (version) return version[1];
    }
  }
  throw new Error(`Could not find the wasm-bindgen version in ${lockPath}.`);
}

function ensureToolchain(version) {
  if (tryRun('cargo', ['--version']) === null) {
    throw new Error(
      'The Rust toolchain is required to build arq-core for WebAssembly. Install it from https://rustup.rs and re-run.',
    );
  }
  // Idempotent, and cheap when the target is already present.
  run('rustup', ['target', 'add', 'wasm32-unknown-unknown'], repoRoot);

  // `wasm-bindgen --version` prints "wasm-bindgen <version>".
  const installed = tryRun('wasm-bindgen', ['--version'])?.trim().split(/\s+/u).at(-1);
  if (installed === version) {
    console.log(`wasm-bindgen ${version} is already installed.`);
    return;
  }
  console.log(
    installed === undefined
      ? `Installing wasm-bindgen-cli ${version} (not found on PATH).`
      : `Replacing wasm-bindgen-cli ${installed} with ${version} to match the wasm-bindgen crate.`,
  );
  run('cargo', ['install', 'wasm-bindgen-cli', '--version', version, '--locked'], repoRoot);
}

const wasmBindgenVersion = readWasmBindgenVersion(readFileSync(lockPath, 'utf8'));
ensureToolchain(wasmBindgenVersion);

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
