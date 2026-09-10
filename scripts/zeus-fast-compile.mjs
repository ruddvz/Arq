#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { compile, markdown } from './lib/zeus-engine.mjs';
import { graphMarkdown, repositoryEvidence } from './lib/zeus-repository-evidence.mjs';

const a = process.argv.slice(2);
const val = (n) => {
  const i = a.indexOf(`--${n}`);
  return i >= 0 ? a[i + 1] : null;
};
const values = (name) =>
  a.flatMap((arg, index) => (arg === `--${name}` && a[index + 1] ? [a[index + 1]] : []));

const task = (val('task') ?? (process.stdin.isTTY ? '' : readFileSync(0, 'utf8'))).trim();
if (!task) {
  console.error('Provide --task or stdin');
  process.exit(2);
}

const contract = compile(task);
const graphSeeds = values('graph-seed');
const graph = graphSeeds.length ? repositoryEvidence(val('root') ?? process.cwd(), graphSeeds) : null;
if (graph) contract.repositoryIntelligence = graph;

const out =
  val('format') === 'json'
    ? JSON.stringify(contract, null, 2)
    : [markdown(contract), graph ? graphMarkdown(graph) : null].filter(Boolean).join('\n\n');
const file = val('out');
if (file) writeFileSync(file, out + '\n');
else console.log(out);
