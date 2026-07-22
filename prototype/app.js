const pages = [...document.querySelectorAll('.page')];
function show(id) {
  pages.forEach((p) => p.classList.toggle('active', p.id === id));
  location.hash = id;
}
document.querySelectorAll('[data-page]').forEach((b) => (b.onclick = () => show(b.dataset.page)));
document.querySelectorAll('.tools button').forEach(
  (b) =>
    (b.onclick = () => {
      document.querySelectorAll('.tools button').forEach((x) => {
        x.classList.remove('active');
        x.setAttribute('aria-pressed', 'false');
      });
      b.classList.add('active');
      b.setAttribute('aria-pressed', 'true');
    }),
);

// BUG-RISK-140 (critical): a dialog must return focus to whatever opened it
// - not just to whatever the browser happens to focus on close - whether it
// closes via the Close button, Escape, or any other path. Listening on the
// dialog's own 'close' event (fires for every close path) is the single
// source of truth, rather than restoring focus from each button handler.
const d = document.querySelector('#dialog');
const cmdButton = document.querySelector('#cmd');
let lastFocusedBeforeDialog = null;
cmdButton?.addEventListener('click', () => {
  lastFocusedBeforeDialog = document.activeElement;
  d.showModal();
});
document.querySelector('#close')?.addEventListener('click', () => d.close());
d?.addEventListener('close', () => {
  (lastFocusedBeforeDialog ?? cmdButton)?.focus();
  lastFocusedBeforeDialog = null;
});
show(location.hash.slice(1) || 'dashboard');
