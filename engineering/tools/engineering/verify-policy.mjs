#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LANE_NAMES = new Set(['L1', 'L2', 'L3', 'L4']);
const CONFLICT_STATUSES = new Set(['CONFLICT', 'QUALIFY', 'UNKNOWN']);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, '../..');

function readJson(root, relativePath, errors) {
  const filePath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push('Invalid or missing JSON ' + relativePath + ': ' + error.message);
    return null;
  }
}

function addError(errors, condition, message) {
  if (!condition) errors.push(message);
}

function arrayOfStrings(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
}

function checkEvidenceReferences(errors, ids, evidenceIds, location) {
  for (const id of ids || [])
    addError(errors, evidenceIds.has(id), location + ' references unknown evidence: ' + id);
}

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else result.push(full);
  }
  return result;
}

function parseArguments(argv) {
  const options = { root: defaultRoot };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--root') {
      options.root = argv[index + 1];
      index += 1;
    } else if (argv[index] === '--help') {
      options.help = true;
    } else {
      throw new Error('Unknown argument: ' + argv[index]);
    }
  }
  return options;
}

export function verifyPolicy(root) {
  const errors = [];
  const policy = readJson(root, 'ops/engineering-policy.v5.json', errors);
  const baseline = readJson(root, 'ops/repo-baseline.v5.json', errors);
  const surfaces = readJson(root, 'ops/active-surface-register.v5.json', errors);
  const contracts = readJson(root, 'ops/critical-contracts.v5.json', errors);
  const conflicts = readJson(root, 'ops/conflict-registry.v5.json', errors);
  const catalog = readJson(root, 'ops/evidence-catalog.v5.json', errors);
  const changeMap = readJson(root, 'ops/change-map.v5.json', errors);
  const crossSystem = readJson(root, 'ops/cross-system-contract.v5.json', errors);
  const installation = readJson(root, 'ops/installation-map.v5.json', errors);
  const publicSite = readJson(root, 'ops/public-site-contract.v5.json', errors);
  const contextRegistry = readJson(root, 'ops/context-source-registry.v5.json', errors);

  if (policy) {
    addError(errors, policy.version === '5.0.0', 'Engineering policy must declare version 5.0.0.');
    addError(
      errors,
      policy.unknownExecutableMinimumLane === 'L3',
      'Unknown executable source must default to L3.',
    );
    addError(
      errors,
      policy.forbidDeterministicDowngrade === true,
      'Deterministic downgrade prohibition must be enabled.',
    );
    addError(
      errors,
      policy.manualEvidenceDecision === 'needs_review',
      'Manual evidence must produce needs_review.',
    );
    addError(errors, policy.staleContextDecision === 'fail', 'Stale context must fail.');
    for (const [lane, config] of Object.entries(policy.lanes || {})) {
      addError(errors, LANE_NAMES.has(lane), 'Unknown lane in policy: ' + lane);
      addError(errors, typeof config?.name === 'string', 'Lane ' + lane + ' needs a name.');
    }
  }

  if (baseline) {
    addError(
      errors,
      /^[0-9a-f]{40}$/.test(baseline.repository?.commit || ''),
      'Baseline repository commit must be a full SHA.',
    );
    addError(
      errors,
      typeof baseline.repository?.fullName === 'string',
      'Baseline repository fullName is required.',
    );
    addError(
      errors,
      typeof baseline.repository?.defaultBranch === 'string',
      'Baseline default branch is required.',
    );
  }

  const evidenceIds = new Set();
  if (catalog) {
    for (const entry of catalog.evidence || []) {
      addError(
        errors,
        typeof entry?.id === 'string' && entry.id.length > 0,
        'Evidence entry needs an id.',
      );
      if (entry?.id) {
        addError(errors, !evidenceIds.has(entry.id), 'Duplicate evidence id: ' + entry.id);
        evidenceIds.add(entry.id);
      }
      addError(
        errors,
        typeof entry?.state === 'string',
        'Evidence ' + (entry?.id || 'unknown') + ' needs a state.',
      );
    }
  }

  if (changeMap) {
    checkEvidenceReferences(
      errors,
      changeMap.default?.unknownExecutableEvidence,
      evidenceIds,
      'Default unknown executable policy',
    );
    const ruleIds = new Set();
    for (const rule of changeMap.rules || []) {
      addError(
        errors,
        typeof rule?.id === 'string' && rule.id.length > 0,
        'Every change-map rule needs an id.',
      );
      if (rule?.id) {
        addError(errors, !ruleIds.has(rule.id), 'Duplicate change-map rule id: ' + rule.id);
        ruleIds.add(rule.id);
      }
      addError(
        errors,
        arrayOfStrings(rule?.globs),
        'Rule ' + (rule?.id || 'unknown') + ' needs nonempty globs.',
      );
      addError(
        errors,
        LANE_NAMES.has(rule?.minLane),
        'Rule ' + (rule?.id || 'unknown') + ' needs a valid minLane.',
      );
      checkEvidenceReferences(
        errors,
        rule?.evidence,
        evidenceIds,
        'Rule ' + (rule?.id || 'unknown'),
      );
    }
    const edgeIds = new Set();
    for (const edge of changeMap.dependencyEdges || []) {
      addError(
        errors,
        typeof edge?.id === 'string' && edge.id.length > 0,
        'Every dependency edge needs an id.',
      );
      if (edge?.id) {
        addError(errors, !edgeIds.has(edge.id), 'Duplicate dependency edge id: ' + edge.id);
        edgeIds.add(edge.id);
      }
      addError(
        errors,
        arrayOfStrings(edge?.triggerGlobs),
        'Dependency edge ' + (edge?.id || 'unknown') + ' needs nonempty triggerGlobs.',
      );
      addError(
        errors,
        LANE_NAMES.has(edge?.minLane),
        'Dependency edge ' + (edge?.id || 'unknown') + ' needs a valid minLane.',
      );
      checkEvidenceReferences(
        errors,
        edge?.evidence,
        evidenceIds,
        'Dependency edge ' + (edge?.id || 'unknown'),
      );
    }
  }

  if (surfaces) {
    const ids = new Set();
    for (const surface of surfaces.surfaces || []) {
      addError(
        errors,
        typeof surface?.id === 'string' && surface.id.length > 0,
        'Surface needs an id.',
      );
      if (surface?.id) {
        addError(errors, !ids.has(surface.id), 'Duplicate surface id: ' + surface.id);
        ids.add(surface.id);
      }
      addError(
        errors,
        typeof surface?.status === 'string',
        'Surface ' + (surface?.id || 'unknown') + ' needs a status.',
      );
      addError(
        errors,
        arrayOfStrings(surface?.sourcePaths),
        'Surface ' + (surface?.id || 'unknown') + ' needs source paths.',
      );
      addError(
        errors,
        typeof surface?.userSafeDescription === 'string',
        'Surface ' + (surface?.id || 'unknown') + ' needs user-safe language.',
      );
    }
  }

  if (contracts) {
    const ids = new Set();
    for (const contract of contracts.contracts || []) {
      addError(
        errors,
        typeof contract?.id === 'string' && contract.id.length > 0,
        'Contract needs an id.',
      );
      if (contract?.id) {
        addError(errors, !ids.has(contract.id), 'Duplicate contract id: ' + contract.id);
        ids.add(contract.id);
      }
      addError(
        errors,
        typeof contract?.state === 'string',
        'Contract ' + (contract?.id || 'unknown') + ' needs a state.',
      );
      addError(
        errors,
        typeof contract?.description === 'string',
        'Contract ' + (contract?.id || 'unknown') + ' needs a description.',
      );
      addError(
        errors,
        arrayOfStrings(contract?.sourcePaths),
        'Contract ' + (contract?.id || 'unknown') + ' needs source paths.',
      );
      checkEvidenceReferences(
        errors,
        contract?.evidence,
        evidenceIds,
        'Contract ' + (contract?.id || 'unknown'),
      );
    }
  }

  if (conflicts) {
    const ids = new Set();
    for (const conflict of conflicts.conflicts || []) {
      addError(
        errors,
        typeof conflict?.id === 'string' && conflict.id.length > 0,
        'Conflict needs an id.',
      );
      if (conflict?.id) {
        addError(errors, !ids.has(conflict.id), 'Duplicate conflict id: ' + conflict.id);
        ids.add(conflict.id);
      }
      addError(
        errors,
        CONFLICT_STATUSES.has(conflict?.status),
        'Conflict ' + (conflict?.id || 'unknown') + ' needs a valid status.',
      );
      addError(
        errors,
        Array.isArray(conflict?.sources) && conflict.sources.length >= 2,
        'Conflict ' + (conflict?.id || 'unknown') + ' needs at least two sources.',
      );
      addError(
        errors,
        arrayOfStrings(conflict?.prohibitedClaims) && conflict.prohibitedClaims.length > 0,
        'Conflict ' + (conflict?.id || 'unknown') + ' needs prohibited claims.',
      );
      addError(
        errors,
        typeof conflict?.resolutionRequired === 'string',
        'Conflict ' + (conflict?.id || 'unknown') + ' needs a resolution requirement.',
      );
    }
  }

  if (crossSystem) {
    addError(
      errors,
      crossSystem.version === '5.0.0',
      'Cross-system contract must declare version 5.0.0.',
    );
    addError(
      errors,
      Array.isArray(crossSystem.systems) && crossSystem.systems.length >= 3,
      'Cross-system contract must name Engineering OS, Language System, and Zeus.',
    );
    const systemIds = new Set((crossSystem.systems || []).map((system) => system.id));
    for (const expectedId of ['engineering-os-5', 'arq-language-system-4.1', 'zeus-4.0']) {
      addError(
        errors,
        systemIds.has(expectedId),
        'Cross-system contract is missing ' + expectedId + '.',
      );
    }
  }

  if (installation) {
    addError(
      errors,
      Array.isArray(installation.copies) && installation.copies.length > 0,
      'Installation map must contain copy instructions.',
    );
    addError(
      errors,
      typeof installation.requiredPackageScripts?.['engineering:policy'] === 'string',
      'Installation map must provide engineering:policy.',
    );
    addError(
      errors,
      typeof installation.requiredPackageScripts?.['engineering:context:verify'] === 'string',
      'Installation map must provide engineering:context:verify.',
    );
  }

  if (publicSite) {
    addError(
      errors,
      typeof publicSite.site?.sourceRoot === 'string',
      'Public-site contract must define sourceRoot.',
    );
    addError(
      errors,
      typeof publicSite.site?.outputRoot === 'string',
      'Public-site contract must define outputRoot.',
    );
    addError(
      errors,
      /^https:\/\//.test(publicSite.site?.baseUrl || ''),
      'Public-site contract must define an HTTPS base URL.',
    );
    addError(
      errors,
      Array.isArray(publicSite.proofOrder) && publicSite.proofOrder.length >= 5,
      'Public-site contract must define the full proof order.',
    );
  }

  if (contextRegistry) {
    addError(
      errors,
      arrayOfStrings(contextRegistry.packageSources) && contextRegistry.packageSources.length > 0,
      'Context registry must define packageSources.',
    );
    addError(
      errors,
      arrayOfStrings(contextRegistry.repositorySources) &&
        contextRegistry.repositorySources.length > 0,
      'Context registry must define repositorySources.',
    );
    addError(
      errors,
      typeof contextRegistry.generatedContext === 'string',
      'Context registry must define generatedContext.',
    );
  }

  const forbidden = policy?.placeholderPolicy?.forbiddenTokensInExecutableFiles || [];
  for (const directory of ['ops', 'tools/engineering', 'templates/.github']) {
    const absolute = path.join(root, directory);
    if (!fs.existsSync(absolute)) continue;
    for (const filePath of walk(absolute)) {
      if (path.relative(root, filePath) === 'ops/engineering-policy.v5.json') continue;
      const content = fs.readFileSync(filePath, 'utf8');
      for (const token of forbidden) {
        if (content.includes(token))
          errors.push('Forbidden placeholder ' + token + ' in ' + path.relative(root, filePath));
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write('Usage: node verify-policy.mjs [--root PACKAGE_ROOT]\n');
    return;
  }
  const result = verifyPolicy(path.resolve(options.root));
  if (result.ok) {
    process.stdout.write('Engineering policy is internally consistent.\n');
  } else {
    for (const error of result.errors) process.stderr.write('POLICY ERROR: ' + error + '\n');
    process.exitCode = 1;
  }
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) runCli();
