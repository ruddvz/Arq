#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  getStartupBundleBudget,
  readFixtureManifest,
  readPerformanceAuthority,
  repoRoot,
} from './lib/performance-authority.mjs';

const failures = [];
const fail = (message) => failures.push(message);
const authority = readPerformanceAuthority();
const fixture = readFixtureManifest();

if (authority.schemaVersion !== '2.0.0') fail(`unexpected schemaVersion ${authority.schemaVersion}`);
if (authority.authority?.issue !== 402) fail('authority.issue must be 402');
if (!Array.isArray(authority.workflows) || authority.workflows.length === 0) fail('workflows are absent');

const ids = new Set();
for (const workflow of authority.workflows ?? []) {
  if (!workflow.id) fail('workflow without id');
  if (ids.has(workflow.id)) fail(`duplicate workflow id ${workflow.id}`);
  ids.add(workflow.id);
  for (const field of ['description', 'fixture', 'measurementWindow', 'metrics', 'environmentClass', 'owner', 'evidenceStatus', 'enforcement']) {
    if (workflow[field] === undefined || workflow[field] === null) fail(`${workflow.id}: missing ${field}`);
  }
  if (!authority.environments?.[workflow.environmentClass]) fail(`${workflow.id}: unknown environmentClass ${workflow.environmentClass}`);
  if (workflow.evidenceStatus.startsWith('pending') && workflow.enforcement !== 'contract-only' && !workflow.enforcement.includes('pending')) {
    fail(`${workflow.id}: pending evidence cannot masquerade as accepted enforcement`);
  }
  if (workflow.budget?.environmentClass && !authority.environments?.[workflow.budget.environmentClass]) {
    fail(`${workflow.id}: budget references unknown environment ${workflow.budget.environmentClass}`);
  }
  if (workflow.regression?.environmentClass && !authority.environments?.[workflow.regression.environmentClass]) {
    fail(`${workflow.id}: regression policy references unknown environment ${workflow.regression.environmentClass}`);
  }
}

for (const required of [
  'app.boot.usable-workspace',
  'project.open-adopt',
  'plan.first-frame',
  'plan.pan-zoom',
  'plan.hover-selection',
  'plan.snap-resolution',
  'wall.preview',
  'wall.commit.plan-settled',
  'operation.commit.3d-settled',
  'model-browser.search-selection',
  '3d.first-open',
  '3d.orbit-selection',
  'sheet.open',
  'native.save-ack',
  'room.recompute',
  'dimension.recompute',
  'publish.project',
  'pdf.vector-generation',
  'material.compositing',
]) {
  if (!ids.has(required)) fail(`required workflow ${required} is absent`);
}

try {
  getStartupBundleBudget(authority);
} catch (error) {
  fail(error.message);
}

const expected = fixture.protectedScale;
if (fixture.kind !== 'synthetic-repository-owned') fail('fixture must remain synthetic and repository owned');
if (fixture.privacy?.containsUserContent !== false || fixture.privacy?.containsPrivateProjectContent !== false) {
  fail('fixture privacy declaration must explicitly reject user/private project content');
}
for (const [key, value] of Object.entries(fixture.complexityGuards?.exact ?? {})) {
  if (expected[key] !== value) fail(`fixture exact guard ${key} drifted from protectedScale`);
}
for (const [key, minimum] of Object.entries(fixture.complexityGuards?.minimum ?? {})) {
  if ((expected[key] ?? 0) < minimum) fail(`fixture minimum ${key} dropped below ${minimum}`);
}

const scenePath = path.join(repoRoot, 'packages/plan-renderer/benchmarks/canvas-2d/scene.js');
const context = { window: {} };
vm.runInNewContext(readFileSync(scenePath, 'utf8'), context, { filename: scenePath });
const scene = context.window.ArqBenchmarkScene.buildScene();
const counts = context.window.ArqBenchmarkScene.countsOf(scene);
const sceneExpected = {
  walls: expected.walls,
  rooms: expected.rooms,
  openings: expected.doorsAndWindows,
  annotations: expected.annotations,
};
for (const [key, value] of Object.entries(sceneExpected)) {
  if (counts[key] !== value) fail(`protected renderer fixture ${key}=${counts[key]}, expected ${value}`);
}

if (authority.targets !== undefined || authority.benchmarkModel !== undefined || authority.ciBaselines !== undefined) {
  fail('legacy top-level threshold authorities must not be reintroduced');
}

if (failures.length) {
  failures.forEach((failure) => process.stderr.write(`FAIL ${failure}\n`));
  process.exit(1);
}
process.stdout.write(
  `PASS performance authority: ${ids.size} workflows, protected fixture ${counts.walls} walls / ${counts.openings} openings / ${counts.rooms} rooms / ${counts.annotations} annotations, startup budget ${authority.bundle.startup.threshold} bytes gzip.\n`,
);
