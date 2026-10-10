(() => {
  'use strict';
  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const nav = document.getElementById('main-nav');
  const menu = document.querySelector('.menu-toggle');
  const compact = matchMedia('(max-width:760px)');
  if (!header || !nav || !menu) return;
  root.classList.add('js', 'ui-ready');
  root.dataset.motion = 'full';
  document.body.classList.add('js');

  const legacy = {
    'p-ciclo': 'estudos/#p-ciclo', 'p-resumos': 'estudos/#p-resumos',
    'p-transcricao': 'estudos/#p-resumos', 'ci-galeria': 'estudos/#ci-galeria',
    'software-gallery': 'estudos/#software-gallery', 'ciclo-detalhes': 'estudos/#ciclo-detalhes',
    'resumo-detalhes': 'estudos/#resumo-detalhes', 'resumo-download': 'estudos/#resumo-download',
    'experimentos': 'jogos/#p-gametwo', 'p-gametwo': 'jogos/#p-gametwo',
    'p-govoice': 'jogos/#p-govoice'
  };
  if (document.body.classList.contains('home-page')) {
    const destination = legacy[location.hash.slice(1)];
    if (destination) { location.replace(new URL(destination, location.href)); return; }
  }

  function menuState(open, restore = false) {
    header.toggleAttribute('data-open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    nav.inert = compact.matches && !open;
    if (nav.inert) nav.setAttribute('aria-hidden', 'true');
    else nav.removeAttribute('aria-hidden');
    if (restore) menu.focus({ preventScroll: true });
  }
  menu.addEventListener('click', () => menuState(!header.hasAttribute('data-open')));
  nav.addEventListener('click', event => { if (event.target.closest('a')) menuState(false); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && header.hasAttribute('data-open')) menuState(false, true);
  });
  document.addEventListener('pointerdown', event => {
    if (header.hasAttribute('data-open') && !header.contains(event.target)) menuState(false);
  });
  compact.addEventListener('change', () => menuState(false));
  menuState(false);
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => {
    root.style.setProperty('--header-height', header.getBoundingClientRect().height + 'px');
  }).observe(header);

  function revealHash(hash, focus = false) {
    if (!hash || hash === '#') return;
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    for (let node = target; node; node = node.parentElement) {
      if (node instanceof HTMLDetailsElement) node.open = true;
    }
    requestAnimationFrame(() => {
      if (focus) {
        if (!target.matches('a,button,input,summary,[tabindex]')) target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || !link.hash || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (link.origin === location.origin && link.pathname === location.pathname) revealHash(link.hash, true);
  });
  window.addEventListener('hashchange', () => revealHash(location.hash));
  revealHash(location.hash);

  document.querySelectorAll('[data-copy-email]').forEach(button => {
    let reset;
    button.addEventListener('click', async () => {
      const status = button.closest('.footer-contact').querySelector('[data-copy-status]');
      clearTimeout(reset);
      try {
        await navigator.clipboard.writeText(button.dataset.copyEmail);
        button.textContent = 'E-mail copiado';
        status.textContent = 'E-mail copiado para a área de transferência.';
        status.classList.add('sr-only');
      } catch {
        status.textContent = 'Não foi possível copiar. O endereço está disponível no link de e-mail acima.';
        status.classList.remove('sr-only');
      }
      reset = setTimeout(() => { button.textContent = 'Copiar e-mail'; }, 3500);
    });
  });

  const dialog = document.getElementById('media-dialog');
  const dialogImage = document.getElementById('media-dialog-image');
  const dialogError = document.getElementById('media-dialog-error');
  let activeGallery = null;
  let modalRequest = 0;
  let opener = null;
  const groups = [];
  const dialogEvent = () => {
    window.dispatchEvent(new Event('portfolio:dialog-change'));
    groups.forEach(group => group.schedule());
  };
  async function renderDialog() {
    if (!activeGallery) return;
    const item = activeGallery.items[activeGallery.current()];
    const serial = ++modalRequest;
    document.getElementById('media-dialog-title').textContent = item.title;
    document.getElementById('media-dialog-description').textContent = item.description;
    document.getElementById('media-dialog-original').href = item.full;
    dialog.setAttribute('aria-busy', 'true');
    dialogError.hidden = true;
    const image = new Image();
    image.src = item.full;
    try { await image.decode(); }
    catch {
      if (serial !== modalRequest) return;
      dialogImage.hidden = true;
      dialogError.hidden = false;
      dialog.removeAttribute('aria-busy');
      return;
    }
    if (serial !== modalRequest || !dialog.open) return;
    dialogImage.src = item.full;
    dialogImage.alt = item.description;
    dialogImage.width = image.naturalWidth;
    dialogImage.height = image.naturalHeight;
    dialogImage.hidden = false;
    dialog.removeAttribute('aria-busy');
  }
  function openDialog(group, trigger) {
    activeGallery = group;
    opener = trigger;
    dialog.classList.remove('is-zoomed');
    const zoom = document.getElementById('media-dialog-zoom');
    if (zoom) { zoom.setAttribute('aria-pressed', 'false'); zoom.textContent = 'Tamanho real'; }
    dialog.showModal();
    renderDialog();
    dialogEvent();
  }
  dialog?.addEventListener('close', () => {
    modalRequest++;
    const group = activeGallery;
    activeGallery = null;
    dialog.classList.remove('is-zoomed');
    dialog.removeAttribute('aria-busy');
    if (group) {
      const destination = opener?.getClientRects().length ? opener : group.items[group.current()].link;
      destination.focus({ preventScroll: true });
    }
    dialogEvent();
  });
  dialog?.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog?.addEventListener('keydown', event => {
    if (!activeGallery || dialog.classList.contains('is-zoomed')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      activeGallery.show(activeGallery.current() + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  document.getElementById('media-dialog-prev')?.addEventListener('click', () => activeGallery?.show(activeGallery.current() - 1));
  document.getElementById('media-dialog-next')?.addEventListener('click', () => activeGallery?.show(activeGallery.current() + 1));
  document.getElementById('media-dialog-zoom')?.addEventListener('click', event => {
    const zoomed = dialog.classList.toggle('is-zoomed');
    event.currentTarget.setAttribute('aria-pressed', String(zoomed));
    event.currentTarget.textContent = zoomed ? 'Ajustar à tela' : 'Tamanho real';
  });

  document.querySelectorAll('[data-gallery]').forEach(gallery => {
    const figures = [...gallery.querySelectorAll('[data-gallery-slide]')];
    const items = figures.map(figure => ({
      figure, image: figure.querySelector('img'), link: figure.querySelector('.gallery-open'),
      full: figure.querySelector('.gallery-open').href,
      title: figure.dataset.title, description: figure.dataset.description
    }));
    if (!items.length) return;
    const dots = [...gallery.querySelectorAll('[data-gallery-select]')];
    const pause = gallery.querySelector('[data-gallery-pause]');
    const status = gallery.querySelector('[data-gallery-status]');
    let index = 0, timer = 0, serial = 0, visible = false, paused = false, hovered = false, focused = false;
    let pointer = null, suppressClick = 0, entrance = null;
    function schedule() {
      clearTimeout(timer);
      if (items.length < 2 || !visible || paused || hovered || focused || document.hidden || dialog?.open || (root.dataset.homeOpening === 'true' && root.dataset.intro !== 'complete')) return;
      timer = setTimeout(() => show(index + 1, false), Number(gallery.dataset.interval) || 7800);
    }
    async function show(requested, manual = true) {
      clearTimeout(timer);
      const next = (requested + items.length) % items.length;
      const token = ++serial;
      gallery.setAttribute('aria-busy', 'true');
      items[next].image.loading = 'eager';
      try { await items[next].image.decode(); }
      catch {
        if (serial !== token) return;
        gallery.removeAttribute('aria-busy');
        status.classList.remove('sr-only');
        status.textContent = 'Não foi possível carregar esta imagem. Selecione outra captura ou tente novamente.';
        return;
      }
      if (serial !== token) return;
      const changed = next !== index;
      index = next;
      figures.forEach((figure, position) => { figure.hidden = position !== index; });
      dots.forEach((button, position) => {
        if (position === index) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      });
      gallery.dataset.current = String(index);
      gallery.removeAttribute('aria-busy');
      status.classList.add('sr-only');
      if (manual) status.textContent = items[index].title + '. Imagem ' + (index + 1) + ' de ' + items.length + '.';
      if (changed && typeof Element.prototype.animate === 'function') {
        entrance?.cancel();
        entrance = items[index].figure.animate([{ opacity: .55 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
      }
      if (dialog?.open && activeGallery === group) renderDialog();
      schedule();
    }
    function togglePause() {
      paused = !paused;
      gallery.dataset.paused = String(paused);
      pause.setAttribute('aria-pressed', String(paused));
      pause.textContent = paused ? 'Retomar' : 'Pausar';
      pause.setAttribute('aria-label', paused ? 'Retomar troca automática de imagens' : 'Pausar troca automática de imagens');
      schedule();
    }
    const group = { items, current: () => index, show, schedule };
    groups.push(group);
    figures.forEach((figure, position) => { figure.hidden = position !== 0; });
    items.forEach(item => {
      item.image.draggable = false;
      item.link.addEventListener('click', event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        if (performance.now() < suppressClick) { event.preventDefault(); return; }
        if (!dialog || typeof dialog.showModal !== 'function') return;
        event.preventDefault();
        openDialog(group, item.link);
      });
    });
    gallery.classList.add('is-enhanced');
    gallery.dataset.current = '0';
    gallery.dataset.paused = 'false';
    gallery.querySelector('[data-gallery-controls]').hidden = false;
    gallery.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight Home End Space');
    dots.forEach(button => button.addEventListener('click', () => show(Number(button.dataset.gallerySelect))));
    pause.addEventListener('click', togglePause);
    gallery.querySelector('[data-gallery-prev]').addEventListener('click', () => show(index - 1));
    gallery.querySelector('[data-gallery-next]').addEventListener('click', () => show(index + 1));
    gallery.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && matchMedia('(any-hover:hover)').matches) { hovered = true; schedule(); }
    });
    gallery.addEventListener('pointerleave', () => { hovered = false; schedule(); });
    gallery.addEventListener('focusin', event => { focused = event.target.matches(':focus-visible'); schedule(); });
    gallery.addEventListener('focusout', event => {
      if (!gallery.contains(event.relatedTarget)) { focused = false; schedule(); }
    });
    gallery.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        show(index + (event.key === 'ArrowLeft' ? -1 : 1));
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        show(event.key === 'Home' ? 0 : items.length - 1);
      } else if (event.key === ' ' && event.target === gallery) {
        event.preventDefault();
        togglePause();
      }
    });
    gallery.addEventListener('pointerdown', event => {
      focused = false;
      if (!event.target.closest('button')) pointer = { x: event.clientX, y: event.clientY, id: event.pointerId };
    });
    window.addEventListener('pointerup', event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      pointer = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        suppressClick = performance.now() + 700;
        show(index + (dx < 0 ? 1 : -1));
      }
    });
    gallery.addEventListener('pointercancel', () => { pointer = null; });
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .12;
      gallery.dataset.visible = String(visible);
      schedule();
    }, { threshold: [0, .12] });
    observer.observe(gallery);
  });
  document.addEventListener('visibilitychange', () => groups.forEach(group => group.schedule()));
  if (root.dataset.homeOpening === 'true') new MutationObserver(() => groups.forEach(group => group.schedule())).observe(root, { attributes: true, attributeFilter: ['data-intro'] });
  window.addEventListener('pagehide', () => groups.forEach(group => group.schedule()));

  // Finite entrances on the two new case pages. The home keeps its original opening.
  if (!document.body.classList.contains('home-page') && typeof Element.prototype.animate === 'function') {
    if(!root.dataset.cardEntry)document.querySelectorAll('.platform-hero h1,.platform-lead,.games-hero-copy h1,.games-hero-copy>p,.games-hero-art').forEach((element, index) => {
      element.animate([{ opacity: .4, transform: 'translateY(18px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 700, delay: index * 75, easing: 'cubic-bezier(.2,.7,.2,1)' });
    });
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.animate([{ opacity: .55, transform: 'translateY(20px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)' });
        observer.unobserve(entry.target);
      }
    }, { threshold: .06 });
    document.querySelectorAll('.section-space').forEach(section => observer.observe(section));
  }
})();
