# Commands and action copy

## Command labels

A command names an action, not a feature category.

Prefer:

- Open project
- Activate Wall tool
- Fit view
- Close active view
- Export PDF
- Review import
- Apply proposal
- Resolve conflict

Avoid:

- Project
- Wall draw
- Execute
- Run
- Go
- Continue

## Tool versus command

Keep the distinction:

- tool noun: **Wall**
- command action: **Activate Wall tool**
- help instruction: **Choose Wall**
- status: **Wall · choose start point**

## Primary buttons

Primary action labels should describe the result:

- Create project
- Open read-only
- Save a copy
- Replace local copy
- Export PDF
- Apply proposal
- Delete Level 2

Avoid consequential primary buttons labelled:

- OK
- Yes
- Continue
- Confirm
- Proceed
- Submit

## Cancel

Use **Cancel** when an in-progress operation will be abandoned.

Use **Close** when dismissing a non-destructive surface.

Use **Back** when navigation returns to the previous step without implying cancellation of already committed work.

Do not use Close and Cancel interchangeably in multi-step operations.

## Undo and redo

When the exact operation name is available:

- Undo Move wall
- Redo Place door

Tooltip/action history should use the operation label from the same source that generated the operation.

## Menu items

Menu item labels should remain verbs for actions and nouns for destinations.

Actions:

- Duplicate view
- Close view
- Export sheet

Destinations:

- Project settings
- Model health
- Keyboard shortcuts

## Keyboard

Visible shortcut labels must come from the platform-aware keyboard registry.

Do not write “Cmd+…” in generic help when the user may be on Windows, touch, or a different keyboard environment.
