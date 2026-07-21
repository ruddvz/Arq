const pages = [...document.querySelectorAll('.page')];
function show(id) {
  pages.forEach((p) => p.classList.toggle('active', p.id === id));
  location.hash = id;
}
document.querySelectorAll('[data-page]').forEach((b) => (b.onclick = () => show(b.dataset.page)));
document.querySelectorAll('.tools button').forEach(
  (b) =>
    (b.onclick = () => {
      document.querySelectorAll('.tools button').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    }),
);
const d = document.querySelector('#dialog');
document.querySelector('#cmd')?.addEventListener('click', () => d.showModal());
document.querySelector('#close')?.addEventListener('click', () => d.close());
show(location.hash.slice(1) || 'dashboard');
