import type { ReactNode } from 'react';

import { nativeProjectNotices, type OpenNativeProject } from './native-project-view';

export interface NativeProjectPanelProps {
  readonly fileName: string;
  readonly staged: OpenNativeProject;
  readonly activeLevelId: string;
  readonly onShowLevel: (levelId: string) => void;
  readonly onCloseProject: () => void;
  /** The model tree, rendered below the project header. */
  readonly children: ReactNode;
}

/**
 * The header of the project browser's Project section when a native `.arq`
 * project is open: what is open, which revision, where a change to it would go, which
 * level is on show, what the file contains that is not being drawn, and how to
 * close it.
 *
 * It exists because every one of those is a question a reader will otherwise
 * answer wrongly. A workspace that shows 37 walls of a 79-wall project with no
 * level control looks like a project with 37 walls; one that silently omits 14
 * doors looks like a project with no doors; and a read-only project with no
 * visible close has no way back to the workspace's own plan.
 */
export function NativeProjectPanel(props: NativeProjectPanelProps): JSX.Element {
  const { fileName, staged, activeLevelId, onShowLevel, onCloseProject, children } = props;
  const { model } = staged;
  const notices = nativeProjectNotices(staged);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--arq-space-micro)',
          padding: 'var(--arq-space-panel)',
          borderBottom: '1px solid var(--arq-ui-line-subtle)',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>
          {model.summary.projectName}
        </p>
        <p style={{ margin: 0, color: 'var(--arq-ui-text-secondary)', overflowWrap: 'anywhere' }}>
          {/* The file name is here rather than in the title bar because a reader
              needs to know which file this is, and a long name must wrap rather
              than be clipped to the panel width. */}
          {fileName} · revision {model.summary.revision} · {model.summary.units}
        </p>
        {/* Section 126: status is never colour alone - this is a word, and the
            reason is spelled out rather than left to a badge. */}
        <p style={{ margin: 0 }}>
          <strong>{staged.writeVerdict === 'read-only' ? 'Read-only.' : 'Working copy.'}</strong>{' '}
          {staged.writeReason}
        </p>

        <fieldset
          style={{
            border: 0,
            margin: 0,
            padding: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--arq-space-micro)',
          }}
        >
          <legend style={{ padding: 0, color: 'var(--arq-ui-text-muted)' }}>Level</legend>
          {model.levels.map((level) => {
            const levelId = level.id as string;
            const active = levelId === activeLevelId;
            // Counted from the project. A plan that draws one level of three
            // looks like a smaller building than it is, so each level says how
            // much of the project is on it.
            const wallCount = model.walls.filter(
              (wall) => (wall.levelId as string) === levelId,
            ).length;
            const roomCount = model.rooms.filter(
              (room) => (room.levelId as string) === levelId,
            ).length;
            return (
              <button
                key={levelId}
                type="button"
                className="arq-shell-button"
                // aria-pressed rather than a styled-only active state, so the
                // current level is announced and not merely shaded.
                aria-pressed={active}
                onClick={() => onShowLevel(levelId)}
                style={{ flexDirection: 'column', alignItems: 'flex-start' }}
              >
                <span>{level.name}</span>
                <span style={{ color: 'var(--arq-ui-text-muted)' }}>
                  {wallCount} walls · {roomCount} rooms
                </span>
              </button>
            );
          })}
        </fieldset>

        {notices.length > 0 && (
          <details>
            <summary style={{ color: 'var(--arq-ui-text-muted)', cursor: 'pointer' }}>
              What this build does not show ({notices.length})
            </summary>
            <ul style={{ margin: 'var(--arq-space-micro) 0 0', paddingInlineStart: '1.2em' }}>
              {notices.map((notice) => (
                <li key={notice} style={{ color: 'var(--arq-ui-text-secondary)' }}>
                  {notice}
                </li>
              ))}
            </ul>
          </details>
        )}

        <button type="button" className="arq-shell-button" onClick={onCloseProject}>
          {/* Closing releases the Worker and the project's resident pages, and
              returns the workspace to its own plan document. Nothing on disk is
              touched, which is why this needs no confirmation. */}
          Close project
        </button>
      </div>
      <div style={{ minHeight: 0, flex: 1, overflow: 'auto' }}>{children}</div>
    </div>
  );
}
