import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDocument } from './layout.js';
import { allPages } from './routes.js';
import { findRepoRoot, loadSbom } from './open-source-data.js';

/**
 * Renders the static site into dist/.
 *
 * Output layout follows static-host conventions: each route becomes
 * route/index.html; the not-found sheet becomes /404.html. Brand assets are
 * copied from brand/ (the single source of truth - nothing is duplicated
 * into this app), fonts from assets/fonts/, and robots.txt is generated.
 *
 * No sitemap is emitted deliberately: a sitemap requires absolute URLs, and
 * the project has not cleared a domain yet (remaining/REMAINING-WORK.md).
 * Set SITE_ORIGIN, e.g. "https://example.com", once a domain exists.
 */

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..');
const repoRoot = findRepoRoot(here);
const dist = join(appRoot, 'dist');

function ensureSbom(): void {
  if (existsSync(join(repoRoot, 'dependency-sbom.json'))) {
    return;
  }
  // Generated file - regenerate it the same way CI does (ARQ-016).
  execFileSync('node', [join(repoRoot, 'scripts', 'check-dependency-licences.mjs')], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

function writePage(route: string, htmlText: string): void {
  const target =
    route === '/404' ? join(dist, '404.html') : join(dist, route.slice(1), 'index.html');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, htmlText);
}

function copyDir(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(source, target);
    } else {
      copyFileSync(source, target);
    }
  }
}

export function buildSite(): { readonly pages: number; readonly outDir: string } {
  ensureSbom();
  const sbom = loadSbom();
  const pages = allPages(sbom);

  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  for (const page of pages) {
    writePage(page.meta.route, renderDocument(page.meta, page.render()));
  }

  // Stylesheet and self-hosted fonts.
  mkdirSync(join(dist, 'assets'), { recursive: true });
  copyFileSync(join(appRoot, 'src', 'site.css'), join(dist, 'assets', 'site.css'));
  copyDir(join(appRoot, 'assets', 'fonts'), join(dist, 'assets', 'fonts'));

  // Brand: favicons and manifest at the root (where browsers look), full web
  // kit plus the wordmarks the header uses under /assets/brand/.
  const brandWeb = join(repoRoot, 'brand', '03_WEB');
  for (const name of [
    'favicon.ico',
    'favicon.svg',
    'apple-touch-icon.png',
    'site.webmanifest',
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'maskable-icon-512x512.png',
  ]) {
    copyFileSync(join(brandWeb, name), join(dist, name));
  }
  mkdirSync(join(dist, 'assets', 'brand'), { recursive: true });
  copyFileSync(
    join(brandWeb, 'ARQ_OpenGraph_Green_1200x630.png'),
    join(dist, 'assets', 'brand', 'ARQ_OpenGraph_Green_1200x630.png'),
  );
  for (const name of ['ARQ_Wordmark_Black.svg', 'ARQ_Wordmark_White.svg']) {
    copyFileSync(join(repoRoot, 'brand', '01_VECTOR', name), join(dist, 'assets', 'brand', name));
  }

  writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n');

  const origin = process.env['SITE_ORIGIN'];
  if (origin !== undefined && origin !== '') {
    const urls = pages
      .filter((page) => page.meta.route !== '/404')
      .map(
        (page) =>
          `  <url><loc>${origin}${page.meta.route === '/' ? '' : page.meta.route}/</loc></url>`,
      )
      .join('\n');
    writeFileSync(
      join(dist, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    );
  }

  return { pages: pages.length, outDir: dist };
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const result = buildSite();
  process.stdout.write(`Rendered ${result.pages} pages to ${result.outDir}\n`);
}
