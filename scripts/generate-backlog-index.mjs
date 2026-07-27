#!/usr/bin/env node
/**
 * Regenerates the backlog index files (backlog/ISSUES.md, backlog/issues.json,
 * backlog/issues.csv) from the issue files in backlog/issues/.
 *
 * The indexes drifted once already: the 2026-07-24 pack extension brought the
 * backlog to 242 issue files while ISSUES.md stopped at 189 and
 * issues.json/csv at 191, leaving the 53 file-system/SQLite/Rust-core items
 * invisible to anyone reading the index. A checked-in generator makes the
 * index a build product of the issue files - the same fix the SBOM uses.
 *
 * Deliberately not a status tracker: issue completion is recorded in git and
 * GitHub history (commit messages reference ARQ-### ids), and inventing a
 * done/open column here without verifying each claim would violate the
 * project's own honesty rules. ISSUES.md says exactly that in its header.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const issuesDir = path.join(repoRoot, 'backlog', 'issues');

function parseIssue(fileName) {
  const text = readFileSync(path.join(issuesDir, fileName), 'utf8');
  const lines = text.split('\n');
  const title = (lines[0] ?? '').replace(/^#\s*/, '').trim();
  const header = (name) => {
    const match = text.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+)`));
    return match === null ? '' : match[1].trim();
  };
  const number = Number(fileName.slice(0, 3));
  const id = header('Issue ID') || `ARQ-${String(number).padStart(3, '0')}`;
  const labelsRaw = header('Suggested labels');
  const labels = labelsRaw
    .split(',')
    .map((label) => label.trim())
    .filter((label) => label !== '')
    .join(';');
  const areaLabel = labels.split(';').find((label) => label.startsWith('area: '));
  const dependenciesRaw = header('Dependencies');
  const dependencies =
    dependenciesRaw === 'None' || dependenciesRaw === ''
      ? ''
      : dependenciesRaw
          .split(',')
          .map((dep) => dep.trim())
          .join(';');
  const acceptanceCriteria = [...text.matchAll(/^- \[[ xX]\] (.+)$/gm)].map((m) => m[1].trim());
  return {
    id,
    number,
    title,
    area: areaLabel === undefined ? title.split(':')[0].trim() : areaLabel.slice('area: '.length),
    phase: header('Phase'),
    epic: header('Epic'),
    priority: header('Priority'),
    labels,
    dependencies,
    file: `backlog/issues/${fileName}`,
    acceptanceCriteria,
  };
}

const files = readdirSync(issuesDir)
  .filter((name) => /^\d{3}-.*\.md$/.test(name))
  .sort();
const issues = files.map(parseIssue);

// Sanity: contiguous numbering with no duplicates, or the index would lie.
const numbers = issues.map((issue) => issue.number);
for (let i = 0; i < numbers.length; i += 1) {
  if (numbers[i] !== i + 1) {
    throw new Error(`Issue numbering broken at ${numbers[i]} (expected ${i + 1})`);
  }
}

const markdown = [
  '# Ordered issue backlog',
  '',
  `${issues.length} issues, regenerated from \`backlog/issues/\` by`,
  '`node scripts/generate-backlog-index.mjs` - edit the issue files, not this index.',
  'Completion state is deliberately not tracked here: merged work references its',
  'ARQ-### id in git history, which is the record of what is done.',
  '',
  ...issues.map((issue) => {
    // Later pack extensions (ARQ-193+) use a named phase or none at all;
    // render whatever headers the file actually has, nothing invented.
    const phasePart = issue.phase === '' ? '' : ` - ${issue.phase}`;
    return `${issue.number}. [${issue.title}](issues/${path.basename(issue.file)})${phasePart} - ${issue.priority}`;
  }),
  '',
].join('\n');
writeFileSync(path.join(repoRoot, 'backlog', 'ISSUES.md'), markdown);

writeFileSync(
  path.join(repoRoot, 'backlog', 'issues.json'),
  `${JSON.stringify(issues, null, 1)}\n`,
);

const csvEscape = (value) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const csv = [
  'id,number,title,area,phase,epic,priority,labels,dependencies,file',
  ...issues.map((issue) =>
    [
      issue.id,
      String(issue.number),
      issue.title,
      issue.area,
      issue.phase,
      issue.epic,
      issue.priority,
      issue.labels,
      issue.dependencies,
      issue.file,
    ]
      .map(csvEscape)
      .join(','),
  ),
  '',
].join('\n');
writeFileSync(path.join(repoRoot, 'backlog', 'issues.csv'), csv);

process.stdout.write(`Indexed ${issues.length} issues into ISSUES.md, issues.json, issues.csv\n`);
