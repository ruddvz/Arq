#!/usr/bin/env node
/**
 * ARQ-190: differentiate the 84 component docs in docs/components/ (they were
 * previously byte-identical boilerplate after "Purpose" - verified
 * programmatically, the same defect ARQ-175 fixed for the 57 page specs).
 *
 * Regenerates docs/components/CMP-*.md from COMPONENT-MAP.csv plus this
 * script's own per-component content, and regenerates
 * component-harness/components.js's `states` arrays to match each doc's
 * "Required states" section (id/name/purpose/renderer are preserved from the
 * existing file, not re-authored here).
 *
 * Regenerate after editing this script's per-component content:
 *   node scripts/gen-component-docs.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const csv = readFileSync(path.join(REPO, 'docs/components/COMPONENT-MAP.csv'), 'utf-8');
const rows = csv
  .trim()
  .split('\n')
  .slice(1)
  .map((line) => {
    // purpose may contain a comma inside quotes
    const m = line.match(/^([^,]+),([^,]+),(?:"([^"]*)"|([^,]*)),(.+)$/);
    if (!m) throw new Error(`bad csv row: ${line}`);
    const [, id, name, purposeQuoted, purposePlain, file] = m;
    return { id, name, purpose: purposeQuoted ?? purposePlain, file };
  });
if (rows.length !== 84) throw new Error(`expected 84 rows, got ${rows.length}`);

// Matches an id and the renderer that follows it within the same object literal,
// independent of whether name/purpose are single- or double-quoted - this file
// re-reads its own previously-generated output on every subsequent run (idempotent
// regeneration), and JSON.stringify (used below) always emits double quotes.
const rendererSrc = readFileSync(path.join(REPO, 'component-harness/components.js'), 'utf-8');
const rendererRe = /id: '(CMP-\d+)',[\s\S]*?renderer: '([^']*)',/g;
const rendererById = new Map();
let rm;
while ((rm = rendererRe.exec(rendererSrc))) rendererById.set(rm[1], rm[2]);
if (rendererById.size !== 84) throw new Error(`expected 84 renderers, got ${rendererById.size}`);

// Per-component real content. Every id in rows must have an entry here -
// the script throws if any are missing, so nothing can silently stay boilerplate.
const CONTENT = {};

function set(id, entry) {
  CONTENT[id] = entry;
}

// ---------- Actions ----------
set('CMP-001', {
  anatomy: [
    'Container',
    'Label text',
    'Optional leading icon',
    'Optional trailing icon',
    'Accessible name (label text or aria-label)',
  ],
  states: [
    'Default',
    'Hover',
    'Focus visible',
    'Active/pressed',
    'Disabled with reason',
    'Loading (label replaced by spinner, width preserved)',
  ],
  behaviour: [
    'A destructive action (delete, discard) requires a distinct visual treatment, never colour alone.',
    'A loading button disables re-submission but keeps its layout width so surrounding content does not reflow.',
    'Uses the same command availability and permission rules as the action it triggers - a button is never enabled for an action the user cannot perform.',
    'A disabled button exposes why via `aria-describedby` or an adjacent tooltip, not silently.',
  ],
  sizing: [
    'Desktop default height follows the button size tokens (compact/default/large).',
    'iPad hit target is at least 44x44pt regardless of visual size.',
    'Label truncates with an accessible full-text fallback (title attribute or tooltip) rather than wrapping.',
  ],
  keyboard: [
    'Reachable by Tab in document order; activated by Space and Enter.',
    'Native `<button>` semantics are used wherever the platform allows it, not a `div` with a click handler.',
    '`aria-busy="true"` while loading; screen readers announce the loading label change.',
  ],
  acceptance: [
    'All required states are implemented and visually distinct without relying on colour alone.',
    'Space and Enter both activate the button; loading state cannot be re-triggered.',
    'Disabled reason is available to assistive technology, not just sighted users.',
    'Contrast and focus-visible outline pass at every state.',
  ],
});

set('CMP-002', {
  anatomy: [
    'Container',
    'Icon glyph',
    'Accessible name via `aria-label`',
    'Optional badge (unread/count)',
  ],
  states: [
    'Default',
    'Hover',
    'Focus visible',
    'Active/pressed',
    'Disabled with reason',
    'Selected (toggle-style icon buttons)',
  ],
  behaviour: [
    'Never ships without an accessible name - the icon alone is not a label.',
    'A toggle-style icon button (e.g. mute/unmute) exposes `aria-pressed`, not just a visual colour change.',
    'Adjacent icon buttons keep at least 8px of visual separation so adjacent 44pt touch targets do not overlap.',
  ],
  sizing: [
    'Hit target is at least 44x44pt on iPad even when the glyph itself is 20-24px.',
    'Icon-only - no visible label text ever appears, by definition of this component.',
  ],
  keyboard: [
    'Space and Enter activate; if toggle-style, activation flips `aria-pressed` and is announced.',
    'A tooltip (CMP-025) shows the accessible name on hover/focus for sighted pointer/keyboard users.',
  ],
  acceptance: [
    'Every instance has a real accessible name, verified programmatically, not just visually apparent.',
    'Toggle-style instances expose `aria-pressed` and are announced on change.',
    'Touch target measures at least 44x44pt regardless of glyph size.',
  ],
});

set('CMP-003', {
  anatomy: [
    'Primary action segment',
    'Divider',
    'Disclosure segment (opens CMP-022 Menu)',
    'Accessible names for both segments',
  ],
  states: [
    'Default',
    'Hover (per segment)',
    'Focus visible (per segment)',
    'Active/pressed (per segment)',
    'Disabled with reason',
    'Menu open',
  ],
  behaviour: [
    'The primary segment always performs the single most common action; the disclosure segment only ever opens the related menu, never a second action.',
    'Opening the menu does not trigger the primary action.',
    'Disabling the whole control disables both segments together; a partially-disabled split button is not supported (ambiguous for screen readers).',
  ],
  sizing: [
    'Both segments meet the 44pt iPad hit target independently, with a visible divider at least 1px wide between them.',
  ],
  keyboard: [
    'Tab moves between the two segments as separate stops.',
    'Down Arrow (or Enter/Space) on the disclosure segment opens the menu with focus on its first item.',
    'Escape closes the menu and returns focus to the disclosure segment.',
  ],
  acceptance: [
    'Primary and disclosure segments are independently reachable and labelled for assistive technology.',
    'Opening the menu never fires the primary action as a side effect.',
    'Keyboard-only users can open, navigate and dismiss the menu without a pointer.',
  ],
});

// ---------- App chrome ----------
set('CMP-004', {
  anatomy: [
    'Project/document title (editable inline)',
    'Save/sync status (delegates to CMP-072 Sync state)',
    'Global actions (share, undo/redo, command palette entry)',
    'Workspace/user menu entry point',
  ],
  states: [
    'Default',
    'Title in edit mode',
    'Sync status: saved/saving/offline/conflict',
    'Narrow-viewport collapsed (icons only)',
  ],
  behaviour: [
    'Persists across every tool/mode change - never re-rendered or reflowed by a tool switch.',
    'Title edits commit on blur or Enter, and revert on Escape without saving a partial edit.',
    'On a narrow viewport, secondary actions collapse into an overflow menu rather than being hidden entirely.',
  ],
  sizing: [
    'Fixed height across the whole application chrome; never resizes when content below it changes.',
    'Title truncates with an accessible full name available via tooltip/title attribute.',
  ],
  keyboard: [
    'Tab order moves left-to-right through title, then global actions, then workspace/user menu.',
    'A documented shortcut (matching CMP-047 Command palette) opens global search/commands directly from anywhere.',
  ],
  acceptance: [
    'Title edit commits and reverts correctly on blur/Enter/Escape.',
    'Sync status is always one of a known finite set, never blank or ambiguous.',
    'Narrow-viewport collapse preserves access to every action via overflow, none silently dropped.',
  ],
});

set('CMP-005', {
  anatomy: [
    'Fixed set of tool category icons',
    'Active-tool indicator',
    'Optional flyout for tools with sub-options',
  ],
  states: [
    'Default',
    'Hover',
    'Focus visible',
    'Active tool (pressed + selected)',
    'Disabled (tool unavailable in current mode)',
  ],
  behaviour: [
    'Exactly one tool is active at a time; selecting a new tool always deactivates the previous one.',
    'Active tool is indicated by shape/icon change and a text label on hover/focus, never colour alone (this exact defect was found and fixed in the static prototype - issue ARQ-211/#211).',
    'A tool that does not apply to the current view (e.g. a 3D-only tool while in plan view) is disabled with a reason, not hidden, so the rail does not reflow.',
  ],
  sizing: [
    'Fixed width regardless of viewport; icons meet the 44pt iPad hit target.',
    'On iPad landscape the rail persists; on iPad portrait it collapses into the tool selection surface documented for the portrait shell.',
  ],
  keyboard: [
    'Arrow Up/Down (or Left/Right if rendered horizontally) moves the roving tabindex between tools; Tab exits the rail entirely.',
    'A documented single-key shortcut per tool (matching the desktop CAD convention already in `packages/editor-shell`) activates it directly.',
    'Each tool button exposes `aria-pressed` reflecting the active tool.',
  ],
  acceptance: [
    'Active tool is programmatically determinable (`aria-pressed`), not shape/colour-only.',
    'Disabled tools state why via `aria-describedby`, not just a visual dim.',
    'Roving tabindex keeps the rail a single Tab stop from the rest of the page.',
  ],
});

set('CMP-006', {
  anatomy: [
    'Context-dependent control group',
    'Optional selection summary (count/type)',
    'Optional confirm/cancel for multi-step tool settings',
  ],
  states: [
    'Empty (no tool/selection - hidden or shows a hint)',
    'Populated for active tool',
    'Populated for active selection',
    'Disabled sub-controls where a setting does not apply',
  ],
  behaviour: [
    'Content is entirely driven by the active tool or selection - it has no state of its own to persist across a tool change.',
    'Never shows controls for a setting that cannot apply to the current selection (e.g. wall thickness when nothing is selected).',
    'Changes commit immediately per control (this is a live settings surface, not a form with a separate save step).',
  ],
  sizing: [
    'Height adapts to its densest realistic content but does not grow unbounded - overflow controls collapse into a menu.',
  ],
  keyboard: [
    'Tab order flows left to right through whatever controls are currently shown.',
    'Escape returns focus to the canvas/model without discarding already-committed changes.',
  ],
  acceptance: [
    'Empty state never shows disabled ghost controls for a tool that is not active.',
    'Every visible control is genuinely applicable to the current tool/selection.',
    'Tab order stays predictable as controls change between tools.',
  ],
});

set('CMP-007', {
  anatomy: [
    'Unit system indicator (metric/imperial)',
    'Active snap type (delegates to CMP-053 Snap glyph)',
    'Selection summary (count and type)',
    'Save/sync status (delegates to CMP-072 Sync state)',
    'Model health summary (delegates to CMP-070)',
  ],
  states: [
    'Default',
    'Selection empty vs populated',
    'Snap active vs inactive',
    'Sync: saved/saving/offline/conflict',
    'Model health: healthy/warnings/errors',
  ],
  behaviour: [
    'Every segment is read-only status except the unit toggle, which is a real control.',
    'Model health segment is clickable and opens CMP-070/CMP-071 detail, but only when there is something to show - not a dead click target when healthy.',
    'Never blocks or delays canvas interaction; it only reflects state, it does not gate it.',
  ],
  sizing: [
    'Fixed single-row height across the whole application; segments truncate individually under width pressure, never the whole bar.',
  ],
  keyboard: [
    'Each interactive segment (unit toggle, model health) is an independent Tab stop with its own accessible name.',
    'Status-only segments (snap, selection, sync) are exposed via `aria-live="polite"` region updates, not as focusable elements.',
  ],
  acceptance: [
    'Status-only segments are announced via `aria-live`, not focus-stealing.',
    'Model health segment truthfully reflects zero, warning, and error counts with no lag from the actual model state.',
    'Unit toggle change is reflected immediately across every open numeric field.',
  ],
});

set('CMP-008', {
  anatomy: [
    'Search/filter field (delegates to CMP-013)',
    'Hierarchical tree of levels/views/sheets/imports/elements (rows are CMP-038 Tree item)',
    'Empty state for a project with nothing yet',
  ],
  states: [
    'Default',
    'Filtered (matches highlighted, non-matches collapsed)',
    'Empty (no project content yet)',
    'Node selected/multi-selected',
    'Node loading (large import still staging)',
  ],
  behaviour: [
    'Selecting a node in the tree selects the same object on the canvas and in the inspector - one selection model shared across all three surfaces.',
    'Filtering never deletes or hides data, only visually collapses non-matching branches; clearing the filter restores the prior expand/collapse state exactly.',
    'A node still being staged from an in-progress import shows a loading affordance rather than appearing complete or missing.',
  ],
  sizing: [
    'Resizable panel with a minimum width that keeps the deepest realistic nesting level legible without horizontal scroll for common projects.',
  ],
  keyboard: [
    'Arrow Up/Down moves focus between visible rows; Right expands a collapsed node, Left collapses/moves to parent.',
    'Type-ahead jumps focus to the next row starting with the typed character(s).',
    'Enter/Space selects; Shift+Arrow extends a contiguous multi-selection.',
  ],
  acceptance: [
    'Selection stays synchronised across tree, canvas, and inspector in both directions.',
    'Filter state is fully reversible without losing prior expand/collapse state.',
    'Full keyboard tree navigation (arrows, type-ahead, multi-select) works without a pointer.',
  ],
});

set('CMP-009', {
  anatomy: [
    'Selected-object type/name header',
    'Grouped property rows (CMP-010)',
    'Empty state for no/mixed selection',
  ],
  states: [
    'Empty (nothing selected)',
    'Single selection',
    'Multi-selection with mixed values',
    'Read-only (no permission to edit)',
  ],
  behaviour: [
    'A mixed-value property across a multi-selection shows an explicit "Mixed" indicator, never a blank field or an arbitrarily-picked single value.',
    'Committing an edit applies to every selected object atomically - either all update or none do, never a partial batch.',
    "Read-only mode (no edit permission) disables inputs with a reason rather than hiding them, so the user still sees the object's real state.",
  ],
  sizing: [
    'Resizable panel; property rows wrap rather than truncate their value where truncation would hide a decision-relevant number.',
  ],
  keyboard: [
    "Tab moves between property rows in visual order; each row's own control (CMP-011/012/014/016/etc.) owns its internal key handling.",
    "Escape in an editing field reverts that field's uncommitted edit without closing the inspector.",
  ],
  acceptance: [
    'Mixed-value state is visually and programmatically distinct from a real shared value.',
    'Multi-object commits are atomic - a rejected validation on one object rejects the whole edit, not a partial one.',
    'Read-only state is announced to assistive technology, not just visually dimmed.',
  ],
});

set('CMP-010', {
  anatomy: [
    'Label',
    'Value control (delegates to the relevant input component)',
    'Inheritance indicator (from type/template vs overridden)',
    'Inline validation slot (CMP-031)',
  ],
  states: [
    'Default (own value)',
    'Inherited (from type/template, not overridden)',
    'Overridden (was inherited, now has its own value)',
    'Invalid',
    'Read-only',
  ],
  behaviour: [
    'Inherited values are visually distinguished from overridden ones, and offer a "reset to inherited" action once overridden.',
    'An invalid value shows its inline validation immediately adjacent, never in a separate panel the user must find.',
    "Read-only rows still display the real current value - never blank just because it can't be edited here.",
  ],
  sizing: [
    'Fixed label column width across all rows in one inspector so values align in a scannable column.',
  ],
  keyboard: [
    'Tab reaches the value control directly; label is not independently focusable.',
    'The "reset to inherited" action, when present, is reachable by Tab after the value control.',
  ],
  acceptance: [
    'Inherited vs overridden is programmatically determinable, not colour-only.',
    'Inline validation appears in the same row as its field, immediately on invalid commit.',
    'Reset-to-inherited restores the exact prior inherited value, not a stale cached one.',
  ],
});

// ---------- Form inputs ----------
set('CMP-011', {
  anatomy: [
    'Label',
    'Input',
    'Optional helper text',
    'Optional inline validation (CMP-031)',
    'Optional character/length indicator',
  ],
  states: ['Default', 'Focus', 'Filled', 'Disabled with reason', 'Invalid', 'Read-only'],
  behaviour: [
    'Validates on blur/commit, not on every keystroke, so the user is not shown an error while still mid-typing a valid value.',
    'Read-only differs from disabled: read-only text remains selectable/copyable; disabled communicates "cannot be edited here at all."',
  ],
  sizing: [
    'Width follows its container/grid; height follows the field-height token shared by every text-style input in this list.',
  ],
  keyboard: [
    'Standard native text-input editing keys; no custom key interception beyond Enter committing (where applicable) and Escape reverting an uncommitted edit.',
  ],
  acceptance: [
    'Validates on blur/commit, not per-keystroke.',
    'Read-only and disabled are visually and programmatically distinct.',
    'Invalid state links its error text via `aria-describedby`.',
  ],
});

set('CMP-012', {
  anatomy: [
    'Label',
    "Unit-aware input (delegates to `packages/editor-shell`'s metric/imperial numeric-input parsers)",
    'Unit suffix/indicator',
    'Optional inline validation',
  ],
  states: [
    'Default',
    'Focus (raw editable value shown)',
    'Blurred/committed (formatted with unit)',
    'Disabled with reason',
    'Invalid (out of range or unparseable)',
  ],
  behaviour: [
    "Accepts both metric and imperial input syntax regardless of the project's current display unit, parsing before commit (matches the real parser behaviour already implemented, not a new rule invented for this doc).",
    'An unparseable or out-of-range value is rejected at commit with an explicit reason, and the field reverts to its last valid committed value rather than silently accepting garbage.',
    "Displays in the project's current unit system on blur regardless of which system the user typed in.",
  ],
  sizing: [
    'Same field-height token as CMP-011; width may be narrower than a general text field since numeric values are typically short.',
  ],
  keyboard: [
    "Up/Down arrow keys nudge the value by its unit's smallest sensible increment while focused.",
    'Enter commits; Escape reverts to the last committed value.',
  ],
  acceptance: [
    'Both metric and imperial input syntax are accepted and parsed correctly regardless of display unit.',
    'Out-of-range/unparseable input is rejected with a stated reason, not silently clamped.',
    "Up/Down arrow nudging respects the field's real unit increment, not a generic 1.",
  ],
});

set('CMP-013', {
  anatomy: [
    'Search icon',
    'Input',
    'Clear button (appears once non-empty)',
    'Optional live result count',
  ],
  states: [
    'Empty',
    'Typing (debounced)',
    'Has results',
    'No results found',
    'Disabled with reason',
  ],
  behaviour: [
    'Debounces query execution so every keystroke does not trigger a full search pass.',
    '"No results" is an explicit, distinct empty state (CMP-035), never an indistinguishable blank list.',
    'Clear button both empties the field and returns focus to the input, ready for a new query.',
  ],
  sizing: [
    "Matches CMP-011's field height; grows to fill its container width up to a sensible maximum.",
  ],
  keyboard: [
    'Escape clears the query if non-empty, or blurs the field if already empty.',
    'Down Arrow from the field moves focus into the first result, where the results list owns further navigation.',
  ],
  acceptance: [
    'Query execution is debounced, not fired on every keystroke.',
    'Empty/no-results/has-results are each a distinct, correctly-announced state.',
    "Escape's two-stage behaviour (clear, then blur) works exactly as specified.",
  ],
});

set('CMP-014', {
  anatomy: ['Label', 'Trigger showing the current value', 'Popup listbox of options'],
  states: ['Default (closed)', 'Open', 'Focus', 'Disabled with reason', 'Invalid'],
  behaviour: [
    'Exactly one option is selected at all times once a default exists - there is no "nothing selected" state for a required select (an optional one shows an explicit placeholder option instead of a blank trigger).',
    'Opening the popup does not change the committed value until an option is actually chosen.',
  ],
  sizing: [
    "Trigger height matches CMP-011; popup width is at least the trigger's width and grows to fit its longest option label.",
  ],
  keyboard: [
    'Enter/Space/Down Arrow opens the popup with the current selection focused.',
    'Arrow Up/Down moves focus within the open popup; type-ahead jumps to a matching option.',
    'Enter commits the focused option and closes the popup; Escape closes without changing the selection.',
  ],
  acceptance: [
    'Full keyboard operation (open, navigate, type-ahead, commit, cancel) works without a pointer.',
    'Escape never leaves a partially-changed selection.',
    'Native `<select>` semantics are used where the platform allows it, matching a real listbox pattern otherwise.',
  ],
});

set('CMP-015', {
  anatomy: [
    'Label',
    'Editable text input',
    'Popup listbox of filtered suggestions',
    'Optional "create new" affordance',
  ],
  states: [
    'Empty',
    'Typing (filtering)',
    'Open with suggestions',
    'No matches (optionally offers "create new")',
    'Selected',
    'Disabled with reason',
    'Invalid',
  ],
  behaviour: [
    'Filters the option list against the typed text; does not require an exact match unless the field explicitly restricts to existing values.',
    'If free text is not a valid final value, the field rejects commit of unmatched text with a stated reason rather than silently accepting it.',
  ],
  sizing: ["Same as CMP-014's trigger height; popup matches CMP-014's sizing rule."],
  keyboard: [
    'Typing filters the popup live; Arrow Down moves focus from the input into the filtered list without closing it.',
    'Enter commits the highlighted suggestion (or the typed text, if free text is allowed); Escape closes without committing a change.',
  ],
  acceptance: [
    'Filtering is case-insensitive and updates the popup on every keystroke without losing input focus.',
    'Free-text rejection (where applicable) states why, rather than silently ignoring the keystroke.',
    'Screen reader announces the live result count as filtering happens.',
  ],
});

// ---------- Toggles ----------
set('CMP-016', {
  anatomy: ['Checkbox control', 'Label (label click also toggles)', 'Optional indeterminate glyph'],
  states: [
    'Unchecked',
    'Checked',
    'Indeterminate (mixed children/partial selection)',
    'Focus visible',
    'Disabled with reason',
    'Invalid',
  ],
  behaviour: [
    'Indeterminate is a distinct visual and programmatic state (`aria-checked="mixed"`), not just a differently-coloured checked box.',
    'Clicking the associated label toggles the checkbox exactly as clicking the box itself would (native `<label for>` association).',
  ],
  sizing: [
    'Native control size follows the platform/token minimum, with the full label+box hit target at least 44pt tall on iPad.',
  ],
  keyboard: ['Space toggles; Tab moves to/from it in document order like any other form control.'],
  acceptance: [
    'Indeterminate state is programmatically `aria-checked="mixed"`, not merely a visual approximation.',
    'Label click toggles the control.',
    'Space toggles when focused; no other key does.',
  ],
});

set('CMP-017', {
  anatomy: [
    'Group label',
    'Set of mutually exclusive radio options',
    'Optional per-option helper text',
  ],
  states: [
    'Default (one option selected)',
    'Focus visible (on the focused option)',
    'Disabled with reason (whole group or a single option)',
    'Invalid (group-level, e.g. required but unanswered)',
  ],
  behaviour: [
    'Exactly one option is selected within the group at all times once a default exists.',
    'A single disabled option within an otherwise-enabled group states why that specific option is unavailable.',
  ],
  sizing: [
    'Options stack vertically by default; a compact horizontal layout is allowed only when there are two options and space is tight.',
  ],
  keyboard: [
    'Arrow Up/Down (or Left/Right if horizontal) moves selection between options directly - the group is a single Tab stop, matching native radio-group semantics.',
    'Tab enters/exits the whole group at the currently-selected option.',
  ],
  acceptance: [
    'The group is a single Tab stop; arrow keys move the actual selection, not just visual focus.',
    'A per-option disabled reason is exposed via `aria-describedby` on that option.',
  ],
});

set('CMP-018', {
  anatomy: [
    'Switch track and thumb',
    'Label',
    'Optional immediate-effect notice for a setting with side effects',
  ],
  states: [
    'Off',
    'On',
    'Focus visible',
    'Disabled with reason',
    'Transitioning (mid-animation, non-interactive)',
  ],
  behaviour: [
    'Change takes effect immediately on toggle - a switch never requires a separate "apply"/"save" step, unlike a form field.',
    'If the setting has a consequence the user should know before confirming, a switch is the wrong component - use a checkbox with an explicit confirm action instead.',
  ],
  sizing: [
    'Track/thumb sizing follows the design tokens; full label+switch hit target is at least 44pt tall on iPad.',
  ],
  keyboard: [
    'Space toggles when focused; Enter is not overloaded onto a switch to avoid double-meaning with dialog "default action" semantics.',
  ],
  acceptance: [
    'Toggling has no separate save step - the underlying setting changes immediately.',
    '`role="switch"` and `aria-checked` are used, not a checkbox role.',
    'Disabled reason is exposed via `aria-describedby`.',
  ],
});

set('CMP-019', {
  anatomy: [
    'Track',
    'Thumb',
    'Current value readout',
    'Optional min/max labels',
    'Optional step ticks',
  ],
  states: ['Default', 'Focus visible', 'Dragging (thumb active)', 'Disabled with reason'],
  behaviour: [
    "Dragging the thumb previews the value live; the underlying setting commits continuously or on release, per the specific control's own documented choice - never silently only on blur with no visual feedback while dragging.",
    'Always shows the current numeric value as text, never relying on thumb position alone for a value that matters precisely.',
  ],
  sizing: [
    'Track is at least 44pt long in its scrolling/interactive axis on iPad; thumb hit target is at least 44x44pt even if the visual thumb is smaller.',
  ],
  keyboard: [
    'Arrow Left/Right (or Up/Down if vertical) adjusts by one step; Page Up/Down adjusts by a larger step; Home/End jump to min/max.',
  ],
  acceptance: [
    'Current value is always shown as readable text, not thumb-position-only.',
    'Full keyboard operation (arrows, page, home/end) works without a pointer.',
    'Thumb hit target meets 44pt even when the visual thumb is smaller.',
  ],
});

set('CMP-020', {
  anatomy: ['Set of 2-4 mutually exclusive compact options rendered as connected buttons'],
  states: [
    'Default',
    'Hover (per segment)',
    'Focus visible (per segment)',
    'Selected segment',
    'Disabled with reason (whole control or one segment)',
  ],
  behaviour: [
    'Exactly one segment is selected at all times; selecting a new one deselects the previous immediately (this is a mode switch, not a multi-select).',
    'Reserved for a small, stable, well-known set of options (2-4) - a longer or dynamic option set should use Tabs (CMP-021) or Select (CMP-014) instead.',
  ],
  sizing: [
    'Fixed total width for a given option set; segments divide that width evenly unless label length genuinely requires otherwise.',
  ],
  keyboard: [
    'Arrow Left/Right moves the actual selection between segments (roving tabindex, single Tab stop overall), matching radio-group semantics.',
  ],
  acceptance: [
    'Exactly one segment is selected at all times; arrow keys move the real selection.',
    'The whole control is a single Tab stop.',
  ],
});

set('CMP-021', {
  anatomy: ['Tab list', 'Individual tab triggers', 'Associated tab panel'],
  states: [
    'Default',
    'Focus visible (on the focused tab)',
    'Selected tab',
    'Disabled tab with reason',
  ],
  behaviour: [
    "Switching tabs preserves each unselected panel's scroll position and any in-progress uncommitted edit rather than discarding it.",
    'A disabled tab (e.g. a Document tab before any sheet exists) states why rather than simply being unreachable with no explanation.',
  ],
  sizing: [
    'Tab list height is fixed; long tab labels truncate with an accessible full label available via tooltip.',
  ],
  keyboard: [
    'Arrow Left/Right moves focus and selection between tabs (roving tabindex, single Tab stop for the tab list itself).',
    "Tab (the key) moves from the tab list into the currently-selected panel's content.",
  ],
  acceptance: [
    "Switching tabs never discards an unselected panel's in-progress state.",
    'Tab list is a single Tab stop; arrow keys move both focus and selection together.',
    '`role="tablist"`/`role="tab"`/`role="tabpanel"` and `aria-selected` are used correctly.',
  ],
});

// ---------- Menus/overlays ----------
set('CMP-022', {
  anatomy: [
    'Trigger (usually a button)',
    'Popup list of actions/options',
    'Optional icons/shortcuts per item',
    'Optional separators/groups',
  ],
  states: [
    'Closed',
    'Open',
    'Item focused',
    'Item disabled with reason',
    'Submenu open (nested menu)',
  ],
  behaviour: [
    'Opens anchored to its trigger and closes on: item activation, Escape, or an outside click/tap.',
    "A disabled menu item states why via an adjacent hint or `aria-describedby`, and is never silently removed (removing it would make the menu's shape unpredictable).",
  ],
  sizing: [
    'Popup width fits its longest item label; height scrolls internally rather than growing past the visible viewport.',
  ],
  keyboard: [
    'Enter/Space/Down Arrow on the trigger opens the menu with the first item focused.',
    'Arrow Up/Down moves focus between items; Right Arrow opens a submenu, Left Arrow closes it and returns to the parent item.',
    'Escape closes the (sub)menu and returns focus to its trigger.',
    'Type-ahead jumps to the next item starting with the typed character.',
  ],
  acceptance: [
    'Full keyboard operation (open, navigate, submenu, activate, escape) works without a pointer.',
    'Focus returns to the trigger after every close path, matching the exact focus-return defect already found and fixed in the static prototype (issue ARQ-211/#211).',
    'Disabled items state why rather than disappearing.',
  ],
});

set('CMP-023', {
  anatomy: [
    'Popup list of actions relevant to the right-clicked/long-pressed target',
    'Optional icons/shortcuts per item',
  ],
  states: ['Closed', 'Open at pointer/touch position', 'Item focused', 'Item disabled with reason'],
  behaviour: [
    'Content is entirely derived from what was right-clicked/long-pressed - it has no fixed content of its own like CMP-022 does.',
    'Opens anchored to the pointer/touch position (not a fixed trigger element), clamped to stay fully within the viewport.',
    'On iPad, a long-press opens it in place of the desktop right-click gesture, with the same content rules.',
  ],
  sizing: [
    'Same popup sizing rule as CMP-022 (fits content, scrolls internally, clamped to viewport).',
  ],
  keyboard: [
    'The equivalent keyboard-accessible entry point is the platform "context menu" key or Shift+F10 on the currently-selected/focused object, so this menu is never pointer-only.',
    'Once open, keyboard navigation matches CMP-022 exactly (arrows, type-ahead, Escape, focus return).',
  ],
  acceptance: [
    'A keyboard-only path to open the same menu exists and is discoverable (documented shortcut), not pointer/touch-only.',
    'Menu position is always fully within the viewport, never clipped off-screen.',
    'Focus returns to the triggering selection after close.',
  ],
});

set('CMP-024', {
  anatomy: ['Trigger', 'Non-modal popup content region', 'Optional close affordance'],
  states: ['Closed', 'Open', 'Focus within'],
  behaviour: [
    'Non-modal: unlike CMP-026 Dialog, the rest of the page remains interactive while a popover is open, and it closes on outside interaction rather than blocking it.',
    'Positions itself relative to its trigger and repositions/flips if it would otherwise render off-screen.',
  ],
  sizing: [
    'Sized to its content up to a sensible maximum width/height; scrolls internally beyond that rather than growing unbounded.',
  ],
  keyboard: [
    'Escape closes it and returns focus to the trigger.',
    "Tab moves through its internal focusable content; Tab out of the last item closes it and continues into the page's normal tab order (a popover never traps focus - that is Dialog's job).",
  ],
  acceptance: [
    'Does not trap focus, unlike a Dialog - Tab can leave it into the rest of the page.',
    'Repositions to stay fully visible regardless of trigger location near a viewport edge.',
    'Escape closes and restores focus to the trigger.',
  ],
});

set('CMP-025', {
  anatomy: ['Trigger element', 'Non-interactive text content'],
  states: ['Hidden', 'Visible (on hover or focus)'],
  behaviour: [
    'Purely informative - never contains an interactive control and never conveys information unavailable elsewhere (a tooltip is a supplement, not the only source of a required fact).',
    'Appears on both hover and keyboard focus, and on long-press on touch devices - it is never pointer-only.',
    'Disappears on Escape, on blur, or when the trigger is no longer hovered, whichever comes first.',
  ],
  sizing: [
    'Sized to its (short) text content; wraps rather than overflowing the viewport near an edge.',
  ],
  keyboard: ['Escape dismisses it without moving focus away from the trigger.'],
  acceptance: [
    'Appears on keyboard focus, not just pointer hover.',
    'Never the sole source of information required to use the associated control.',
    'Contains no interactive content.',
  ],
});

// ---------- Modals ----------
set('CMP-026', {
  anatomy: [
    'Overlay/scrim',
    'Title',
    'Body content',
    'Primary and secondary actions',
    'Optional close control',
  ],
  states: [
    'Closed',
    'Open',
    'Open with a validation error blocking its primary action',
    'Busy (primary action in progress)',
  ],
  behaviour: [
    'Modal: traps focus within itself while open and blocks interaction with the rest of the page via the scrim.',
    'Closing via any path (action button, Escape, scrim click, close control) returns focus to the exact element that opened it - the precise defect (BUG-RISK-140) already found and fixed in the static prototype (issue ARQ-211/#211).',
    'A destructive primary action (delete, discard) is visually distinct from a neutral one and never the pre-focused default unless the destructive action is genuinely what most users want (e.g. confirming a delete they already explicitly requested).',
  ],
  sizing: [
    'Sized to its content up to a maximum width/height per breakpoint; scrolls its body internally rather than exceeding the viewport.',
  ],
  keyboard: [
    'Focus moves to the dialog (its title or first focusable element) on open, and is trapped within it via Tab/Shift+Tab.',
    'Escape closes it exactly like a cancel action, unless the dialog explicitly documents itself as non-dismissable (e.g. mid-destructive-operation with no safe cancel point).',
  ],
  acceptance: [
    'Focus returns to the exact trigger element after every close path (button, Escape, scrim click).',
    'Focus is trapped within the dialog while open; Tab never escapes to the background page.',
    '`role="dialog"`/`aria-modal="true"` and a real accessible name (title) are present.',
  ],
});

set('CMP-027', {
  anatomy: [
    'Overlay/scrim (optional, may allow background interaction depending on use)',
    'Slide-in panel from a screen edge',
    'Title',
    'Body content',
    'Optional actions',
  ],
  states: ['Closed', 'Open', 'Resizing (if the drawer supports a draggable edge)'],
  behaviour: [
    'Desktop-oriented secondary surface (e.g. detailed inspector or history panel) that does not block the whole canvas the way a Dialog does, unless explicitly configured as modal for a specific flow.',
    'Remembers its last width/open-state per surface within a session, rather than resetting every time it is reopened.',
  ],
  sizing: [
    'Has a documented minimum and maximum width if resizable; below the minimum it should behave like CMP-028 Bottom sheet instead (that is a distinct component, not this one shrunk down).',
  ],
  keyboard: [
    'Escape closes it (if dismissable) and returns focus to its trigger.',
    "If configured modal for a specific flow, follows the same focus-trap rule as CMP-026 Dialog; if non-modal, follows CMP-024 Popover's non-trapping rule instead.",
  ],
  acceptance: [
    'Open/width state persists correctly across reopen within a session.',
    'Focus-trap behaviour matches whichever mode (modal or non-modal) this specific drawer instance actually uses - never ambiguous.',
  ],
});

set('CMP-028', {
  anatomy: ['Drag handle', 'Title', 'Body content', 'Optional actions', 'Scrim below the sheet'],
  states: [
    'Closed',
    'Peek (partially visible, collapsed)',
    'Open (fully expanded)',
    'Dragging (mid-gesture)',
  ],
  behaviour: [
    'iPad-portrait-specific secondary surface, replacing CMP-027 Drawer where a side panel would not fit the portrait layout.',
    'Drag handle supports both a full swipe-to-dismiss gesture and a tap-to-toggle between peek and open, so it is never gesture-only.',
    'Settles into exactly one of its defined snap positions (peek/open/closed) after a drag ends - never left at an arbitrary partial height.',
  ],
  sizing: [
    'Peek height and open height are each fixed per breakpoint, not proportional to unrelated content changes.',
  ],
  keyboard: [
    'When a hardware keyboard is attached, Escape closes it and a documented shortcut toggles peek/open, so it is not touch-gesture-only even on iPad.',
  ],
  acceptance: [
    'Settles into a defined snap position after every drag, never an arbitrary height.',
    'Fully operable by tap alone (no gesture-only dead ends) and by keyboard when a hardware keyboard is attached.',
  ],
});

// ---------- Feedback ----------
set('CMP-029', {
  anatomy: [
    'Icon (optional, matching severity)',
    'Message text',
    'Optional single action (e.g. Undo)',
    'Auto-dismiss timer',
  ],
  states: ['Visible', 'Visible with action', 'Dismissing (exit animation)'],
  behaviour: [
    'Transient and non-blocking - never requires acknowledgement to continue working, and never contains more than one action.',
    'Auto-dismisses after a fixed duration unless the user is actively hovering/focused on it (e.g. reading it or about to click Undo), in which case the timer pauses.',
    'Multiple toasts queue rather than overlapping or replacing one another before being seen.',
  ],
  sizing: ['Fixed maximum width; message text wraps rather than truncating a fact the user needs.'],
  keyboard: [
    'Never steals focus on appearance; its optional action (if present) is reachable by Tab for as long as the toast remains visible, and Escape dismisses it early.',
  ],
  acceptance: [
    'Never steals focus when it appears.',
    'Timer pauses on hover/focus and resumes correctly.',
    'Announced via `aria-live="polite"` so it is not missed by screen reader users without stealing their focus.',
  ],
});

set('CMP-030', {
  anatomy: [
    'Icon (matching severity)',
    'Message text',
    'Optional action',
    'Optional dismiss control',
  ],
  states: ['Visible (info/warning/error severity)', 'Dismissed (if dismissable)'],
  behaviour: [
    'Persistent page-level status - unlike CMP-029 Toast, it does not auto-dismiss and remains visible until the underlying condition resolves or the user dismisses it.',
    'Only shown for a condition that is genuinely page-level (affects the whole current view), not a single-object issue - that belongs in CMP-031 Inline validation instead.',
  ],
  sizing: [
    'Spans the width of its containing surface; height grows with message length rather than truncating a fact the user needs to act on.',
  ],
  keyboard: [
    'Its optional dismiss control and action are reachable by Tab in document order; no focus-trap behaviour, since it never blocks the rest of the page.',
  ],
  acceptance: [
    'Remains visible until the underlying condition genuinely resolves, not on a timer.',
    'Announced via `aria-live="polite"` on appearance.',
    'Never used for a single-object issue that belongs in Inline validation instead.',
  ],
});

set('CMP-031', {
  anatomy: [
    'Icon',
    'Message text',
    'Association with its specific field/object via `aria-describedby`',
  ],
  states: ['Hidden (valid)', 'Visible (invalid)'],
  behaviour: [
    "Always appears immediately adjacent to the specific field/object it describes, never in a separate summary-only location (that is CMP-032's distinct job).",
    'Message states the specific problem and, where possible, how to fix it - never a generic "Invalid value."',
  ],
  sizing: ['Width matches its associated field; wraps rather than truncating.'],
  keyboard: [
    'No independent keyboard interaction - it is programmatically linked to its field via `aria-describedby` so screen readers announce it automatically on focus.',
  ],
  acceptance: [
    'Every invalid field has an adjacent, specific (non-generic) message.',
    '`aria-describedby` correctly links the field to its message so it is announced automatically.',
  ],
});

set('CMP-032', {
  anatomy: [
    'Heading (count of problems)',
    'List of individual problems, each linking to its source field/object',
  ],
  states: ['Hidden (no blocking problems)', 'Visible with N problems'],
  behaviour: [
    'Aggregates every current blocking problem across the whole current view/form, each as a link that moves focus to and highlights its source field/object.',
    'Distinct from CMP-031: this is the "everything wrong in one place" view used before a blocking action (e.g. export, publish); CMP-031 is the per-field detail shown at the source.',
  ],
  sizing: [
    'Height scrolls internally beyond a reasonable maximum rather than pushing the blocking action off-screen.',
  ],
  keyboard: [
    'Each listed problem is a real link/button; activating it moves focus to the corresponding field and announces the same message CMP-031 shows there.',
  ],
  acceptance: [
    'Every listed problem correctly navigates focus to its real source field/object.',
    'Count shown always matches the real number of currently-blocking problems, with no stale entries after a problem is fixed.',
  ],
});

// ---------- Loading/empty ----------
set('CMP-033', {
  anatomy: ['Track/spinner', 'Optional percentage/label', 'Optional cancel action'],
  states: [
    'Determinate (known percentage)',
    'Indeterminate (unknown duration)',
    'Complete',
    'Failed',
  ],
  behaviour: [
    'Uses determinate form whenever real progress can be measured (e.g. bytes processed of a known total); falls back to indeterminate only when genuinely unknown.',
    'A cancellable operation exposes its cancel action directly on the indicator, not buried elsewhere.',
  ],
  sizing: [
    'Compact inline form for small operations; a full-width bar form for page-level/import-export operations (CMP-082 Job progress builds on this).',
  ],
  keyboard: ['Its cancel action, when present, is a normal focusable button reachable by Tab.'],
  acceptance: [
    'Determinate form is used whenever real progress is measurable, not defaulted to indeterminate out of convenience.',
    'Completion and failure are each announced via `aria-live`, not left to visual inference alone.',
  ],
});

set('CMP-034', {
  anatomy: ["Shape(s) approximating the real content's eventual layout"],
  states: ['Visible (loading)', 'Replaced by real content'],
  behaviour: [
    'Reserves the exact layout space the real content will occupy, so its arrival never causes a layout shift.',
    'Never shown for longer than a brief, genuinely-loading window - a slow operation should switch to CMP-033 Progress indicator instead once it is clear the wait is non-trivial.',
  ],
  sizing: [
    "Matches the real content's eventual dimensions exactly, not an approximate placeholder size.",
  ],
  keyboard: [
    'Not focusable; purely visual, and marked `aria-hidden` so screen readers do not announce a shape with no real content yet.',
  ],
  acceptance: [
    'Causes zero layout shift when replaced by real content.',
    'Never used to disguise a genuinely long-running operation that should show real progress instead.',
  ],
});

set('CMP-035', {
  anatomy: ['Icon or illustration', 'Explanatory text', 'Optional primary next action'],
  states: ['Visible (no content yet)', 'Visible (no results after a filter/search)'],
  behaviour: [
    'Explains the specific reason for absence (never had content, vs. filtered to zero results) rather than one generic "Nothing here" message for both cases.',
    'Where a clear next action exists (e.g. "New project"), it is offered directly rather than left for the user to discover elsewhere.',
  ],
  sizing: [
    'Centred within its container; scales down gracefully on narrow viewports rather than clipping.',
  ],
  keyboard: ['Its optional action is a normal focusable button reachable by Tab.'],
  acceptance: [
    'Distinguishes "never had content" from "filtered to zero results" with different, accurate text.',
    'Offers a real next action where one genuinely exists.',
  ],
});

// ---------- Data display ----------
set('CMP-036', {
  anatomy: [
    'Column headers (sortable)',
    'Rows of structured data',
    'Optional row selection checkboxes',
    'Optional pagination/virtualisation',
  ],
  states: [
    'Default',
    'Sorted (ascending/descending per column)',
    'Row hover',
    'Row selected',
    'Empty (delegates to CMP-035)',
    'Loading (delegates to CMP-034/033)',
  ],
  behaviour: [
    'Sorting is stable (equal keys keep their relative order) and reflected in the header via a visible + programmatic indicator, never colour alone.',
    'Large datasets are virtualised so scroll performance does not degrade with row count.',
  ],
  sizing: [
    'Columns are resizable with a documented minimum width per column that keeps its header label legible.',
  ],
  keyboard: [
    'Arrow keys move a roving cell/row focus in a grid pattern (Up/Down/Left/Right); Home/End jump to the first/last cell in a row; Ctrl+Home/End jump to the first/last cell in the table.',
    "Space toggles row selection where selection is supported; Enter activates a row's primary action if one exists.",
  ],
  acceptance: [
    'Sort state is programmatically exposed (`aria-sort`), not colour-only.',
    'Full grid keyboard navigation works without a pointer, matching `role="grid"` conventions.',
    'Virtualised scrolling never drops or duplicates a row.',
  ],
});

set('CMP-037', {
  anatomy: ['Ordered or filtered set of items', 'Optional per-item leading/trailing content'],
  states: [
    'Default',
    'Item hover',
    'Item selected',
    'Filtered (subset visible)',
    'Empty (delegates to CMP-035)',
  ],
  behaviour: [
    'Simpler than CMP-036 Data table: single-column items with no per-column sort/resize - used when structure is genuinely one-dimensional.',
    'Filtering preserves the underlying item order rather than re-sorting by relevance unless the list explicitly documents relevance-ranked filtering.',
  ],
  sizing: [
    'Item height is consistent across the list unless an item genuinely carries more content (e.g. a two-line item), in which case that height difference is intentional and documented, not accidental.',
  ],
  keyboard: ['Arrow Up/Down moves a roving item focus; Enter/Space activates the focused item.'],
  acceptance: [
    'Roving focus and Enter/Space activation work without a pointer.',
    'Filtering never reorders items unless explicitly documented as relevance-ranked.',
  ],
});

set('CMP-038', {
  anatomy: [
    'Expand/collapse disclosure triangle (if it has children)',
    'Icon indicating object type',
    'Label',
    'Optional trailing status/count',
  ],
  states: [
    'Collapsed (has children)',
    'Expanded',
    'Leaf (no children, no disclosure control)',
    'Selected/multi-selected',
    'Focus visible',
  ],
  behaviour: [
    'Belongs to and is rendered by CMP-008 Model tree - it has no standalone existence outside a tree.',
    'Expand/collapse state persists across a session per node, rather than resetting whenever the tree is filtered or re-rendered.',
  ],
  sizing: [
    'Indentation per depth level follows a fixed token so deep hierarchies stay legible without a horizontal scroll for realistic project depths.',
  ],
  keyboard: [
    "Delegates its Left/Right/Up/Down/type-ahead behaviour entirely to CMP-008's tree-level keyboard contract - it has no independent keyboard model of its own.",
  ],
  acceptance: [
    'Expand/collapse state persists correctly across filter/re-render within a session.',
    'Leaf nodes never render a disclosure control that does nothing.',
  ],
});

set('CMP-039', {
  anatomy: [
    'Thumbnail/preview',
    'Title',
    'Metadata (e.g. last saved, sync status)',
    'Optional actions (delegates to CMP-022 Menu)',
  ],
  states: [
    'Default',
    'Hover',
    'Focus visible',
    'Selected (in a multi-select grid)',
    'Syncing/offline (delegates to CMP-072/CMP-073)',
  ],
  behaviour: [
    'The whole card is a single activation target (opens the project/template) in addition to any secondary actions menu, so a click anywhere on the card except an explicit action opens it.',
    'Thumbnail reflects real current project content where available, falling back to a generic placeholder rather than a stale image.',
  ],
  sizing: [
    'Fixed aspect ratio for the thumbnail region across a grid of cards so the grid stays visually aligned.',
  ],
  keyboard: [
    'The whole card is one Tab stop, activated by Enter; its secondary-actions menu (if present) is a separate, subsequent Tab stop.',
  ],
  acceptance: [
    'Card and its secondary-actions menu are each independently reachable and operable by keyboard.',
    'Thumbnail never shows stale content once real project content exists.',
  ],
});

// ---------- Navigation ----------
set('CMP-040', {
  anatomy: [
    'Ordered sequence of ancestor labels',
    'Separators',
    'Current (non-clickable) final segment',
  ],
  states: ['Default', 'Truncated (collapses middle segments on narrow width)'],
  behaviour: [
    'Every segment except the final (current) one is a real navigation link, not decorative text.',
    'Truncation collapses middle segments behind an overflow affordance rather than dropping them entirely, so the full path remains reachable.',
  ],
  sizing: ['Single line; truncates via overflow rather than wrapping to a second line.'],
  keyboard: [
    'Each ancestor segment is an independent Tab stop and real link/button; the current segment is not focusable since it performs no action.',
  ],
  acceptance: [
    'Every non-current segment genuinely navigates.',
    'Truncated segments remain reachable via the overflow affordance, never silently lost.',
  ],
});

set('CMP-041', {
  anatomy: [
    'Trigger showing the current project name',
    'Popup list of recent/available projects',
    'Search/filter within the popup for large lists',
  ],
  states: ['Closed', 'Open', 'Filtering (many projects)', 'Loading (project list still fetching)'],
  behaviour: [
    "Switching projects preserves the current one's in-progress uncommitted state (auto-saves or explicitly prompts) rather than discarding it silently.",
  ],
  sizing: [
    'Popup grows to a maximum height with internal scrolling for large project lists rather than exceeding the viewport.',
  ],
  keyboard: [
    "Follows CMP-014 Select's keyboard contract (open, arrow-navigate, type-ahead filter, commit, escape).",
  ],
  acceptance: [
    'Never silently discards unsaved state when switching - either auto-saves first or explicitly prompts.',
    "Full keyboard operation matches CMP-014's contract.",
  ],
});

set('CMP-042', {
  anatomy: [
    'Trigger showing the current workspace name',
    'Popup list of available workspaces',
    'Optional "create workspace" affordance',
  ],
  states: ['Closed', 'Open', 'Loading (workspace list still fetching)'],
  behaviour: [
    'Switching workspace is a heavier transition than switching project (CMP-041) since it can change available projects, permissions, and team context entirely - shows a brief loading state rather than an instant, possibly-incomplete swap.',
  ],
  sizing: ['Same popup sizing rule as CMP-041.'],
  keyboard: ["Follows CMP-014 Select's keyboard contract."],
  acceptance: [
    'Shows a genuine loading state during the heavier workspace-switch transition rather than flashing incomplete/stale content.',
    "Full keyboard operation matches CMP-014's contract.",
  ],
});

set('CMP-043', {
  anatomy: [
    'Avatar/initials trigger (delegates to CMP-044 for rendering)',
    'Popup menu (delegates to CMP-022) with account and sign-out actions',
  ],
  states: ['Closed', 'Open'],
  behaviour: [
    'Sign-out always confirms first if there is any genuinely unsaved local state that would be lost, otherwise proceeds immediately.',
  ],
  sizing: ['Trigger meets the 44pt iPad hit target like any icon-style trigger.'],
  keyboard: ["Follows CMP-022 Menu's keyboard contract exactly."],
  acceptance: [
    'Sign-out never silently discards genuinely unsaved local state.',
    "Full keyboard operation matches CMP-022's contract.",
  ],
});

set('CMP-044', {
  anatomy: [
    'Initials or photo',
    'Presence indicator (online/idle/offline)',
    'Optional colour keyed to the collaborator',
  ],
  states: ['Online', 'Idle', 'Offline', 'Focus visible (when interactive, e.g. in CMP-043)'],
  behaviour: [
    'Presence state reflects the real current connection status of that specific collaborator, updating live rather than on a stale snapshot.',
    "Colour keying alone never distinguishes collaborators for accessibility purposes - initials/photo plus an accessible name (real person's name) always accompany it.",
  ],
  sizing: [
    'Fixed circular/rounded size per usage context (e.g. smaller stacked in a group, larger standalone in CMP-043).',
  ],
  keyboard: [
    'Not independently focusable unless it is itself a trigger (e.g. within CMP-043); otherwise purely decorative with an accessible name via `alt`/`aria-label`.',
  ],
  acceptance: [
    'Presence state updates live and never shows a stale status.',
    'A real accessible name (not colour alone) identifies the collaborator.',
  ],
});

set('CMP-045', {
  anatomy: [
    'List of assignable roles',
    'Currently-assigned role indicator',
    'Optional description of what each role can do',
  ],
  states: [
    'Default',
    'Open (choosing a new role)',
    'Disabled with reason (e.g. cannot demote the last owner)',
  ],
  behaviour: [
    'Never allows removing the last remaining owner/admin from a workspace/project - that specific option is disabled with a stated reason rather than allowed and failing later.',
    'Shows what each role can actually do (delegates to real RBAC data, not a static description that could drift from the truth).',
  ],
  sizing: [
    "Follows CMP-014 Select's sizing where rendered as a dropdown, or a radio-group's sizing (CMP-017) where rendered as a list with descriptions.",
  ],
  keyboard: [
    "Follows CMP-014 or CMP-017's keyboard contract depending on which visual form this instance uses.",
  ],
  acceptance: [
    'Cannot produce a workspace/project with zero owners/admins under any interaction path.',
    'Role descriptions shown always match the real current RBAC rules, not a stale hard-coded copy.',
  ],
});

set('CMP-046', {
  anatomy: [
    'Current link (if one exists) with copy action',
    '"Create link" action',
    'Access-level control (view/comment/edit)',
    '"Revoke" action for existing links',
  ],
  states: [
    'No link exists yet',
    'Link exists',
    'Just copied (transient confirmation)',
    'Revoking (confirm step)',
  ],
  behaviour: [
    'Revoking a link is a real permission change with immediate effect on anyone holding the old link - it always requires an explicit confirm step, never a single accidental click.',
    "Copy action gives clear, brief transient confirmation (matches CMP-029 Toast's pattern) rather than silent success.",
  ],
  sizing: [
    'Compact, typically hosted inside CMP-024 Popover or CMP-026 Dialog rather than a standalone full page.',
  ],
  keyboard: [
    'Every action (create, copy, change access level, revoke) is an independent, labelled Tab stop.',
  ],
  acceptance: [
    'Revoke always requires an explicit confirm step.',
    'Copy gives real, perceivable confirmation, not silent success.',
  ],
});

// ---------- Command ----------
set('CMP-047', {
  anatomy: [
    'Search input',
    'Filtered, ranked list of matching commands/objects',
    'Optional keyboard-shortcut hints per result (CMP-048)',
  ],
  states: [
    'Closed',
    'Open, empty query (recent/suggested commands)',
    'Open, typing (filtered results)',
    'No results',
    'Result focused',
  ],
  behaviour: [
    'Ranks results by relevance to the typed query, not just alphabetically or by insertion order.',
    'Never executes a command silently on typing - only on explicit selection (Enter or click), so a fast typist never accidentally fires something destructive mid-query.',
    'A command unavailable in the current context (e.g. no permission, or requires a selection that does not exist) still appears but is shown disabled with a stated reason, so users can discover what exists.',
  ],
  sizing: [
    'Modal-style overlay sized to a fixed maximum width/height regardless of viewport, centred, with internal scrolling for long result lists.',
  ],
  keyboard: [
    'A documented global shortcut (e.g. Cmd/Ctrl+K) opens it from anywhere in the application.',
    'Arrow Up/Down moves the highlighted result; Enter executes it; Escape closes without executing anything.',
  ],
  acceptance: [
    'Global shortcut opens it from any screen/mode.',
    'Nothing executes until explicit selection - typing alone never triggers a command.',
    'Unavailable commands are discoverable (shown, disabled, with a reason), not hidden.',
  ],
});

set('CMP-048', {
  anatomy: [
    'One or more key glyphs (e.g. platform-correct modifier symbols)',
    'Optional connecting "+" or spacing convention',
  ],
  states: ['Visible'],
  behaviour: [
    'Renders the platform-correct modifier glyphs (e.g. Cmd/Option on macOS/iPadOS vs Ctrl/Alt elsewhere) rather than one hard-coded convention everywhere.',
    'Purely informative; never itself an interactive trigger for the shortcut it describes.',
  ],
  sizing: [
    "Compact inline element sized to sit naturally inside a menu item, tooltip, or button without disrupting that container's row height.",
  ],
  keyboard: [
    'Not focusable; purely decorative/informative text for sighted and screen-reader users alike (the latter via a real text equivalent, not an image of the keys).',
  ],
  acceptance: [
    'Renders the correct platform-specific modifier glyphs per platform.',
    'Announces as real text to screen readers, not as an unlabelled image.',
  ],
});

// ---------- Canvas/geometry ----------
set('CMP-049', {
  anatomy: [
    'Rendering surface (plan/model/sheet view)',
    'Active tool cursor',
    'Selection/overlay layers (CMP-050/051/052/053/054 render on top of this)',
  ],
  states: [
    'Default (idle)',
    'Panning',
    'Zooming',
    'Active drawing command in progress',
    'Selection active',
  ],
  behaviour: [
    'The primary authoring surface - every editing tool, snap, and selection interaction ultimately renders and resolves here.',
    'Never loses committed model state on a rendering failure - a canvas render error is recoverable and reported (delegates to CMP-070/071), never silently corrupts underlying data.',
    'Provides a keyboard-operable fallback path for every pointer-only gesture where one is required for accessibility compliance (see Keyboard section) - it is not treated as inherently pointer-only.',
  ],
  sizing: [
    'Fills its available layout region and resizes live with the window/panel without discarding the current view/zoom state.',
  ],
  keyboard: [
    'Arrow keys pan the view; +/- (or a documented shortcut) zoom; a documented shortcut resets to fit.',
    'Tab moves focus to the canvas as a region, after which tool-specific keyboard commands (documented per tool, not here) take over.',
    "This is a real rendering engine surface, not something the flat-HTML component harness can render live - see the harness's own placeholder notice.",
  ],
  acceptance: [
    'A render failure never corrupts or loses committed model data.',
    'Keyboard-only pan/zoom/fit exists as a genuine fallback, not merely aspirational.',
  ],
});

set('CMP-050', {
  anatomy: [
    'Transparent layer above the canvas hosting transient controls/warnings that must track canvas coordinates',
  ],
  states: ['Empty (nothing to show)', 'Showing one or more transient controls/warnings'],
  behaviour: [
    'Purely additive over CMP-049 Canvas - never itself receives pointer events meant for the canvas beneath it except on its own explicit controls.',
    'Content here tracks canvas pan/zoom exactly, never drifting out of alignment with the geometry it annotates.',
  ],
  sizing: ["Exactly matches the canvas's own bounds and transform at all times."],
  keyboard: [
    "Any interactive control hosted here (e.g. an inline confirm) is independently reachable by Tab, not swallowed by the canvas's own keyboard handling.",
  ],
  acceptance: [
    'Overlay content never drifts out of alignment with canvas geometry during pan/zoom.',
    'Non-interactive regions of the overlay never intercept pointer events meant for the canvas.',
  ],
});

set('CMP-051', {
  anatomy: ['Draggable grip rendered at a manipulable geometry point (endpoint, midpoint, corner)'],
  states: [
    'Default',
    'Hover',
    'Dragging',
    'Snapped (delegates to CMP-053 Snap glyph while dragging)',
  ],
  behaviour: [
    'Dragging respects the same active snap settings as any other drawing operation - a handle drag is not a separate, unsnapped code path.',
    'A drag that would produce invalid/degenerate geometry (e.g. collapsing a wall to zero length) is rejected at drop, reverting to the last valid position rather than committing broken geometry.',
  ],
  sizing: [
    "Hit target is at least 44x44pt on iPad even though the visual grip is typically much smaller, matching every other interactive control's touch-target rule.",
  ],
  keyboard: [
    'A selected handle can be nudged by arrow keys at the current grid/snap increment, so precise adjustment is not pointer-only.',
  ],
  acceptance: [
    'A drag that would produce degenerate geometry is rejected, not silently committed.',
    'Keyboard nudging works as a genuine alternative to pointer dragging.',
    'Touch target meets 44pt regardless of visual grip size.',
  ],
});

set('CMP-052', {
  anatomy: [
    'Outline/highlight rendered around selected geometry, distinguishing primary from secondary selection',
  ],
  states: [
    'Unselected (not rendered)',
    'Primary selection',
    'Secondary/additional selection (multi-select)',
  ],
  behaviour: [
    'Primary and secondary selection are visually distinct (not just "everything selected looks the same"), since the primary selection is what property edits in CMP-009 Inspector target when values differ across a multi-selection.',
    'Never relies on colour alone - a distinct stroke pattern/weight also differs between primary and secondary.',
  ],
  sizing: [
    'Stroke weight is legible at every supported zoom level, including scaling appropriately rather than becoming a solid blob when zoomed far out.',
  ],
  keyboard: [
    'Not itself interactive - purely a rendering consequence of the real selection state, which is set via canvas/tree/keyboard selection actions elsewhere.',
  ],
  acceptance: [
    'Primary vs secondary selection is distinguishable without relying on colour alone.',
    'Remains legible (not a solid blob, not invisible) across the supported zoom range.',
  ],
});

set('CMP-053', {
  anatomy: [
    'Small glyph indicating the active snap type (endpoint, midpoint, intersection, grid, etc.) and its source object where applicable',
  ],
  states: ['Hidden (no active snap)', 'Visible per snap type (one glyph shape per type)'],
  behaviour: [
    'Each snap type (matching `packages/editor-shell`\'s real snap implementations - grid, midpoint, and the rest) has a visually distinct glyph, not one generic "snapped" indicator.',
    'Disappears immediately once the pointer moves off the snap point - never lingers stale.',
  ],
  sizing: ['Small, fixed size independent of canvas zoom, so it stays legible at any zoom level.'],
  keyboard: [
    'Purely visual feedback for an in-progress pointer operation; keyboard-driven precise entry uses CMP-054 Numeric overlay instead, which states the same information as accessible text.',
  ],
  acceptance: [
    'Each real snap type has its own distinct glyph, verified against the actual set of snap implementations in `packages/editor-shell`.',
    'Never shows a stale snap indicator after the pointer moves away.',
  ],
});

set('CMP-054', {
  anatomy: [
    'Small floating input tracking the cursor during an active drawing command',
    'Distance and/or angle fields (unit-aware, delegates to CMP-012)',
  ],
  states: [
    'Hidden (no active command)',
    'Visible, tracking pointer',
    'Visible, value being typed (locks that axis to the typed value)',
  ],
  behaviour: [
    'Lets a user type an exact distance/angle mid-command instead of relying on pointer precision alone - typing a value locks that dimension until the point is committed.',
    'Follows the exact same metric/imperial parsing rule as CMP-012 Numeric field - no separate, inconsistent parser for in-canvas entry.',
  ],
  sizing: [
    'Small and positioned near the cursor without obscuring the point currently being placed.',
  ],
  keyboard: [
    'Tab (or a documented key) switches which field (distance vs angle) currently accepts typed input.',
    'Enter commits the point at the typed value(s); Escape cancels the current segment without discarding the command entirely.',
  ],
  acceptance: [
    'Uses the identical parsing rules as CMP-012, verified against the same test cases.',
    'Typed value takes precedence over pointer position for the locked axis until committed.',
  ],
});

set('CMP-055', {
  anatomy: ['3D orientation cube/indicator with face/edge/corner hit regions'],
  states: ['Default', 'Hover (per face/edge/corner)', 'Active drag (free rotate)'],
  behaviour: [
    'Clicking a face/edge/corner animates to that exact standard orientation; dragging free-rotates the 3D view continuously.',
    '3D-view-only - hidden or disabled in plan/2D views where orientation has no meaning.',
  ],
  sizing: [
    'Fixed small size in a corner of the 3D viewport, never obscuring model content beneath it.',
  ],
  keyboard: [
    'A documented set of shortcuts (e.g. numeric keys for standard views) provides the same standard-orientation jumps as clicking a face, so the view cube itself is not the only way to reach a given orientation.',
  ],
  acceptance: [
    'Every standard orientation reachable by click is also reachable by a documented keyboard shortcut.',
    'Correctly hidden/disabled outside 3D views.',
  ],
});

set('CMP-056', {
  anatomy: [
    'Current zoom percentage/scale readout',
    'Zoom in/out controls',
    '"Fit to view" action',
  ],
  states: ['Default', 'At minimum zoom', 'At maximum zoom'],
  behaviour: [
    'At minimum/maximum zoom, the relevant in/out control is disabled with a reason rather than allowed to silently do nothing.',
    '"Fit to view" always frames the real current model extent, recalculated live, never a cached extent from an earlier state.',
  ],
  sizing: ['Compact, typically docked in CMP-007 Status bar or as a floating canvas control.'],
  keyboard: [
    "+/- keys (or the documented shortcuts) zoom in/out; a documented shortcut triggers fit-to-view, matching CMP-049 Canvas's own keyboard contract.",
  ],
  acceptance: [
    'Limit controls disable with a stated reason at min/max zoom rather than silently no-op-ing.',
    'Fit-to-view always reflects the real current model extent.',
  ],
});

set('CMP-057', {
  anatomy: [
    'Current drawing scale readout',
    'Scale selector (delegates to CMP-014 Select for a fixed list of standard scales)',
  ],
  states: ['Default', 'Open (choosing a new scale)', 'Custom scale entered'],
  behaviour: [
    'Changing scale affects sheet/print output and scale-dependent annotation sizing, not the underlying model geometry itself - it is a presentation setting, not a geometry edit.',
    'A custom (non-standard) scale is validated to a sane, positive, non-degenerate ratio before being accepted.',
  ],
  sizing: ["Matches CMP-014 Select's sizing."],
  keyboard: [
    "Follows CMP-014's keyboard contract when acting as a picker; a typed custom value follows CMP-012 Numeric field's validation-on-commit rule.",
  ],
  acceptance: [
    'Never mutates underlying model geometry - verified to affect only presentation/output.',
    'Custom scale entry rejects a non-positive or degenerate ratio with a stated reason.',
  ],
});

set('CMP-058', {
  anatomy: [
    'Small proportional overview of the full plan',
    'Viewport rectangle showing the current visible region',
  ],
  states: ['Default', 'Dragging the viewport rectangle (panning the main view)'],
  behaviour: [
    'Explicitly deferred: this repo\'s own `docs/platform/*` plans mark large-plan navigation aids as "later," not yet implemented - this doc describes the intended contract for when it is built, not a claim that it exists today.',
    'When built, dragging the viewport rectangle pans the main canvas live, and the main canvas panning likewise updates the rectangle live (bidirectional, not one-way).',
  ],
  sizing: [
    'Small, fixed corner placement; never obscures a meaningful portion of the main canvas.',
  ],
  keyboard: [
    "When built, a documented shortcut toggles its visibility; the viewport rectangle itself is not required to be keyboard-draggable since CMP-049's own keyboard pan already covers that need.",
  ],
  acceptance: [
    'This component\'s absence from the shipped application is correctly reflected as "not yet built" rather than claimed complete.',
    'When built: viewport-rectangle drag and main-canvas pan stay bidirectionally synchronised.',
  ],
});

set('CMP-059', {
  anatomy: [
    'Underlay thumbnail/name',
    'Opacity slider (delegates to CMP-019)',
    'Lock toggle',
    'Calibration action',
  ],
  states: [
    'Default (unlocked)',
    'Locked (position/scale fixed)',
    'Calibrating (mid-calibration flow)',
  ],
  behaviour: [
    'Locking prevents the underlay from being accidentally moved/rescaled by a subsequent pointer drag meant for real model geometry.',
    "Calibration (setting the underlay's real-world scale from two reference points) is a distinct, explicit flow the user opts into - never inferred automatically.",
  ],
  sizing: [
    'Compact panel, typically hosted in CMP-006 Context bar when the underlay tool is active.',
  ],
  keyboard: [
    "Opacity slider follows CMP-019's keyboard contract; lock toggle follows CMP-018 Switch's.",
  ],
  acceptance: [
    'Locked underlays cannot be moved/rescaled by an ordinary drag meant for model geometry.',
    'Calibration never runs automatically without explicit user initiation.',
  ],
});

// ---------- Import/export ----------
set('CMP-060', {
  anatomy: [
    'Drop target region',
    'Instructional text listing supported formats',
    'Fallback "browse" action for non-drag input',
  ],
  states: [
    'Idle',
    'Drag-over (valid file type)',
    'Drag-over (invalid file type)',
    'Uploading/processing',
  ],
  behaviour: [
    'Validates file type/extension on drag-over, giving feedback before drop, not only after a failed drop.',
    'Always offers a non-drag "browse" fallback - never drag-and-drop-only, since drag-and-drop is not available on every input method.',
    'Delegates real acquisition/detection to `packages/file-ingress` - this component is the UI surface, not where detection logic lives.',
  ],
  sizing: [
    'Large enough drop target to be a comfortable, discoverable pointer/touch target, not a thin strip.',
  ],
  keyboard: [
    'The "browse" fallback action opens a native file picker and is a normal focusable button, fully keyboard-operable.',
  ],
  acceptance: [
    'A working keyboard-only path (via the browse fallback) exists independent of drag-and-drop.',
    'Invalid file type is communicated before or immediately at drop, using the real detection result, not a guess.',
  ],
});

set('CMP-061', {
  anatomy: [
    'Per-format fidelity summary (native/exact/structured/approximated/underlay/attached/rejected)',
    'List of preserved vs unsupported content',
    'Link to detailed issues (delegates to CMP-032)',
  ],
  states: [
    'Success (fully preserved)',
    'Partial (some content approximated/attached/ignored)',
    'Failed',
  ],
  behaviour: [
    'Never claims an import was "exact" when it was actually approximated or merely attached - fidelity is reported honestly using the real fidelity levels the ingress pipeline actually produces (`packages/file-ingress`), never rounded up.',
    'Every unsupported/approximated item is individually listed, not summarised away into a single vague count.',
  ],
  sizing: [
    'Scrolls internally for imports with many individual issues rather than truncating the list.',
  ],
  keyboard: [
    "Each listed issue, where actionable, is a real link/button reachable by Tab, following CMP-032's pattern.",
  ],
  acceptance: [
    'Fidelity reported always matches the real adapter/report fidelity level, never inflated.',
    'Every unsupported/approximated item is individually visible, not hidden behind a count alone.',
  ],
});

set('CMP-062', {
  anatomy: [
    'Format selector',
    'Scope selector (whole project / current view / selection)',
    'Validation summary before export (delegates to CMP-032)',
    'Confirm action',
  ],
  states: ['Default', 'Validating', 'Blocked (validation problems exist)', 'Ready to export'],
  behaviour: [
    'Export is blocked while real blocking validation problems exist, shown via the same CMP-032 pattern used elsewhere, never allowed to proceed to a broken output silently.',
    'Scope selection genuinely constrains what gets exported - a "current view" export never silently includes the whole project.',
  ],
  sizing: ["Typically hosted in CMP-026 Dialog; sized to that dialog's content rules."],
  keyboard: [
    "Follows CMP-026 Dialog's and CMP-014 Select's keyboard contracts for its respective parts.",
  ],
  acceptance: [
    'Export is genuinely blocked (not just visually discouraged) while blocking validation problems exist.',
    'Selected scope accurately constrains the real exported content.',
  ],
});

set('CMP-063', {
  anatomy: [
    'Success/failure summary',
    'List of warnings (e.g. content that could not be represented in the target format)',
    'Output file/location reference',
  ],
  states: ['Success (no warnings)', 'Success with warnings', 'Failed'],
  behaviour: [
    'Reports every real warning the export pipeline actually produced - never suppresses a warning to present a cleaner-looking summary.',
    'Distinguishes "succeeded with caveats" from "succeeded cleanly" as genuinely different states, not the same green checkmark for both.',
  ],
  sizing: ['Scrolls internally for exports with many warnings rather than truncating the list.'],
  keyboard: [
    "Each listed warning, where it links to a source object, is reachable by Tab, following CMP-032's pattern.",
  ],
  acceptance: [
    'Every real warning from the export pipeline is shown, none suppressed for presentation.',
    '"Succeeded with warnings" is visually and programmatically distinct from a fully clean success.',
  ],
});

// ---------- Collaboration/history ----------
set('CMP-064', {
  anatomy: [
    'Pin marker anchored to a model/sheet coordinate',
    'Author avatar (delegates to CMP-044)',
    'Resolved/unresolved indicator',
  ],
  states: ['Unresolved', 'Resolved', 'Hover (preview)', 'Selected (opens CMP-065 Comment thread)'],
  behaviour: [
    'Stays anchored to its real model/sheet coordinate through pan/zoom, and through any geometry edit that moves the annotated object, rather than drifting to a stale screen position.',
    'Resolved pins remain visible (dimmed/distinct) rather than disappearing, so resolved discussion history stays discoverable.',
  ],
  sizing: ['Hit target at least 44x44pt on iPad even though the visual pin marker is smaller.'],
  keyboard: [
    "Reachable via CMP-008 Model tree's comment listing (not pointer-only), opening the same CMP-065 thread that clicking the pin would.",
  ],
  acceptance: [
    'Pin position never drifts from its real anchored coordinate through pan/zoom/geometry edits.',
    'Resolved pins remain visible and reachable, not deleted from view.',
  ],
});

set('CMP-065', {
  anatomy: [
    'Ordered list of comments',
    'Author + timestamp per comment',
    'Reply input',
    'Resolve/reopen action',
  ],
  states: ['Open (unresolved)', 'Resolved', 'Composing a reply'],
  behaviour: [
    'Resolving is a real, auditable state change (visible in CMP-067 History timeline), not merely hiding the thread from view.',
    'A reopened thread keeps its full prior comment history intact, never truncated by the resolve/reopen cycle.',
  ],
  sizing: [
    'Scrolls internally for long threads; reply input stays pinned and visible at the bottom.',
  ],
  keyboard: [
    "Reply input follows CMP-011 Text field's contract; Resolve/reopen is a normal focusable button.",
  ],
  acceptance: [
    'Resolve/reopen is a real, auditable state change, not a visual-only hide.',
    'Full comment history survives a resolve/reopen cycle intact.',
  ],
});

set('CMP-066', {
  anatomy: [
    'Title',
    'Status (open/in-progress/resolved)',
    'Assignee (delegates to CMP-044)',
    'Priority indicator',
    'Link to the affected model/sheet location',
  ],
  states: ['Open', 'In progress', 'Resolved', 'Overdue (if a due date exists and has passed)'],
  behaviour: [
    "Status changes are real, auditable state (matching CMP-065's resolve/reopen auditability rule), never a purely local UI toggle.",
    'Overdue is computed live against a real due date and the current time, never a stale precomputed flag.',
  ],
  sizing: ['Fits comfortably as a row in CMP-037 List or CMP-036 Data table depending on context.'],
  keyboard: [
    'Whole card/row is a single Tab stop opening its detail; status/assignee/priority controls within an expanded detail view are separate subsequent stops.',
  ],
  acceptance: [
    'Status changes are real auditable state, not a local-only visual toggle.',
    'Overdue is computed live against the real current time and due date.',
  ],
});

set('CMP-067', {
  anatomy: [
    'Chronological list of revisions and their constituent operations',
    'Author + timestamp per entry',
    'Optional diff/compare entry point (delegates to CMP-069)',
  ],
  states: [
    'Default',
    'Entry expanded (showing constituent operations)',
    'Loading more (older history, paginated)',
  ],
  behaviour: [
    "Reflects the real, immutable operation log - it never allows silently editing or deleting a past entry, only appending new ones (matches this repo's own operations/collaboration package design).",
    'Loads incrementally (paginated) for a long project history rather than requiring the whole history to load before showing anything.',
  ],
  sizing: [
    'Scrolls internally; loads more entries as the user scrolls near the end rather than all at once.',
  ],
  keyboard: [
    "Arrow Up/Down moves a roving entry focus; Enter expands/collapses an entry's constituent operations.",
  ],
  acceptance: [
    'Never allows editing or deleting a real past history entry - append-only, verified against the underlying operation log.',
    'Incremental loading never drops or duplicates an entry at the pagination boundary.',
  ],
});

set('CMP-068', {
  anatomy: ['Compact label indicating draft/review/issued state'],
  states: ['Draft', 'In review', 'Issued'],
  behaviour: [
    'Reflects the real current revision state from the model, never a locally-cached or optimistic guess that could disagree with the source of truth.',
    "Never relies on colour alone - each state has distinct text, matching this component's whole reason for existing.",
  ],
  sizing: ['Compact, fixed height matching other inline badges (CMP-079).'],
  keyboard: [
    'Not independently focusable; purely a status label rendered inline wherever a sheet/revision is shown.',
  ],
  acceptance: [
    'Always reflects the real current state, never a stale cached guess.',
    'Distinct text per state, not colour-only.',
  ],
});

set('CMP-069', {
  anatomy: ['Colour/pattern key mapping to added/modified/deleted', 'Optional counts per category'],
  states: ['Visible alongside an active compare view'],
  behaviour: [
    'Only appears alongside a real active compare operation - never shown standalone with nothing to explain.',
    'Never relies on colour alone to distinguish added/modified/deleted - each category also has a distinct pattern/glyph, since this is exactly the kind of comparison a colourblind user must be able to read correctly.',
  ],
  sizing: ['Compact, fixed position near the compare view it explains.'],
  keyboard: [
    "Not independently focusable; purely explanatory, read by screen readers as ordinary text alongside the compare view's own live region.",
  ],
  acceptance: [
    'Never appears without an active compare view to explain.',
    'Categories are distinguishable without relying on colour alone.',
  ],
});

set('CMP-070', {
  anatomy: [
    'Compact summary (counts of warnings/errors)',
    'Entry point into CMP-071 Recovery panel or a detailed issue list',
  ],
  states: ['Healthy (no issues)', 'Warnings present', 'Errors present'],
  behaviour: [
    "Counts always reflect the real, live current model state - never a stale count from before the user's last edit.",
    'Errors and warnings are visually and programmatically distinct severities, not merged into one generic "issues" count.',
  ],
  sizing: ['Compact, typically hosted in CMP-007 Status bar.'],
  keyboard: ['A single Tab stop that opens the detailed issue list/panel on activation.'],
  acceptance: [
    'Counts are always live-accurate, never stale after an edit.',
    'Errors and warnings are distinguishable, not merged into one count.',
  ],
});

set('CMP-071', {
  anatomy: [
    'List of recovered content',
    'List of content that could not be recovered, with reason',
    'Acknowledge/continue action',
  ],
  states: ['Visible after a recovery event', 'Acknowledged/dismissed'],
  behaviour: [
    'States plainly and specifically what was recovered and what was not, with a real reason for the latter - never a vague "some content may be missing."',
    "Delegates to the real recovery-report data (matches `packages/arqfs`'s `arqfs-recovery-report.ts`/`arqfs-safe-mode.ts` structured plan, not a UI-invented summary).",
  ],
  sizing: [
    'Typically hosted in CMP-026 Dialog on first open after a recovery event; scrolls internally for a long list of affected content.',
  ],
  keyboard: [
    "Follows CMP-026 Dialog's keyboard contract; the acknowledge action is its primary/default focused action on open.",
  ],
  acceptance: [
    'Every listed unrecovered item states a real, specific reason, never a generic disclaimer.',
    'Content shown is sourced from the real recovery report structure, not invented in the UI layer.',
  ],
});

set('CMP-072', {
  anatomy: ['Compact status text/icon distinguishing local-save from cloud-sync'],
  states: ['Saved locally, not yet synced', 'Syncing', 'Synced', 'Sync error'],
  behaviour: [
    'Explicitly distinguishes "safe on this device" from "safe in the cloud" - these are never merged into one ambiguous "saved" state, since the difference is materially important if the device is lost.',
    'Sync error state names the real problem where known (e.g. offline vs a real conflict) rather than one generic failure icon.',
  ],
  sizing: ['Compact, typically hosted in CMP-004 Top application bar and/or CMP-007 Status bar.'],
  keyboard: [
    'Announced via `aria-live="polite"` on state change; not independently focusable unless clicking it opens more detail, in which case it is a normal Tab stop.',
  ],
  acceptance: [
    'Local-save and cloud-sync are always distinguishable, never merged.',
    'Sync error names the real specific problem where the underlying system knows it.',
  ],
});

set('CMP-073', {
  anatomy: ['Compact icon/text indicating the app is currently offline'],
  states: ['Online (hidden or neutral)', 'Offline'],
  behaviour: [
    "Reflects real, live network-independent operation status (matches this repo's local-first design) - the application keeps working offline, and this indicator says so honestly rather than implying broken state.",
  ],
  sizing: ['Compact, typically hosted in CMP-007 Status bar alongside CMP-072.'],
  keyboard: ['Announced via `aria-live="polite"` on state change; not independently focusable.'],
  acceptance: [
    'Never implies the application is broken while offline - states the real, still-functional offline status.',
    'Updates immediately on a real connectivity change, not on a delayed poll.',
  ],
});

set('CMP-074', {
  anatomy: [
    'Description of the conflicting operations',
    'Options for resolution (e.g. keep mine / keep theirs / merge where possible)',
    'Preview of the outcome before committing',
  ],
  states: ['Unresolved conflict presented', 'Previewing a chosen resolution', 'Resolved'],
  behaviour: [
    "Never silently auto-resolves a genuine conflict in a way that could discard someone's real work without their explicit choice.",
    'Shows a real preview of the outcome before the user commits to a resolution, not just an abstract description of the options.',
  ],
  sizing: [
    "Typically hosted in CMP-026 Dialog given the significance of the decision; sized to that dialog's content rules.",
  ],
  keyboard: [
    "Follows CMP-026 Dialog's keyboard contract; each resolution option is an independent, labelled Tab stop.",
  ],
  acceptance: [
    'Never auto-resolves a genuine conflict without explicit user choice.',
    'A real preview of the outcome is shown before commit, not just an abstract description.',
  ],
});

// ---------- AI ----------
set('CMP-075', {
  anatomy: [
    'Bounded text input',
    'Character/length indicator',
    'Submit action',
    'Optional context chip showing what the request will apply to (e.g. current selection)',
  ],
  states: ['Empty', 'Typing', 'Submitted (processing)', 'Disabled with reason'],
  behaviour: [
    'Bounded by a real, stated length limit rather than silently truncating at submission.',
    'Shows what context (selection/scope) the request applies to before submission, so the user is never surprised by what the AI acted on.',
  ],
  sizing: [
    "Multi-line, growing up to a maximum height with internal scrolling beyond that, matching CMP-011's general text-input conventions.",
  ],
  keyboard: ['Enter submits (Shift+Enter inserts a newline); Escape clears an unsubmitted draft.'],
  acceptance: [
    'Length limit is stated and enforced before submission, not a silent truncation.',
    'Applied context/scope is always shown before the request is sent.',
  ],
});

set('CMP-076', {
  anatomy: [
    'Stated intent summary',
    'List of assumptions the proposal made',
    'List of proposed operations (rows are CMP-077)',
    'Accept/reject/edit actions',
  ],
  states: [
    'Proposing (loading)',
    'Ready for review',
    'Partially accepted (some operations accepted, others rejected)',
    'Fully accepted',
    'Fully rejected',
  ],
  behaviour: [
    "Never applies a single proposed operation to the real model until the user explicitly accepts it (or that specific operation) - matches this repo's own AI-guardrails discipline that architects remain responsible and proposals may be wrong.",
    'Every assumption the AI made is stated explicitly, never silently baked into the proposal with no visibility.',
    'Supports accepting individual operations rather than only all-or-nothing, since a mostly-good proposal with one wrong operation should not have to be entirely discarded.',
  ],
  sizing: [
    'Typically a CMP-027 Drawer or full panel given the amount of content (intent, assumptions, potentially many operations); scrolls internally.',
  ],
  keyboard: [
    'Arrow Up/Down moves focus between listed operations; each has its own accept/reject Tab stops (delegates to CMP-077).',
  ],
  acceptance: [
    'No proposed operation is ever applied to the real model without explicit per-operation or whole-proposal acceptance.',
    'Every assumption is visibly stated, not silently embedded.',
    'Partial (per-operation) acceptance is genuinely supported, not just all-or-nothing.',
  ],
});

set('CMP-077', {
  anatomy: [
    'Operation type/description',
    'Affected object reference',
    'Accept/reject controls',
    'Optional confidence/fidelity indicator',
  ],
  states: ['Pending review', 'Accepted', 'Rejected'],
  behaviour: [
    'States plainly what will change and to which real object - never a vague description that could apply to multiple different real edits.',
    'Rejecting one operation never affects the accept/reject state of any other operation in the same proposal (CMP-076).',
  ],
  sizing: [
    "Fits as a row within CMP-076's list; wraps rather than truncating the operation description.",
  ],
  keyboard: [
    'Accept/reject are independent, labelled Tab stops within the row, each activatable by Enter/Space.',
  ],
  acceptance: [
    'Operation description is specific enough to identify the exact real change and object.',
    "Accept/reject of one operation never affects any sibling operation's state.",
  ],
});

// ---------- Misc utility ----------
set('CMP-078', {
  anatomy: [
    'One or more filter controls (delegates to CMP-014/016/017 depending on filter type)',
    'Active-filter summary/chips',
    '"Clear all" action',
  ],
  states: [
    'No filters active',
    'One or more filters active',
    'Filter combination yields zero results (delegates to CMP-035)',
  ],
  behaviour: [
    'Active filters are always visible as a summary/chips, never hidden state the user has to remember or re-open a panel to check.',
    '"Clear all" restores exactly the unfiltered state, never a partial or stale reset.',
  ],
  sizing: ['Wraps to multiple rows on narrow widths rather than clipping active-filter chips.'],
  keyboard: [
    'Each filter control and each removable chip is an independent Tab stop; "Clear all" is a normal focusable button.',
  ],
  acceptance: [
    'Active filters are always visibly summarised, never hidden state.',
    '"Clear all" always restores the exact true unfiltered state.',
  ],
});

set('CMP-079', {
  anatomy: ['Compact label with optional leading icon, indicating a status or tag'],
  states: ['Default (per status/tag value)'],
  behaviour: [
    "Never relies on colour alone to distinguish different statuses - text (and icon, where used) always differs too, matching CMP-068's same rule for the specific revision-badge case.",
  ],
  sizing: [
    'Compact, fixed height; text truncates only if genuinely necessary, with the full value available via tooltip.',
  ],
  keyboard: ['Not independently focusable; purely a status label rendered inline.'],
  acceptance: [
    'Distinguishable without relying on colour alone.',
    'Full value remains available (via tooltip) if truncated.',
  ],
});

set('CMP-080', {
  anatomy: ['Small preview swatch of a monochrome hatch/fill pattern', 'Selection indicator'],
  states: ['Default', 'Hover', 'Focus visible', 'Selected'],
  behaviour: [
    'Distinguishes patterns by their actual visual density/texture, not colour, since these are explicitly monochrome patterns meant to remain legible on any material colour underneath.',
  ],
  sizing: [
    'Fixed small square/rect per swatch in a grid; hit target still meets 44pt on iPad even though the visual swatch is smaller.',
  ],
  keyboard: [
    "Arranged as a roving-tabindex grid (arrow keys move selection, matching CMP-020's single-Tab-stop pattern); Enter/Space selects the focused swatch.",
  ],
  acceptance: [
    'Every pattern remains distinguishable purely by its texture, independent of colour.',
    'Full keyboard grid navigation works without a pointer.',
  ],
});

set('CMP-081', {
  anatomy: [
    'File name',
    'Status (delegates to CMP-072/CMP-070 style indicators as applicable)',
    'Size',
    'Row actions (delegates to CMP-022 Menu)',
  ],
  states: [
    'Default',
    'Hover',
    'Processing (import/export in progress, delegates to CMP-082)',
    'Error',
  ],
  behaviour: [
    'Shows real current file size and status, never a stale value from when the row was first rendered.',
    'Row actions available always reflect what is genuinely possible for that file\'s current status (e.g. no "open" action for a file still processing).',
  ],
  sizing: ['Fits as a row within CMP-036 Data table or CMP-037 List depending on context.'],
  keyboard: [
    'Row is a Tab stop for its primary action; the row actions menu is a separate, subsequent Tab stop.',
  ],
  acceptance: [
    'Size/status shown is always live-accurate, not stale.',
    "Available row actions always match what is genuinely valid for the file's current real status.",
  ],
});

set('CMP-082', {
  anatomy: [
    'Stage label (e.g. detecting/converting/validating/staging)',
    'Progress indicator (delegates to CMP-033)',
    'Cancel action',
  ],
  states: [
    'Queued',
    'In progress (per real pipeline stage)',
    'Cancelling',
    'Cancelled',
    'Complete',
    'Failed',
  ],
  behaviour: [
    'Stage label always reflects the real current stage of the actual import/export pipeline (matches this repo\'s real `ImportWorkerRequest`/`ImportWorkerResponse` stages), never a generic "Working..." with no real detail.',
    'Cancellation is honoured promptly and never results in a stale "converted"/"failed" result appearing after the user was already told it was cancelled - this exact race (FP-019) was found and fixed in the real worker handler this component reflects.',
  ],
  sizing: [
    'Compact row form for a file list context; a larger standalone form for a single big operation.',
  ],
  keyboard: [
    'Cancel is a normal, always-reachable focusable button while an operation is in progress.',
  ],
  acceptance: [
    'Stage label always matches the real current pipeline stage, not a generic placeholder.',
    'Never shows a converted/failed result for an operation the user was already told was cancelled.',
  ],
});

set('CMP-083', {
  anatomy: [
    'Explanation of exactly what diagnostic data will be included',
    'Explicit consent checkbox/action',
    'Create action',
  ],
  states: ['Awaiting consent', 'Creating', 'Ready to share/download'],
  behaviour: [
    "Never creates or transmits a diagnostics bundle without an explicit, informed consent action - never automatic, matching this repo's privacy-conscious design intent.",
    'States exactly what categories of data are included (e.g. logs, model metadata) and, just as importantly, what is explicitly excluded (e.g. real project content/analytics), so consent is genuinely informed.',
  ],
  sizing: ['Typically hosted in CMP-026 Dialog given the significance of the consent decision.'],
  keyboard: [
    "Follows CMP-026 Dialog's keyboard contract; the consent checkbox and create action are independent Tab stops, with create disabled until consent is given.",
  ],
  acceptance: [
    'Bundle creation is impossible without the explicit consent step having occurred first.',
    'Included and excluded data categories are both stated plainly, not just included categories.',
  ],
});

set('CMP-084', {
  anatomy: [
    'Pointer/highlight toward a specific UI element',
    'Short explanatory text',
    'Dismiss/next action',
    'Optional step counter (e.g. "2 of 4")',
  ],
  states: ['Visible (current step)', 'Dismissed'],
  behaviour: [
    'Never blocks the underlying UI from being used while visible - a coachmark explains, it does not gate.',
    'Dismissing it (at any step) permanently dismisses the whole sequence rather than restarting it unexpectedly on next launch, unless the user explicitly reopens onboarding.',
  ],
  sizing: [
    'Positioned relative to the element it explains, repositioning/flipping to stay fully within the viewport, following the same rule as CMP-024 Popover.',
  ],
  keyboard: [
    'Escape dismisses the whole sequence; a documented key (e.g. Enter or a "Next" button) advances to the next step; the underlying UI beneath it remains fully keyboard-operable throughout.',
  ],
  acceptance: [
    'Never blocks interaction with the real UI element it is pointing at.',
    'Dismissal is permanent for the session rather than silently reappearing.',
  ],
});

// ---- sanity check: every row has content ----
const missing = rows.map((r) => r.id).filter((id) => !CONTENT[id]);
if (missing.length > 0) {
  throw new Error(`Missing content for: ${missing.join(', ')}`);
}

function renderMarkdown(row, content) {
  const section = (title, items) => `## ${title}\n\n${items.map((i) => `- ${i}`).join('\n')}\n`;
  const acceptance = content.acceptance.map((i) => `- [ ] ${i}`).join('\n');
  return `# ${row.id}: ${row.name}

## Purpose

${row.purpose}.

${section('Anatomy', content.anatomy)}
${section('Required states', content.states)}
${section('Behaviour', content.behaviour)}
${section('Sizing', content.sizing)}
${section('Keyboard and accessibility', content.keyboard)}
## Acceptance criteria

${acceptance}
`;
}

for (const row of rows) {
  const md = renderMarkdown(row, CONTENT[row.id]);
  writeFileSync(path.join(REPO, row.file), md, 'utf-8');
}

// Regenerate components.js: preserve id/name/purpose/renderer from the CSV +
// existing renderer map, replace states with the corrected doc's own list.
function jsStringArray(arr) {
  return `[\n${arr.map((s) => `      ${JSON.stringify(s)},`).join('\n')}\n    ]`;
}

const entries = rows.map((row) => {
  const renderer = rendererById.get(row.id);
  const states = CONTENT[row.id].states;
  return `  {
    id: '${row.id}',
    name: ${JSON.stringify(row.name)},
    purpose: ${JSON.stringify(row.purpose)},
    renderer: '${renderer}',
    states: ${jsStringArray(states)},
  }`;
});

const header = `// Data for the component test harness (component-harness/index.html + harness.js).
// Regenerated from docs/components/COMPONENT-MAP.csv and each component's own
// CMP-XXX doc (ARQ-190) - states here must always match the doc's "Required
// states" section, not drift independently. See scripts/gen-component-docs.mjs
// (or its scratchpad equivalent) for the generator.
`;

const componentsJs = `${header}const ARQ_COMPONENTS = [\n${entries.join(',\n')},\n];\n`;
writeFileSync(path.join(REPO, 'component-harness/components.js'), componentsJs, 'utf-8');

console.log(`Wrote ${rows.length} docs and regenerated components.js`);
