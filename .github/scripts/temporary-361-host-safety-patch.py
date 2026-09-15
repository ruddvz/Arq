from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one exact patch anchor, found {count}")
    target.write_text(text.replace(old, new, 1))


replace_once(
    "apps/web/src/App.tsx",
    """  /** Set while a publish is actually in flight, so the command cannot be invoked twice concurrently against the same session. */
  const [publishing, setPublishing] = useState(false);

  /**
   * Replaces the workspace's project with one that has already been fully
""",
    """  /** Set while a publish is actually in flight, so the command cannot be invoked twice concurrently against the same session. */
  const [publishing, setPublishing] = useState(false);

  /**
   * Non-destructively drains the current native session before a file-open flow
   * is allowed to replace it. A failed write must keep that exact session alive:
   * it owns the pending change and is the only object that can replay it.
   */
  const prepareCurrentNativeProjectForReplacement = useCallback(async () => {
    const current = nativeSessionRef.current;
    if (current === null) return { status: 'ready' as const };
    return current.prepareForReplacement();
  }, []);

  /**
   * Replaces the workspace's project with one that has already been fully
""",
)

replace_once(
    "apps/web/src/App.tsx",
    """  const handleCloseNativeProject = useCallback(() => {
    void nativeSessionRef.current?.close().catch(() => undefined);
    nativeSessionRef.current = null;
    setOpenNativeProject(null);
    setActiveNativeLevelId(null);
    setProjectRooms(null);
    setWallDimensions(new Map());
    setWallOpenings(new Map());
    setLevelPlacedContent(EMPTY_LEVEL_CONTENT);
    setActiveWorkingCopyId(null);
    setDrawnWalls([]);
    drawnWallsRef.current = [];
    setProjectName('Untitled project');
    setModelSelection({ primary: null, secondary: new Set() });
    setSaveState('saved');
    setJournalLabel('Journal current');
  }, []);
""",
    """  const handleCloseNativeProject = useCallback(() => {
    void (async () => {
      const session = nativeSessionRef.current;
      if (session !== null) {
        const preparation = await session.prepareForReplacement();
        if (nativeSessionRef.current !== session) return;
        if (preparation.status === 'blocked') {
          if (preparation.code === 'ARQ_REPLACE_UNSAVED_FAILURE') {
            setSaveState('unsaved-changes');
            setJournalLabel('Working copy write failed · save again before closing');
            feedbackStoreRef.current.publish(
              'error',
              'Project stays open: save again before closing',
              Date.now(),
            );
            return;
          }
          feedbackStoreRef.current.publish('error', preparation.reason, Date.now());
        } else {
          try {
            await session.close();
          } catch (error) {
            feedbackStoreRef.current.publish(
              'error',
              `Project shutdown reported: ${error instanceof Error ? error.message : String(error)}`,
              Date.now(),
            );
          }
        }
        if (nativeSessionRef.current !== session) return;
      }

      // Late persistence completions belong to the project being released and
      // must not overwrite the scratch-journal status after this reset.
      persistenceRevisionRef.current += 1;
      nativeSessionRef.current = null;
      setNativeProjectAvailability({ open: false, writable: false });
      setOpenNativeProject(null);
      setActiveNativeLevelId(null);
      setProjectRooms(null);
      setWallDimensions(new Map());
      setWallOpenings(new Map());
      setLevelPlacedContent(EMPTY_LEVEL_CONTENT);
      setActiveWorkingCopyId(null);
      setDrawnWalls([]);
      drawnWallsRef.current = [];
      setProjectName('Untitled project');
      setModelSelection({ primary: null, secondary: new Set() });
      setSaveState('saved');
      setJournalLabel('Journal current');
    })();
  }, []);
""",
)

replace_once(
    "apps/web/src/App.tsx",
    """      <FileOpenPanel
        isOpen={fileOpenPanelOpen}
        onOpenChange={setFileOpenPanelOpen}
        onProjectOpened={adoptNativeProject}
        activeWorkingCopyId={activeWorkingCopyId}
      />
""",
    """      <FileOpenPanel
        isOpen={fileOpenPanelOpen}
        onOpenChange={setFileOpenPanelOpen}
        onProjectOpened={adoptNativeProject}
        activeWorkingCopyId={activeWorkingCopyId}
        prepareForProjectReplacement={prepareCurrentNativeProjectForReplacement}
      />
""",
)

replace_once(
    "apps/web/src/file-handling/FileOpenPanel.tsx",
    """    // The current project has now been asked every non-mutating question we can
    // ask about the candidate. Before allocating another Worker, give the live
    // session a chance to drain its own write queue. The surrounding modal is
    // already trapping focus, so no new canvas edit can race in behind this
    // barrier. A failed write is a hard refusal: the old session is the only
    // object that can replay it, so replacing that session would make the edit
    // irrecoverable.
""",
    """    // The current project has now been asked every non-mutating question we can
    // ask about the candidate. Before allocating another Worker, give the live
    // session a chance to drain its own write queue. A failed write is a hard
    // refusal: the old session is the only object that can replay it, so
    // replacing that session would make the edit irrecoverable. The same gate
    // is checked again immediately before adoption because global shortcuts can
    // still change the workspace while this modal is waiting on candidate I/O.
""",
)

replace_once(
    "apps/web/src/file-handling/FileOpenPanel.tsx",
    """    if (!isCurrent()) {
      // A newer attempt owns the flow. This project is real and fully open, and
      // it is not the one the user is waiting for - so it is closed here rather
      // than adopted or leaked. Closing releases the Worker and with it the
      // working copy's write lock, which a later reopen of the same file needs.
      void opened.session.close();
      return;
    }
    // Adoption is the last step, and it is the caller's: the panel never
""",
    """    if (!isCurrent()) {
      // A newer attempt owns the flow. This project is real and fully open, and
      // it is not the one the user is waiting for - so it is closed here rather
      // than adopted or leaked. Closing releases the Worker and with it the
      // working copy's write lock, which a later reopen of the same file needs.
      void opened.session.close();
      return;
    }

    // Candidate I/O can take long enough for a global undo/redo shortcut to
    // enqueue another native write behind the modal. Re-run the same
    // non-destructive barrier at the last possible moment. If the current
    // project became unsafe, release the candidate and keep the old session
    // authoritative and recoverable.
    if (prepareForProjectReplacement !== undefined) {
      let preparation: NativeProjectReplacementPreparation;
      try {
        preparation = await prepareForProjectReplacement();
      } catch (error) {
        void opened.session.close().catch(() => undefined);
        emit({
          type: 'fail',
          code: 'ARQ_REPLACE_PREPARE_FAILED',
          message:
            error instanceof Error
              ? error.message
              : 'The current project could not be prepared for replacement.',
        });
        return;
      }
      if (!isCurrent()) {
        void opened.session.close().catch(() => undefined);
        return;
      }
      if (preparation.status === 'blocked') {
        void opened.session.close().catch(() => undefined);
        emit({ type: 'fail', code: preparation.code, message: preparation.reason });
        return;
      }
    }

    // Adoption is the last step, and it is the caller's: the panel never
""",
)
