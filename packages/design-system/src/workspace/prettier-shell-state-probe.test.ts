import { readFileSync } from 'node:fs';
import { format } from 'prettier';
import { it } from 'vitest';

const OPTIONS = {
  semi: true,
  singleQuote: true,
  trailingComma: 'all' as const,
  printWidth: 100,
  arrowParens: 'always' as const,
};

it('prints the exact repository-formatted shell state files', async () => {
  const component = readFileSync(new URL('./shell-state.tsx', import.meta.url), 'utf8');
  const test = readFileSync(new URL('./shell-state.test.ts', import.meta.url), 'utf8');
  const css = readFileSync(new URL('./shell-state.css', import.meta.url), 'utf8');
  const formattedComponent = await format(component, { ...OPTIONS, parser: 'typescript' });
  const formattedTest = await format(test, { ...OPTIONS, parser: 'typescript' });
  const formattedCss = await format(css, { ...OPTIONS, parser: 'css' });
  throw new Error(
    `COMPONENT_START\n${formattedComponent}\nCOMPONENT_END\nTEST_START\n${formattedTest}\nTEST_END\nCSS_START\n${formattedCss}\nCSS_END`,
  );
});
