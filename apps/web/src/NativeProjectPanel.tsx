import { useId, useMemo, useState, type ReactNode } from 'react';

import { DoorIcon, PlanIcon, Model3dIcon, RoomIcon, WallIcon, WindowIcon } from '@arq/icons';
import { nativeProjectNotices, type OpenNativeProject } from './native-project-view';

export interface NativeProjectPanelProps {
  readonly fileName: string;
  readonly staged: OpenNativeProject;
  readonly activeLevelId: string;
  readonly onShowLevel: (levelId: string) => void;
  readonly onCloseProject: () => void;
  /** Which of the browser's sections is on show. */
  readonly section: 'views' | 'model';
  /** The model tree, rendered under the Model section. */
  readonly children: ReactNode;
}

/**
 * What is in the open project, as a list you can scan.
 *
 * This was four paragraphs of prose: the project name, the file name with its
 * revision and units, a sentence about where changes go, a set of level buttons
 * each carrying two counts in a second line, a disclosure, and a button - and
 * then, beneath all of that, a flat list repeating "Exterior 250 mm · 12000 mm
 * Wall" once per wall. A reader looking for the upper floor had to read an essay
 * to find it.
 *
 * The reference composition is a directory: headed groups, one row each, counts
 * right-aligned, and nothing else. That is what this is now.
 *
 * Nothing true was dropped to get there, and that distinction matters:
 *
 * - The project's name, revision and units moved to the project bar, which is
 *   where the reference puts them and where they are read once rather than
 *   scanned past repeatedly.
 * - The write state stays, at the foot beside "Close project". An earlier pass
 *   dropped it, reasoning that "changes are kept in a local working copy on
 *   this device" was already in the status bar word for word in substance and
 *   that removing the second copy was a de-duplication. That reasoning was
 *   wrong on the half that matters: the strip says where the work is kept, and
 *   only this said that nothing is written back to the `.arq` file the reader
 *   chose. Naming the reader's own file is the whole promise, and no other
 *   surface makes it.
 * - The unsupported-content disclosure stays, because it is the one thing here
 *   a reader cannot learn anywhere else.
 */
export function NativeProjectPanel(props: NativeProjectPanelProps): JSX.Element {
  const { staged, activeLevelId, onShowLevel, onCloseProject, section, children } = props;
  const { model } = staged;
  const notices = nativeProjectNotices(staged);
  const searchId = useId();
  const [query, setQuery] = useState('');

  const levels = useMemo(
    () =>
      model.levels.map((level) => {
        const levelId = level.id as string;
        return {
          id: levelId,
          name: level.name,
          // Counted from the project. A plan that draws one level of three looks
          // like a smaller building than it is, so each level says how much of
          // the project is on it.
          wallCount: model.walls.filter((wall) => (wall.levelId as string) === levelId).length,
        };
      }),
    [model.levels, model.walls],
  );

  /*
   * The views the file declares, minus the plans.
   *
   * `views.json` lists a view per floor plan as well as the axonometric and the
   * section, and the floor plans are already the group above - so the panel was
   * naming "Ground floor plan" twice, once as a level and once as a view, and a
   * reader had no way to know they were the same drawing.
   */
  const otherViews = useMemo(
    () => model.views.filter((view) => view.kind !== 'plan'),
    [model.views],
  );

  const modelCounts: readonly (readonly [ReactNode, string, number])[] = [
    [<WallIcon width={16} height={16} key="w" />, 'Walls', model.walls.length],
    [<DoorIcon width={16} height={16} key="d" />, 'Doors', model.doors.length],
    [<WindowIcon width={16} height={16} key="n" />, 'Windows', model.windows.length],
    [<RoomIcon width={16} height={16} key="r" />, 'Rooms', model.rooms.length],
  ];

  /*
   * Filters what is already on screen, and never reorders it.
   *
   * The reference has a field reading "Search views, sheets, elements". What it
   * cannot be here is a project-wide index, because no such index exists - so
   * this narrows the rows in front of the reader rather than implying a search
   * that reaches further than it does. Reordering would be worse than useless:
   * a list that rearranges itself as you type is one you cannot aim at.
   */
  const matches = (label: string): boolean =>
    query.trim() === '' || label.toLowerCase().includes(query.trim().toLowerCase());

  const shownLevels = levels.filter((level) => matches(level.name));
  const shownViews = otherViews.filter((view) => matches(view.name));
  const shownCounts = modelCounts.filter(([, label]) => matches(label));
  const shownCount =
    section === 'views' ? shownLevels.length + shownViews.length : shownCounts.length;

  return (
    <div className="arq-project-directory">
      <div className="arq-project-directory__search">
        <input
          id={searchId}
          type="search"
          className="arq-field"
          aria-label="Search this project"
          placeholder="Search views, sheets, elements"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {/* Announced, because a filter that silently empties a list leaves a
            screen-reader user with no way to know it did anything. */}
        <p className="arq-project-directory__result-count" role="status" aria-live="polite">
          {query.trim() === ''
            ? ''
            : shownCount === 0
              ? 'Nothing here matches'
              : `${shownCount} shown`}
        </p>
      </div>

      {section === 'views' && (
        <>
          <section aria-labelledby="arq-directory-plans">
            <h3 id="arq-directory-plans" className="arq-project-directory__heading">
              Floor plans
            </h3>
            {shownLevels.map((level) => (
              <button
                key={level.id}
                type="button"
                className="arq-project-directory__row"
                // aria-pressed rather than a styled-only active state, so the
                // level on show is announced and not merely shaded.
                aria-pressed={level.id === activeLevelId}
                onClick={() => onShowLevel(level.id)}
              >
                <PlanIcon width={16} height={16} />
                <span className="arq-project-directory__label">{level.name}</span>
                {/* "37 walls", not "37". A bare figure in a right-hand column is
                    a number the reader has to work out the unit of. */}
                <span className="arq-project-directory__count">{level.wallCount} walls</span>
              </button>
            ))}
          </section>

          {shownViews.length > 0 && (
            <section aria-labelledby="arq-directory-views">
              <h3 id="arq-directory-views" className="arq-project-directory__heading">
                Views
              </h3>
              {shownViews.map((view) => (
                <div
                  key={view.id}
                  className="arq-project-directory__row"
                  aria-disabled={!view.supported}
                  /* The file's own reason, not a generic one: a section the
                     project records as never rendered is a different fact from
                     a kind this build has no surface for. */
                  title={view.unsupportedReason ?? undefined}
                >
                  <Model3dIcon width={16} height={16} />
                  <span className="arq-project-directory__label">{view.name}</span>
                  {view.unsupportedReason !== null && (
                    <span className="arq-project-directory__count">Not shown</span>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {section === 'model' && (
        <>
          <section aria-labelledby="arq-directory-model">
            <h3 id="arq-directory-model" className="arq-project-directory__heading">
              Model
            </h3>
            {shownCounts.map(([icon, label, count]) => (
              <div key={label} className="arq-project-directory__row">
                {icon}
                <span className="arq-project-directory__label">{label}</span>
                <span className="arq-project-directory__count">{count}</span>
              </div>
            ))}
          </section>

          {notices.length > 0 && (
            <details className="arq-project-directory__notices">
              <summary>Not shown ({notices.length})</summary>
              <ul>
                {notices.map((notice) => (
                  <li key={notice}>{notice}</li>
                ))}
              </ul>
            </details>
          )}

          {/*
           * The element tree, closed.
           *
           * It was always open, so the panel ended in a flat list repeating
           * "Exterior 250 mm · 12000 mm Wall" once per wall - seventy-nine rows
           * of near-identical text under a directory that already says "Walls
           * 79". Collapsed it is available and not in the way, which is the
           * right relationship: the counts answer "what is in here", the tree
           * answers "show me each one", and only the first is a question a
           * reader has on arrival.
           */}
          <details className="arq-project-directory__tree">
            <summary>All elements</summary>
            {children}
          </details>
        </>
      )}

      {/*
       * Where a change lands, and what happens to the file the reader chose.
       *
       * Restored rather than added. Turning this panel into a directory swept
       * away four paragraphs of prose, and one of them was carrying a guarantee
       * about the reader's own file: that editing here does not write back to
       * the `.arq` they picked. That is not prose, it is the promise the whole
       * working-copy design exists to keep, and a directory is no reason to
       * stop making it.
       *
       * Kept to one line beside the action that ends the session, and worded by
       * the project itself - a file open for reading only says something
       * different from one open as a working copy, and the difference is the
       * point.
       */}
      <p className="arq-project-directory__write-state">
        <strong>{staged.writeVerdict === 'read-only' ? 'Read-only.' : 'Working copy.'}</strong>{' '}
        {staged.writeReason}
      </p>

      {/* Closing releases the Worker and the project's resident pages, and
          returns the workspace to its own plan document. Nothing on disk is
          touched, which is why this needs no confirmation. */}
      <button type="button" className="arq-shell-button" onClick={onCloseProject}>
        Close project
      </button>
    </div>
  );
}
