import { config as zeusConfig } from './zeus-engine.mjs';
import {
  graphStatus,
  loadConfig,
  preflightFromGraph,
  readSnapshot,
} from '../zeus-repository-intelligence.mjs';

const TIER_NODE_CAPS = { fast: 64, standard: 160, deep: 240 };
const TIER_DEPTH_CAPS = { fast: 2, standard: 4, deep: 4 };

export function graphBudgetsForTier(graphConfig, tier, budget = zeusConfig.budgets[tier]) {
  const graphBudget = graphConfig.budgets;
  const safeBudget = budget ?? zeusConfig.budgets.standard;
  return {
    max_nodes: Math.min(graphBudget.max_nodes, TIER_NODE_CAPS[tier] ?? TIER_NODE_CAPS.standard),
    max_depth: Math.min(graphBudget.max_depth, TIER_DEPTH_CAPS[tier] ?? TIER_DEPTH_CAPS.standard),
    max_context_chars: Math.min(graphBudget.max_context_chars, safeBudget.contextChars),
  };
}

function sourceMetadata(status, graphConfig) {
  return {
    id: 'repository-intelligence',
    rank: 1,
    protocol: graphConfig.protocol,
    fingerprint: status.fingerprint,
    sourceRevision: status.source_revision,
    branch: status.branch,
    provenance: [...(graphConfig.hard_gate_provenance ?? [])],
  };
}

function staleGraphResult(status, graphConfig, seeds) {
  return {
    source: sourceMetadata(status, graphConfig),
    fresh: false,
    uncertainty: true,
    reason: status.reason,
    seeds: { resolved: [], unresolved: [...seeds], ambiguous: {} },
    context: null,
    impact: null,
    verification: {
      level: 'protected',
      uncertain: true,
      domains: [],
      commands: [...graphConfig.verification_frontiers.protected],
    },
  };
}

export function repositoryContext(root, seeds, tier = 'standard') {
  if (!Array.isArray(seeds) || seeds.length === 0) return null;
  const graphConfig = loadConfig(root);
  const status = graphStatus(root, graphConfig);
  if (!status.fresh) return staleGraphResult(status, graphConfig, seeds);

  const snapshot = readSnapshot(root);
  const scopedConfig = {
    ...graphConfig,
    budgets: graphBudgetsForTier(graphConfig, tier),
  };
  const result = preflightFromGraph(snapshot.nodes, snapshot.edges, seeds, scopedConfig);

  return {
    source: sourceMetadata(status, graphConfig),
    fresh: true,
    uncertainty: result.uncertainty,
    reason: result.uncertainty ? 'unresolved-or-ambiguous-seed' : 'fresh',
    seeds: result.seeds,
    context: result.context,
    impact: result.impact,
    verification: result.verification,
    canonicalOrProtected: result.canonical_or_protected.map((item) => item.id),
    derivedOrInterface: result.derived_or_interface.map((item) => item.id),
    authorityWarnings: result.authority_warnings,
  };
}

export function graphImpactSignals(result) {
  const domains = new Set(result?.impact?.nodes?.map((item) => item.domain) ?? []);
  return {
    domains: [...domains].sort(),
    protected: result?.verification?.level === 'protected',
    persistence: domains.has('persistence'),
  };
}
