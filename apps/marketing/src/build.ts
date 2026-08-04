import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
 * Hosting knobs (both optional):
 * - SITE_BASE_PATH, e.g. "/Arq" - for hosts that serve the site under a
 *   subpath (GitHub Pages project sites). Pages are authored with
 *   root-absolute internal URLs; applyBasePath prefixes every one at build
 *   time. This is sound precisely because the site's tests forbid external
 *   resources: every `="/..."` attribute is provably internal.
 * - SITE_ORIGIN, e.g. "https://ruddvz.github.io" - enables sitemap.xml, the
 *   robots Sitemap line, canonical links and absolute og:image/og:url values.
 * - SITE_REVISION - the immutable source commit shown in every footer. CI
 *   supplies the exact GitHub SHA; local builds are labelled as local.
 */

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..');
const repoRoot = findRepoRoot(here);
const dist = join(appRoot, 'dist');

/** Validates and normalises a base path: '' or '/like-this' (no trailing slash). */
export function normaliseBasePath(raw: string | undefined): string {
  if (raw === undefined || raw === '' || raw === '/') {
    return '';
  }
  const withLead = raw.startsWith('/') ? raw : `/${raw}`;
  return withLead.endsWith('/') ? withLead.slice(0, -1) : withLead;
}

/**
 * Prefixes every root-absolute internal URL attribute with the base path.
 * Matches only the attribute forms this renderer emits (href/src/srcset/
 * content followed by `="/`); protocol-relative (`//`) is excluded, and the
 * no-external-resources test guarantees nothing else needs distinguishing.
 */
export function applyBasePath(html: string, basePath: string): string {
  if (basePath === '') {
    return html;
  }
  return html.replace(/(href|src|srcset|content)="\/(?!\/)/g, `$1="${basePath}/`);
}

/**
 * Makes og:image absolute and adds canonical and og:url once an origin is
 * known. Runs AFTER applyBasePath, so the paths already carry the base.
 */
export function absolutiseOpenGraph(
  html: string,
  origin: string,
  canonicalPathWithBase: string,
): string {
  const withImage = html.replace(/(property="og:image" content=")(\/[^"]*)"/, `$1${origin}$2"`);
  return withImage.replace(
    /<meta property="og:image"/,
    `<link rel="canonical" href="${origin}${canonicalPathWithBase}" />\n        <meta property="og:url" content="${origin}${canonicalPathWithBase}" />\n        <meta property="og:image"`,
  );
}

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
  const basePath = normaliseBasePath(process.env['SITE_BASE_PATH']);
  const origin = process.env['SITE_ORIGIN'];
  const sourceRevision = process.env['SITE_REVISION'];
  const hasOrigin = origin !== undefined && origin !== '';

  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  for (const page of pages) {
    let html = applyBasePath(renderDocument(page.meta, page.render(), sourceRevision), basePath);
    if (hasOrigin) {
      const canonicalPath =
        page.meta.route === '/' ? `${basePath}/` : `${basePath}${page.meta.route}/`;
      html = absolutiseOpenGraph(html, origin, canonicalPath);
    }
    writePage(page.meta.route, html);
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
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'maskable-icon-512x512.png',
  ]) {
    copyFileSync(join(brandWeb, name), join(dist, name));
  }
  // The brand manifest uses root-absolute URLs; under a base path its
  // start_url and icon paths must carry the prefix too.
  const manifest = JSON.parse(readFileSync(join(brandWeb, 'site.webmanifest'), 'utf8')) as {
    start_url?: string;
    icons?: { src: string }[];
  };
  if (basePath !== '') {
    manifest.start_url = `${basePath}/`;
    if (manifest.icons !== undefined) {
      manifest.icons = manifest.icons.map((icon) => ({
        ...icon,
        src: icon.src.startsWith('/') ? `${basePath}${icon.src}` : icon.src,
      }));
    }
  }
  writeFileSync(join(dist, 'site.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);
  mkdirSync(join(dist, 'assets', 'brand'), { recursive: true });
  copyFileSync(
    join(brandWeb, 'ARQ_OpenGraph_Green_1200x630.png'),
    join(dist, 'assets', 'brand', 'ARQ_OpenGraph_Green_1200x630.png'),
  );
  for (const name of ['ARQ_Wordmark_Black.svg', 'ARQ_Wordmark_White.svg']) {
    copyFileSync(join(repoRoot, 'brand', '01_VECTOR', name), join(dist, 'assets', 'brand', name));
  }

  // GitHub Pages runs Jekyll unless told not to; Jekyll would drop or
  // mangle nothing here today, but .nojekyll makes the output contract
  // explicit: serve these files exactly as built.
  writeFileSync(join(dist, '.nojekyll'), '');

  const robotsLines = ['User-agent: *', 'Allow: /'];
  if (hasOrigin) {
    robotsLines.push(`Sitemap: ${origin}${basePath}/sitemap.xml`);
    const urls = pages
      .filter((page) => page.meta.route !== '/404')
      .map(
        (page) =>
          `  <url><loc>${origin}${basePath}${page.meta.route === '/' ? '' : page.meta.route}/</loc></url>`,
      )
      .join('\n');
    writeFileSync(
      join(dist, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    );
  }
  writeFileSync(join(dist, 'robots.txt'), `${robotsLines.join('\n')}\n`);

  return { pages: pages.length, outDir: dist };
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const result = buildSite();
  process.stdout.write(`Rendered ${result.pages} pages to ${result.outDir}\n`);
}
