import { ctaBand, hero, notes, specList } from '../components.js';
import { html } from '../html.js';
import type { Page } from '../site.js';

/**
 * PUB-001. Explains the product and routes onward to product, security,
 * pricing and the changelog.
 *
 * Claim bindings (docs/product/voice/claim-binding-registry.json):
 * pub-home-native-file (native-arq-open, CURRENT), pub-home-local-persistence
 * (local-journal-persistence, CURRENT) and pub-home-semantic-tools
 * (current-door-window-room-authoring, LIBRARY_ONLY, must qualify).
 * Present-tense sentences here are limited to what those bindings allow; the
 * release ladder is labelled as scope, not availability.
 *
 * native-arq-open is CURRENT as of benchmark:native-open, so this page states
 * the open plainly instead of denying it. The binding requires the limit in the
 * same breath, and there is a reason it is a limit and not a footnote: a reader
 * told a project opens will assume it saves. It does not. The file the reader
 * chose is never written to, and the "Where your work is kept" note has to
 * leave with that understood.
 */
export const homePage: Page = {
  meta: {
    id: 'PUB-001',
    route: '/',
    title: 'Home',
    family: 'story',
    documentTitle: 'ARQ · pre-release architectural workspace',
    description:
      'ARQ is pre-release architectural design software. The current development build opens an .arq project in the browser and draws walls in a plan with real units, keeping your work on your own device. It does not save back to the file yet.',
  },
  render: () => html`
    ${hero({
      eyebrow: 'ARQ · architectural workspace · pre-release',
      heading: 'Plans made of building elements, not lines.',
      lede: 'ARQ is architectural design software in open development. A wall in ARQ is a wall, with a thickness and a length in millimetres. The current development build opens an .arq project from your disk, draws walls in a plan, and keeps the work on your own device.',
      actions: [
        { href: '/product', label: 'See the product' },
        { href: '/changelog', label: 'What exists today' },
      ],
    })}
    ${notes([
      {
        title: 'Precision is the product',
        body: html`
          <p>
            ARQ works in real units at millimetre precision. The status bar reads out world
            coordinates, and dimensions are measurements rather than decorations. Where the software
            cannot be precise, it says so: an error in ARQ names what happened, why, what was
            affected and what remains safe.
          </p>
        `,
      },
      {
        title: 'Where your work is kept',
        body: html`
          <p>
            The ARQ project format is a single <code>.arq</code> file: a versioned SQLite database
            you hold on your own disk. The current build opens one. Choosing an
            <code>.arq</code> file checks it, copies it into a working copy on your device, and puts
            that project in the workspace - its levels, its walls and rooms, its plan and its 3D
            view.
          </p>
          <p>
            It opens; it does not yet save. ARQ works on the copy and never writes to the file you
            chose, which is the safe half of that arrangement and also the unfinished half: nothing
            you do in the browser goes back into your <code>.arq</code> file yet.
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
        title: 'A small first release, stated plainly',
        separation: 'chapter',
        body: html`
          <p>
            ARQ has not shipped. It is not a full CAD seat and does not replace Revit. Its scope is
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
      'The changelog records dated development work with the evidence behind each entry. The product page explains where ARQ is going and in what order.',
      [
        { href: '/changelog', label: 'Read the changelog' },
        { href: '/security', label: 'How ARQ treats your work' },
      ],
    )}
  `,
};
