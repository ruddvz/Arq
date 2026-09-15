import { config as zeusConfig } from './zeus-engine.mjs';
import {
  graphStatus,
  loadConfig,
  preflightFromGraph,
  readSnapshot,
} from '../zeus-repository-cross-language.mjs';

const RISK_RANK = { low: 0, moderate: 1, high: 2, critical: 3 };
const TIER_RANK = { fast: 0, standard: 1, deep: 2 };
const TIER_NODE_CAPS = { fast: 64, standard: 160, deep: 240 };
const TIER_DEPTH_CAPS = { fast: 2, standard: 4, deep: 4 };

export function verificationCommandsToChecks(commands = []) {
  const checks = new Set();
  for (const command of commands) {
    const value = String(command).trim();
    if (/\bformat:check\b/.test(value)) checks.add('format:check');
    if (/\blint\b/.test(value)) checks.add('lint');
    if (/\btypecheck\b/.test(value)) checks.add('typecheck');
    if (/\btest\b/.test(value)) checks.add('test');
    if (/\bbuild\b/.test(value)) checks.add('build');
    if (/\bzeus:validate\b/.test(value)) checks.add('zeus:validate');
    if (/\bzeus:drift\b/.test(value)) checks.add('zeus:drift');
  }
  return [...checks];
}

export function graphBudgetsForTier(graphConfig, tier = 'standard') {
  const graphBudget = graphConfig.budgets;
  const zeusBudget = zeusConfig.budgets[tier] ?? zeusConfig.budgets.standard;
  return {
    max_nodes: Math.min(graphBudget.max_nodes, TIER_NODE_CAPS[tier] ?? TIER_NODE_CAPS.standard),
    max_depth: Math.min(graphBudget.max_depth, TIER_DEPTH_CAPS[tier] ?? TIER_DEPTH_CAPS.standard),
    max_context_chars: Math.min(graphBudget.max_context_chars, zeusBudget.contextChars),
  };
}

function sourceMetadata(status, graphConfig) {
  return {
    id: 'repository-intelligence',
    rank: 1,
    protocol: graphConfig.protocol,
    fingerprint: status.fingerprint,
    source_revision: status.source_revision,
    branch: status.branch,
    provenance: [...(graphConfig.hard_gate_provenance ?? [])],
  };
}

export function normaliseGraphPreflight(preflight, graphConfig) {
  const traversalTruncated = Boolean(preflight?.context?.truncated || preflight?.impact?.truncated);
  const uncertainty = Boolean(preflight?.uncertainty || traversalTruncated);
  if (!traversalTruncated) return { ...preflight, uncertainty };

  return {
    ...preflight,
    uncertainty,
    truncation_uncertainty: true,
    verification: {
      ...(preflight?.verification ?? {}),
      level: 'protected',
      uncertain: true,
      commands: [...(graphConfig.verification_frontiers?.protected ?? [])],
    },
  };
}

export function repositoryEvidence(root, seeds, tier = 'standard') {
  const config = loadConfig(root);
  const status = graphStatus(root, config);
  const source = sourceMetadata(status, config);
  const context_budget = graphBudgetsForTier(config, tier);
  if (!status.fresh) {
    const commands = [...(config.verification_frontiers?.protected ?? [])];
    return {
      source,
      fresh: false,
      uncertainty: true,
      reason: status.reason,
      source_revision: status.source_revision,
      branch: status.branch,
      fingerprint: status.fingerprint,
      context_budget,
      seeds: { requested: [...seeds], resolved: [], unresolved: [...seeds], ambiguous: {} },
      verification: {
        level: 'protected',
        uncertain: true,
        domains: [],
        commands,
      },
      canonical_or_protected: [],
    };
  }

  const snapshot = readSnapshot(root);
  const scopedConfig = { ...config, budgets: context_budget };
  const preflight = normaliseGraphPreflight(
    preflightFromGraph(snapshot.nodes, snapshot.edges, seeds, scopedConfig),
    config,
  );
  return {
    source,
    fresh: true,
    reason: status.reason,
    source_revision: status.source_revision,
    branch: status.branch,
    fingerprint: status.fingerprint,
    context_budget,
    ...preflight,
  };
}

export function applyGraphEscalation({ risk, tier = 'standard', checks }, evidence) {
  const nextChecks = new Set(checks ?? []);
  for (const check of verificationCommandsToChecks(evidence?.verification?.commands)) {
    nextChecks.add(check);
  }

  const protectedOrUncertain =
    evidence?.verification?.level === 'protected' || Boolean(evidence?.uncertainty);
  let nextRisk = risk;
  let nextTier = tier;
  if (protectedOrUncertain && RISK_RANK[nextRisk] < RISK_RANK.high) {
    nextRisk = 'high';
  }
  if (protectedOrUncertain && TIER_RANK[nextTier] < TIER_RANK.deep) {
    nextTier = 'deep';
  }

  return { risk: nextRisk, tier: nextTier, checks: [...nextChecks] };
}

export function graphMarkdown(evidence) {
  const resolved = evidence?.seeds?.resolved?.length ?? 0;
  const unresolved = evidence?.seeds?.unresolved?.length ?? 0;
  const level = evidence?.verification?.level ?? 'unknown';
  return [
    '## Repository intelligence',
    '',
    `- Graph: ${evidence?.fresh ? 'fresh' : 'stale or missing'}`,
    `- Uncertainty: ${Boolean(evidence?.uncertainty)}`,
    `- Verification frontier: ${level}`,
    `- Seeds: ${resolved} resolved, ${unresolved} unresolved`,
    evidence?.source?.provenance?.length
      ? `- Provenance: ${evidence.source.provenance.join(', ')}`
      : null,
    evidence?.fingerprint ? `- Fingerprint: ${evidence.fingerprint}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}