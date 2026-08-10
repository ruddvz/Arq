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
  /**
   * Which of the four public page families this sheet belongs to. Drives a
   * class on <main> (site.css, ".family-*") that adjusts hero weight and
   * closing treatment - the components stay the same everywhere, only the
   * emphasis changes. Omitted for the 404 utility sheet, which stays
   * unclassified and minimal.
   */
  readonly family?: 'story' | 'capability' | 'operational' | 'reference';
}

export interface Page {
  readonly meta: PageMeta;
  /** Rendered <main> content, starting with the page's single h1. */
  render(): SafeHtml;
}

export interface NavLink {
  readonly route: string;
  readonly label: string;
}

export interface NavGroup {
  readonly heading: string;
  readonly links: readonly NavLink[];
}

/**
 * Header navigation, grouped by what a visitor is trying to do rather than
 * exposing all 17 routes flat. Pricing and Contact stay direct links: each
 * is one destination, so a dropdown would add a click without adding
 * meaning.
 */
export const PRIMARY_NAV_GROUPS: readonly NavGroup[] = [
  {
    heading: 'Product',
    links: [
      // "Overview", not "Product": the group is already called Product, and
      // the footer index names this same sheet "Product overview".
      { route: '/product', label: 'Overview' },
      { route: '/interoperability', label: 'Interoperability' },
      { route: '/ai', label: 'AI' },
      { route: '/ipad', label: 'iPad' },
    ],
  },
  {
    heading: 'Solutions',
    links: [
      { route: '/architects', label: 'Architects' },
      { route: '/students', label: 'Students' },
      { route: '/collaboration', label: 'Collaboration' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { route: '/docs', label: 'Docs' },
      { route: '/changelog', label: 'Changelog' },
      { route: '/status', label: 'Status' },
      { route: '/security', label: 'Security' },
    ],
  },
];

/** Direct top-level links: single destinations that do not need a group. */
export const PRIMARY_NAV_DIRECT: readonly NavLink[] = [
  { route: '/pricing', label: 'Pricing' },
  { route: '/contact', label: 'Contact' },
];

/** Every route in the primary nav, flattened - the set a page's route is checked against. */
export const PRIMARY_NAV: readonly NavLink[] = [
  ...PRIMARY_NAV_GROUPS.flatMap((group) => group.links),
  ...PRIMARY_NAV_DIRECT,
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
