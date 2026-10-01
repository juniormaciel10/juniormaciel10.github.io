(() => {
  'use strict';
  const figure = document.querySelector('[data-lp-animation]');
  const video = figure?.querySelector('video');
  const toggle = figure?.querySelector('[data-lp-toggle]');
  if (!video || !toggle) return;
  // Com movimento reduzido, a página mostra só a imagem final da abertura.
  if (document.documentElement.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  toggle.hidden = false;
  const label = () => { toggle.textContent = video.ended ? 'Rever animação' : video.paused ? 'Reproduzir animação' : 'Pausar animação'; };
  ['play', 'pause', 'ended'].forEach(type => video.addEventListener(type, label));
  toggle.addEventListener('click', () => {
    if (video.ended) video.currentTime = 0;
    if (video.paused) video.play().catch(() => {}); else video.pause();
  });
  let played = false;
  new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting && !played) { played = true; video.play().catch(label); }
      else if (!entry.isIntersecting && !video.paused) video.pause();
    }
  }, { threshold: 0.45 }).observe(video);
  label();
})();
