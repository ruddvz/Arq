// Shared root ESLint flat config. Individual packages extend this via their
// own eslint.config.js re-exporting and appending package-specific rules.
// Kept minimal until real source exists (see issue "configure formatting,
// linting and type checking") - expand rules as packages/apps come online.
export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.d.ts'],
  },
];
