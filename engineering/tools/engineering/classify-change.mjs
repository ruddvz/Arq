#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LANE_WEIGHT = Object.freeze({ L0: 0, L1: 1, L2: 2, L3: 3, L4: 4, HOTFIX: 5 });
const KNOWN_FLAGS = Object.freeze([
  'ui',
  'interaction',
  'accessibility',
  'geometry',
  'rendering',
  'document',
  'persistence',
  'recovery',
  'worker_wasm',
  'import_export',
  'sync_collaboration',
  'security',
  'privacy',
  'performance',
  'observability',
  'deployment',
  'ci_control',
  'dependencies',
  'product_truth',
  'public_claim',
  'configuration',
  'validation',
  'test_integrity',
  'unknown_runtime_surface',
]);
const SOURCE_EXTENSIONS = new Set([
  '.c',
  '.cc',
  '.cpp',
  '.css',
  '.cjs',
  '.go',
  '.html',
  '.java',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.php',
  '.py',
  '.rb',
  '.rs',
  '.scss',
  '.sh',
  '.sql',
  '.svelte',
  '.swift',
  '.ts',
  '.tsx',
  '.vue',
  '.wasm',
]);

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function normalisePath(value) {
  return String(value)
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+/g, '/');
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function laneWeight(lane) {
  if (!(lane in LANE_WEIGHT)) fail('Unknown lane: ' + lane);
  return LANE_WEIGHT[lane];
}

function maxLane(current, candidate) {
  return laneWeight(candidate) > laneWeight(current) ? candidate : current;
}

function globToRegExp(glob) {
  let output = '^';
  let index = 0;
  const value = normalisePath(glob);
  while (index < value.length) {
    const character = value[index];
    if (character === '*') {
      if (value[index + 1] === '*') {
        if (value[index + 2] === '/') {
          output += '(?:.*/)?';
          index += 3;
        } else {
          output += '.*';
          index += 2;
        }
      } else {
        output += '[^/]*';
        index += 1;
      }
      continue;
    }
    if (character === '?') {
      output += '[^/]';
      index += 1;
      continue;
    }
    output += '\\^$+.|()[]{}'.includes(character) ? '\\' + character : character;
    index += 1;
  }
  return new RegExp(output + '$');
}

function matchesGlobs(globs, changedPath) {
  return (globs || []).some((glob) => globToRegExp(glob).test(changedPath));
}

function isExecutableSource(changedPath) {
  const extension = path.posix.extname(changedPath).toLowerCase();
  if (SOURCE_EXTENSIONS.has(extension)) return true;
  return ['apps/', 'packages/', 'workers/', 'scripts/', '.github/', 'rust/', '.zeus/', 'ops/'].some(
    (prefix) => changedPath.startsWith(prefix),
  );
}

function parseArguments(argv) {
  const options = { files: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    const next = argv[index + 1];
    if (option === '--map') {
      options.map = next;
      index += 1;
    } else if (option === '--files-file') {
      options.filesFile = next;
      index += 1;
    } else if (option === '--files') {
      while (argv[index + 1] && !argv[index + 1].startsWith('--')) {
        options.files.push(argv[index + 1]);
        index += 1;
      }
    } else if (option === '--semantic') {
      options.semantic = next;
      index += 1;
    } else if (option === '--base-sha') {
      options.baseSha = next;
      index += 1;
    } else if (option === '--head-sha') {
      options.headSha = next;
      index += 1;
    } else if (option === '--output') {
      options.output = next;
      index += 1;
    } else if (option === '--github-output') {
      options.githubOutput = next;
      index += 1;
    } else if (option === '--help') {
      options.help = true;
    } else {
      fail('Unknown argument: ' + option);
    }
  }
  return options;
}

function readFiles(options) {
  const fromFile = options.filesFile
    ? fs.readFileSync(options.filesFile, 'utf8').split(/\r?\n/)
    : [];
  return uniqueSorted([...fromFile, ...options.files].map(normalisePath).filter(Boolean));
}

function readSemantic(filePath) {
  if (!filePath) return [];
  const value = readJson(filePath);
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.escalations)) return value.escalations;
  fail('Semantic input must be an array or an object with an escalations array.');
}

function normaliseRule(rule) {
  if (!rule || !rule.id || !Array.isArray(rule.globs))
    fail('Every change-map rule needs id and globs.');
  return {
    ...rule,
    minLane: rule.minLane || rule.min_lane || 'L0',
    impacts: rule.impacts || [],
    evidence: rule.evidence || [],
  };
}

function normaliseEdge(edge) {
  if (!edge || !edge.id || !Array.isArray(edge.triggerGlobs || edge.trigger_globs)) {
    fail('Every dependency edge needs id and triggerGlobs.');
  }
  return {
    ...edge,
    triggerGlobs: edge.triggerGlobs || edge.trigger_globs,
    addsImpacts: edge.addsImpacts || edge.adds_impacts || [],
    minLane: edge.minLane || edge.min_lane || 'L0',
    evidence: edge.evidence || [],
  };
}

function appendRuleEffect({ rule, file, impacts, evidence, matches, lane }) {
  for (const impact of rule.impacts || rule.addsImpacts || []) impacts.add(impact);
  for (const item of rule.evidence || []) evidence.add(item);
  matches.push({ file, rule: rule.id });
  return maxLane(lane, rule.minLane);
}

function flagsFor(impacts) {
  const result = {};
  for (const flag of KNOWN_FLAGS) result[flag] = impacts.includes(flag);
  result.runtime = impacts.some(
    (impact) => !['documentation', 'test_integrity', 'ci_control'].includes(impact),
  );
  return result;
}

function writeGitHubOutputs(filePath, result) {
  const lines = [
    'lane=' + result.lane,
    'confidence=' + result.classifier_confidence,
    'manual_review=' + String(result.manual_review_required),
    'needs_l4_approval=' + String(result.manual_review_required),
    'impacts=' + JSON.stringify(result.impacts),
    'required_evidence=' + JSON.stringify(result.required_evidence),
  ];
  for (const flag of [...KNOWN_FLAGS, 'runtime'])
    lines.push(flag + '=' + String(result.flags[flag]));
  fs.appendFileSync(filePath, lines.join('\n') + '\n');
}

export function classifyChange({ map, files, baseSha = null, headSha = null, semantic = [] }) {
  if (!map || !Array.isArray(map.rules)) fail('Change map requires a rules array.');
  const rules = map.rules.map(normaliseRule);
  const edges = (map.dependencyEdges || map.dependency_edges || []).map(normaliseEdge);
  const defaults = map.default || map.defaults || {};
  const deterministicImpacts = new Set();
  const requiredEvidence = new Set();
  const matchingRules = [];
  const matchingDependencyEdges = [];
  const unknownFiles = [];
  let deterministicLane = 'L0';

  for (const originalFile of files || []) {
    const file = normalisePath(originalFile);
    const matched = rules.filter((rule) => matchesGlobs(rule.globs, file));
    if (matched.length === 0 && isExecutableSource(file)) {
      deterministicImpacts.add('unknown_runtime_surface');
      for (const item of defaults.unknownExecutableEvidence ||
        defaults.unknown_source_evidence ||
        [])
        requiredEvidence.add(item);
      deterministicLane = maxLane(
        deterministicLane,
        defaults.unknownExecutableLane || defaults.unknown_source_min_lane || 'L3',
      );
      unknownFiles.push(file);
    }
    for (const rule of matched) {
      deterministicLane = appendRuleEffect({
        rule,
        file,
        impacts: deterministicImpacts,
        evidence: requiredEvidence,
        matches: matchingRules,
        lane: deterministicLane,
      });
    }
    for (const edge of edges.filter((entry) => matchesGlobs(entry.triggerGlobs, file))) {
      deterministicLane = appendRuleEffect({
        rule: edge,
        file,
        impacts: deterministicImpacts,
        evidence: requiredEvidence,
        matches: matchingDependencyEdges,
        lane: deterministicLane,
      });
    }
  }

  const finalImpacts = new Set(deterministicImpacts);
  let lane = deterministicLane;
  const semanticEscalations = [];
  for (const escalation of semantic) {
    if (
      !escalation ||
      escalation.remove_impacts ||
      escalation.removeImpacts ||
      escalation.action === 'remove' ||
      escalation.lane_downgrade ||
      escalation.laneDowngrade
    ) {
      fail('Semantic classification may not downgrade deterministic safeguards.');
    }
    const impacts = escalation.impacts || (escalation.domain ? [escalation.domain] : []);
    if (!impacts.length) fail('Semantic escalation requires a domain or impacts.');
    for (const impact of impacts) finalImpacts.add(impact);
    for (const item of escalation.evidence || []) requiredEvidence.add(item);
    if (escalation.minLane || escalation.min_lane)
      lane = maxLane(lane, escalation.minLane || escalation.min_lane);
    semanticEscalations.push({
      impacts,
      reason: escalation.reason || 'No reason supplied.',
      minLane: escalation.minLane || escalation.min_lane || null,
    });
  }

  if (files.length === 0) lane = 'L1';
  const impacts = uniqueSorted([...finalImpacts]);
  const unknown = uniqueSorted(unknownFiles);
  const confidence = unknown.length
    ? 'low'
    : matchingRules.length || matchingDependencyEdges.length
      ? 'high'
      : 'medium';
  const manualReviewRequired =
    laneWeight(lane) >= laneWeight('L4') || requiredEvidence.has('protected_l4_approval');
  return {
    schema_version: 1,
    base_sha: baseSha,
    head_sha: headSha,
    files: uniqueSorted((files || []).map(normalisePath)),
    deterministic_lane: deterministicLane,
    lane,
    impacts,
    required_evidence: uniqueSorted([...requiredEvidence]),
    flags: flagsFor(impacts),
    classifier_confidence: confidence,
    manual_review_required: manualReviewRequired,
    unknown_files: unknown,
    matching_rules: matchingRules,
    matching_dependency_edges: matchingDependencyEdges,
    semantic_escalations: semanticEscalations,
  };
}

function printHelp() {
  process.stdout.write(
    'Usage: node classify-change.mjs --map change-map.json [--files path ... | --files-file paths.txt] [--semantic semantic.json] [--base-sha SHA --head-sha SHA] [--output result.json] [--github-output output-file]\n',
  );
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) return printHelp();
  if (!options.map) fail('--map is required.');
  const result = classifyChange({
    map: readJson(options.map),
    files: readFiles(options),
    semantic: readSemantic(options.semantic),
    baseSha: options.baseSha,
    headSha: options.headSha,
  });
  if (options.output) writeJson(options.output, result);
  if (options.githubOutput) writeGitHubOutputs(options.githubOutput, result);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) runCli();
