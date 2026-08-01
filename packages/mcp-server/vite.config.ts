import { defineConfig } from 'vite';

/**
 * Builds the one artifact this package needs to be a server rather than a
 * library: a single Node module a client can launch.
 *
 * Every other workspace package is consumed as TypeScript source by a
 * bundler. This one is different because an MCP client launches a process
 * and speaks to it over stdio - it cannot import source. Node's own type
 * stripping does not help either: the workspace packages this depends on
 * use extensionless relative imports, which Node's ESM resolver rejects.
 *
 * `noExternal` is the important line. Vite's SSR build externalises
 * everything listed in `dependencies` by default, which would leave the
 * output importing `@arq/bim-core` at runtime and failing for the reason
 * above. Bundling the workspace packages in - and only those - produces a
 * file that runs with plain `node` and no resolution setup.
 */
export default defineConfig({
  build: {
    ssr: 'src/bin/stdio-entry.ts',
    outDir: 'dist',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    rollupOptions: {
      output: { entryFileNames: 'arq-mcp-stdio.mjs', format: 'es' },
    },
  },
  ssr: {
    noExternal: [/^@arq\//],
  },
});
