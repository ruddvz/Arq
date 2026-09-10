#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { blastRadius, classifyPaths, route } from './lib/zeus-engine.mjs';
import {
  gateConfig,
  ledgerPath,
  loadLedger,
  repositoryRoot,
  shipReadiness,
  workspaceSignature,
} from './zeus-gate-ledger.mjs';
import { closeReadiness, loadPlan, nextItem, planPath } from './zeus-plan-ledger.mjs';
import { changedPaths, reviewersForPaths } from './zeus-reviewer-match.mjs';
import {
  diffImpactFromGraph,
  graphStatus,
  loadConfig as loadGraphConfig,
  readSnapshot,
} from './zeus-repository-intelligence.mjs';

export const DOCTOR_SCHEMA = 'zeus-doctor/v1';
export const NEXT_ACTIONS = [
  'INSPECT',
  'NARROW',
  'IMPLEMENT',
  'BENCHMARK',
  'TEST',
  'FIX',
  'REVIEW',
  'OPEN PR',
  'WAIT',
  'RELEASE',
];

const RISK_RANK = { low: 0, moderate: 1, high: 2, critical: 3 };
const TIER_RANK = { fast: 0, standard: 1, deep: 2 };
const RADIUS_RANK = Object.fromEntries(blastRadius.levels.map((item) => [item.id, item.rank]));
const RADIUS_LEVEL = Object.fromEntries(blastRadius.levels.map((item) => [item.id, item]));
const REVERSIBILITY_RANK = Object.fromEntries(
  blastRadius.reversibility.map((item) => [item.id, item.rank]),
);

const readJson = (file, fallback = null) =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback;

const highest = (values, rank, fallback) =>
  values.filter(Boolean).reduce((best, value) => {
    if (rank[value] === undefined) return best;
    return rank[value] > rank[best] ? value : best;
  }, fallback);

function evidenceGrade(ledger, greenStates = ['verified']) {
  if (!ledger) return { status: 'not-inspected', counts: {}, failures: [], blocked: [] };
  const entries = Array.isArray(ledger.entries) ? ledger.entries : [];
  const counts = {};
  for (const entry of entries) counts[entry.state] = (counts[entry.state] ?? 0) + 1;
  const failures = entries.filter((entry) => entry.state === 'failed');
  const blocked = entries.filter((entry) => entry.state === 'blocked');
  let status = 'partial';
  if (failures.length) status = 'failed';
  else if (blocked.length || !entries.length) status = 'blocked';
  else if (entries.every((entry) => greenStates.includes(entry.state))) status = 'green';
  if (ledger.openConflicts?.length && status === 'green') status = 'partial';
  return { status, counts, failures, blocked };
}

const runStatus = (run) => {
  if (!run) return 'not-inspected';
  if (run.state === 'failed' || run.state === 'rolled_back') return 'failed';
  if (run.state === 'blocked') return 'blocked';
  if (run.state === 'production_verified' || run.state === 'closed') return 'green';
  return 'partial';
};

const languageFor = (file) => {
  const languages = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.mjs': 'JavaScript',
    '.cjs': 'JavaScript',
    '.rs': 'Rust',
    '.json': 'JSON',
    '.md': 'Markdown',
    '.yml': 'YAML',
    '.yaml': 'YAML',
    '.toml': 'TOML',
    '.css': 'CSS',
    '.html': 'HTML',
    '.py': 'Python',
    '.sh': 'Shell',
  };
  const extension = extname(file).toLowerCase();
  return languages[extension] ?? (extension ? extension.slice(1).toUpperCase() : 'Other');
};

const packageFor = (file) => {
  const match = file.match(/^(packages|apps|workers|rust)\/([^/]+)/);
  return match ? `${match[1]}/${match[2]}` : null;
};

export function relevantInvariants(files) {
  const sections = new Set(['A. Source authority and truth', 'L. Delivery and evidence']);
  const any = (pattern) => files.some((file) => pattern.test(file.toLowerCase()));
  if (any(/packages\/bim-core|packages\/operations|semantic|operation/)) {
    sections.add('B. Product boundary and semantic model');
    sections.add('C. Typed operations and history');
  }
  if (any(/\.arq|arqfs|project-format|local-storage|migration|sqlite|wal|shm/)) {
    sections.add('D. `.arq` file, storage and migration');
  }
  if (any(/geometry|rust\/arq-core|unit|tolerance|coordinate/)) {
    sections.add('E. Geometry and numerics');
  }
  if (any(/editor|input|selection|snap/)) sections.add('F. Editor, input and selection');
  if (any(/renderer|render|canvas|pixi|canvaskit/)) sections.add('G. Renderer and performance');
  if (any(/sync|collab|concurren/)) sections.add('H. Sync, collaboration and concurrency');
  if (any(/import|export|ifc|dxf|dwg/)) sections.add('I. Import, export and interoperability');
  if (any(/security|auth|credential|ai/)) sections.add('J. Security, privacy and AI');
  if (any(/^apps\/|ui|accessibility|language|copy/)) sections.add('K. UI, accessibility and language');
  return [...sections];
}

export function arqImplications(files) {
  const affectedFiles = files.filter((file) =>
    /\.arq|arqfs|project-format|local-storage|migration|sqlite|wal|shm/i.test(file),
  );
  return {
    applies: affectedFiles.length > 0,
    affectedFiles,
    requirements:
      affectedFiles.length > 0
        ? [
            'preserve the original before migration or repair',
            'use copy-on-write migration and explicit compatibility handling',
            'verify reopen/recovery before promotion',
          ]
        : [],
  };
}

export function deriveAxes({ task, gateLedger, files }) {
  const routed = task ? route(task) : null;
  const pathAxes = classifyPaths(files);
  const blast = highest(
    [routed?.blastRadius, gateLedger?.blastRadius, pathAxes.blastRadius],
    RADIUS_RANK,
    'local',
  );
  const reversibility = highest(
    [routed?.reversibility, pathAxes.reversibility],
    REVERSIBILITY_RANK,
    'reversible',
  );
  let risk = highest([routed?.risk, gateLedger?.risk], RISK_RANK, 'low');
  if (RADIUS_RANK[blast] >= RADIUS_RANK.persistent && RISK_RANK[risk] < RISK_RANK.high) {
    risk = 'high';
  }
  if (reversibility === 'irreversible' && RISK_RANK[risk] < RISK_RANK.high) risk = 'high';
  const minimumTier = RADIUS_LEVEL[blast]?.minimumTier ?? 'fast';
  const tier = highest([routed?.tier, gateLedger?.tier, minimumTier], TIER_RANK, 'fast');
  return {
    mode: routed?.mode ?? null,
    risk,
    tier,
    blastRadius: blast,
    reversibility,
    deliveryStop: routed?.deliveryStop ?? null,
  };
}

function graphReport(root, base) {
  try {
    const config = loadGraphConfig(root);
    const status = graphStatus(root, config);
    const report = {
      authority: 'advisory-navigation-only',
      fresh: status.fresh,
      reason: status.reason,
      uncertainty: false,
      truncated: false,
      nodeCount: null,
      domains: [],
      verificationFrontier: null,
    };
    if (status.fresh && base) {
      const snapshot = readSnapshot(root);
      const impact = diffImpactFromGraph(root, snapshot.nodes, snapshot.edges, config, { base });
      report.uncertainty = Boolean(impact.uncertainty);
      report.truncated = Boolean(impact.impact?.truncated);
      report.nodeCount = impact.impact?.node_count ?? 0;
      report.domains = [...new Set((impact.impact?.nodes ?? []).map((node) => node.domain))].sort();
      report.verificationFrontier = impact.verification?.level ?? null;
    }
    return report;
  } catch (error) {
    return {
      authority: 'advisory-navigation-only',
      fresh: false,
      reason: `unavailable: ${error.message}`,
      uncertainty: true,
      truncated: false,
      nodeCount: null,
      domains: [],
      verificationFrontier: null,
    };
  }
}

function currentReview(gates, signature, required) {
  if (!required.length) return true;
  const passed = new Set(
    gates
      .filter(
        (gate) =>
          gate.gate?.startsWith('review:') &&
          gate.outcome === 'pass' &&
          (!signature || gate.signature === signature),
      )
      .map((gate) => gate.gate.slice('review:'.length).trim()),
  );
  return required.every((reviewer) => passed.has(reviewer));
}

export function chooseNextAction(facts) {
  const delivery = facts.runState?.state ?? null;
  if (facts.failures.length || delivery === 'failed' || delivery === 'rolled_back') {
    return { action: 'FIX', reason: 'failed evidence or delivery state must be repaired first' };
  }
  if (facts.hardBlockers.length) {
    if (delivery === 'blocked' && facts.runState?.blockers?.length) {
      return { action: 'FIX', reason: 'the active delivery state has an explicit blocker' };
    }
    return { action: 'INSPECT', reason: facts.hardBlockers[0] };
  }
  if (!facts.task) return { action: 'INSPECT', reason: 'no active ZEUS task or plan is recorded' };
  if (!facts.diff.complete) {
    return {
      action: 'NARROW',
      reason: `changed-path coverage is incomplete: ${facts.diff.baseReason}`,
    };
  }
  if (facts.graph.uncertainty || facts.graph.truncated) {
    return { action: 'NARROW', reason: 'advisory graph impact is uncertain or truncated' };
  }
  if (facts.planBlocked) return { action: 'FIX', reason: 'the active plan contains a blocked item' };
  if (facts.staleEvidence.length) {
    return { action: 'TEST', reason: 'recorded evidence is stale for the current workspace' };
  }
  if (delivery === 'ci_running' || delivery === 'pr_open') {
    return { action: 'WAIT', reason: `delivery state is ${delivery.replaceAll('_', ' ')}` };
  }
  const item = facts.planNext;
  if (item && /benchmark|performance|latency|fps|throughput/i.test(`${item.title} ${item.acceptance}`)) {
    return {
      action: 'BENCHMARK',
      reason: `plan item ${item.id} requires measured performance evidence`,
    };
  }
  if (item && (item.state === 'pending' || item.state === 'active')) {
    return { action: 'IMPLEMENT', reason: `plan item ${item.id} is ${item.state}` };
  }
  if (facts.evidence.exists && facts.evidence.status !== 'green') {
    return { action: 'TEST', reason: `evidence ledger is ${facts.evidence.status}, not green` };
  }
  if (facts.plan.exists && !facts.plan.ready && !facts.planNext) {
    return { action: 'NARROW', reason: 'the unfinished plan has no currently workable item' };
  }
  if (!facts.engineeringOs.ready) {
    if (facts.needsReview || (!facts.reviewCurrent && facts.review.required.length)) {
      return { action: 'REVIEW', reason: 'required independent review is not current' };
    }
    return { action: 'TEST', reason: 'Engineering OS required gates are not current and green' };
  }
  if (['ci_green', 'merge_authorized', 'merged', 'deployment_running'].includes(delivery)) {
    return {
      action: 'RELEASE',
      reason: `delivery state ${delivery.replaceAll('_', ' ')} is ready for its next release step`,
    };
  }
  if (facts.currentBranch && facts.baseBranch && facts.currentBranch !== facts.baseBranch) {
    return { action: 'OPEN PR', reason: 'local evidence is green on a non-canonical branch' };
  }
  if (facts.overallStatus === 'green') {
    return { action: 'RELEASE', reason: 'recorded evidence is green at the canonical integration point' };
  }
  return { action: 'INSPECT', reason: 'no safer deterministic next action is proven' };
}

export function computeOverallStatus(facts) {
  if (facts.failures.length || facts.deliveryStatus === 'failed') return 'failed';
  if (facts.hardBlockers.length || facts.deliveryStatus === 'blocked' || facts.planBlocked) {
    return 'blocked';
  }
  const evidenceReady = !facts.evidence.exists || facts.evidence.status === 'green';
  const planReady = !facts.plan.exists || facts.plan.ready;
  return facts.engineeringOs.ready &&
    evidenceReady &&
    planReady &&
    facts.diff.complete &&
    !facts.staleEvidence.length
    ? 'green'
    : 'partial';
}

export function buildDoctorReport(facts) {
  const prepared = { ...facts, overallStatus: computeOverallStatus(facts) };
  const next = chooseNextAction(prepared);
  return {
    schema: DOCTOR_SCHEMA,
    status: prepared.overallStatus,
    repository: {
      root: prepared.root,
      canonicalBase: prepared.base,
      baseBranch: prepared.baseBranch,
      currentBranch: prepared.currentBranch,
      head: prepared.head,
      drift: prepared.drift,
      dirty: prepared.dirty,
    },
    task: {
      identity: prepared.task,
      planTask: prepared.plan.task,
      gateTask: prepared.gateTask,
      runId: prepared.runState?.runId ?? null,
      deliveryState: prepared.runState?.state ?? null,
    },
    axes: prepared.axes,
    impact: {
      directFiles: prepared.files,
      packages: prepared.packages,
      languages: prepared.languages,
      invariants: prepared.invariants,
      arq: prepared.arq,
    },
    graph: prepared.graph,
    evidence: prepared.evidence,
    plan: prepared.plan,
    review: prepared.review,
    engineeringOs: prepared.engineeringOs,
    diagnostics: {
      hardBlockers: prepared.hardBlockers,
      failures: prepared.failures,
      staleEvidence: prepared.staleEvidence,
      advisories: prepared.advisories,
    },
    nextAction: next.action,
    nextActionReason: next.reason,
  };
}

function gitFacts(root, explicitBase) {
  const runGit = (args) => {
    const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
    return { ok: result.status === 0, stdout: (result.stdout ?? '').trim() };
  };
  const diff = changedPaths(root, explicitBase);
  const currentBranch = runGit(['branch', '--show-current']).stdout || null;
  const head = runGit(['rev-parse', 'HEAD']).stdout || null;
  let ahead = null;
  let behind = null;
  if (diff.base) {
    const counts = runGit(['rev-list', '--left-right', '--count', `${diff.base}...HEAD`]);
    if (counts.ok) {
      const values = counts.stdout.split(/\s+/).map(Number);
      behind = Number.isFinite(values[0]) ? values[0] : null;
      ahead = Number.isFinite(values[1]) ? values[1] : null;
    }
  }
  const baseBranch = diff.base?.startsWith('origin/')
    ? diff.base.slice('origin/'.length)
    : /^[0-9a-f]{7,40}$/i.test(diff.base ?? '')
      ? null
      : diff.base;
  return {
    diff,
    currentBranch,
    head,
    base: diff.base,
    baseBranch,
    drift: { ahead, behind },
    dirty: runGit(['status', '--porcelain']).stdout.split('\n').filter(Boolean),
  };
}

export function collectDoctorReport({ root = process.cwd(), base = null } = {}) {
  const repoRoot = repositoryRoot(root);
  const git = gitFacts(repoRoot, base);
  const files = git.diff.paths;
  const config = readJson(join(repoRoot, '.zeus', 'config.json'), {});
  const evidenceLedger = readJson(join(repoRoot, '.zeus', 'evidence-ledger.json'));
  const runState = readJson(join(repoRoot, '.zeus', 'run-state.json'));
  const hardBlockers = [];

  let signature = null;
  let gates = null;
  let gateReadiness = { ready: false, problems: ['gate ledger could not be inspected'] };
  try {
    signature = workspaceSignature(repoRoot);
    gates = loadLedger(ledgerPath(repoRoot));
    const reviewers = reviewersForPaths(files, repoRoot);
    gateReadiness = shipReadiness(gates, signature, {
      match: {
        required: reviewers.reviewers,
        modules: reviewers.modules,
        paths: files,
        matched: git.diff.complete && files.length > 0 && reviewers.reviewers.length > 0,
        reason: git.diff.complete ? 'reviewers derived from current changed paths' : git.diff.baseReason,
        base: git.base,
        unknownReviewers: reviewers.unknownReviewers,
      },
    });
  } catch (error) {
    hardBlockers.push(`Engineering OS ledger inspection failed: ${error.message}`);
  }

  let plan = null;
  let planReadiness = { ready: false, problems: [] };
  try {
    plan = loadPlan(planPath(repoRoot));
    planReadiness = closeReadiness(plan, signature);
  } catch (error) {
    hardBlockers.push(`plan ledger inspection failed: ${error.message}`);
  }

  const evidence = evidenceGrade(evidenceLedger, config.greenEvidenceStates ?? ['verified']);
  const task = plan?.task || gates?.task || evidenceLedger?.task || null;
  const axes = deriveAxes({ task, gateLedger: gates, files });
  const reviewerInfo = reviewersForPaths(files, repoRoot);
  const review = {
    required: reviewerInfo.reviewers,
    modules: reviewerInfo.modules,
    unknownReviewers: reviewerInfo.unknownReviewers,
    matched: git.diff.complete && files.length > 0 && reviewerInfo.reviewers.length > 0,
    reason: git.diff.complete ? 'derived from current changed paths' : git.diff.baseReason,
  };
  const graph = graphReport(repoRoot, git.base);
  const planNext = plan ? nextItem(plan) : null;
  const planBlocked = Boolean(plan?.items?.some((item) => item.state === 'blocked'));
  const gateFailures = (gates?.gates ?? []).filter((gate) => gate.outcome !== 'pass');
  const staleGates = (gates?.gates ?? []).filter(
    (gate) => gate.outcome === 'pass' && signature && gate.signature !== signature,
  );
  const stalePlan = (plan?.items ?? []).filter(
    (item) =>
      item.state === 'done' &&
      item.evidence?.signature &&
      signature &&
      item.evidence.signature !== signature,
  );
  const failures = [
    ...evidence.failures.map((entry) => `evidence failed: ${entry.claim}`),
    ...gateFailures.map((gate) => `gate failed: ${gate.gate}`),
  ];
  const staleEvidence = [
    ...staleGates.map((gate) => `gate stale: ${gate.gate}`),
    ...stalePlan.map((item) => `plan evidence stale: ${item.id}`),
  ];
  if (!git.base) hardBlockers.push(`canonical base unresolved: ${git.diff.baseReason}`);
  const advisories = [];
  if (!graph.fresh) advisories.push(`repository graph is not fresh: ${graph.reason}`);
  if (graph.uncertainty) advisories.push('repository graph impact is uncertain');
  if (graph.truncated) advisories.push('repository graph impact was truncated');
  const engineeringStatus = gateFailures.length
    ? 'failed'
    : staleGates.length
      ? 'stale'
      : gateReadiness.ready
        ? 'green'
        : 'partial';

  return buildDoctorReport({
    root: repoRoot,
    base: git.base,
    baseBranch: git.baseBranch,
    currentBranch: git.currentBranch,
    head: git.head,
    drift: git.drift,
    dirty: git.dirty,
    diff: git.diff,
    files,
    packages: [...new Set(files.map(packageFor).filter(Boolean))].sort(),
    languages: [...new Set(files.map(languageFor))].sort(),
    task,
    gateTask: gates?.task ?? null,
    axes,
    invariants: relevantInvariants(files),
    arq: arqImplications(files),
    graph,
    evidence: { exists: Boolean(evidenceLedger), ...evidence },
    plan: {
      exists: Boolean(plan?.task),
      task: plan?.task ?? null,
      ready: planReadiness.ready,
      problems: planReadiness.problems,
      items: plan?.items ?? [],
      next: planNext,
    },
    planNext,
    planBlocked,
    runState,
    deliveryStatus: runStatus(runState),
    review,
    reviewCurrent: currentReview(gates?.gates ?? [], signature, review.required),
    engineeringOs: {
      authority: 'Engineering OS 5.0',
      status: engineeringStatus,
      ready: gateReadiness.ready,
      requiredGates: gateConfig(repoRoot).repositoryGates,
      problems: gateReadiness.problems,
    },
    needsReview: gateReadiness.problems.some((problem) => /review/i.test(problem)),
    hardBlockers,
    failures,
    staleEvidence,
    advisories,
  });
}

export function formatHuman(report, { details = false } = {}) {
  const files = report.impact.directFiles;
  const lines = [
    `ZEUS doctor: ${report.status.toUpperCase()}`,
    `Task: ${report.task.identity ?? 'none recorded'}`,
    `Branch: ${report.repository.currentBranch ?? 'detached'} -> ${report.repository.baseBranch ?? report.repository.canonicalBase ?? 'base unresolved'}`,
    `Drift: ahead=${report.repository.drift.ahead ?? '?'} behind=${report.repository.drift.behind ?? '?'}`,
    `Axes: mode=${report.axes.mode ?? 'unknown'} risk=${report.axes.risk} tier=${report.axes.tier} blast=${report.axes.blastRadius} reversibility=${report.axes.reversibility}`,
    `Impact: ${files.length} files, ${report.impact.packages.length} packages, ${report.impact.languages.join(', ') || 'no language changes'}`,
    `Files: ${files.slice(0, 5).join(', ') || 'none'}${files.length > 5 ? ` (+${files.length - 5} more)` : ''}`,
    `Invariants: ${report.impact.invariants.join(' | ')}; .arq=${report.impact.arq.applies ? 'affected' : 'not affected'}`,
    `Graph: ${report.graph.fresh ? 'fresh' : 'stale/unavailable'}, advisory, ${report.graph.nodeCount ?? '?'} impacted nodes`,
    `Evidence: ${report.evidence.status}; stale=${report.diagnostics.staleEvidence.length}; failed=${report.diagnostics.failures.length}`,
    `Checks: ${report.engineeringOs.requiredGates.length} required; reviewers=${report.review.required.join(', ') || 'none resolved'}`,
    `Engineering OS: ${report.engineeringOs.status}`,
    `Next: ${report.nextAction} - ${report.nextActionReason}`,
  ];
  if (details) {
    if (report.engineeringOs.problems.length) {
      lines.push(`Gate gaps: ${report.engineeringOs.problems.join(' | ')}`);
    }
    if (report.diagnostics.hardBlockers.length) {
      lines.push(`Hard blockers: ${report.diagnostics.hardBlockers.join(' | ')}`);
    }
    if (report.diagnostics.staleEvidence.length) {
      lines.push(`Stale evidence: ${report.diagnostics.staleEvidence.join(' | ')}`);
    }
    if (report.diagnostics.advisories.length) {
      lines.push(`Advisories: ${report.diagnostics.advisories.join(' | ')}`);
    }
    if (report.impact.arq.applies) lines.push(`.arq: ${report.impact.arq.requirements.join(' | ')}`);
  }
  return lines.join('\n');
}

function parseArgs(argv) {
  const args = { json: false, details: false, root: process.cwd(), base: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') args.json = true;
    else if (value === '--details') args.details = true;
    else if (value === '--root') args.root = argv[++index];
    else if (value === '--base') args.base = argv[++index];
    else if (value === '--help' || value === '-h') args.help = true;
    else throw new Error(`unknown option: ${value}`);
  }
  return args;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
  if (args.help) {
    console.log('Usage: pnpm zeus doctor [--json] [--details] [--root <path>] [--base <ref>]');
    return;
  }
  try {
    const report = collectDoctorReport({ root: args.root, base: args.base });
    console.log(args.json ? JSON.stringify(report, null, 2) : formatHuman(report, args));
    process.exitCode = report.status === 'green' ? 0 : 1;
  } catch (error) {
    console.error(`ZEUS doctor failed: ${error.message}`);
    process.exitCode = 2;
  }
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) main();
