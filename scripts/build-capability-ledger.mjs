#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  assertDefinitionsAreProjectionOnly,
  buildCapabilityLedger,
  renderCapabilityDashboard,
} from './lib/capability-ledger.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const definitionsPath = path.join(
  repoRoot,
  'docs/product/capabilities/ARQ-CAPABILITY-DEFINITIONS.json',
);
const toolRegistryPath = path.join(
  repoRoot,
  'packages/workspace/src/registry/workspace-tool-registry.json',
);
const definitions = JSON.parse(readFileSync(definitionsPath, 'utf8'));
const provider = definitions.providers['command-authority'];
if (provider?.source === undefined) {
  throw new Error('capability definitions have no command-authority provider source');
}
const commandAuthorityPath = path.join(repoRoot, provider.source);
const commandAuthoritySource = readFileSync(commandAuthorityPath, 'utf8');
const toolRegistry = JSON.parse(readFileSync(toolRegistryPath, 'utf8'));

assertDefinitionsAreProjectionOnly(definitions);
const ledger = buildCapabilityLedger({
  repoRoot,
  definitions,
  commandAuthoritySource,
  toolRegistry,
});

const jsonPath = path.join(repoRoot, 'docs/product/capabilities/ARQ-CAPABILITY-LEDGER.json');
const dashboardPath = path.join(repoRoot, 'docs/product/ARQ-CAPABILITY-DASHBOARD.md');
const prettier = await import('prettier');
const dashboard = await prettier.format(renderCapabilityDashboard(ledger), {
  ...(await prettier.resolveConfig(dashboardPath)),
  filepath: dashboardPath,
});

writeFileSync(jsonPath, `${JSON.stringify(ledger, null, 2)}\n`);
writeFileSync(dashboardPath, dashboard);
console.log(`Wrote ${path.relative(repoRoot, jsonPath)} (${ledger.summary.total} capabilities).`);
console.log(`Wrote ${path.relative(repoRoot, dashboardPath)}.`);
