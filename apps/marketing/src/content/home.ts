import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-001. Explains the product and routes onward to product, security,
 * pricing and the changelog. Every claim on this sheet is either present
 * tense about the working development build or explicitly labelled planned —
 * business/LAUNCH-CLAIMS-CHECKLIST.md is enforced by pages.test.ts.
 */
export const homePage: Page = {
  meta: {
    id: 'PUB-001',
    route: '/',
    title: 'Home',
    documentTitle: 'Arq — an architectural workspace that keeps your work yours',
    description:
      'Arq is an in-development architectural design tool for drawing plans that behave like buildings — local-first, precise, and honest about what it can do.',
  },
  render: () => html`
    ${hero({
      eyebrow: 'Arq · architectural workspace · pre-release',
      heading: 'Draw plans that behave like buildings.',
      lede: 'Arq is an architectural design tool in open development: walls, doors, windows and rooms with real dimensions, saved locally in a file you own. No account, no upload, no surprise.',
      actions: [
        { href: '/product', label: 'See the product' },
        { href: '/changelog', label: 'What exists today' },
      ],
    })}
    ${notes([
      {
        title: 'Local first, by architecture',
        body: html`
          <p>
            Your project is a single <code>.arq</code> file — a versioned SQLite database that lives
            on your device and opens in your browser. Saving is a local write, not a network
            request. Arq's file format, migration and recovery layers are built and tested before
            any cloud feature: if a sync service exists one day, it will be an addition to the file
            you own, never a replacement for it.
          </p>
        `,
      },
      {
        title: 'Precision is the product',
        body: html`
          <p>
            Arq works in real units at millimetre precision. The status bar reads out world
            coordinates; dimensions are measurements, not decorations. Where the software cannot be
            precise, it says so plainly — an error in Arq tells you what happened, why, what was
            affected and what remains safe.
          </p>
        `,
      },
      {
        title: 'Honest software, honestly described',
        body: html`
          <p>
            Arq is not finished, and this site will not pretend otherwise. It is not a full CAD
            seat, it does not replace Revit, and its scope is deliberately small: the first release
            targets the drawings below and nothing more.
          </p>
          ${specList([
            {
              term: 'Release 1',
              detail:
                'Walls, doors, windows, rooms, dimensions, notes, floor plans, basic 3D, one plan sheet, vector PDF, local journal and recovery.',
            },
            {
              term: 'Release 2',
              detail:
                'DXF linework exchange, IFC viewing and inspection, import reports, share links, comments, issues.',
            },
            {
              term: 'Deliberately out',
              detail:
                'Curved walls, complex roofs, family editor, photorealistic rendering, structural and MEP.',
            },
          ])}
        `,
      },
    ])}
    ${ctaBand(
      'Follow the work, not the promises.',
      'The changelog lists what is genuinely built, with tests behind every entry. The product page explains where Arq is going and in what order.',
      [
        { href: '/changelog', label: 'Read the changelog' },
        { href: '/security', label: 'How Arq treats your work' },
      ],
    )}
  `,
};
