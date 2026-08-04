#!/usr/bin/env node
/**
 * Duplicate-ADR-ID and decision-mapping verifier.
 *
 * Draft PR #280 is the shape this exists to catch. It was opened against an
 * older base and adds `docs/adr/0027-desktop-shell-deferral.md` plus a decision
 * row `D-024` for a desktop-shell deferral. Both identifiers were free when it
 * was written. Both were taken afterwards by work that merged first: ADR-0027 is
 * now the MCP boundary, and D-024 is now the persistence responsibility split.
 * Nothing in the repository noticed, because every check ran against one tree at
 * a time and each tree was internally consistent. A reviewer had to remember.
 *
 * So this verifier runs in two modes:
 *
 *   tree  - the working tree must be internally consistent: no ADR number used
 *           twice, no decision id used twice, every ADR a decision cites must
 *           exist, and every ADR must declare a Status.
 *   base  - `--base <ref>` additionally rejects an identifier this branch adds
 *           that already exists at the base. That is the check that would have
 *           failed #280, and it cannot be satisfied by looking at either tree
 *           alone.
 *
 * Usage:
 *   node scripts/verify-decision-ids.mjs [--root <dir>] [--base <git-ref>] [--json]
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ADR_DIRECTORY = 'docs/adr';
const REGISTER_PATH = 'docs/product/DECISION-REGISTER.csv';
const ADR_FILENAME = /^(\d{4})-[a-z0-9-]+\.md$/;
const ADR_HEADING = /^#\s*ADR-(\d{3,4})\b/m;
const ADR_STATUS = /^\*\*Status:\*\*\s*(.+)$/m;
const ADR_REFERENCE = /\bADR-(\d{3,4})\b/g;

/**
 * How much wording two versions of a decision must share before they count as
 * the same decision. Exact equality is the obvious rule and the wrong one: it
 * rejects "Proposed X" becoming "Accepted X", which is ordinary governance, and
 * a check that blocks ordinary governance gets switched off. What matters is
 * whether the id still decides the same thing. The #280 shape - "persistence
 * responsibility split" becoming "defer a Tauri desktop shell" - shares almost
 * no wording and fails comfortably below this threshold.
 */
const DECISION_SAME_SUBJECT_OVERLAP = 0.6;

function wordOverlap(before, after) {
  const words = (text) =>
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 2),
    );
  const a = words(before);
  const b = words(after);
  if (a.size === 0 || b.size === 0) return 1;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  // Overlap coefficient, not Jaccard. Jaccard divides by the union, so adding
  // detail to a decision scores as low as replacing it: a three-word row that
  // grows into a full sentence drops under any useful threshold even when every
  // original word survives. Dividing by the smaller set asks the question that
  // matters - is one still about the same thing as the other - and a genuinely
  // different decision shares almost nothing either way.
  return shared / Math.min(a.size, b.size);
}

function parseArguments(argv) {
  const options = { root: process.cwd(), base: null, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--root') {
      options.root = argv[index + 1];
      index += 1;
    } else if (option === '--base') {
      options.base = argv[index + 1];
      index += 1;
    } else if (option === '--json') {
      options.json = true;
    } else {
      throw new Error(`Unknown argument: ${option}`);
    }
  }
  return options;
}

/**
 * A minimal RFC 4180 reader. The register's decision text contains commas and
 * quoted passages, so splitting on commas silently mis-parses rows and can hide
 * a duplicate id in a field that is not the id.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (character !== '\r') {
      field += character;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim() !== ''));
}

function readAdrIds(root) {
  const directory = path.join(root, ADR_DIRECTORY);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const match = ADR_FILENAME.exec(name);
      const contents = readFileSync(path.join(directory, name), 'utf8');
      const heading = ADR_HEADING.exec(contents);
      const status = ADR_STATUS.exec(contents);
      return {
        file: `${ADR_DIRECTORY}/${name}`,
        name,
        fileId: match ? match[1] : null,
        headingId: heading ? heading[1].padStart(4, '0') : null,
        status: status ? status[1].trim() : null,
      };
    });
}

function readDecisions(root) {
  const file = path.join(root, REGISTER_PATH);
  if (!existsSync(file)) return { rows: [], header: [] };
  const rows = parseCsv(readFileSync(file, 'utf8'));
  return { header: rows[0] ?? [], rows: rows.slice(1) };
}

function idsAtRef(ref, root) {
  const run = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  const adrFiles = [];
  const decisionRows = new Map();
  let listing = '';
  try {
    listing = run(['ls-tree', '--name-only', `${ref}:${ADR_DIRECTORY}`]);
  } catch {
    return { adrFiles, decisionRows, available: false };
  }
  for (const name of listing.split('\n')) {
    const trimmed = name.trim();
    if (ADR_FILENAME.test(trimmed)) adrFiles.push(trimmed);
  }
  try {
    const register = run(['show', `${ref}:${REGISTER_PATH}`]);
    for (const row of parseCsv(register).slice(1)) {
      const id = row[0]?.trim();
      if (id) decisionRows.set(id, row);
    }
  } catch {
    // A base without the register still supports the ADR half of the check.
  }
  return { adrFiles, decisionRows, available: true };
}

export function verifyDecisionIds({ root = process.cwd(), base = null } = {}) {
  const errors = [];
  const adrs = readAdrIds(root);
  const { rows } = readDecisions(root);

  const byFileId = new Map();
  for (const adr of adrs) {
    if (adr.fileId === null) {
      errors.push(`ADR filename is not <nnnn>-<slug>.md: ${adr.file}`);
      continue;
    }
    if (!byFileId.has(adr.fileId)) byFileId.set(adr.fileId, []);
    byFileId.get(adr.fileId).push(adr.file);
    if (adr.headingId !== null && adr.headingId !== adr.fileId) {
      errors.push(
        `ADR ${adr.file} is numbered ${adr.fileId} but its heading says ADR-${adr.headingId}`,
      );
    }
    if (adr.status === null) {
      errors.push(`ADR ${adr.file} declares no "**Status:**"`);
    }
  }
  for (const [id, files] of byFileId) {
    if (files.length > 1) {
      errors.push(`ADR id ${id} is used by ${files.length} files: ${files.join(', ')}`);
    }
  }

  const seenDecisions = new Map();
  const knownAdrIds = new Set([...byFileId.keys()]);
  for (const row of rows) {
    const id = (row[0] ?? '').trim();
    if (id === '') continue;
    if (seenDecisions.has(id)) {
      errors.push(`Decision id ${id} appears more than once in ${REGISTER_PATH}`);
    }
    seenDecisions.set(id, row);
    const evidence = row[3] ?? '';
    for (const match of evidence.matchAll(ADR_REFERENCE)) {
      const referenced = match[1].padStart(4, '0');
      // ADR-001 style references in older rows resolve to 0001.
      if (!knownAdrIds.has(referenced)) {
        errors.push(`Decision ${id} cites ADR-${match[1]}, which has no file in ${ADR_DIRECTORY}`);
      }
    }
  }

  const summary = {
    adrs: adrs.length,
    decisions: seenDecisions.size,
    base: base ?? null,
    baseComparisonRan: false,
  };

  if (base !== null) {
    const at = idsAtRef(base, root);
    summary.baseComparisonRan = at.available;
    if (!at.available) {
      errors.push(`Base ref ${base} could not be read; the added-id comparison did not run`);
    } else {
      // The collision shape: this branch adds a *file* whose ADR number is
      // already taken at the base by a *different* file. Presence of the id at
      // base is not itself a fault - editing ADR-0027 in place is normal - so
      // the filename has to differ for it to count.
      const baseFilesById = new Map();
      for (const name of at.adrFiles) {
        const match = ADR_FILENAME.exec(name);
        if (match) baseFilesById.set(match[1], name);
      }
      for (const [id, files] of byFileId) {
        const baseFile = baseFilesById.get(id);
        if (baseFile === undefined) continue;
        for (const file of files) {
          if (path.basename(file) !== baseFile) {
            errors.push(
              `ADR id ${id} is already ${ADR_DIRECTORY}/${baseFile} at ${base}; this branch adds ${file} for the same id`,
            );
          }
        }
      }
      // Same rule for decisions, applied to the decision text only. Moving a
      // row from proposed to accepted, or adding evidence, is ordinary
      // governance and must stay allowed. Rewriting what the id *decides* is
      // the #280 shape: D-024 meant the persistence split, and that branch
      // would have made it mean a desktop-shell deferral.
      for (const [id, row] of seenDecisions) {
        const baseRow = at.decisionRows.get(id);
        if (baseRow === undefined) continue;
        const before = (baseRow[1] ?? '').trim();
        const after = (row[1] ?? '').trim();
        if (before === '' || after === '') continue;
        const overlap = wordOverlap(before, after);
        if (overlap < DECISION_SAME_SUBJECT_OVERLAP) {
          errors.push(
            `Decision ${id} decides something different from ${base} (${Math.round(overlap * 100)}% shared wording): ` +
              'the id is already taken, allocate the next free id instead',
          );
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, summary };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = verifyDecisionIds(options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const error of result.errors) console.error(`FAIL ${error}`);
    if (result.ok) {
      console.log(
        `PASS ${result.summary.adrs} ADRs and ${result.summary.decisions} decisions have unique, resolvable ids` +
          (result.summary.baseComparisonRan ? ` (compared against ${result.summary.base})` : ''),
      );
    }
  }
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
