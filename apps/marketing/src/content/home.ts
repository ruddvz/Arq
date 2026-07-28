import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-001. Explains the product and routes onward to product, security,
 * pricing and the changelog.
 *
 * Claim bindings (docs/product/voice/claim-binding-registry.json):
 * pub-home-native-file (native-arq-open, LIBRARY_ONLY, must qualify),
 * pub-home-local-persistence (local-journal-persistence, CURRENT) and
 * pub-home-semantic-tools (current-door-window-room-authoring, LIBRARY_ONLY,
 * must qualify). Present-tense sentences here are limited to what those
 * bindings allow; the release ladder is labelled as scope, not availability.
 */
export const homePage: Page = {
  meta: {
    id: 'PUB-001',
    route: '/',
    title: 'Home',
    documentTitle: 'Arq · an architectural workspace built on a local project file',
    description:
      'Arq is pre-release architectural design software. The current development build draws walls in a plan with real units and records those edits in a local journal on your device.',
  },
  render: () => html`
    ${hero({
      eyebrow: 'Arq · architectural workspace · pre-release',
      heading: 'Plans made of building elements, not lines.',
      lede: 'Arq is architectural design software in open development. A wall in Arq is a wall, with a thickness and a length in millimetres, and the current development build lets you draw walls in a plan and keeps those edits on your own device.',
      actions: [
        { href: '/product', label: 'See the product' },
        { href: '/changelog', label: 'What exists today' },
      ],
    })}
    ${notes([
      {
        title: 'Where your work is kept',
        body: html`
          <p>
            The Arq project format is a single <code>.arq</code> file: a versioned SQLite database
            you hold on your own disk. Choosing an <code>.arq</code> file in the current build
            checks it and reports whether it is a compatible Arq project. Opening it as a working
            project in the browser is not wired yet.
          </p>
          <p>
            What the current build does persist is its own demo plan. Every edit is appended to a
            journal in your browser's local storage and replayed when you return. That journal is a
            local record on your device. It does not write to a portable <code>.arq</code> file, and
            nothing is uploaded.
          </p>
        `,
      },
      {
        title: 'Precision is the product',
        body: html`
          <p>
            Arq works in real units at millimetre precision. The status bar reads out world
            coordinates, and dimensions are measurements rather than decorations. Where the software
            cannot be precise, it says so: an error in Arq names what happened, why, what was
            affected and what remains safe.
          </p>
        `,
      },
      {
        title: 'A small first release, stated plainly',
        body: html`
          <p>
            Arq has not shipped. It is not a full CAD seat and does not replace Revit. Its scope is
            deliberately small. The list below is release scope from
            <code>docs/product/RELEASE-SCOPE.md</code>. It describes the intended sequence of work,
            not what the current development build can do today.
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
          <p>
            Doors, windows and rooms are in Release 1 scope. Their libraries and tools exist in the
            repository and are tested, but they are not yet connected to the drawing canvas, so they
            are not something you can use today.
          </p>
        `,
      },
    ])}
    ${ctaBand(
      'Follow the work, not the promises.',
      'The changelog records dated development work with the evidence behind each entry. The product page explains where Arq is going and in what order.',
      [
        { href: '/changelog', label: 'Read the changelog' },
        { href: '/security', label: 'How Arq treats your work' },
      ],
    )}
  `,
};
