#!/usr/bin/env node
// Zeus 5 delegated-prompt linter.
//
// A prompt written for a subagent or another model is itself a deliverable: it must
// carry everything the executor needs, because the executor has no other context.
// This lints a handoff package (file or stdin) for seven structural sections that
// compress the elements `/zeus-handoff` defines (its "Arq context and invariants"
// and "current-state evidence" collapse into one `context` check here; "task and
// non-goals" becomes `task` plus a separate non-goals warning below), in service of
// the standing order that no delegated prompt is dispatched unseen or
// under-specified. Hard failures exit 1; warnings exit 0.
import { readFileSync } from 'node:fs';

const a = process.argv.slice(2);
const file = a.find((x) => !x.startsWith('--'));
const text = file ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8');
if (!text.trim()) {
  console.error('Provide a prompt file or stdin');
  process.exit(2);
}

const SECTIONS = [
  ['role', /\brole\b|\bpersona\b/i],
  ['context', /\bcontext( pack)?\b|\bcurrent[- ]state\b|\bevidence\b|\bbackground\b/i],
  ['task', /\btask( spec)?\b|\bobjective\b|\boutcome\b/i],
  ['acceptance', /\bacceptance\b|\bdefinition of done\b|\bdod\b|\bsuccess criteria\b/i],
  // (?<!-)...( ?!-) keeps "qa" from matching inside hyphenated identifiers like the
  // "qa-release" reviewer role name, which would otherwise falsely fire this section.
  ['verification', /\bverif(y|ication)\b|\bcheck(s| ladder)?\b|(?<!-)\bqa\b(?!-)/i],
  ['critique', /\bcritique\b|\breview\b|\bred[- ]team\b/i],
  ['handoff', /\bhandoff\b|\breport(ing)? format\b|\bfinal state\b|\bsign[- ]?off\b/i],
];

// Strip fenced code blocks first: a heading-shaped line quoted inside a ``` fence
// (an example, a template, a "don't write it like this" sample) is not a real
// section of this prompt and must not satisfy the lint.
const withoutFences = text.replace(/```[\s\S]*?```/g, '');

// A section counts only when its signal appears on a heading or bolded label line,
// not buried mid-sentence, because the executor scans structure, not prose.
const lines = withoutFences.split(/\r?\n/);
const structural = lines.filter((l) =>
  /^\s*(#{1,6}\s|\*\*|[-*]\s+\*\*|[A-Z][A-Z /-]{3,}:?\s*$)/.test(l),
);

// A real heading names one concept. A single line that strings together every
// trigger word (e.g. to game this exact check) matches most of SECTIONS at once;
// cap how many sections one line may satisfy so that kind of line is ignored,
// while a legitimately combined heading ("Verification & Critique") still counts.
const MAX_SECTIONS_PER_LINE = 2;
const satisfiedSections = new Set();
for (const line of structural) {
  const hits = SECTIONS.filter(([, re]) => re.test(line));
  if (hits.length > 0 && hits.length <= MAX_SECTIONS_PER_LINE) {
    for (const [name] of hits) satisfiedSections.add(name);
  }
}

const errors = [];
const warnings = [];
for (const [name, re] of SECTIONS) {
  if (satisfiedSections.has(name)) continue;
  if (re.test(withoutFences))
    warnings.push(`section "${name}" is only mentioned in prose, not as a structural heading`);
  else errors.push(`missing section: ${name}`);
}

if (
  withoutFences.length < 2500 &&
  /read the docs|see documentation|refer to the (docs|readme)/i.test(withoutFences)
)
  warnings.push(
    'prompt points at documentation but inlines under 2500 chars of context; inline the task-critical facts',
  );
if (
  /\bmerge\b|\bdeploy\b|\bproduction\b/i.test(withoutFences) &&
  !/authority|engineering os|gate/i.test(withoutFences)
)
  warnings.push(
    'prompt reaches merge/deploy/production but never names the authority gate (Engineering OS 5.0)',
  );
if (!/non[- ]goal/i.test(withoutFences))
  warnings.push('no non-goals stated; the executor cannot know where to stop');
if (!/verified|evidence state/i.test(withoutFences))
  warnings.push('no typed evidence language; the executor may report unverified work as done');

// A prompt is used programmatically as a dispatch gate (exit code, not prose), so a
// prompt where most sections exist only as scattered keywords — never a real heading
// with content under it — must not exit 0 just because each individual section is
// merely a soft warning. Enough of those at once is under-specified or gamed, not
// delegatable, and gating code that only checks the exit code must see it fail.
const structuralWarnings = warnings.filter((w) => w.includes('only mentioned in prose'));
if (structuralWarnings.length >= Math.ceil(SECTIONS.length / 2))
  errors.push(
    `${structuralWarnings.length} of ${SECTIONS.length} sections have no real heading, only scattered keyword mentions`,
  );

for (const w of warnings) console.error(`warn: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`fail: ${e}`);
  console.error(
    `Zeus prompt lint failed (${errors.length} issue${errors.length === 1 ? '' : 's'}).`,
  );
  process.exit(1);
}
console.log(
  `Zeus prompt lint passed (${SECTIONS.length} sections${warnings.length ? `, ${warnings.length} warnings` : ''}).`,
);
