(() => {
  const panels = [...document.querySelectorAll('.site-footer .footer-disclosure')];
  if (!panels.length) return;
  const mobile = window.matchMedia('(max-width: 720px)');
  const layout = () => { for (const panel of panels) panel.open = !mobile.matches; };
  layout();
  if (mobile.addEventListener) mobile.addEventListener('change', layout);
  else mobile.addListener(layout);
})();
