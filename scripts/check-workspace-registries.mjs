#!/usr/bin/env node
/**
 * Validates the UI/UX Package 3.0/4.0 workspace registries checked in at
 * `packages/workspace/src/registry/`, and reports how much of them this
 * repository actually implements.
 *
 * Two jobs, and the second is the one that matters:
 *
 * 1. **Integrity.** Structural checks the TypeScript cannot make, because they
 *    are about the three large design inventories (icons, components, surfaces)
 *    that no runtime module imports - unique ids, required fields, resolvable
 *    cross-references. Failures exit non-zero.
 *
 * 2. **Honest coverage.** Prints designed-versus-implemented counts for tools,
 *    icons, components and surfaces. This exists so that
 *    `docs/design/WORKSPACE-3.0-INTEGRATION.md` and any release note quote a
 *    number the repository can produce on demand, rather than the package's
 *    headline totals - "215 icons specified" is true, "215 icons shipped" is
 *    not, and only one of those is a claim about this codebase.
 *
 * Coverage numbers never fail the build. A large gap between designed and
 * implemented is the expected, correct state of a specification package that
 * runs ahead of the product; failing on it would only create pressure to shrink
 * the specification or overstate the implementation.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const registryDir = path.join(repoRoot, 'packages/workspace/src/registry');
const iconSvgDir = path.join(repoRoot, 'design/icons/svg');
const iconComponentDir = path.join(repoRoot, 'packages/icons/src/generated');
const toolStateFile = path.join(repoRoot, 'packages/workspace/src/tool-state.ts');
const designSystemWorkspaceDir = path.join(repoRoot, 'packages/design-system/src/workspace');

const errors = [];

function fail(message) {
  errors.push(message);
}

function readRegistry(name) {
  const file = path.join(registryDir, name);
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${name}: could not be read or parsed (${error.message})`);
    return null;
  }
}

function requireUniqueIds(name, records, key) {
  const seen = new Set();
  for (const record of records) {
    const id = record[key];
    if (id === undefined || id === null || id === '') {
      fail(`${name}: a record has no "${key}"`);
      continue;
    }
    if (seen.has(id)) {
      fail(`${name}: duplicate ${key} "${id}"`);
    }
    seen.add(id);
  }
  return seen;
}

function requireFields(name, records, key, fields) {
  for (const record of records) {
    for (const field of fields) {
      const value = record[field];
      if (value === undefined || value === null || value === '') {
        fail(`${name}: "${record[key]}" is missing "${field}"`);
      }
    }
  }
}

// --- 1. Every registry file is present and parses. ------------------------

const EXPECTED_REGISTRIES = [
  'workspace-capability-gates.json',
  'workspace-component-registry.json',
  'workspace-context-menu-registry.json',
  'workspace-icon-registry.json',
  'workspace-keyboard-map.json',
  'workspace-layout-slots.json',
  'workspace-panel-registry.json',
  'workspace-platform-layouts.json',
  'workspace-qa-fixtures.json',
  'workspace-state-machines.json',
  'workspace-surface-registry.json',
  'workspace-tab-registry.json',
  'workspace-tool-registry.json',
];

const present = new Set(readdirSync(registryDir));
for (const name of EXPECTED_REGISTRIES) {
  if (!present.has(name)) {
    fail(`packages/workspace/src/registry/${name} is missing`);
  }
}

const tools = readRegistry('workspace-tool-registry.json');
const icons = readRegistry('workspace-icon-registry.json');
const components = readRegistry('workspace-component-registry.json');
const surfaces = readRegistry('workspace-surface-registry.json');
const gates = readRegistry('workspace-capability-gates.json');
const tabs = readRegistry('workspace-tab-registry.json');
const panels = readRegistry('workspace-panel-registry.json');
const layouts = readRegistry('workspace-layout-slots.json');

// --- 2. Integrity. --------------------------------------------------------

if (tools) {
  requireUniqueIds('tool registry', tools.tools, 'id');
  requireFields('tool registry', tools.tools, 'id', [
    'name',
    'group',
    'icon',
    'status',
    'activation',
    'cancel',
    'touch',
    'keyboard',
  ]);
  const groups = new Set(tools.toolGroups);
  for (const tool of tools.tools) {
    if (!groups.has(tool.group)) {
      fail(`tool registry: "${tool.id}" has group "${tool.group}", which toolGroups does not list`);
    }
  }
  if (tools.count !== undefined && tools.count !== tools.tools.length) {
    fail(`tool registry: declared count ${tools.count} but ships ${tools.tools.length} tools`);
  }
}

if (icons) {
  requireUniqueIds('icon registry', icons.icons, 'id');
  requireFields('icon registry', icons.icons, 'id', ['name', 'source', 'artboard', 'purpose']);
  for (const icon of icons.icons) {
    // Doc 48's geometry rules are the whole reason a new glyph goes through the
    // ARQ icon workflow rather than being drawn ad hoc.
    if (icon.artboard !== '24x24') {
      fail(`icon registry: "${icon.id}" has artboard "${icon.artboard}", expected 24x24`);
    }
    if (icon.stroke !== 1.75) {
      fail(`icon registry: "${icon.id}" has stroke ${icon.stroke}, expected 1.75`);
    }
  }
  if (icons.count !== undefined && icons.count !== icons.icons.length) {
    fail(`icon registry: declared count ${icons.count} but ships ${icons.icons.length} icons`);
  }
}

if (components) {
  requireUniqueIds('component registry', components.components, 'id');
  requireFields('component registry', components.components, 'id', ['name', 'category', 'purpose']);
  if (components.count !== undefined && components.count !== components.components.length) {
    fail(
      `component registry: declared count ${components.count} but ships ${components.components.length}`,
    );
  }
}

if (surfaces) {
  requireUniqueIds('surface registry', surfaces.surfaces, 'id');
  requireFields('surface registry', surfaces.surfaces, 'id', ['name', 'family', 'purpose']);
  for (const surface of surfaces.surfaces) {
    if (!Array.isArray(surface.states) || surface.states.length === 0) {
      fail(`surface registry: "${surface.id}" declares no states`);
    }
  }
}

if (gates && surfaces) {
  const surfaceIds = new Set(surfaces.surfaces.map((surface) => surface.id));
  for (const gate of gates.gates) {
    for (const surfaceId of gate.surfaces) {
      // Gates may legitimately name a non-surface scope ("future native
      // shells"); anything that *looks* like a surface id must resolve.
      if (/^WS-\d+$/.test(surfaceId) && !surfaceIds.has(surfaceId)) {
        fail(`capability gates: "${gate.id}" references unknown surface "${surfaceId}"`);
      }
    }
  }
}

if (tabs && icons) {
  const iconNames = new Set(icons.icons.map((icon) => icon.name));
  for (const kind of tabs.tabKinds) {
    if (!iconNames.has(kind.icon)) {
      fail(`tab registry: kind "${kind.kind}" wants icon "${kind.icon}", not in the icon registry`);
    }
  }
}

if (panels) {
  requireUniqueIds('panel registry', panels.panels, 'id');
  for (const panel of panels.panels) {
    const desktop = panel.desktop ?? {};
    if (typeof desktop.defaultWidth !== 'number') {
      fail(`panel registry: "${panel.id}" has no numeric desktop.defaultWidth`);
    }
    if (typeof desktop.min === 'number' && desktop.min > desktop.defaultWidth) {
      fail(
        `panel registry: "${panel.id}" min ${desktop.min} exceeds default ${desktop.defaultWidth}`,
      );
    }
    if (typeof desktop.max === 'number' && desktop.max < desktop.defaultWidth) {
      fail(
        `panel registry: "${panel.id}" max ${desktop.max} is below default ${desktop.defaultWidth}`,
      );
    }
  }
}

if (layouts) {
  for (const [id, slots] of Object.entries(layouts.layouts)) {
    if (typeof slots.topBar !== 'number') {
      fail(`layout slots: "${id}" has no numeric topBar`);
    }
    if (typeof slots.tabStrip !== 'number' && typeof slots.viewTabBar !== 'number') {
      fail(`layout slots: "${id}" has neither tabStrip nor viewTabBar`);
    }
  }
}

// --- 3. Coverage. ---------------------------------------------------------

/**
 * Reads TOOLS_WITH_REPOSITORY_BACKING out of tool-state.ts rather than
 * importing it, so this script stays a plain Node script with no build step -
 * the same reason the other scripts/ checks parse rather than import.
 */
function readBackedToolIds() {
  const source = readFileSync(toolStateFile, 'utf8');
  const block = source.match(
    /export const TOOLS_WITH_REPOSITORY_BACKING: readonly string\[\] = \[([\s\S]*?)\];/,
  );
  if (block === null) {
    fail('tool-state.ts: could not find TOOLS_WITH_REPOSITORY_BACKING');
    return new Set();
  }
  // Anchored per line so the trailing `// ... ('crossing' mode)` evidence
  // comments beside each entry are not mistaken for entries themselves.
  return new Set([...block[1].matchAll(/^\s*'([^']+)',/gm)].map((match) => match[1]));
}

const backedTools = readBackedToolIds();
if (tools) {
  const toolIds = new Set(tools.tools.map((tool) => tool.id));
  for (const id of backedTools) {
    if (!toolIds.has(id)) {
      fail(`tool-state.ts: TOOLS_WITH_REPOSITORY_BACKING lists unknown tool "${id}"`);
    }
  }
}

const shippedIconComponents = readdirSync(iconComponentDir).filter((file) =>
  file.endsWith('Icon.tsx'),
);
const shippedIconSvgs = readdirSync(iconSvgDir).filter((file) => file.endsWith('.svg'));
const shippedWorkspaceComponents = readdirSync(designSystemWorkspaceDir).filter(
  (file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'),
);

const iconsFromRepo = icons
  ? icons.icons.filter((icon) => icon.source === 'existing-repo').length
  : 0;

function line(label, implemented, designed) {
  const percent = designed === 0 ? 0 : Math.round((implemented / designed) * 100);
  console.log(
    `  ${label.padEnd(34)} ${String(implemented).padStart(4)} / ${String(designed).padEnd(4)} (${percent}%)`,
  );
}

console.log('\nARQ workspace registry check\n');
console.log('Integrity:');
if (errors.length === 0) {
  console.log(`  ${EXPECTED_REGISTRIES.length} registries validated, no problems found`);
} else {
  for (const error of errors) {
    console.log(`  FAIL  ${error}`);
  }
}

console.log('\nCoverage (designed by Package 3.0/4.0 vs. built in this repository):');
if (tools) {
  line('Tool commands', backedTools.size, tools.tools.length);
}
if (icons) {
  line('Icon glyphs', shippedIconSvgs.length, icons.icons.length);
  console.log(
    `  ${'  of which registry says existing'.padEnd(34)} ${String(iconsFromRepo).padStart(4)}`,
  );
  console.log(
    `  ${'  generated React components'.padEnd(34)} ${String(shippedIconComponents.length).padStart(4)}`,
  );
}
if (components) {
  line('Workspace components', shippedWorkspaceComponents.length, components.components.length);
}
if (surfaces) {
  console.log(
    `  ${'Workspace surfaces'.padEnd(34)} ${'see docs/design/WORKSPACE-3.0-INTEGRATION.md'}`,
  );
}

console.log(
  '\nCoverage figures are reported, never enforced: a specification that runs ahead of\n' +
    'the product is the expected state. Only integrity failures exit non-zero.\n',
);

if (errors.length > 0) {
  console.error(`${errors.length} registry integrity problem(s) found.`);
  process.exit(1);
}
