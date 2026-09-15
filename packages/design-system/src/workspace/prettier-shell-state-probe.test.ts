import { readFileSync } from 'node:fs';
import { format } from 'prettier';
import { it } from 'vitest';

it('prints the exact Prettier output for the shell state contract test', async () => {
  const source = readFileSync(new URL('./shell-state.test.ts', import.meta.url), 'utf8');
  const formatted = await format(source, { parser: 'typescript' });
  throw new Error(`PRETTIER_OUTPUT_START\n${formatted}\nPRETTIER_OUTPUT_END`);
});
