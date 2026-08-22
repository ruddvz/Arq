#!/usr/bin/env node
// Zeus 5 operating-system self-validation.
//
// `zeus verify` answers "is Zeus installed". This answers "is Zeus internally
// consistent": do the manifests, registries, skills, agents, hooks and schemas
// still agree with each other after an edit.
//
// Scope note: the em dash sweep covers Zeus-owned assets only. Arq's U+2014 rule
// is a house-style decision for public and product copy, owned by the Arq
// Language System (`scripts/arq-language-patterns.mjs`), not a repository-wide
// ban. Sweeping the whole tree here would both duplicate that system and flag
// legitimate internal prose.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { agentRegistry } from './zeus-agent-registry.mjs';

const root = process.cwd();
const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const readJson = (rel) => {
  try {
    return JSON.parse(readFileSync(join(root, rel), 'utf8'));
  } catch (e) {
    fail(`${rel}: ${e.message}`);
    return null;
  }
};

const EXPECTED_VERSION = '5.0.0';

/* ---------------------------------------------------------------- 1. files */

const REQUIRED = [
  '.zeus/FAST-KERNEL.md',
  '.zeus/ZEUS.md',
  '.zeus/INVARIANTS.md',
  '.zeus/config.json',
  '.zeus/module-manifest.json',
  '.zeus/method-registry.json',
  '.zeus/blast-radius.json',
  '.zeus/compact-contract.schema.json',
  '.zeus/evidence-ledger.schema.json',
  'scripts/zeus.mjs',
  'scripts/lib/zeus-engine.mjs',
  'scripts/zeus-method.mjs',
  'scripts/zeus-evidence.mjs',
  'scripts/zeus-hook.sh',
  'scripts/zeus-agent-registry.mjs',
  'scripts/zeus-harness-state.mjs',
  'scripts/zeus-gate-ledger.mjs',
  'scripts/zeus-reviewer-match.mjs',
  'scripts/zeus-drift-guard.mjs',
];
for (const f of REQUIRED) if (!existsSync(join(root, f))) fail(`missing ${f}`);

/* --------------------------------------------------------------- 2. config */

const config = readJson('.zeus/config.json');
if (config) {
  if (config.version !== EXPECTED_VERSION)
    fail(`.zeus/config.json version is ${config.version}, expected ${EXPECTED_VERSION}`);
  if (config.project !== 'Arq') fail('.zeus/config.json project is not Arq');
  for (const tier of ['fast', 'standard', 'deep']) {
    const b = config.budgets?.[tier];
    if (!b) fail(`missing budget ${tier}`);
    else if (typeof b.supportingMethods !== 'number')
      fail(`budget ${tier} is missing supportingMethods (Zeus 5 method budget)`);
  }
  if (!Array.isArray(config.evidenceStates) || config.evidenceStates.length < 7)
    fail('.zeus/config.json is missing the typed evidence states');
  for (const s of config.greenEvidenceStates ?? [])
    if (!config.evidenceStates.includes(s)) fail(`green evidence state ${s} is not a known state`);
  if (config.gate?.authority !== 'engineering-os-5')
    fail('.zeus/config.json must record Engineering OS 5.0 as the merge authority');
  // The continual harness and the gate ledger read their budgets here rather
  // than hardcoding them, so a missing block silently disables a feature the
  // kernel advertises.
  for (const key of [
    'promptCharBudget',
    'maxActiveEntries',
    'maxTitleChars',
    'maxContentChars',
    'maxEvidenceChars',
    'rollbackWindow',
  ])
    if (!Number.isInteger(config.harness?.[key]) || config.harness[key] < 1)
      fail(`.zeus/config.json harness.${key} is not a positive integer`);
  if (!config.harness?.store) fail('.zeus/config.json harness.store is not a path');
  if (!config.gates?.store) fail('.zeus/config.json gates.store is not a path');
  if (!Array.isArray(config.gates?.repositoryGates) || !config.gates.repositoryGates.length)
    fail('.zeus/config.json gates.repositoryGates is empty, so ship could infer nothing');
  for (const r of config.gates?.reviewRequiredAtRisk ?? [])
    if (!['low', 'moderate', 'high', 'critical'].includes(r))
      fail(`.zeus/config.json gates.reviewRequiredAtRisk names unknown risk ${r}`);
}

/* ------------------------------------------------------- 3. module manifest */

const manifest = readJson('.zeus/module-manifest.json');
const blast = readJson('.zeus/blast-radius.json');
const levelIds = new Set((blast?.levels ?? []).map((l) => l.id));
const agentDir = join(root, '.claude/agents');
// One definition of "dispatchable", shared with the gate ledger. Two copies of
// this rule disagree on the next edit, and both sit behind guards that assume
// they agree.
const agents = agentRegistry(agentDir);
const agentNames = agents.dispatchable;
const agentFiles = new Set([...agents.dispatchable, ...agents.roleDocs]);

if (manifest) {
  if (manifest.version !== EXPECTED_VERSION)
    fail(`.zeus/module-manifest.json version is ${manifest.version}`);
  const ids = new Set();
  for (const m of manifest.modules ?? []) {
    if (ids.has(m.id)) fail(`duplicate module id ${m.id}`);
    ids.add(m.id);
    if (!existsSync(join(root, m.path))) fail(`missing module file ${m.path}`);
    if (!Array.isArray(m.tokens) || !Array.isArray(m.phrases))
      fail(`module ${m.id} still uses Zeus 4 flat triggers; Zeus 5 needs phrases and tokens`);
    if (m.blastRadius && !levelIds.has(m.blastRadius))
      fail(`module ${m.id} declares unknown blast radius ${m.blastRadius}`);
    for (const r of m.reviewers ?? [])
      if (!agentNames.has(r)) fail(`module ${m.id} names reviewer agent ${r} which does not exist`);
    for (const t of m.tokens ?? [])
      if (t.length <= 2 && !/^[.]|^3d$|^ai$|^ui$|^ux$|^pr$|^ci$/.test(t))
        warn(`module ${m.id} token "${t}" is very short and may over-match`);
  }
}

/* ------------------------------------------------------- 4. method registry */

const registry = readJson('.zeus/method-registry.json');
if (registry) {
  if (registry.version !== EXPECTED_VERSION)
    fail(`.zeus/method-registry.json version is ${registry.version}`);
  const methods = registry.methods ?? [];
  if (methods.length !== registry.total)
    fail(`method registry total is ${registry.total} but holds ${methods.length} entries`);
  if (methods.length !== 98) fail(`expected 98 retained methods, found ${methods.length}`);

  const labels = new Set();
  const ids = new Set();
  const families = new Set((registry.families ?? []).map((f) => f.id));
  const scopes = new Set(Object.keys(registry.scopes ?? {}));
  for (const m of methods) {
    if (labels.has(m.label)) fail(`duplicate method label ${m.label}`);
    labels.add(m.label);
    if (ids.has(m.id)) fail(`duplicate method id ${m.id}`);
    ids.add(m.id);
    if (!families.has(m.family)) fail(`method ${m.label} has unknown family ${m.family}`);
    for (const s of m.scopes ?? [])
      if (!scopes.has(s)) fail(`method ${m.label} has unknown scope ${s}`);
    if (!m.effect || m.effect.length < 20) fail(`method ${m.label} has no usable effect statement`);
    if (!Array.isArray(m.triggers) || !m.triggers.length)
      fail(`method ${m.label} has no triggers, so it can never be selected`);
  }
  for (const m of methods)
    if (m.aliasOf && !labels.has(m.aliasOf)) fail(`method ${m.label} aliases unknown ${m.aliasOf}`);
  for (const [risk, list] of Object.entries(registry.riskMandated ?? {}))
    for (const label of list)
      if (!labels.has(label)) fail(`riskMandated.${risk} names unknown method ${label}`);
  for (const [mode, def] of Object.entries(registry.modeDefaults ?? {})) {
    if (!labels.has(def.primary)) fail(`modeDefaults.${mode} primary ${def.primary} is unknown`);
    if (def.defectFallbackPrimary && !labels.has(def.defectFallbackPrimary))
      fail(`modeDefaults.${mode} fallback ${def.defectFallbackPrimary} is unknown`);
    for (const s of def.scopes ?? [])
      if (!scopes.has(s)) fail(`modeDefaults.${mode} references unknown scope ${s}`);
  }
}

/* --------------------------------------------------------- 5. blast radius */

if (blast) {
  if (blast.version !== EXPECTED_VERSION)
    fail(`.zeus/blast-radius.json version is ${blast.version}`);
  const ranks = (blast.levels ?? []).map((l) => l.rank).sort((a, b) => a - b);
  if (ranks.some((r, i) => r !== i)) fail('blast radius level ranks are not contiguous from 0');
  for (const l of blast.levels ?? [])
    if (!['fast', 'standard', 'deep'].includes(l.minimumTier))
      fail(`blast radius level ${l.id} has invalid minimumTier ${l.minimumTier}`);
  for (const rule of blast.pathRules ?? []) {
    if (!levelIds.has(rule.blastRadius))
      fail(`path rule ${rule.glob} references unknown level ${rule.blastRadius}`);
    if (!(blast.reversibility ?? []).some((r) => r.id === rule.reversibility))
      fail(`path rule ${rule.glob} references unknown reversibility ${rule.reversibility}`);
  }
  if (!levelIds.has(blast.moduleContribution?.cappedRadius))
    fail('blast radius moduleContribution.cappedRadius is not a known level');
}

/* ------------------------------------------------------------- 6. skills */

const skillRoot = join(root, '.claude/skills');
let zeusSkills = 0;
if (existsSync(skillRoot)) {
  const names = new Set();
  for (const dir of readdirSync(skillRoot)) {
    const file = join(skillRoot, dir, 'SKILL.md');
    if (!statSync(join(skillRoot, dir)).isDirectory()) continue;
    if (!existsSync(file)) {
      fail(`skill ${dir} has no SKILL.md`);
      continue;
    }
    const text = readFileSync(file, 'utf8');
    const m = text.match(/^---\r?\nname:\s*([^\n]+)\r?\ndescription:\s*([^\n]+)\r?\n/);
    if (!m) {
      fail(`skill ${dir} has unreadable frontmatter (need name then description)`);
      continue;
    }
    const [, name, description] = [m[0], m[1].trim(), m[2].trim()];
    if (name !== dir) fail(`skill ${dir} declares name "${name}"`);
    if (names.has(name)) fail(`duplicate skill name ${name}`);
    names.add(name);
    if (description.length < 45) fail(`skill ${dir} description is too weak to route on`);
    if (name.startsWith('zeus-')) {
      zeusSkills++;
      if (!/\.zeus\//.test(text))
        fail(`skill ${dir} does not point at a .zeus source, so it can drift from the modules`);
    }
  }
}
if (zeusSkills < 30) fail(`expected at least 30 Zeus skills, found ${zeusSkills}`);

/* ------------------------------------------------------------- 7. agents */

if (!agentNames.size) fail('no reviewer agents installed under .claude/agents');
if (agentNames.size < 6) fail(`expected at least 6 reviewer agents, found ${agentNames.size}`);
// Every file, not only the dispatchable ones: an agent Claude Code cannot
// register is exactly the case worth reporting, and iterating the dispatchable
// set alone would skip it in silence.
for (const name of agentFiles) {
  const text = readFileSync(join(agentDir, `${name}.md`), 'utf8');
  const m = text.match(/^---\r?\nname:\s*([^\n]+)\r?\ndescription:\s*([^\n]+)\r?\n/);
  if (!m) {
    fail(`agent ${name} has unreadable frontmatter`);
    continue;
  }
  if (m[1].trim() !== name) fail(`agent file ${name}.md declares name "${m[1].trim()}"`);
  if (!/INVARIANTS\.md/.test(text))
    fail(`agent ${name} does not review against .zeus/INVARIANTS.md`);
}

/* ------------------------------------------------------------ 8. settings */

const settingsPath = join(root, '.claude/settings.json');
if (existsSync(settingsPath)) {
  const settings = readJson('.claude/settings.json');
  if (settings) {
    const commands = [];
    for (const groups of Object.values(settings.hooks ?? {}))
      for (const group of groups)
        for (const h of group.hooks ?? []) if (h.command) commands.push(h.command);
    for (const c of commands) {
      const m = c.match(/^(?:node|bash)\s+(\S+)/);
      if (m && !existsSync(join(root, m[1]))) fail(`hook command target missing: ${m[1]}`);
    }
    const wired = (settings.hooks?.UserPromptSubmit ?? []).some((g) =>
      (g.hooks ?? []).some((h) => (h.command ?? '').includes('zeus-hook.sh')),
    );
    if (!wired) fail('.claude/settings.json does not wire UserPromptSubmit to zeus-hook.sh');
    const guardian = commands.some((c) => c.includes('arq-language-guardian.mjs'));
    if (!guardian)
      fail(
        '.claude/settings.json no longer wires the Arq language guardian; Zeus must not replace it',
      );
  }
}

/* ------------------------------------------------------------ 9. schemas */

for (const f of ['.zeus/compact-contract.schema.json', '.zeus/evidence-ledger.schema.json'])
  if (existsSync(join(root, f))) readJson(f);

/* -------------------------------------------------- 10. Zeus-owned em dash */

const OWNED = ['.zeus', '.claude/agents', '.claude/hooks'];
const EM_DASH = String.fromCharCode(0x2014);
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Generated state, not authored Zeus assets. `harness` and `gates` hold
      // agent-written entries and verbatim command output, and house style is
      // enforced on those at write time by scripts/zeus-harness-state.mjs
      // instead, where the message can name the entry.
      if (['cache', 'runs', 'backups', 'harness', 'gates'].includes(entry.name)) continue;
      walk(p);
    } else if (/\.(md|json|cjs|mjs|sh)$/.test(entry.name)) {
      if (readFileSync(p, 'utf8').includes(EM_DASH))
        fail(`U+2014 em dash in Zeus asset ${p.replace(root + '/', '')}`);
    }
  }
};
for (const d of OWNED) walk(join(root, d));
// A missing skills directory is already reported above as a validation failure.
// Reading it unguarded here would replace that message with a stack trace.
if (existsSync(skillRoot))
  for (const f of readdirSync(skillRoot)) if (f.startsWith('zeus')) walk(join(skillRoot, f));

/* ------------------------------------------------------------- 11. kernel */

const kernel = existsSync(join(root, '.zeus/FAST-KERNEL.md'))
  ? readFileSync(join(root, '.zeus/FAST-KERNEL.md'), 'utf8')
  : '';
for (const needle of ['Context economy', 'Verification economy', 'INVARIANTS.md', 'Blast radius'])
  if (!kernel.includes(needle)) fail(`.zeus/FAST-KERNEL.md is missing "${needle}"`);

/* -------------------------------------------------------------- report */

if (warnings.length)
  console.error('Zeus 5 validation warnings:\n' + warnings.map((w) => '- ' + w).join('\n'));
if (errors.length) {
  console.error('\nZeus 5 validation failed:\n' + errors.map((e) => '- ' + e).join('\n'));
  process.exit(1);
}
console.log(
  `Zeus 5 validation passed: ${manifest?.modules?.length ?? 0} modules, ${registry?.total ?? 0} methods, ${zeusSkills} skills, ${agentNames.size} reviewer agents, ${blast?.levels?.length ?? 0} blast radius levels.`,
);
