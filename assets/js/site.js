/* Mesa de montagem: capítulos finitos, profundidade e exploração por scroll nativo. */
(function () {
  'use strict';
  const raiz = document.documentElement;
  const sistemaReduzido = matchMedia('(prefers-reduced-motion: reduce)');
  // Sem escolha salva, o sistema decide. "on"/"off" é a última ação explícita do visitante e vale acima do sistema.
  let escolha = null, storageOk = true;
  function lerEscolha() {
    if (!storageOk) return;
    try { const salvo = localStorage.getItem('portfolio-motion'); escolha = salvo === 'on' || salvo === 'off' ? salvo : null; } catch (_) { storageOk = false; }
  }
  lerEscolha();
  const reduzido = { get matches() { return escolha ? escolha === 'off' : sistemaReduzido.matches; }, addEventListener: (tipo, fn) => sistemaReduzido.addEventListener(tipo, fn) };
  const motor = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined' && typeof SplitText !== 'undefined' && typeof Flip !== 'undefined' && typeof DrawSVGPlugin !== 'undefined' && typeof CustomEase !== 'undefined';
  const controle = document.getElementById('movimento');
  const rotuloControle = document.getElementById('movimento-rotulo');
  const topo = document.getElementById('topo');
  const menu = document.getElementById('menu');
  const nav = document.getElementById('navegacao');
  const campoHero = document.getElementById('quem-sou');
  const campoCena = document.querySelector('#na-pratica #cena-frentes');
  const statusCena = document.getElementById('cena-status');
  const rever = document.getElementById('rever-sequencia');
  const secoes = Array.from(nav.querySelectorAll('a')).map(link => ({ link, alvo: document.querySelector(link.hash) }));
  let ativo = false, contexto = null, entradaConsumida = false, heroConsumido = false;
  // Rolagem suave (Lenis) só existe dentro do contexto de movimento em desktop com ponteiro fino; fora dele a rolagem é nativa.
  let lenis = null;
  let fontesProntas = !document.fonts, reverEntrada = () => {}, sincronizarCena = () => {};
  let prepararGaleriaMovimento = () => () => {};
  const capitulosConsumidos = new Set();
  let layoutPendente = 0, navPendente = 0, alturaTopo = 0;
  raiz.classList.add('js');
  // O rótulo rolante duplica só o texto visível do próprio botão, em pseudo-elemento sem nome acessível.
  document.querySelectorAll('.botao-rotulo').forEach(rotulo => { rotulo.dataset.rotulo = rotulo.textContent.trim(); });
  raiz.classList.toggle('documento-oculto', document.hidden);
  if (motor) {
    gsap.registerPlugin(ScrollTrigger, SplitText, Flip, DrawSVGPlugin, CustomEase);
    CustomEase.create('montagem', 'M0,0 C0.16,1 0.3,1 1,1');
  }
  // Mudança de altura lazy deve atualizar os gatilhos, não apenas o cabeçalho.
  document.querySelectorAll('img[loading="lazy"]').forEach(img => img.addEventListener('load', atualizarLayout));
  if ('IntersectionObserver' in window) new IntersectionObserver(([entrada]) => {
    topo.classList.toggle('topo-preso', !entrada.isIntersecting);
  }).observe(document.querySelector('.topo-sentinela'));

  function atualizarNavegacao() {
    navPendente = 0;
    let atual = null;
    const limite = topo.getBoundingClientRect().height + innerHeight * .32;
    secoes.forEach(secao => { if (secao.alvo.getBoundingClientRect().top <= limite) atual = secao.link; });
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) atual = secoes[secoes.length - 1].link;
    secoes.forEach(secao => {
      if (secao.link === atual) secao.link.setAttribute('aria-current', 'location');
      else secao.link.removeAttribute('aria-current');
    });
  }
  function atualizarLayout() {
    if (layoutPendente) return;
    layoutPendente = requestAnimationFrame(() => {
      layoutPendente = 0;
      if (motor) ScrollTrigger.refresh();
      atualizarNavegacao();
      sincronizarCena();
    });
  }
  window.addEventListener('scroll', () => {
    if (!navPendente) navPendente = requestAnimationFrame(() => { atualizarNavegacao(); sincronizarCena(); });
  }, { passive: true });
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {
      const altura = Math.ceil(topo.getBoundingClientRect().height);
      if (altura === alturaTopo) return;
      alturaTopo = altura;
      raiz.style.setProperty('--topo-altura', altura + 'px');
      atualizarLayout();
    }).observe(topo);
  }

  /* Sem JS, a navegação fica exposta. Escape devolve o foco, sem prendê-lo. */
  function fecharMenu() {
    nav.classList.remove('aberta');
    menu.setAttribute('aria-expanded', 'false');
    menu.textContent = 'Menu';
  }
  menu.hidden = false;
  menu.addEventListener('click', () => {
    const aberto = menu.getAttribute('aria-expanded') !== 'true';
    nav.classList.toggle('aberta', aberto);
    menu.setAttribute('aria-expanded', String(aberto));
    menu.textContent = aberto ? 'Fechar' : 'Menu';
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { fecharMenu(); menu.focus(); }
  });
  document.addEventListener('click', e => { if (!topo.contains(e.target)) fecharMenu(); });
  matchMedia('(min-width: 900px)').addEventListener('change', e => { if (e.matches) fecharMenu(); });
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const alvo = document.getElementById(link.hash.slice(1));
      if (!alvo) return;
      e.preventDefault();
      fecharMenu();
      raiz.style.setProperty('--topo-altura', Math.ceil(topo.getBoundingClientRect().height) + 'px');
      if (!alvo.hasAttribute('tabindex')) alvo.setAttribute('tabindex', '-1');
      alvo.focus({ preventScroll: true });
      if (location.hash !== link.hash) history.pushState(null, '', link.hash);
      // Com a Lenis ativa, a âncora passa por ela (scrollIntoView nativo brigaria com a interpolação). A Lenis 1.3 já honra o scroll-margin-top do alvo.
      if (lenis && !lenis.isStopped && !document.hidden) lenis.scrollTo(alvo);
      else alvo.scrollIntoView({ behavior: ativo && !document.hidden ? 'smooth' : 'instant', block: 'start' });
    });
  });
  // Exploração do case continua nativa, inclusive com pausa, sem motor ou sem JS.
  document.querySelectorAll('details').forEach(detalhe => detalhe.addEventListener('toggle', atualizarLayout));

  /* Galeria progressiva: links seguros primeiro, dialog e rolagem nativos depois. */
  function iniciarGaleria() {
    const galeria = document.getElementById('ci-galeria');
    const dialog = document.getElementById('ci-dialog');
    if (!galeria || !dialog || typeof dialog.showModal !== 'function') return;
    const miniaturas = Array.from(galeria.querySelectorAll('[data-ci-tela]'));
    const telas = miniaturas.map(link => ({
      href: link.getAttribute('href'), titulo: link.querySelector('span').textContent,
      alt: link.dataset.descricao, imagem: link.querySelector('img')
    }));
    const abrir = Array.from(galeria.querySelectorAll('[data-ci-ampliar]'));
    const imagem = document.getElementById('ci-galeria-imagem');
    const status = document.getElementById('ci-galeria-status');
    const arquivo = document.getElementById('ci-galeria-arquivo');
    const trilho = document.getElementById('ci-dialog-telas');
    const statusDialog = document.getElementById('ci-dialog-status');
    const arquivoDialog = document.getElementById('ci-dialog-arquivo');
    const anterior = document.getElementById('ci-anterior');
    const proxima = document.getElementById('ci-proxima');
    let atual = 0, origem = null, fimScroll = 0, tamanhoPendente = 0, transicao = null, tocando = false;
    let trocarMiniatura = indice => selecionar(indice), realinharIndicador = () => {}, cancelarGaleriaVista = () => {}, vistaEmCurso = false;
    const quadros = telas.map((tela, indice) => {
      const quadro = document.createElement('figure');
      quadro.className = 'ci-dialog-tela';
      quadro.setAttribute('aria-label', `Tela ${indice + 1} de ${telas.length} · ${tela.titulo}`);
      if (indice !== atual) quadro.setAttribute('aria-hidden', 'true');
      const img = tela.imagem.cloneNode();
      img.alt = tela.alt;
      img.addEventListener('load', () => { if (atual === indice) anunciar(); });
      img.addEventListener('error', () => { if (atual === indice) anunciar(); });
      quadro.append(img);
      trilho.append(quadro);
      return quadro;
    });
    const cliqueNormal = e => !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
    function mensagem(img) {
      const tela = `Tela ${atual + 1} de ${telas.length} · ${telas[atual].titulo}`;
      if (!img.complete) return tela + ' · Carregando imagem…';
      return img.naturalWidth ? tela : tela + ' · Não foi possível carregar. Tente abrir o arquivo da tela.';
    }
    function anunciar() {
      const texto = mensagem(imagem);
      if (status.textContent !== texto) status.textContent = texto;
      if (dialog.open) {
        const textoDialog = mensagem(quadros[atual].querySelector('img'));
        if (statusDialog.textContent !== textoDialog) statusDialog.textContent = textoDialog;
      }
    }
    function animarImagem(img) {
      if (transicao) { transicao.cancel(); transicao = null; }
      if (ativo && !reduzido.matches && !document.hidden && !vistaEmCurso && img.complete && img.naturalWidth) {
        transicao = img.animate([{ opacity: .6 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
      }
    }
    function selecionar(indice) {
      atual = Math.max(0, Math.min(telas.length - 1, indice));
      const tela = telas[atual];
      if (imagem.getAttribute('src') !== tela.href) {
        imagem.alt = tela.alt;
        imagem.width = Number(tela.imagem.getAttribute('width'));
        imagem.height = Number(tela.imagem.getAttribute('height'));
        imagem.src = tela.href;
        if (!dialog.open) animarImagem(imagem);
      }
      miniaturas.forEach((link, i) => {
        if (i === atual) {
          link.setAttribute('aria-current', 'true');
          quadros[i].removeAttribute('aria-hidden');
        } else {
          link.removeAttribute('aria-current');
          // Sem controles dentro dos quadros: o foco permanece na navegação, nunca na tela oculta.
          quadros[i].setAttribute('aria-hidden', 'true');
        }
      });
      abrir.forEach(link => { link.href = tela.href; });
      imagem.parentElement.setAttribute('aria-label', 'Ampliar tela: ' + tela.titulo);
      arquivo.href = arquivoDialog.href = tela.href;
      anterior.setAttribute('aria-disabled', String(atual === 0));
      proxima.setAttribute('aria-disabled', String(atual === telas.length - 1));
      anunciar();
      realinharIndicador();
    }
    function navegar(indice, animado = true) {
      const antes = atual;
      selecionar(indice);
      if (!dialog.open) return;
      trilho.scrollTo({ left: atual * trilho.clientWidth, behavior: 'instant' });
      if (animado && antes !== atual) animarImagem(quadros[atual].querySelector('img'));
    }
    function concluirScroll() {
      clearTimeout(fimScroll);
      if (!dialog.open || tocando || !trilho.clientWidth) return;
      selecionar(Math.round(trilho.scrollLeft / trilho.clientWidth));
      if (Math.abs(trilho.scrollLeft - atual * trilho.clientWidth) > 2) navegar(atual, false);
    }
    function alinhar() {
      if (transicao) { transicao.cancel(); transicao = null; }
      if (!dialog.open || tamanhoPendente) return;
      tamanhoPendente = requestAnimationFrame(() => { tamanhoPendente = 0; if (dialog.open) navegar(atual, false); });
    }
    imagem.addEventListener('load', anunciar);
    imagem.addEventListener('error', anunciar);
    miniaturas.forEach((link, indice) => link.addEventListener('click', e => {
      if (!cliqueNormal(e)) return;
      e.preventDefault();
      trocarMiniatura(indice);
    }));
    abrir.forEach(link => {
      link.setAttribute('aria-haspopup', 'dialog');
      link.setAttribute('aria-controls', dialog.id);
      link.addEventListener('click', e => {
        if (!cliqueNormal(e)) return;
        e.preventDefault();
        cancelarGaleriaVista();
        origem = link;
        raiz.classList.add('ci-dialog-aberto');
        dialog.showModal();
        // A página atrás do dialog não rola: a Lenis para; o dialog e o trilho têm data-lenis-prevent e rolam nativos.
        if (lenis) lenis.stop();
        quadros.forEach(quadro => { quadro.querySelector('img').loading = 'eager'; });
        navegar(atual, false);
      });
    });
    anterior.addEventListener('click', () => { if (atual > 0) navegar(atual - 1); });
    proxima.addEventListener('click', () => { if (atual < telas.length - 1) navegar(atual + 1); });
    dialog.addEventListener('keydown', e => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'Tab') {
        const focaveis = Array.from(dialog.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]')).filter(el => el.getClientRects().length && !el.closest('[inert], [aria-hidden="true"]'));
        const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
        // Fechar o ciclo nos extremos também quando o navegador cederia o Tab à barra de endereço.
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
        return;
      }
      if (e.shiftKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault();
      navegar(atual + (e.key === 'ArrowRight' ? 1 : -1));
    });
    function agendarFimScroll() {
      clearTimeout(fimScroll);
      if (!tocando) fimScroll = setTimeout(concluirScroll, 180);
    }
    trilho.addEventListener('scrollend', concluirScroll);
    // Alguns gestos terminam entre snaps sem emitir scrollend. Esperar o repouso, nunca puxar durante o toque.
    trilho.addEventListener('scroll', agendarFimScroll, { passive: true });
    trilho.addEventListener('touchstart', () => { tocando = true; clearTimeout(fimScroll); }, { passive: true });
    for (const tipo of ['touchend', 'touchcancel']) trilho.addEventListener(tipo, () => { tocando = false; agendarFimScroll(); }, { passive: true });
    dialog.addEventListener('close', () => {
      clearTimeout(fimScroll);
      if (transicao) { transicao.cancel(); transicao = null; }
      tocando = false;
      raiz.classList.remove('ci-dialog-aberto');
      if (lenis) lenis.start();
      if (origem && origem.isConnected) origem.focus({ preventScroll: true });
    });
    if ('ResizeObserver' in window) new ResizeObserver(alinhar).observe(trilho);
    else window.addEventListener('resize', alinhar, { passive: true });
    reduzido.addEventListener('change', alinhar);
    controle.addEventListener('click', alinhar);
    document.addEventListener('visibilitychange', alinhar);

    // Uma seleção acessível; o indicador é só continuidade visual, fora do layout.
    prepararGaleriaMovimento = (configuracao, mobile) => {
      const navMiniaturas = miniaturas[0].parentElement;
      const indicador = document.createElement('span');
      indicador.className = 'ci-selecao';
      indicador.setAttribute('aria-hidden', 'true');
      navMiniaturas.append(indicador);
      let vista = null, flip = null;
      function posicionar() {
        const link = miniaturas[atual];
        indicador.style.width = link.offsetWidth + 'px';
        indicador.style.height = link.offsetHeight + 'px';
        indicador.style.transform = `translate(${link.offsetLeft}px, ${link.offsetTop}px)`;
        navMiniaturas.classList.add('indicador-pronto');
      }
      function cancelarVista(aplicar = true) {
        if (!vista) return;
        const anteriorVista = vista;
        if (aplicar) anteriorVista.aplicar();
        anteriorVista.cancelada = true;
        anteriorVista.transicao.skipTransition();
        anteriorVista.limpar();
        vista = null;
        vistaEmCurso = false;
      }
      function alinharDecoracao() {
        cancelarVista();
        if (flip) { flip.kill(); flip = null; }
        posicionar();
      }
      realinharIndicador = posicionar;
      cancelarGaleriaVista = cancelarVista;
      configuracao.add('trocarMiniatura', indice => {
        cancelarVista(false);
        if (flip) { flip.kill(); flip = null; }
        if (indice === atual) { selecionar(indice); return; }
        if (document.startViewTransition && ativo && !reduzido.matches && !document.hidden) {
          const thumb = miniaturas[indice];
          const registro = {
            cancelada: false, aplicada: false,
            aplicar() { if (!this.aplicada && !this.cancelada) { this.aplicada = true; selecionar(indice); } },
            limpar() { for (const el of [imagem, thumb, indicador]) el.style.removeProperty('view-transition-name'); }
          };
          imagem.style.viewTransitionName = 'ci-imagem';
          thumb.style.viewTransitionName = 'ci-miniatura';
          indicador.style.viewTransitionName = 'ci-selecao';
          vistaEmCurso = true;
          vista = registro;
          registro.transicao = document.startViewTransition(() => registro.aplicar());
          registro.transicao.ready.catch(() => {}); // skipTransition rejeita ready ao cancelar por preferência/resize.
          registro.transicao.finished.catch(() => {}).finally(() => {
            if (vista !== registro) return;
            registro.limpar(); vista = null; vistaEmCurso = false;
          });
          // Flip não roda atrás do snapshot; a VT transporta o indicador com nome próprio.
        } else {
          const estado = Flip.getState(indicador);
          selecionar(indice);
          if (!document.hidden) flip = Flip.from(estado, { duration: mobile ? .216 : .36, ease: 'montagem', scale: true, simple: true });
        }
      });
      trocarMiniatura = indice => configuracao.trocarMiniatura(indice);
      const observadorIndicador = 'ResizeObserver' in window ? new ResizeObserver(alinharDecoracao) : null;
      if (observadorIndicador) { observadorIndicador.observe(navMiniaturas); miniaturas.forEach(link => observadorIndicador.observe(link)); }
      else window.addEventListener('resize', alinharDecoracao, { passive: true });
      dialog.addEventListener('close', alinharDecoracao);
      document.addEventListener('visibilitychange', alinharDecoracao);
      posicionar();
      return () => {
        cancelarVista();
        if (flip) flip.kill();
        observadorIndicador?.disconnect();
        window.removeEventListener('resize', alinharDecoracao);
        dialog.removeEventListener('close', alinharDecoracao);
        document.removeEventListener('visibilitychange', alinharDecoracao);
        trocarMiniatura = indice => selecionar(indice);
        realinharIndicador = () => {};
        cancelarGaleriaVista = () => {};
        indicador.remove(); navMiniaturas.classList.remove('indicador-pronto');
      };
    };
    anunciar();
  }

  function estadoCena(estado, mensagem) {
    campoCena.dataset.estado = estado;
    if (statusCena.textContent !== mensagem) statusCena.textContent = mensagem;
    rever.hidden = !motor;
    rever.setAttribute('aria-disabled', String(!ativo || !fontesProntas || estado === 'em-curso'));
  }
  function iniciarMovimento() {
    contexto = gsap.matchMedia();
    contexto.add({ desktop: '(min-width: 1024px)', tablet: '(min-width: 768px) and (max-width: 1023px)', mobile: '(max-width: 767px)', fino: '(pointer: fine) and (hover: hover)' }, configuracao => {
      const { mobile, desktop, fino } = configuracao.conditions;
      const trilhas = campoCena.querySelector('.cena-trilhas');
      const titulosDivididos = new Set();
      const limparInteracoes = [];
      let entrada = null, entradaHero = null, inicioPendente = 0, iniciada = false, encerrando = false;
      function linhas(titulo, timeline, posicao = 0) {
        const split = SplitText.create(titulo, { type: 'lines', mask: 'lines', linesClass: 'linha-titulo', aria: 'auto', autoSplit: false });
        const registro = { split, tween: null };
        titulosDivididos.add(registro);
        registro.tween = gsap.fromTo(split.lines, { yPercent: 100 }, {
          yPercent: 0, duration: mobile ? .54 : .9, stagger: Math.min(.08, .24 / Math.max(1, split.lines.length - 1)), ease: 'montagem',
          onComplete: () => { split.revert(); titulosDivididos.delete(registro); }
        });
        timeline.add(registro.tween, posicao);
      }
      function concluirTitulos() {
        if (entradaHero && entradaHero.progress() < 1) entradaHero.progress(1);
        Array.from(titulosDivididos).forEach(registro => { registro.tween.progress(1); registro.split.revert(); });
        titulosDivididos.clear();
      }
      window.addEventListener('resize', concluirTitulos, { passive: true });
      function capitulo(seletor, complementar) {
        const titulo = document.querySelector(seletor);
        const id = titulo.id || titulo.closest('article').id;
        if (capitulosConsumidos.has(id) || titulo.getBoundingClientRect().bottom < topo.getBoundingClientRect().height) {
          capitulosConsumidos.add(id);
          titulo.dataset.entrada = 'concluida';
          return;
        }
        titulo.dataset.entrada = 'aguardando';
        const funcao = 'revelar-' + id;
        configuracao.add(funcao, () => {
          if (encerrando || capitulosConsumidos.has(id)) return;
          capitulosConsumidos.add(id);
          titulo.dataset.entrada = 'em-curso';
          const timeline = gsap.timeline({ id: 'entrada-' + id, onComplete: () => { titulo.dataset.entrada = 'concluida'; } });
          linhas(titulo, timeline);
          if (complementar) complementar(timeline);
        });
        ScrollTrigger.create({ id: 'capitulo-' + id, trigger: titulo, start: 'top 80%', once: true, toggleActions: 'play none none none', onEnter: () => configuracao[funcao]() });
      }
      function magnetizar(seletor) {
        if (!fino) return;
        document.querySelectorAll(seletor).forEach(el => {
          const x = gsap.quickTo(el, 'x', { duration: .3, ease: 'montagem' });
          const y = gsap.quickTo(el, 'y', { duration: .3, ease: 'montagem' });
          const mover = e => {
            if (document.hidden || e.pointerType === 'touch') return;
            const r = el.getBoundingClientRect();
            const raio = mobile ? 16.8 : 28, forca = mobile ? .132 : .22;
            x(gsap.utils.clamp(-raio, raio, (e.clientX - r.left - r.width / 2) * forca));
            y(gsap.utils.clamp(-raio, raio, (e.clientY - r.top - r.height / 2) * forca));
          };
          const sair = () => { x(0); y(0); };
          el.addEventListener('pointermove', mover);
          el.addEventListener('pointerleave', sair);
          el.addEventListener('blur', sair);
          limparInteracoes.push(() => { el.removeEventListener('pointermove', mover); el.removeEventListener('pointerleave', sair); el.removeEventListener('blur', sair); });
        });
      }
      function areaVisivel(elemento) {
        const area = elemento.getBoundingClientRect();
        const visivel = Math.min(area.bottom, innerHeight) - Math.max(area.top, topo.getBoundingClientRect().height);
        return visivel >= Math.min(area.height * .7, innerHeight * .4);
      }
      function cenaVisivel() { return areaVisivel(trilhas); }
      function permitida() { return ativo && fontesProntas && !reduzido.matches && !document.hidden && cenaVisivel(); }
      function cancelarInicio() { cancelAnimationFrame(inicioPendente); inicioPendente = 0; }
      campoHero.dataset.entrada = heroConsumido ? 'concluida' : 'aguardando-visibilidade';
      configuracao.add('prepararHero', () => {
        heroConsumido = true;
        campoHero.dataset.entrada = 'em-curso';
        entradaHero = gsap.timeline({ id: 'entrada-hero', defaults: { ease: 'montagem' }, onComplete: () => { campoHero.dataset.entrada = 'concluida'; } });
        linhas(document.getElementById('titulo'), entradaHero);
        entradaHero.fromTo('.hero-intro', { y: mobile ? 14.4 : 24, autoAlpha: .88 }, { y: 0, autoAlpha: 1, duration: mobile ? .54 : .9 }, .08)
          .fromTo('.hero-texto p', { y: mobile ? 10.8 : 18, opacity: .94 }, { y: 0, opacity: 1, duration: mobile ? .48 : .8, stagger: mobile ? .072 : .12 }, .16)
          .fromTo('.hero-ficha', { scale: mobile ? .988 : .98, y: mobile ? 6 : 10 }, { scale: 1, y: 0, duration: mobile ? .7 : 1.04 }, .32)
          .fromTo('.ficha-filete', { scaleX: 0 }, { scaleX: 1, duration: mobile ? .42 : .7, stagger: mobile ? .048 : .08 }, .42)
          .fromTo('.hero-acoes', { y: mobile ? 6 : 10, opacity: .94 }, { y: 0, opacity: 1, duration: mobile ? .55 : .65 }, mobile ? .81 : .95);
      });
      function sincronizar() {
        if (encerrando) return;
        if (!heroConsumido && ativo && fontesProntas && !reduzido.matches && !document.hidden && areaVisivel(campoHero.querySelector('h1'))) configuracao.prepararHero();
        if (entradaHero && entradaHero.progress() < 1) {
          if (ativo && fontesProntas && !reduzido.matches && !document.hidden) {
            heroConsumido = true;
            campoHero.dataset.entrada = 'em-curso';
            entradaHero.play();
          } else entradaHero.pause();
        }
        if (!entrada) return;
        if (!permitida()) {
          cancelarInicio();
          entrada.pause();
          if (entrada.progress() < 1) estadoCena(iniciada ? 'suspensa' : 'aguardando-visibilidade', iniciada ? 'Sequência suspensa fora de vista. Continua ao voltar.' : 'Sequência pronta. Começa quando os percursos estiverem visíveis.');
          return;
        }
        if (entrada.progress() >= 1 || inicioPendente) return;
        inicioPendente = requestAnimationFrame(() => {
          inicioPendente = 0;
          // Fontes, preferência e visibilidade podem mudar entre o pedido e este quadro.
          if (encerrando || !entrada || !permitida()) return;
          iniciada = true;
          entradaConsumida = true;
          estadoCena('em-curso', 'Frentes em movimento, cada uma com seu destino.');
          entrada.play();
        });
      }
      configuracao.add('prepararEntrada', () => {
        cancelarInicio();
        if (entrada) entrada.revert();
        iniciada = false;
        const entregas = Array.from(campoCena.querySelectorAll('.entrega-cena'));
        // Medir a folga antes de escrever estilos evita atravessar o nome da frente.
        const distancias = entregas.map(el => Math.min(mobile ? 32 : 104, el.previousElementSibling.getBoundingClientRect().width - 8));
        entrada = gsap.timeline({ id: 'entrada-frentes', paused: true, defaults: { ease: 'power2.inOut' }, onComplete: () => {
          estadoCena('concluida', 'Sequência concluída. Explore cada percurso ou reveja por ação.');
        } });
        entrada.addLabel('abrir', 0)
          .fromTo(entregas, { x: i => -Math.max(0, distancias[i]) }, { x: 0, duration: 1.5, stagger: .25 }, 'abrir+=.15')
          .fromTo('.caminho-ativo', { drawSVG: 0 }, { drawSVG: '100%', duration: 1.5, stagger: .25, clearProps: 'strokeDasharray,strokeDashoffset' }, 'abrir+=.2');
        if (!mobile) entrada.fromTo('.seta-destino path', { drawSVG: 0 }, { drawSVG: '100%', duration: .7, stagger: .15, clearProps: 'strokeDasharray,strokeDashoffset' }, 1.2);
        estadoCena('aguardando-visibilidade', 'Sequência pronta. Começa quando os percursos estiverem visíveis.');
        sincronizar();
      });
      if (!entradaConsumida) configuracao.prepararEntrada();
      else estadoCena('disponivel', 'Animações ativas. Use Rever sequência para ver os percursos.');
      reverEntrada = () => {
        if (!permitida() && (reduzido.matches || !ativo || !fontesProntas)) return;
        // Com a Lenis ativa, um salto nativo durante uma animação dela seria ignorado; immediate cancela a animação em curso e posiciona na hora.
        if (!cenaVisivel()) {
          if (lenis && !lenis.isStopped) lenis.scrollTo(trilhas, { immediate: true, offset: -Math.max(0, (innerHeight - trilhas.getBoundingClientRect().height) / 2) });
          else trilhas.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
        configuracao.prepararEntrada();
      };
      sincronizarCena = sincronizar;
      const observador = new IntersectionObserver(sincronizar, { threshold: [0, .4, .7, 1] });
      observador.observe(trilhas);
      observador.observe(campoHero.querySelector('h1'));
      sincronizar();
      // Rolagem suave: só desktop com ponteiro fino e hover. Nasce e morre com este contexto (pausa, reduce, toque e resize destroem).
      let rafLenis = null;
      if (desktop && fino && typeof Lenis !== 'undefined') {
        // respectReducedMotion: false de propósito: a autoridade sobre movimento é a do site (sistema decide o padrão, a escolha explícita do visitante vence).
        // A Lenis só existe dentro deste contexto; se ela consultasse o sistema por conta própria, zeraria a suavidade mesmo depois de o visitante ligar.
        lenis = new Lenis({ lerp: .1, wheelMultiplier: 1, smoothWheel: true, syncTouch: false, autoRaf: false, anchors: false, allowNestedScroll: true, respectReducedMotion: false });
        lenis.on('scroll', ScrollTrigger.update);
        rafLenis = tempo => lenis.raf(tempo * 1000);
        gsap.ticker.add(rafLenis);
        gsap.ticker.lagSmoothing(0);
        if (document.getElementById('ci-dialog')?.open) lenis.stop();
      }
      magnetizar('.hero-acoes .botao');
      // Parallax de saída: o hero fica um pouco atrás enquanto o próximo capítulo sobe. Só deslocamento, opacidade intacta; desktop.
      if (desktop) gsap.fromTo(campoHero, { y: 0 }, { y: () => innerHeight * .12, ease: 'none', immediateRender: false, scrollTrigger: { id: 'hero-parallax', trigger: campoHero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
      // A captura do fundo fica um pouco atrás do próprio hero (profundidade); a escala 1.08 (≈36px de folga em 900px) cobre os −3%.
      if (desktop) gsap.fromTo('.hero-fundo img', { yPercent: 0 }, { yPercent: -3, ease: 'none', immediateRender: false, scrollTrigger: { id: 'hero-fundo-parallax', trigger: campoHero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
      capitulo('#titulo-trabalho', timeline => {
        timeline.fromTo('.trabalho-texto > p', { y: mobile ? 19.2 : 32, rotation: i => (i % 2 ? -1 : 1) * (mobile ? .9 : 1.5) }, { y: 0, rotation: 0, duration: mobile ? .54 : .9, stagger: mobile ? .072 : .12, ease: 'montagem' }, .12);
      });
      capitulo('#titulo-metodo');
      if (desktop) {
        ScrollTrigger.create({ id: 'metodo-pin', trigger: '.estrutura-projeto', pin: true, pinSpacing: true, start: 'top 88px', endTrigger: '.metodo-sequencia', end: 'bottom bottom', invalidateOnRefresh: true });
        gsap.fromTo('.metodo-trilho-progresso', { drawSVG: 0 }, { drawSVG: '100%', ease: 'none', scrollTrigger: { id: 'metodo-trilho', trigger: '.metodo-passos', start: 'top center', end: 'bottom center', scrub: true } });
        document.querySelectorAll('.metodo-passos > li').forEach((passo, i) => {
          gsap.set(passo, { '--passo-luz': .55, '--passo-superficie': 0 });
          ScrollTrigger.create({ id: 'metodo-passo-' + (i + 1), trigger: passo, start: 'top center', end: 'bottom center', onToggle: self => {
            gsap.to(passo, { '--passo-luz': self.isActive ? 1 : .55, '--passo-superficie': self.isActive ? 1 : 0, duration: self.isActive ? .2 : 0, overwrite: 'auto' });
          } });
        });
      }
      document.querySelectorAll('#metodo .registro-execucao').forEach(registro => {
        const id = 'recorte-' + registro.id;
        if (capitulosConsumidos.has(id)) return;
        gsap.fromTo(registro.querySelector('.registro-imagem'), { scale: mobile ? .976 : .96 }, { scale: 1, duration: mobile ? .48 : .8, ease: 'montagem', scrollTrigger: { id, trigger: registro, start: 'top 80%', once: true, toggleActions: 'play none none none', onEnter: () => capitulosConsumidos.add(id) } });
      });
      capitulo('#titulo-pratica');
      if (desktop) gsap.fromTo('.registro-mesa .registro-imagem', { y: 24 }, { y: -24, ease: 'none', scrollTrigger: { id: 'mesa-parallax', trigger: '.registro-mesa', start: 'top bottom', end: 'bottom top', scrub: true } });
      capitulo('#titulo-projetos');
      for (const seletor of ['#titulo-ciclo', '#p-copy > h3', '#p-resumos > h3', '#p-funil > h3', '#p-transcricao > h3', '#experimentos > h3']) {
        capitulo(seletor, timeline => {
          const artigo = document.querySelector(seletor).closest('article');
          const corpo = artigo.querySelector('.projeto-conteudo') || artigo.querySelector('.ciclo-titulo > p') || artigo.querySelector(':scope > p');
          timeline.fromTo(corpo, { y: mobile ? 10.8 : 18, opacity: .94 }, { y: 0, opacity: 1, duration: mobile ? .42 : .7, ease: 'montagem' }, .12);
        });
      }
      limparInteracoes.push(prepararGaleriaMovimento(configuracao, mobile));
      if (fino) {
        const imagem = document.getElementById('ci-galeria-imagem');
        const area = imagem.parentElement;
        gsap.set(imagem, { transformPerspective: 900 });
        const x = gsap.quickTo(imagem, 'rotationX', { duration: .35, ease: 'montagem' });
        const y = gsap.quickTo(imagem, 'rotationY', { duration: .35, ease: 'montagem' });
        const inclinar = e => {
          if (document.hidden || e.pointerType === 'touch') return;
          const r = area.getBoundingClientRect(), limite = mobile ? 1.2 : 2;
          x(gsap.utils.clamp(-limite, limite, (r.top + r.height / 2 - e.clientY) / r.height * limite * 2));
          y(gsap.utils.clamp(-limite, limite, (e.clientX - r.left - r.width / 2) / r.width * limite * 2));
        };
        const assentar = () => { x(0); y(0); };
        area.addEventListener('pointermove', inclinar); area.addEventListener('pointerleave', assentar);
        limparInteracoes.push(() => { area.removeEventListener('pointermove', inclinar); area.removeEventListener('pointerleave', assentar); });
      }
      const cena = (id, trigger, start, end) => gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { id, trigger, start, end, scrub: true, invalidateOnRefresh: true }
      });
      cena('quadro-ci', '.ci-galeria-grade', 'top 92%', 'top 34%')
        .fromTo('.ci-galeria-quadro', { y: mobile ? 36 : 56, scale: mobile ? .93 : .9, transformOrigin: '50% 0%' }, { y: 0, scale: 1, duration: 1, ease: 'power2.out' }, 0)
        .fromTo('.ci-galeria-imagem', { '--moldura-corte': '82%' }, { '--moldura-corte': '0%', duration: 1 }, 0);
      capitulo('#titulo-experiencia');
      gsap.set(document.body, { '--fundo-secao': '#111215' });
      const pintarFundo = gsap.quickSetter(document.body, '--fundo-secao');
      let trechosFundo = [];
      const medirFundo = () => {
        const top = seletor => document.querySelector(seletor).getBoundingClientRect().top + scrollY;
        trechosFundo = [
          { inicio: top('#metodo') - innerHeight * .85, fim: top('#metodo') - innerHeight * .35, cor: gsap.utils.interpolate('#111215', '#1B1D23') },
          { inicio: top('#na-pratica') - innerHeight * .85, fim: top('#na-pratica') - innerHeight * .35, cor: gsap.utils.interpolate('#1B1D23', '#111215') },
          { inicio: top('#contato') - innerHeight * .92, fim: top('#contato') - innerHeight * .4, cor: gsap.utils.interpolate('#111215', '#19275C') }
        ];
      };
      const atualizarFundo = self => {
        const posicao = self.scroll();
        let cor = '#111215';
        trechosFundo.forEach(trecho => { if (posicao >= trecho.inicio) cor = trecho.cor(gsap.utils.clamp(0, 1, (posicao - trecho.inicio) / (trecho.fim - trecho.inicio))); });
        pintarFundo(cor);
      };
      medirFundo();
      ScrollTrigger.create({ id: 'fundo-secoes', start: 0, end: 'max', scrub: true, onUpdate: atualizarFundo, onRefresh: self => { medirFundo(); atualizarFundo(self); } });
      capitulo('#titulo-contato');
      cena('contato-campo', '.contato', 'top 92%', 'top 45%').fromTo(document.querySelector('.contato'), { '--contato-corte': '100%' }, { '--contato-corte': '0%', duration: 1 });
      magnetizar('.contato-links a');
      return () => {
        encerrando = true;
        cancelarInicio();
        if (lenis) {
          if (rafLenis) gsap.ticker.remove(rafLenis);
          lenis.destroy();
          lenis = null;
          // A Lenis 1.3 não limpa as próprias classes ao destruir; a rolagem volta a ser nativa de imediato.
          raiz.classList.remove('lenis', 'lenis-smooth', 'lenis-scrolling', 'lenis-stopped');
        }
        observador.disconnect();
        window.removeEventListener('resize', concluirTitulos);
        titulosDivididos.forEach(registro => registro.split.revert());
        titulosDivididos.clear();
        limparInteracoes.forEach(limpar => limpar());
        document.querySelectorAll('h2[data-entrada], h3[data-entrada]').forEach(titulo => { if (capitulosConsumidos.has(titulo.id || titulo.closest('article')?.id)) titulo.dataset.entrada = 'concluida'; });
        reverEntrada = () => {};
        sincronizarCena = () => {};
      };
    }, document.getElementById('conteudo'));
    gsap.globalTimeline.paused(document.hidden);
  }
  function pararMovimento() {
    if (contexto) { contexto.revert(); contexto = null; }
  }
  function aplicarPreferencia() {
    lerEscolha();
    const proximo = motor && !reduzido.matches;
    const sistema = sistemaReduzido.matches;
    raiz.classList.toggle('movimento-ativo', proximo && fontesProntas);
    raiz.classList.toggle('movimento-pausado', !proximo);
    controle.hidden = !motor;
    controle.dataset.sistema = sistema ? 'reduzido' : 'normal';
    controle.setAttribute('aria-pressed', String(proximo));
    // Sempre operável: o sistema define o padrão, a escolha do visitante prevalece e fica salva neste navegador.
    const label = proximo
      ? (sistema ? 'Pausar animações. Ativadas por escolha sua; o sistema pede movimento reduzido.' : 'Pausar animações')
      : (sistema && !escolha ? 'Ativar animações. Sistema em movimento reduzido: a página está estática por padrão.' : 'Ativar animações');
    controle.setAttribute('aria-label', label);
    controle.title = label;
    rotuloControle.textContent = proximo ? 'Pausar' : 'Ativar';
    ativo = proximo;
    if (!ativo) {
      pararMovimento();
      // Desligar o movimento interrompe transições em curso: o Chromium não cancela a do ::backdrop ao trocar a classe.
      document.getElementById('ci-dialog')?.getAnimations?.({ subtree: true }).forEach(animacao => animacao.cancel());
      campoHero.dataset.entrada = !motor ? 'estatica' : escolha === 'off' ? 'pausada' : 'reduzida';
      if (!motor) estadoCena('estatica', 'Cena estática. Os percursos estão completos.');
      else if (escolha === 'off') estadoCena('pausada', 'Animações pausadas. Preferência salva neste navegador.');
      else estadoCena('reduzida', 'Movimento reduzido pelo sistema. Todos os percursos estão completos.');
    } else if (!fontesProntas) {
      campoHero.dataset.entrada = 'aguardando-fontes';
      estadoCena('aguardando-fontes', 'Preparando a sequência. O conteúdo já está disponível.');
    } else if (!contexto) iniciarMovimento();
    atualizarLayout();
  }
  controle.addEventListener('click', () => {
    escolha = ativo ? 'off' : 'on';
    try { localStorage.setItem('portfolio-motion', escolha); } catch (_) { storageOk = false; }
    aplicarPreferencia();
  });
  // Outra aba do mesmo navegador mudou a escolha: acompanhar.
  window.addEventListener('storage', e => { if (e.key === null || e.key === 'portfolio-motion') aplicarPreferencia(); });
  rever.addEventListener('click', () => {
    if (!ativo || reduzido.matches || !fontesProntas || rever.getAttribute('aria-disabled') === 'true') return;
    reverEntrada();
  });
  reduzido.addEventListener('change', aplicarPreferencia);
  document.addEventListener('visibilitychange', () => {
    raiz.classList.toggle('documento-oculto', document.hidden);
    if (motor) gsap.globalTimeline.paused(document.hidden);
    sincronizarCena();
    if (!document.hidden) atualizarLayout();
  });

  const email = document.getElementById('email');
  const copiar = document.getElementById('copiar');
  const aviso = document.getElementById('aviso-copia');
  if (email.tagName === 'A' && /^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.getAttribute('href'))) {
    copiar.hidden = !navigator.clipboard;
    copiar.addEventListener('click', () => {
      navigator.clipboard.writeText(email.textContent.trim()).then(() => { aviso.textContent = 'E-mail copiado.'; }).catch(() => { aviso.textContent = 'Não foi possível copiar. Selecione o e-mail e copie manualmente.'; });
    });
  }
  document.getElementById('ano').textContent = String(new Date().getFullYear());
  iniciarGaleria();
  aplicarPreferencia();
  if (document.fonts) document.fonts.ready.then(() => { fontesProntas = true; aplicarPreferencia(); });
  window.addEventListener('load', atualizarLayout);
  window.addEventListener('resize', atualizarLayout, { passive: true });
})();
