/**
 * Public marketing website.
 *
 * Static HTML rendered from typed page modules - see build.ts (renderer),
 * routes.ts (the page registry, PUB-001..PUB-017 plus 404) and
 * src/content/ (one module per sheet). `pnpm build` renders dist/;
 * `pnpm dev` builds and serves a local preview.
 */
export { allPages } from './routes.js';
export { renderDocument } from './layout.js';
export { buildSite } from './build.js';
