import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (p) => JSON.parse(readFileSync(join(root, '.zeus', p), 'utf8'));

const config = read('config.json');
const manifest = read('module-manifest.json');
const methodRegistry = read('method-registry.json');
const blastRadius = read('blast-radius.json');

/* ------------------------------------------------------------------ *
 * Matching
 *
 * Zeus 4 scored a module trigger with `task.includes(trigger)`. That made
 * "build" select ui-visual through "ui", "wallpaper" select geometry through
 * "wall", and "improve" select github-cicd through "pr". Zeus 5 normalises
 * both sides the same way and matches on token and phrase boundaries with a
 * bounded set of inflection suffixes.
 * ------------------------------------------------------------------ */

const SUFFIX = '(?:s|es|ing|ed)?';
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Lowercase, drop punctuation except `.` (needed for `.arq`), collapse spaces. */
export function normalise(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const boundedRe = (raw) => {
  const t = normalise(raw);
  // A token that opens with an extension dot (`.arq`) must still match when it
  // follows a filename stem, because "project.arq" is how people actually name
  // the file. A word-character lookbehind would reject exactly that case.
  const lead = t.startsWith('.') ? '(?<![a-z0-9.]\\.)(?<!\\.)' : '(?<![a-z0-9.])';
  return new RegExp(`${lead}${escape(t)}${SUFFIX}(?![a-z0-9])`);
};

const compileMatchers = (list) => (list ?? []).map((raw) => ({ raw, re: boundedRe(raw) }));

/** Precompiled once at module load so compile()/route() stay in the microsecond range. */
const MODULES = manifest.modules.map((m) => ({
  ...m,
  phraseRes: compileMatchers(m.phrases),
  tokenRes: compileMatchers(m.tokens),
  negativeRes: compileMatchers(m.negative),
}));

const METHODS = methodRegistry.methods.map((m) => ({
  ...m,
  triggerRes: compileMatchers(m.triggers),
}));

const anyMatch = (s, matchers) => matchers.some((m) => m.re.test(s));
const countMatches = (s, matchers) => matchers.reduce((n, m) => n + (m.re.test(s) ? 1 : 0), 0);
const compileSignals = (list) => list.map(boundedRe).map((re) => ({ re }));

/* ------------------------------------------------------------------ *
 * Speech act
 *
 * Zeus 4 decided "answer" from keyword presence, so "explain how the build
 * works" became an implementation task (because it contains "build") and
 * "explain the release process" was escalated to production-verified. Zeus 5
 * reads the speech act from clause openings instead.
 * ------------------------------------------------------------------ */

const ACTION_OPENER =
  /^(?:implement|build|fix|create|add|update|change|refactor|remove|delete|drop|write|migrate|deploy|release|ship|merge|rebase|rename|wire|install|upgrade|integrate|make|perfect|finish|complete|apply|revert|rollback|open|close|land|publish|generate|convert|port|extract|split|move|replace|harden|optimise|optimize|cleanup|configure|enable|disable|bump|patch|run)\b/;

const INVESTIGATE_OPENER =
  /^(?:audit|review|critique|check|verify|investigate|diagnose|assess|evaluate)\b/;

const PLAN_OPENER = /^(?:plan|design|draft|propose|research|explore|spec)\b/;

const QUESTION_OPENER =
  /^(?:what|why|how|when|where|which|who|whose|is|are|was|were|does|do|did|can|could|should|would|will|have|has|am)\b/;

const EXPLAIN_OPENER =
  /^(?:explain|describe|tell me|summarise|summarize|walk me through|clarify|document|list|show me)\b/;

const clauses = (raw) =>
  String(raw)
    .split(/[.?!;\n]+|,\s*(?:and\s+)?(?:then\s+)?/)
    .map((c) => normalise(c))
    .filter(Boolean);

function speechAct(task) {
  const parts = clauses(task);
  const first = parts[0] ?? '';
  const endsWithQuestion = /\?\s*$/.test(String(task).trim());
  const asksQuestion =
    endsWithQuestion || QUESTION_OPENER.test(first) || EXPLAIN_OPENER.test(first);
  const commandClauses = parts.filter((c) => ACTION_OPENER.test(c));
  return {
    asksQuestion,
    hasCommand: commandClauses.length > 0,
    investigates: parts.some((c) => INVESTIGATE_OPENER.test(c)),
    plans: parts.some((c) => PLAN_OPENER.test(c)),
    clauses: parts,
  };
}

/* ------------------------------------------------------------------ *
 * Classification
 * ------------------------------------------------------------------ */

const RISK_RANK = { low: 0, moderate: 1, high: 2, critical: 3 };
const TIER_RANK = { fast: 0, standard: 1, deep: 2 };
const TIER_BY_RANK = ['fast', 'standard', 'deep'];
const RADIUS_RANK = Object.fromEntries(blastRadius.levels.map((l) => [l.id, l.rank]));
const RADIUS_LEVEL = Object.fromEntries(blastRadius.levels.map((l) => [l.id, l]));
const REVERSIBILITY_RANK = Object.fromEntries(blastRadius.reversibility.map((r) => [r.id, r.rank]));

const STOP_LADDER = [
  'answer',
  'plan',
  'local-green',
  'pr-open',
  'ci-green',
  'merged',
  'production-verified',
];
const STOP_RANK = Object.fromEntries(STOP_LADDER.map((s, i) => [s, i]));

const CRITICAL_SIGNALS = compileSignals([
  'data loss',
  'lose data',
  'corrupt user data',
  'corrupted project',
  'destroy',
  'overwrite the original',
  'security breach',
  'leaked credential',
  'rollback production',
  'production migration',
  'production incident',
]);

const HIGH_SIGNALS = compileSignals([
  '.arq',
  'sqlite',
  'opfs',
  'migration',
  'recovery',
  'corruption',
  'sync',
  'geometry',
  'topology',
  'constraint',
  'canonical unit',
  'coordinate space',
  'security',
  'permission',
  'auth',
  'credential',
  'ai apply',
  'ifc',
  'dxf',
  'dwg',
  'merge',
  'deploy',
  'production',
  'release',
]);

const LOW_SIGNALS = compileSignals([
  'copy',
  'doc',
  'docs',
  'typo',
  'rename',
  'comment',
  'readme',
  'wording',
]);

const IRREVERSIBLE_SIGNALS = compileSignals(blastRadius.taskLanguage.irreversible);
const COMPENSABLE_SIGNALS = compileSignals(blastRadius.taskLanguage.compensable);

const INCIDENT_SIGNALS = compileSignals([
  'outage',
  'incident',
  'production down',
  'broken production',
  'hotfix',
  'sev1',
  'sev2',
]);

// An incident is a failure state on a shared surface. Matching fixed phrases such as
// "ci failing" missed the way people actually write it ("the ci is failing on main"),
// so Zeus 5 detects the pair instead: a shared surface plus a failure word.
const SHARED_SURFACE = compileSignals([
  'ci',
  'pipeline',
  'deployment',
  'deploy',
  'production',
  'prod',
  'release',
  'workflow',
  'main branch',
  'the site',
]);
const FAILURE_STATE = compileSignals([
  'failing',
  'failed',
  'down',
  'broken',
  'red',
  'crashed',
  'crashing',
  'stuck',
  'blocked',
]);
const looksLikeIncident = (s) => anyMatch(s, SHARED_SURFACE) && anyMatch(s, FAILURE_STATE);

const RELEASE_SIGNALS = compileSignals([
  'release',
  'deploy',
  'deployment',
  'production',
  'ship',
  'rollout',
]);

const STOP_SIGNALS = [
  ['production-verified', ['deploy', 'production', 'go live', 'rollout']],
  ['merged', ['merge', 'land it']],
  ['ci-green', ['ci', 'continuous integration', 'green build', 'pipeline']],
  ['pr-open', ['pull request', 'pr']],
].map(([stop, list]) => [stop, compileSignals(list)]);

const MODULE_SCOPES = {
  architecture: ['arch', 'eng'],
  geometry: ['eng', 'arch'],
  'editor-input': ['prod', 'eng'],
  arqfs: ['eng', 'arch'],
  rendering: ['eng'],
  'ui-visual': ['prod'],
  accessibility: ['prod'],
  security: ['eng', 'arch'],
  'github-cicd': ['eng'],
  'release-production': ['eng', 'arch'],
  ai: ['eng', 'prod'],
  interoperability: ['eng', 'arch'],
  incident: ['eng'],
};

const SCOPE_SIGNALS = {
  mkt: compileSignals([
    'marketing',
    'landing page',
    'headline',
    'campaign',
    'seo',
    'social',
    'public site',
  ]),
  comm: compileSignals([
    'documentation',
    'readme',
    'changelog',
    'report',
    'release notes',
    'help centre',
    'help center',
  ]),
  learn: compileSignals(['teach', 'quiz', 'flashcard', 'coach', 'tutorial']),
};

export function classify(task) {
  const s = normalise(task);
  const act = speechAct(task);

  let mode;
  if (anyMatch(s, INCIDENT_SIGNALS) || (looksLikeIncident(s) && !act.asksQuestion))
    mode = 'incident';
  else if (act.hasCommand && anyMatch(s, RELEASE_SIGNALS)) mode = 'release';
  else if (act.asksQuestion && !act.hasCommand) mode = 'answer';
  else if (act.investigates && !act.hasCommand) mode = 'audit';
  else if (act.plans && !act.hasCommand) mode = 'plan';
  else mode = 'implement';

  let risk = 'moderate';
  if (anyMatch(s, CRITICAL_SIGNALS)) risk = 'critical';
  else if (anyMatch(s, HIGH_SIGNALS)) risk = 'high';
  else if (anyMatch(s, LOW_SIGNALS)) risk = 'low';

  // Reading about a risky area is not the same as changing it.
  if ((mode === 'answer' || mode === 'plan') && RISK_RANK[risk] > RISK_RANK.moderate)
    risk = 'moderate';

  let reversibility = 'reversible';
  if (anyMatch(s, IRREVERSIBLE_SIGNALS)) reversibility = 'irreversible';
  else if (anyMatch(s, COMPENSABLE_SIGNALS)) reversibility = 'compensable';
  if (mode === 'answer' || mode === 'plan') reversibility = 'reversible';

  return { mode, risk, reversibility, speechAct: act };
}

export function globToRe(glob) {
  return new RegExp(
    '^' +
      glob
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replaceAll('**', '§')
        .replaceAll('*', '[^/]*')
        .replaceAll('§', '.*') +
      '$',
  );
}

/** Blast radius implied by concrete changed paths. Used by `zeus impact`. */
export function classifyPaths(files = []) {
  let radius = 'local';
  let reversibility = 'reversible';
  for (const file of files) {
    for (const rule of blastRadius.pathRules) {
      if (!globToRe(rule.glob).test(file)) continue;
      if (RADIUS_RANK[rule.blastRadius] > RADIUS_RANK[radius]) radius = rule.blastRadius;
      if (REVERSIBILITY_RANK[rule.reversibility] > REVERSIBILITY_RANK[reversibility])
        reversibility = rule.reversibility;
    }
  }
  return { blastRadius: radius, reversibility };
}

/* ------------------------------------------------------------------ *
 * Routing
 * ------------------------------------------------------------------ */

function resolveStop(s, mode) {
  if (mode === 'answer') return 'answer';
  if (mode === 'plan') return 'plan';
  if (mode === 'audit') return 'answer';

  let stop = 'local-green';
  for (const [candidate, matchers] of STOP_SIGNALS) {
    if (anyMatch(s, matchers) && STOP_RANK[candidate] > STOP_RANK[stop]) stop = candidate;
  }
  if (mode === 'release' && STOP_RANK[stop] < STOP_RANK['production-verified'])
    stop = 'production-verified';
  return stop;
}

export function route(task, forcedTier = null) {
  const c = classify(task);
  const s = normalise(task);

  const scored = MODULES.map((m) => {
    if (anyMatch(s, m.negativeRes)) return null;
    const score = countMatches(s, m.phraseRes) * 2 + countMatches(s, m.tokenRes);
    if (score === 0) return null;
    return { id: m.id, path: m.path, score, priority: m.priority };
  })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || b.priority - a.priority);

  const force = (id) => {
    if (scored.some((x) => x.id === id)) return;
    const m = MODULES.find((x) => x.id === id);
    if (m) scored.unshift({ id: m.id, path: m.path, score: 2, priority: m.priority });
  };
  if (c.mode === 'release') force('release-production');
  if (c.mode === 'incident') force('incident');

  let radius = 'local';
  const bump = (id) => {
    if (RADIUS_RANK[id] > RADIUS_RANK[radius]) radius = id;
  };
  const { minScoreForFullRadius, cappedRadius } = blastRadius.moduleContribution;
  for (const m of scored) {
    const def = MODULES.find((x) => x.id === m.id);
    if (!def?.blastRadius) continue;
    // A single weak token match must not drag a variable rename into the public lane.
    const contribution =
      m.score >= minScoreForFullRadius
        ? def.blastRadius
        : RADIUS_RANK[def.blastRadius] > RADIUS_RANK[cappedRadius]
          ? cappedRadius
          : def.blastRadius;
    bump(contribution);
  }
  if (c.mode === 'release' || c.mode === 'incident') bump('production');
  if (c.mode === 'answer' || c.mode === 'plan') radius = 'local';

  let risk = c.risk;
  if (RADIUS_RANK[radius] >= RADIUS_RANK.persistent && RISK_RANK[risk] < RISK_RANK.high)
    risk = 'high';
  if (c.reversibility === 'irreversible' && RISK_RANK[risk] < RISK_RANK.high) risk = 'high';

  const riskTier = risk === 'low' ? 'fast' : risk === 'moderate' ? 'standard' : 'deep';
  const radiusTier = RADIUS_LEVEL[radius]?.minimumTier ?? 'fast';
  let tier = forcedTier ?? TIER_BY_RANK[Math.max(TIER_RANK[riskTier], TIER_RANK[radiusTier])];
  // A question or a plan never buys a deep execution budget on topic alone.
  if ((c.mode === 'answer' || c.mode === 'plan') && !forcedTier)
    tier = TIER_BY_RANK[Math.min(TIER_RANK[tier], TIER_RANK.standard)];

  const limit = config.budgets[tier].modules;

  return {
    mode: c.mode,
    risk,
    tier,
    deliveryStop: resolveStop(s, c.mode),
    blastRadius: radius,
    reversibility: c.reversibility,
    modules: scored.slice(0, limit),
    droppedModules: scored.slice(limit).map((x) => x.id),
  };
}

/* ------------------------------------------------------------------ *
 * Method selection
 *
 * New in Zeus 5. Zeus 4 routed domain knowledge but never selected a
 * reasoning method, so depth was left entirely to the model. Selection is
 * scope-gated: a marketing method is never proposed for a geometry defect.
 * ------------------------------------------------------------------ */

export function selectMethods(task, routed) {
  const s = normalise(task);
  const budget = config.budgets[routed.tier];

  const scopes = new Set(methodRegistry.modeDefaults[routed.mode]?.scopes ?? ['eng']);
  for (const m of routed.modules) for (const sc of MODULE_SCOPES[m.id] ?? []) scopes.add(sc);
  for (const [scope, matchers] of Object.entries(SCOPE_SIGNALS))
    if (anyMatch(s, matchers)) scopes.add(scope);
  scopes.add('fmt');

  const byLabel = (label) => METHODS.find((m) => m.label === label);
  const scoreOf = (m) => countMatches(s, m.triggerRes);

  const selectable = METHODS.filter(
    (m) => !m.aliasOf && m.scopes.some((sc) => scopes.has(sc)) && !m.scopes.includes('fmt'),
  );
  const ranked = selectable
    .map((m) => ({ m, score: scoreOf(m) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.m.label.localeCompare(b.m.label));

  const modeDefault = methodRegistry.modeDefaults[routed.mode] ?? {};
  // "Implement the door tool" is not a defect report. Without a defect signal the
  // right opening move is to establish what the repository already does.
  const defaultPrimary =
    modeDefault.defectFallbackPrimary && scoreOf(byLabel(modeDefault.primary)) === 0
      ? modeDefault.defectFallbackPrimary
      : (modeDefault.primary ?? 'DEBUG');
  const primary =
    ranked.length && ranked[0].score >= 2 ? ranked[0].m : (byLabel(defaultPrimary) ?? ranked[0]?.m);

  const supporting = [];
  const push = (m) => {
    if (!m || m.label === primary?.label) return;
    if (supporting.some((x) => x.label === m.label)) return;
    supporting.push(m);
  };
  for (const { m } of ranked) {
    if (supporting.length >= budget.supportingMethods) break;
    push(m);
  }
  for (const label of methodRegistry.riskMandated[routed.risk] ?? []) push(byLabel(label));

  const formatting = METHODS.filter(
    (m) => !m.aliasOf && m.scopes.includes('fmt') && scoreOf(m) > 0,
  ).slice(0, 2);

  return {
    primary: primary?.label ?? defaultPrimary,
    supporting: supporting.map((m) => m.label),
    formatting: formatting.map((m) => m.label),
    scopes: [...scopes].sort(),
  };
}

/* ------------------------------------------------------------------ *
 * Contract compilation
 * ------------------------------------------------------------------ */

const roleMap = {
  architecture: 'product-architecture',
  geometry: 'geometry-bim',
  'editor-input': 'editor-interaction',
  arqfs: 'arqfs-recovery',
  rendering: 'rendering-performance',
  'ui-visual': 'ui-visual',
  accessibility: 'accessibility',
  security: 'security',
  'github-cicd': 'delivery-reliability',
  'release-production': 'delivery-reliability',
  ai: 'ai-arqscript',
  interoperability: 'interoperability',
  incident: 'incident-commander',
};

export function compile(task) {
  const r = route(task);
  const budget = config.budgets[r.tier];
  const ids = r.modules.map((x) => x.id);
  const level = RADIUS_LEVEL[r.blastRadius];
  const methods = selectMethods(task, r);

  const owner =
    roleMap[ids[0]] ??
    (r.mode === 'release' || r.mode === 'incident' ? 'delivery-reliability' : 'executor');

  const reviewers = [];
  if (RISK_RANK[r.risk] >= RISK_RANK.high || level.requiresReview) {
    reviewers.push('qa-release');
    if (!ids.includes('security') && RADIUS_RANK[r.blastRadius] >= RADIUS_RANK.persistent)
      reviewers.push('security');
  }

  const agentLimit = r.tier === 'deep' ? 4 : r.tier === 'standard' ? 2 : 0;
  const reviewAgents = [
    ...new Set(ids.flatMap((id) => MODULES.find((m) => m.id === id)?.reviewers ?? [])),
  ].slice(0, agentLimit);

  const acceptance = [
    'authoritative current state inspected',
    'requested success and failure paths work',
    'applicable Arq invariants remain satisfied',
    `${r.deliveryStop} has current evidence`,
  ];
  if (ids.includes('ui-visual'))
    acceptance.push('visual states, responsive matrix and screenshot diff reviewed');
  if (ids.includes('arqfs'))
    acceptance.push('integrity, recovery and source-preservation evidence passes');
  for (const extra of level.extraEvidence ?? []) acceptance.push(extra);
  if (level.requiresRollbackPlan) acceptance.push('rollback or compensating action stated');
  if (r.reversibility === 'irreversible')
    acceptance.push('irreversible step confirmed with the operator before execution');

  const checks = [
    'ranked context retrieval',
    'impact-selected focused checks',
    'actual output inspection',
  ];
  if (r.tier !== 'fast')
    checks.push('affected package quality checks', 'independent critique pass');
  if (r.tier === 'deep') checks.push('uncached protected gates and rollback evidence');

  return {
    version: '5.0.0',
    intent: task.trim().slice(0, 320),
    mode: r.mode,
    risk: r.risk,
    tier: r.tier,
    deliveryStop: r.deliveryStop,
    blastRadius: r.blastRadius,
    reversibility: r.reversibility,
    modules: ids,
    modulePaths: r.modules.map((x) => x.path),
    methods,
    owner,
    reviewers,
    reviewAgents,
    scope: [`deliver the requested Arq outcome to ${r.deliveryStop}`],
    nonGoals: [
      'no unrelated platform expansion',
      'no bypass of safety, evidence or authority gates',
    ],
    acceptance,
    checks,
    budget,
    cachePolicy:
      r.tier === 'fast' && RADIUS_RANK[r.blastRadius] < RADIUS_RANK.persistent
        ? 'fingerprinted short-lived pass cache allowed'
        : 'no critical gate cache',
  };
}

export function markdown(c) {
  const stack = [
    c.methods.primary,
    ...c.methods.supporting,
    ...(c.methods.formatting.length ? [`then ${c.methods.formatting.join(', ')}`] : []),
  ].join(' + ');
  return [
    '# Zeus 5 Compact Contract',
    '',
    `**Mode / risk / tier / stop:** ${c.mode} / ${c.risk} / ${c.tier} / ${c.deliveryStop}`,
    `**Blast radius / reversibility:** ${c.blastRadius} / ${c.reversibility}`,
    `**Owner:** ${c.owner}${c.reviewers.length ? ` · Review: ${c.reviewers.join(', ')}` : ''}${c.reviewAgents.length ? ` · Agents: ${c.reviewAgents.join(', ')}` : ''}`,
    `**Modules:** ${c.modules.join(', ') || 'kernel only'}`,
    `**Method:** ${stack}`,
    '',
    '**Acceptance**',
    ...c.acceptance.map((x) => `- [ ] ${x}`),
    '',
    '**Checks**',
    ...c.checks.map((x) => `- ${x}`),
    '',
  ].join('\n');
}

/* ------------------------------------------------------------------ *
 * Execution prompt
 *
 * The compact contract states what Zeus decided. The execution prompt is the
 * instruction block those decisions compile into — the prompt the executor
 * actually works from. Rendering it makes the routing transparent: the
 * operator sees, for every request, exactly what Zeus told the executor to
 * do, in which order, with which methods, and what evidence closes it.
 * ------------------------------------------------------------------ */

const methodLine = (label, tag) => {
  const m = METHODS.find((x) => x.label === label);
  return `- **${tag}** \`${label}\`${m?.effect ? ` — ${m.effect}` : ''}`;
};

export function executionPrompt(c) {
  const moduleLines = c.modules.length
    ? c.modules.map((id, i) => {
        const m = MODULES.find((x) => x.id === id);
        return `- ${m?.title ?? id} → \`${c.modulePaths[i] ?? ''}\``;
      })
    : ['- none — the fast kernel alone carries this task'];

  const stack = [
    methodLine(c.methods.primary, 'primary'),
    ...c.methods.supporting.map((l) => methodLine(l, 'support')),
    ...c.methods.formatting.map((l) => methodLine(l, 'format, last')),
  ];

  const reviewers = [
    c.reviewers.length ? `role review: ${c.reviewers.join(', ')}` : null,
    c.reviewAgents.length ? `independent agents: ${c.reviewAgents.join(', ')}` : null,
  ].filter(Boolean);

  return [
    '# Zeus 5 Execution Prompt',
    '',
    '_The full prompt compiled for this request — what the executor is told to do._',
    '',
    `You are the Arq **${c.owner}**, accountable for this ${c.tier}-tier ${c.mode} task.`,
    `Risk **${c.risk}** · blast radius **${c.blastRadius}** · reversibility **${c.reversibility}**.`,
    `Deliver to **${c.deliveryStop}** and stop there; later stages are non-goals.`,
    '',
    '**Task**',
    `> ${c.intent}`,
    '',
    '**1. Load** `.zeus/FAST-KERNEL.md` plus only the routed modules:',
    ...moduleLines,
    '',
    `**2. Retrieve** ranked evidence within budget (${c.budget.sources} sources, ${c.budget.contextChars} chars):`,
    `\`node scripts/zeus.mjs context --query "<task terms>"\` — never whole-repository reads.`,
    '',
    '**3. Apply** the method stack in order:',
    ...stack,
    '',
    `**4. Execute** the smallest complete slice that reaches ${c.deliveryStop}.`,
    ...c.nonGoals.map((g) => `- non-goal: ${g}`),
    '',
    `**5. Verify** with the ${c.tier} check ladder: \`node scripts/zeus.mjs check --tier ${c.tier}\` (${c.cachePolicy}).`,
    ...c.checks.map((x) => `- ${x}`),
    '',
    '**6. Prove acceptance** — every box needs current evidence, and only `verified` is green:',
    ...c.acceptance.map((x) => `- [ ] ${x}`),
    '',
    `**7. Review and report** — ${reviewers.length ? reviewers.join(' · ') : 'self-review; no independent reviewers routed at this tier'}.`,
    `Report each claim with its evidence state (verified, partially-verified, inferred, assumed, blocked, not-inspected, failed). Repair within ${c.budget.repairRounds} rounds, then report what still fails.`,
    '',
    '**8. Handoff** with exactly one final state: green, partial, blocked, failed or rolled_back. Never "perfect", never a claim without its evidence.',
    '',
    '**Standing orders (always on, nobody has to ask)**',
    '- Critique your own result and repair it before reporting; the operator never has to type "check your work".',
    '- Any prompt you write for a subagent or another model is shown in full, in a fenced code block, before dispatch (`node scripts/zeus.mjs prompt-lint` checks its shape). Never dispatch a prompt the operator has not seen.',
    '- Only verified evidence is green; unknown, blocked and failed are never green.',
    '- Engineering OS 5.0 owns the merge gate and the Arq Language System 4.1 owns public wording; report defects to them, never re-decide for them.',
    '',
  ].join('\n');
}

export { config, manifest, methodRegistry, blastRadius };
