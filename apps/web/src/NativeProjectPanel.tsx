import type { ReactNode } from 'react';

import { DoorIcon, PlanIcon, Model3dIcon, RoomIcon, WallIcon, WindowIcon } from '@arq/icons';
import { nativeProjectNotices, type OpenNativeProject } from './native-project-view';

export interface NativeProjectPanelProps {
  readonly fileName: string;
  readonly staged: OpenNativeProject;
  readonly activeLevelId: string;
  readonly onShowLevel: (levelId: string) => void;
  readonly onCloseProject: () => void;
  /** The model tree, rendered below the project summary. */
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
 * The reference composition is a directory: three headed groups, one row each,
 * counts right-aligned, and nothing else. That is what this is now.
 *
 * Nothing true was dropped to get there, and that distinction matters:
 *
 * - The project's name, revision and units moved to the project bar, which is
 *   where the reference puts them and where they are read once rather than
 *   scanned past repeatedly.
 * - "Changes are kept in a local working copy on this device" was *already* in
 *   the status bar, word for word in substance. Removing the second copy is a
 *   de-duplication, not a deletion, and the guarantee that the product never
 *   implies a save it has not made is untouched.
 * - The unsupported-content disclosure stays, because it is the one thing here
 *   a reader cannot learn anywhere else.
 */
export function NativeProjectPanel(props: NativeProjectPanelProps): JSX.Element {
  const { staged, activeLevelId, onShowLevel, onCloseProject, children } = props;
  const { model } = staged;
  const notices = nativeProjectNotices(staged);

  const modelCounts: readonly (readonly [ReactNode, string, number])[] = [
    [<WallIcon width={16} height={16} key="w" />, 'Walls', model.walls.length],
    [<DoorIcon width={16} height={16} key="d" />, 'Doors', model.doors.length],
    [<WindowIcon width={16} height={16} key="n" />, 'Windows', model.windows.length],
    [<RoomIcon width={16} height={16} key="r" />, 'Rooms', model.rooms.length],
  ];

  return (
    <div className="arq-project-directory">
      <section aria-labelledby="arq-directory-plans">
        <h3 id="arq-directory-plans" className="arq-project-directory__heading">
          Floor plans
        </h3>
        {model.levels.map((level) => {
          const levelId = level.id as string;
          // Counted from the project. A plan that draws one level of three looks
          // like a smaller building than it is, so each level says how much of
          // the project is on it.
          const wallCount = model.walls.filter(
            (wall) => (wall.levelId as string) === levelId,
          ).length;
          return (
            <button
              key={levelId}
              type="button"
              className="arq-project-directory__row"
              // aria-pressed rather than a styled-only active state, so the
              // level on show is announced and not merely shaded.
              aria-pressed={levelId === activeLevelId}
              onClick={() => onShowLevel(levelId)}
            >
              <PlanIcon width={16} height={16} />
              <span className="arq-project-directory__label">{level.name}</span>
              <span className="arq-project-directory__count">{wallCount}</span>
            </button>
          );
        })}
      </section>

      {model.views.length > 0 && (
        <section aria-labelledby="arq-directory-views">
          <h3 id="arq-directory-views" className="arq-project-directory__heading">
            Views
          </h3>
          {model.views.map((view) => (
            <div key={view.id} className="arq-project-directory__row" aria-disabled="true">
              <Model3dIcon width={16} height={16} />
              <span className="arq-project-directory__label">{view.name}</span>
            </div>
          ))}
        </section>
      )}

      <section aria-labelledby="arq-directory-model">
        <h3 id="arq-directory-model" className="arq-project-directory__heading">
          Model
        </h3>
        {modelCounts.map(([icon, label, count]) => (
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
       * "Exterior 250 mm · 12000 mm Wall" once per wall - seventy-nine rows of
       * near-identical text under a directory that already says "Walls 79".
       * Collapsed it is available and not in the way, which is the right
       * relationship: the counts answer "what is in here", the tree answers
       * "show me each one", and only the first is a question a reader has on
       * arrival.
       */}
      <details className="arq-project-directory__tree">
        <summary>All elements</summary>
        {children}
      </details>

      {/* Closing releases the Worker and the project's resident pages, and
          returns the workspace to its own plan document. Nothing on disk is
          touched, which is why this needs no confirmation. */}
      <button type="button" className="arq-shell-button" onClick={onCloseProject}>
        Close project
      </button>
    </div>
  );
}
