import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT_SOURCE = readFileSync(new URL('./workspace-root.tsx', import.meta.url), 'utf8');
const CONTROL_SOURCE = readFileSync(new URL('./panel-collapse-control.tsx', import.meta.url), 'utf8');

describe('workspace panel collapse rendering contract', () => {
  it('floats only explicit overlay presentation, never a collapsed panel', () => {
    expect(ROOT_SOURCE).toContain(
      "const browserFloating = !canvasFirst && browserState.open && browserState.mode === 'overlay';",
    );
    expect(ROOT_SOURCE).toContain(
      "const inspectorFloating = !canvasFirst && inspectorState.open && inspectorState.mode === 'overlay';",
    );
    expect(ROOT_SOURCE).not.toContain('panels[\'project-browser\'].open && !browserDocked');
    expect(ROOT_SOURCE).not.toContain('panels.inspector.open && !inspectorDocked');
  });

  it('keeps collapsed panel bodies mounted but removes layout and interaction', () => {
    expect(ROOT_SOURCE).toContain('const browserDockHost = browserDocked || browserCollapsed;');
    expect(ROOT_SOURCE).toContain('const inspectorDockHost = inspectorDocked || inspectorCollapsed;');
    expect(ROOT_SOURCE).toContain("aria-hidden={browserCollapsed ? true : undefined}");
    expect(ROOT_SOURCE).toContain("aria-hidden={inspectorCollapsed ? true : undefined}");
    expect(ROOT_SOURCE).toContain("{...(browserCollapsed ? { inert: '' } : {})}");
    expect(ROOT_SOURCE).toContain("{...(inspectorCollapsed ? { inert: '' } : {})}");
    expect(ROOT_SOURCE).toContain('width: browserCollapsed ? 0 : browserState.widthPx');
    expect(ROOT_SOURCE).toContain('width: inspectorCollapsed ? 0 : inspectorState.widthPx');
  });

  it('keeps one accessible focusable edge control through collapse and reopen', () => {
    expect(CONTROL_SOURCE).toContain('aria-expanded={!collapsed}');
    expect(CONTROL_SOURCE).toContain('aria-controls={`arq-workspace-panel-${panel}`}');
    expect(CONTROL_SOURCE).toContain('onClick={() => onCollapsedChange(!collapsed)}');
    expect(ROOT_SOURCE).toContain('id="arq-workspace-panel-project-browser"');
    expect(ROOT_SOURCE).toContain('id="arq-workspace-panel-inspector"');
  });

  it('does not invent a second local panel-state authority', () => {
    expect(ROOT_SOURCE).toContain('readonly panels: PanelLayoutState;');
    expect(ROOT_SOURCE).toContain(
      'readonly onSetPanelCollapsed?: (panel: CollapsiblePanelId, collapsed: boolean) => void;',
    );
    expect(ROOT_SOURCE).not.toMatch(/useState\s*\(/);
  });
});
