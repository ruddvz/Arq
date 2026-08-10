import { html, raw, type SafeHtml } from './html.js';
import {
  FOOTER_INDEX,
  PRIMARY_NAV_DIRECT,
  PRIMARY_NAV_GROUPS,
  type NavLink,
  type PageMeta,
} from './site.js';

/**
 * One document shell for every sheet in the set.
 *
 * Head wiring follows the repo's one prior example of correct brand plumbing
 * (prototype/index.html): brand favicons, web manifest, Open Graph image and
 * the phthalo-green theme colour, all served from this site's own origin -
 * the page loads no third-party resource, so there is nothing to consent to
 * and no analytics to disclose (see /legal/privacy).
 *
 * Accessibility contract shared by all pages (PUB specs, "Keyboard and
 * accessibility"): skip-to-content link first in the tab order, one <h1> per
 * page (owned by the page body), landmark regions header/nav/main/footer,
 * and focus styles that never rely on colour alone.
 */

function revisionLabel(sourceRevision: string | undefined): string {
  const shortRevision = sourceRevision?.match(/^[0-9a-f]{7,64}$/i)?.[0]?.slice(0, 7);
  return shortRevision === undefined
    ? 'REV B · 2026-08 · local build'
    : `REV B · 2026-08 · source ${shortRevision}`;
}

function navLinkList(links: readonly NavLink[], activeRoute: string): SafeHtml {
  return html`${links.map((item) =>
    item.route === activeRoute
      ? html`<a href="${item.route}" aria-current="page">${item.label}</a>`
      : html`<a href="${item.route}">${item.label}</a>`,
  )}`;
}

/**
 * Desktop primary nav: one <details> dropdown per group, native and
 * JS-free like the mobile drawer this pattern is borrowed from. A group
 * containing the active route gets a class so its summary reads as "you
 * are in this section" without opening it.
 */
function desktopNav(activeRoute: string): SafeHtml {
  return html`
    ${PRIMARY_NAV_GROUPS.map((group) => {
      const isActiveGroup = group.links.some((link) => link.route === activeRoute);
      return html`
        <details class="${isActiveGroup ? 'nav-group nav-group--active' : 'nav-group'}">
          <summary>${group.heading}</summary>
          <nav aria-label="${group.heading}">${navLinkList(group.links, activeRoute)}</nav>
        </details>
      `;
    })}
    ${navLinkList(PRIMARY_NAV_DIRECT, activeRoute)}
  `;
}

/** Mobile drawer: the same groups as headings in one flat disclosure, not nested dropdowns. */
function mobileNav(activeRoute: string): SafeHtml {
  return html`
    ${PRIMARY_NAV_GROUPS.map(
      (group) => html`
        <p class="nav-drawer-heading">${group.heading}</p>
        ${navLinkList(group.links, activeRoute)}
      `,
    )}
    <p class="nav-drawer-heading">More</p>
    ${navLinkList(PRIMARY_NAV_DIRECT, activeRoute)}
  `;
}

function footerIndex(): SafeHtml {
  return html`${FOOTER_INDEX.map(
    (group) => html`
      <nav class="footer-col" aria-labelledby="footer-${group.heading.toLowerCase()}">
        <h2 class="footer-heading" id="footer-${group.heading.toLowerCase()}">${group.heading}</h2>
        <ul>
          ${group.links.map((link) => html`<li><a href="${link.route}">${link.label}</a></li>`)}
        </ul>
      </nav>
    `,
  )}`;
}

export function renderDocument(meta: PageMeta, body: SafeHtml, sourceRevision?: string): string {
  const documentTitle = meta.documentTitle ?? `${meta.title} · ARQ`;
  const robots =
    meta.noIndex === true ? html`<meta name="robots" content="noindex, nofollow" />` : '';
  const mainAttrs =
    meta.family === undefined
      ? html`id="content"`
      : html`id="content" class="family-${meta.family}"`;
  const page = html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${documentTitle}</title>
        <meta name="description" content="${meta.description}" />
        ${robots}
        <meta name="theme-color" content="#0b6b50" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="ARQ" />
        <meta property="og:title" content="${documentTitle}" />
        <meta property="og:description" content="${meta.description}" />
        <meta property="og:image" content="/assets/brand/ARQ_OpenGraph_Green_1200x630.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="stylesheet" href="/assets/site.css" />
      </head>
      <body>
        <a class="skip-link" href="#content">Skip to content</a>
        <header class="site-header">
          <div class="measure header-inner">
            <a class="wordmark" href="/" aria-label="ARQ home">
              <picture>
                <source
                  media="(prefers-color-scheme: dark)"
                  srcset="/assets/brand/ARQ_Wordmark_White.svg"
                />
                <img src="/assets/brand/ARQ_Wordmark_Black.svg" alt="ARQ" width="76" height="28" />
              </picture>
            </a>
            <nav class="site-nav" aria-label="Primary">${desktopNav(meta.route)}</nav>
            <details class="nav-drawer">
              <summary aria-label="Menu">Menu</summary>
              <nav aria-label="Primary, compact">${mobileNav(meta.route)}</nav>
            </details>
          </div>
        </header>
        <main ${mainAttrs}>${body}</main>
        <footer class="site-footer">
          <div class="measure">
            <div class="footer-grid">${footerIndex()}</div>
            <div class="title-block" aria-label="Sheet information">
              <div>
                <span class="tb-label">Project</span><span>ARQ (architectural workspace)</span>
              </div>
              <div><span class="tb-label">Sheet</span><span>${meta.id} · ${meta.title}</span></div>
              <div>
                <span class="tb-label">Revision</span><span>${revisionLabel(sourceRevision)}</span>
              </div>
              <div>
                <span class="tb-label">Status</span><span>Pre-release, in development</span>
              </div>
            </div>
            <p class="footer-fineprint">
              ARQ is in development and has not shipped. The
              <a href="/changelog">changelog</a> records what exists today.
            </p>
          </div>
        </footer>
      </body>
    </html>`;
  return `${page.value}\n`;
}

/** Convenience for pages that need the raw helper without importing html.ts twice. */
export { html, raw };
