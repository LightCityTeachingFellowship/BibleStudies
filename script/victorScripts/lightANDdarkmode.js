(() => {
  const toggle = document.getElementById('theme-toggle');
  const sheet = document.getElementById('theme-stylesheet');
  if (!sheet) return;
  let saved;
  try { saved = localStorage.getItem('theme'); } catch {}
  const dark = saved === 'darkMODE' || (saved !== 'lightMODE' && matchMedia('(prefers-color-scheme: dark)').matches);
  function apply(useDark) {
    const name = useDark ? 'darkMODE' : 'lightMODE';
    const url = new URL(name + '.css', sheet.href).href;
    if (sheet.href !== url) sheet.href = url;
    document.documentElement.toggleAttribute('data-lc-initial-dark', useDark);
    document.body.classList.toggle('darkmode', useDark);
    if (toggle) toggle.checked = useDark;
    return name;
  }
  apply(dark);
  toggle?.addEventListener('click', () => {
    const name = apply(!document.body.classList.contains('darkmode'));
    try { localStorage.setItem('theme', name); } catch {}
  });
})();
