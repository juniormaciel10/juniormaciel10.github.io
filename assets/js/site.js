(() => {
  'use strict';
  const slides = [...document.querySelectorAll("[data-slide]")].map(link => ({ label: link.dataset.label, description: link.dataset.description, src: link.getAttribute("href"), original: link.getAttribute("href") }));
  const header = document.querySelector('.site-header');
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  function closeMenu(restoreFocus = false) {
    header.removeAttribute('data-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Abrir menu');
    if (restoreFocus) menuButton.focus({ preventScroll: true });
  }
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    header.toggleAttribute('data-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  });
  nav.addEventListener('click', e => {
    if (e.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && header.hasAttribute('data-open')) closeMenu(true);
  });
  document.addEventListener('pointerdown', e => {
    if (header.hasAttribute('data-open') && !header.contains(e.target)) closeMenu();
  });
  matchMedia('(min-width: 761px)').addEventListener('change', e => {
    if (e.matches) closeMenu();
  });
  document.documentElement.classList.add('js');
  document.body.classList.add('js');

  function revealTarget(hash, focus = false) {
    if (!hash) return;
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    for (let node = target; node; node = node.parentElement) {
      if (node instanceof HTMLDetailsElement) node.open = true;
    }
    if (focus) {
      if (!target.hasAttribute('tabindex') && !target.matches('a,button,input,summary,select,textarea')) target.tabIndex = -1;
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }
  }
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (link && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) revealTarget(link.hash, true);
  });
  window.addEventListener('hashchange', () => revealTarget(location.hash));
  revealTarget(location.hash);

  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  root.classList.add('has-motion');
  root.dataset.motion = motionPreference.matches ? 'reduced' : 'full';
  motionPreference.addEventListener('change', e => { root.dataset.motion = e.matches ? 'reduced' : 'full'; });
  const smallScreen = matchMedia('(max-width:760px)');
  function syncMenu() {
    const hidden = smallScreen.matches && !header.hasAttribute('data-open');
    nav.inert = hidden;
    if (hidden) nav.setAttribute('aria-hidden', 'true'); else nav.removeAttribute('aria-hidden');
  }
  new MutationObserver(syncMenu).observe(header, { attributes: true, attributeFilter: ['data-open'] });
  smallScreen.addEventListener('change', syncMenu);
  syncMenu();
  new ResizeObserver(() => root.style.setProperty('--site-header-height', header.getBoundingClientRect().height + 'px')).observe(header);

  const activeNav = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      for (const link of nav.querySelectorAll('a')) {
        if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }
  }, { rootMargin: '-15% 0px -65% 0px' });
  const sections = new Set(['inicio', ...[...nav.querySelectorAll('a[href^="#"]')].map(link => link.hash.slice(1))]);
  sections.forEach(id => { const section = document.getElementById(id); if (section) activeNav.observe(section); });

  document.querySelectorAll('video').forEach(video => {
    const disclosure = video.closest('details');
    disclosure?.addEventListener('toggle', () => { if (!disclosure.open) video.pause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
  });

  const gallery = document.getElementById('software-gallery');
  if (!gallery) return;
  const galleryImage = document.getElementById('gallery-image');
  const galleryButtons = [...document.querySelectorAll('[data-slide]')];
  const expand = document.getElementById('gallery-expand');
  const pause = document.getElementById('gallery-pause');
  const dialog = document.getElementById('gallery-dialog');
  const dialogImage = document.getElementById('dialog-image');
  const announcement = document.getElementById('gallery-announcement');
  const errorMessage = document.querySelector('.gallery-error');
  let current = 0, paused = false, visible = false, timer = 0, serial = 0;
  const decoded = new Map();
  function prepare(index) {
    if (!decoded.has(index)) {
      const image = new Image();
      image.src = slides[index].src;
      const ready = image.decode().then(() => image).catch(error => {
        decoded.delete(index);
        throw error;
      });
      decoded.set(index, ready);
    }
    return decoded.get(index);
  }
  function prepareNeighbor() {
    if (visible && !navigator.connection?.saveData) prepare((current + 1) % slides.length).catch(() => {});
  }
  function schedule() {
    clearTimeout(timer);
    if (paused || !visible || document.hidden || dialog.open) return;
    timer = setTimeout(() => showSlide((current + 1) % slides.length, false), 5800);
  }
  function updateDialog() {
    dialogImage.src = slides[current].src;
    dialogImage.alt = slides[current].description;
    document.getElementById('dialog-title').textContent = slides[current].label;
    document.getElementById('dialog-position').textContent = (current + 1) + ' / ' + slides.length;
    document.getElementById('dialog-original').href = slides[current].original;
  }
  async function showSlide(index, manual = true) {
    const request = ++serial;
    const next = (index + slides.length) % slides.length;
    clearTimeout(timer);
    gallery.setAttribute('aria-busy', 'true');
    try { await prepare(next); }
    catch {
      if (request !== serial) return;
      errorMessage.hidden = false;
      gallery.removeAttribute('aria-busy');
      document.getElementById('gallery-fallback').href = slides[next].original;
      announcement.textContent = 'Não foi possível carregar a tela. O arquivo original continua disponível.';
      return;
    }
    if (request !== serial) return;
    errorMessage.hidden = true;
    gallery.removeAttribute('aria-busy');
    current = next;
    galleryImage.src = slides[current].src;
    galleryImage.alt = slides[current].description;
    expand.setAttribute('aria-label', 'Ampliar a tela: ' + slides[current].label);
    expand.href = slides[current].original;
    gallery.dataset.current = String(current);
    for (const link of galleryButtons) {
      if (Number(link.dataset.slide) === current) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    if (!motionPreference.matches) galleryImage.animate([{ opacity: .55 }, { opacity: 1 }], { duration: 250, easing: 'ease-out' });
    if (manual) announcement.textContent = slides[current].label + ', tela ' + (current + 1) + ' de ' + slides.length + '.';
    if (dialog.open) updateDialog();
    prepareNeighbor();
    schedule();
  }
  gallery.dataset.current = '0';
  galleryButtons.forEach(link => link.addEventListener('click', e => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    showSlide(Number(link.dataset.slide));
  }));
  pause.addEventListener('click', () => {
    paused = !paused;
    pause.setAttribute('aria-pressed', String(paused));
    pause.setAttribute('aria-label', paused ? 'Retomar troca automática' : 'Pausar troca automática');
    pause.querySelector('[data-pause-text]').textContent = paused ? 'Retomar' : 'Pausar';
    pause.querySelector('[data-pause-icon]').hidden = paused;
    pause.querySelector('[data-play-icon]').hidden = !paused;
    schedule();
  });
  const galleryObserver = new IntersectionObserver(entries => {
    visible = entries[0].intersectionRatio >= .15;
    prepareNeighbor();
    schedule();
  }, { threshold: [0, .15] });
  galleryObserver.observe(gallery);
  document.addEventListener('visibilitychange', schedule);
  expand.setAttribute('aria-haspopup', 'dialog');
  expand.addEventListener('click', e => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    updateDialog();
    dialog.showModal();
    schedule();
  });
  dialog.addEventListener('close', () => {
    expand.focus({ preventScroll: true });
    schedule();
  });
  dialog.addEventListener('click', e => {
    if (e.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); showSlide(current - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); showSlide(current + 1); }
  });
  document.getElementById('dialog-prev').addEventListener('click', () => showSlide(current - 1));
  document.getElementById('dialog-next').addEventListener('click', () => showSlide(current + 1));
  let touch = null;
  const dialogViewport = document.querySelector('.dialog-image-wrap');
  dialogViewport.addEventListener('touchstart', e => {
    touch = e.touches.length === 1 && (!window.visualViewport || window.visualViewport.scale <= 1.05)
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }, { passive: true });
  dialogViewport.addEventListener('touchmove', e => {
    if (!touch || e.touches.length !== 1 || (window.visualViewport && visualViewport.scale > 1.05)) return;
    const dx = e.touches[0].clientX - touch.x, dy = e.touches[0].clientY - touch.y;
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5 && e.cancelable) e.preventDefault();
  }, { passive: false });
  dialogViewport.addEventListener('touchend', e => {
    if (!touch || !e.changedTouches[0]) return;
    const dx = e.changedTouches[0].clientX - touch.x;
    const dy = e.changedTouches[0].clientY - touch.y;
    touch = null;
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5) showSlide(current + (dx < 0 ? 1 : -1));
  }, { passive: true });
  dialogViewport.addEventListener('touchcancel', () => { touch = null; }, { passive: true });

  const copyButton = document.querySelector('.copy-email');
  let copyTimer = 0;
  copyButton?.addEventListener('click', async () => {
    clearTimeout(copyTimer);
    try {
      await navigator.clipboard.writeText('jrmaciell92@gmail.com');
      copyButton.querySelector('span').textContent = 'E-mail copiado';
      document.getElementById('copy-status').textContent = 'E-mail copiado para a área de transferência.';
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => { copyButton.querySelector('span').textContent = 'Copiar e-mail'; }, 3000);
    } catch {
      document.getElementById('copy-status').textContent = 'Não foi possível copiar automaticamente. O endereço está disponível no link acima.';
      copyButton.querySelector('span').textContent = 'Selecione o endereço';
    }
  });
  window.addEventListener('pagehide', () => {
    clearTimeout(timer);
    clearTimeout(copyTimer);
  });
  window.addEventListener('pageshow', schedule);
})();
