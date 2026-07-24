# CMP-060: Import dropzone

## Purpose

Accept supported files.

## Anatomy

- Drop target region
- Instructional text listing supported formats
- Fallback "browse" action for non-drag input

## Required states

- Idle
- Drag-over (valid file type)
- Drag-over (invalid file type)
- Uploading/processing

## Behaviour

- Validates file type/extension on drag-over, giving feedback before drop, not only after a failed drop.
- Always offers a non-drag "browse" fallback - never drag-and-drop-only, since drag-and-drop is not available on every input method.
- Delegates real acquisition/detection to `packages/file-ingress` - this component is the UI surface, not where detection logic lives.

## Sizing

- Large enough drop target to be a comfortable, discoverable pointer/touch target, not a thin strip.

## Keyboard and accessibility

- The "browse" fallback action opens a native file picker and is a normal focusable button, fully keyboard-operable.

## Acceptance criteria

- [ ] A working keyboard-only path (via the browse fallback) exists independent of drag-and-drop.
- [ ] Invalid file type is communicated before or immediately at drop, using the real detection result, not a guess.
