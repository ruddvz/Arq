#!/usr/bin/env node
// Zeus 5 delegated-prompt linter.
//
// A prompt written for a subagent or another model is itself a deliverable: it must
// carry everything the executor needs, because the executor has no other context.
// This lints a handoff package (file or stdin) for the seven parts `/zeus-handoff`
// defines, in service of the standing order that no delegated prompt is dispatched
// unseen or under-specified. Hard failures exit 1; warnings exit 0.
import { readFileSync } from 'node:fs';

const a = process.argv.slice(2);
const file = a.find((x) => !x.startsWith('--'));
const text = file ? readFileSync(file, 'utf8') : readFileSync(0, 'utf8');
if (!text.trim()) {
  console.error('Provide a prompt file or stdin');
  process.exit(2);
}

const SECTIONS = [
  ['role', /\brole\b/i],
  ['context', /\bcontext( pack)?\b|\bcurrent[- ]state\b|\bevidence\b/i],
  ['task', /\btask( spec)?\b|\bobjective\b|\boutcome\b/i],
  ['acceptance', /\bacceptance\b/i],
  ['verification', /\bverif(y|ication)\b|\bcheck(s| ladder)?\b/i],
  ['critique', /\bcritique\b|\breview\b|\bred[- ]team\b/i],
  ['handoff', /\bhandoff\b|\breport(ing)? format\b|\bfinal state\b/i],
];

// A section counts only when its signal appears on a heading or bolded label line,
// not buried mid-sentence, because the executor scans structure, not prose.
const lines = text.split(/\r?\n/);
const structural = lines.filter((l) =>
  /^\s*(#{1,6}\s|\*\*|[-*]\s+\*\*|[A-Z][A-Z /-]{3,}:?\s*$)/.test(l),
);
const structuralText = structural.join('\n');

const errors = [];
const warnings = [];
for (const [name, re] of SECTIONS) {
  if (re.test(structuralText)) continue;
  if (re.test(text))
    warnings.push(`section "${name}" is only mentioned in prose, not as a structural heading`);
  else errors.push(`missing section: ${name}`);
}

if (text.length < 2500 && /read the docs|see documentation|refer to the (docs|readme)/i.test(text))
  warnings.push(
    'prompt points at documentation but inlines under 2500 chars of context; inline the task-critical facts',
  );
if (
  /\bmerge\b|\bdeploy\b|\bproduction\b/i.test(text) &&
  !/authority|engineering os|gate/i.test(text)
)
  warnings.push(
    'prompt reaches merge/deploy/production but never names the authority gate (Engineering OS 5.0)',
  );
if (!/non[- ]goal/i.test(text))
  warnings.push('no non-goals stated; the executor cannot know where to stop');
if (!/verified|evidence state/i.test(text))
  warnings.push('no typed evidence language; the executor may report unverified work as done');

for (const w of warnings) console.error(`warn: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`fail: ${e}`);
  console.error(
    `Zeus prompt lint failed (${errors.length} missing of ${SECTIONS.length} required sections).`,
  );
  process.exit(1);
}
console.log(
  `Zeus prompt lint passed (${SECTIONS.length} sections${warnings.length ? `, ${warnings.length} warnings` : ''}).`,
);
