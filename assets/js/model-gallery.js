(() => {
  'use strict';
  const gallery = document.getElementById('roblox-gallery');
  if (!gallery?.classList.contains('is-enhanced')) return;
  const panels = [...gallery.querySelectorAll('[data-model-panel]')];
  const position = gallery.querySelector('[data-model-position]');
  if (!panels.length || !position) return;
  function update() {
    const index = Number(gallery.dataset.current) || 0;
    panels.forEach((panel, order) => { panel.hidden = order !== index; });
    position.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(panels.length).padStart(2, '0');
  }
  update();
  new MutationObserver(update).observe(gallery, { attributes: true, attributeFilter: ['data-current'] });
  gallery.classList.add('is-inspected');
})();
