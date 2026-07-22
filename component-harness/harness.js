// Framework-agnostic component test harness. Renders every component from
// docs/components/COMPONENT-MAP.csv in every state its own CMP-XXX.md doc
// requires, using the real design tokens. No frontend framework is chosen
// yet (open-source/TECHNOLOGY-MATRIX.csv still lists React Aria Components
// as "spike to adopt", not decided) - this harness intentionally does not
// presuppose one, so it stays useful regardless of what's picked later.

function simClassFor(state) {
  const s = state.toLowerCase();
  if (s.includes('disabled')) return 'sim-disabled';
  if (s.includes('active') || s.includes('pressed')) return 'sim-active';
  if (s.includes('selected')) return 'sim-selected';
  if (s.includes('invalid')) return 'sim-invalid';
  if (s.includes('focus')) return 'sim-focus';
  if (s.includes('hover')) return 'sim-hover';
  return '';
}

const renderers = {
  button: (cls) => `<button class="hs primary ${cls}">Button</button>`,
  'icon-button': (cls) => `<button class="hs-icon-btn ${cls}" aria-label="Action">&#9998;</button>`,
  'split-button': (cls) =>
    `<div style="display:flex"><button class="hs primary ${cls}" style="border-radius:6px 0 0 6px">Action</button><button class="hs primary ${cls}" style="border-radius:0 6px 6px 0;border-left:1px solid #0003">&#9662;</button></div>`,
  'property-row': (cls) =>
    `<div class="${cls}" style="display:flex;justify-content:space-between;width:100%;font-size:13px"><span>Thickness</span><span>150 mm</span></div>`,
  field: (cls) =>
    `<label style="font-size:12px">Label<input class="hs ${cls}" value="3500 mm"/></label>`,
  select: (cls) =>
    `<label style="font-size:12px">Label<select class="hs ${cls}"><option>Interior 150</option></select></label>`,
  checkbox: (cls) => `<label class="${cls}"><input type="checkbox" checked/> Option</label>`,
  radio: (cls) =>
    `<label class="${cls}"><input type="radio" name="hs-radio" checked/> Option</label>`,
  toggle: (cls) => `<label class="${cls}"><input type="checkbox" checked/> Enabled</label>`,
  slider: (cls) => `<input class="${cls}" type="range" value="60"/>`,
  segmented: (cls) =>
    `<div style="display:flex;border:1px solid var(--arq-color-line-default);border-radius:6px;overflow:hidden"><button class="hs ${cls}" style="border:0;border-radius:0">Plan</button><button class="hs primary" style="border:0;border-radius:0">3D</button></div>`,
  tabs: (cls) =>
    `<div style="display:flex;gap:16px;border-bottom:1px solid var(--arq-color-line-subtle)"><span class="${cls}" style="padding-bottom:6px;border-bottom:2px solid var(--arq-color-ink)">Design</span><span style="padding-bottom:6px;color:var(--arq-color-text-muted)">Document</span></div>`,
  tooltip: (cls) =>
    `<div style="position:relative;display:inline-block"><button class="hs">Hover me</button><div class="${cls}" style="position:absolute;top:-32px;left:0;background:var(--arq-color-ink);color:#fff;font-size:11px;padding:4px 8px;border-radius:4px">Tooltip text</div></div>`,
  toast: (cls) => `<div class="hs-toast ${cls}">Project recovered</div>`,
  banner: (cls) => `<div class="hs-banner ${cls}">Changing thickness affects two room areas.</div>`,
  'inline-validation': (cls) =>
    `<div class="${cls}" style="font-size:12px;color:#b3261e">Value must be positive.</div>`,
  progress: (cls) => `<div class="hs-progress ${cls}"><span style="width:60%"></span></div>`,
  skeleton: (cls) => `<div class="hs-skeleton ${cls}"></div>`,
  'empty-state': (cls) =>
    `<div class="${cls}" style="text-align:center;font-size:12px;color:var(--arq-color-text-muted)">No projects yet<br/><button class="hs primary" style="margin-top:8px">New project</button></div>`,
  list: (cls) =>
    `<ul class="${cls}" style="margin:0;padding-left:16px;font-size:13px"><li>Ground Floor Plan</li><li>3D</li></ul>`,
  card: (cls) =>
    `<div class="hs-card ${cls}"><b>Courtyard House</b><p style="font-size:12px;margin:4px 0 0">Saved locally</p></div>`,
  breadcrumb: (cls) =>
    `<div class="${cls}" style="font-size:12px;color:var(--arq-color-text-muted)">Workspace &gt; Courtyard House &gt; Plan</div>`,
  avatar: (cls) => `<div class="hs-avatar ${cls}">JS</div>`,
  'shortcut-hint': (cls) => `<span class="${cls}"><kbd>Cmd</kbd> + <kbd>K</kbd></span>`,
  dropzone: (cls) => `<div class="hs-dropzone ${cls}">Drop a .arq, DXF, or IFC file</div>`,
  badge: (cls) => `<span class="hs-badge ${cls}">Synced</span>`,
};

function renderState(renderer, state) {
  const cls = simClassFor(state);
  const fn = renderers[renderer];
  const html = fn
    ? fn(cls)
    : `<span style="font-size:12px;color:var(--arq-color-text-muted)">no renderer</span>`;
  return `<div class="state-cell">${html}<span class="label">${state}</span></div>`;
}

function renderComponent(c) {
  const main = document.querySelector('main');
  if (c.renderer === 'placeholder') {
    main.innerHTML = `
      <h1>${c.name}</h1>
      <p class="purpose">${c.purpose}</p>
      <div class="placeholder-notice">
        <strong>Not implemented in this harness.</strong>
        This component is either layout chrome (tool rail, top bar, canvas overlays)
        or too specific to render meaningfully in flat HTML/CSS without a real
        rendering engine (canvas, view cube, minimap, model tree). Its required
        states are listed below so the spec stays visible even without a live render.
      </div>
      <ul class="spec-states">${c.states.map((s) => `<li>${s}</li>`).join('')}</ul>
    `;
    return;
  }
  main.innerHTML = `
    <h1>${c.name}</h1>
    <p class="purpose">${c.purpose}</p>
    <div class="state-grid">${c.states.map((s) => renderState(c.renderer, s)).join('')}</div>
  `;
}

// Data comes from components.js as a plain global (not fetch('components.json'))
// because fetching a local file over file:// is blocked by CORS in Chromium -
// this harness needs to open directly by double-clicking index.html, the same
// way prototype/index.html does, not require a local server to be running.
(function () {
  const components = ARQ_COMPONENTS;
  const nav = document.querySelector('#nav-list');
  nav.innerHTML = components
    .map(
      (c, i) =>
        `<li><button data-i="${i}" class="${i === 0 ? 'current' : ''}">${c.name}<span class="badge">${c.renderer === 'placeholder' ? 'spec only' : 'live'}</span></button></li>`,
    )
    .join('');
  nav.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      nav.querySelectorAll('button').forEach((x) => x.classList.remove('current'));
      b.classList.add('current');
      renderComponent(components[Number(b.dataset.i)]);
    }),
  );
  renderComponent(components[0]);
})();
