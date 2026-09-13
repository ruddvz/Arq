import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { it } from 'vitest';

it('prints the canonical Prettier output for the layer contract guard', async () => {
  const path = fileURLToPath(new URL('./layer-contract.test.ts', import.meta.url));
  const source = readFileSync(path, 'utf8');
  const config = (await resolveConfig(path)) ?? {};
  const formatted = await format(source, { ...config, filepath: path });

  throw new Error(`PRETTIER_OUTPUT_START\n${formatted}PRETTIER_OUTPUT_END`);
});
