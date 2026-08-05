#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { compile, executionPrompt, markdown } from './lib/zeus-engine.mjs';
const a = process.argv.slice(2);
const val = (n) => {
  const i = a.indexOf(`--${n}`);
  return i >= 0 ? a[i + 1] : null;
};
const task = (val('task') ?? readFileSync(0, 'utf8')).trim();
if (!task) {
  console.error('Provide --task or stdin');
  process.exit(2);
}
const c = compile(task);
const withContract = a.includes('--with-contract');
const out =
  val('format') === 'json'
    ? JSON.stringify(
        {
          contract: c,
          executionPrompt: executionPrompt(c, { omitContractDuplicates: withContract }),
        },
        null,
        2,
      )
    : withContract
      ? `${markdown(c)}\n${executionPrompt(c, { omitContractDuplicates: true })}`
      : executionPrompt(c);
const file = val('out');
if (file) writeFileSync(file, out + '\n');
else console.log(out);
