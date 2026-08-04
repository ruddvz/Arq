import type { SafeHtml } from './html.js';

/**
 * The public site's shared vocabulary.
 *
 * Routes and titles come from docs/pages/ROUTE-MAP.csv (PUB-001..PUB-017);
 * the navigation split comes from marketing/SITE-INFORMATION-ARCHITECTURE.md.
 * Page ids double as drawing-set sheet numbers in the footer title block -
 * the one place the spec ids are user-visible, deliberately.
 */

export interface PageMeta {
  /** Spec id, e.g. "PUB-009" - printed as the sheet number. */
  readonly id: string;
  /** Route exactly as in ROUTE-MAP.csv, e.g. "/pricing". */
  readonly route: string;
  /** Short title used in nav and the <title> suffix position. */
  readonly title: string;
  /** Full <title> text; defaults to `${title} - ARQ` when omitted. */
  readonly documentTitle?: string;
  /** Meta description - required; the build fails without one. */
  readonly description: string;
  /** Exclude utility and error routes from search indexing. */
  readonly noIndex?: boolean;
}

export interface Page {
  readonly meta: PageMeta;
  /** Rendered <main> content, starting with the page's single h1. */
  render(): SafeHtml;
}

/** Header navigation - the working set, small enough to scan. */
export const PRIMARY_NAV: readonly { readonly route: string; readonly label: string }[] = [
  { route: '/product', label: 'Product' },
  { route: '/architects', label: 'Architects' },
  { route: '/ai', label: 'AI' },
  { route: '/interoperability', label: 'Interoperability' },
  { route: '/pricing', label: 'Pricing' },
  { route: '/security', label: 'Security' },
  { route: '/docs', label: 'Docs' },
];

/** Footer index - every public sheet in the set, grouped as the IA names them. */
export const FOOTER_INDEX: readonly {
  readonly heading: string;
  readonly links: readonly { readonly route: string; readonly label: string }[];
}[] = [
  {
    heading: 'Product',
    links: [
      { route: '/product', label: 'Product overview' },
      { route: '/architects', label: 'For architects' },
      { route: '/students', label: 'For students' },
      { route: '/collaboration', label: 'Collaboration' },
      { route: '/ai', label: 'AI' },
      { route: '/interoperability', label: 'Interoperability' },
      { route: '/ipad', label: 'iPad' },
    ],
  },
  {
    heading: 'Trust',
    links: [
      { route: '/pricing', label: 'Pricing' },
      { route: '/security', label: 'Security' },
      { route: '/legal/privacy', label: 'Privacy notice' },
      { route: '/legal/terms', label: 'Terms' },
      { route: '/legal/open-source', label: 'Open-source notices' },
    ],
  },
  {
    heading: 'Project',
    links: [
      { route: '/docs', label: 'Documentation' },
      { route: '/changelog', label: 'Changelog' },
      { route: '/status', label: 'Status' },
      { route: '/contact', label: 'Contact and support' },
    ],
  },
];
