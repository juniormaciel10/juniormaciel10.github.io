// A rolagem continua sendo a do navegador. O CSS desenha; o JavaScript sincroniza mídia, foco e números.
(() => {
  'use strict';
  const raiz = document.documentElement;
  if (raiz.dataset.movimento !== 'capitulos' || !document.querySelector('[data-cp-pagina]')) return;
  // Os efeitos ficam ligados por padrão, conforme a escolha do autor, como no resto do site: a preferência de movimento
  // reduzido do sistema não os desliga. A versão parada fica para quando o JavaScript não roda e para a impressão.
  const ligado = true;
  const computador = matchMedia('(min-width:761px)');
  const nativo = !!(window.CSS && CSS.supports('animation-timeline: view()'));
  const limita = v => Math.max(0, Math.min(1, v));
  const formatar = (valor, casas) => {
    const partes = (casas ? valor.toFixed(casas) : String(Math.floor(valor))).split('.');
    return partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (casas ? ',' + partes[1] : '');
  };
  const perto = new Set();
  let teclado = false, quadro = 0, medirPendente = true, fecharDialogo = null;
  const estilo = (no, nome, valor) => { if (no.style.getPropertyValue(nome) !== String(valor)) no.style.setProperty(nome, String(valor)); };
  const pedir = (medir = false) => {
    medirPendente ||= medir;
    if (!quadro) quadro = requestAnimationFrame(() => {
      quadro = 0;
      if (medirPendente) { medirPendente = false; medirTudo(); pedir(); return; }
      atualizar();
    });
  };

  // Retira os ouvintes do carrossel temporizado antes de entregar o controle à rolagem.
  const galerias = [...document.querySelectorAll('[data-cp-galeria]')].map(original => {
    const pausa = original.querySelector('[data-gallery-pause]');
    if (original.classList.contains('is-enhanced') && original.dataset.paused !== 'true') pausa?.click();
    original.getAnimations({ subtree: true }).forEach(a => a.cancel());
    const no = original.cloneNode(true);
    original.replaceWith(no);
    no.classList.remove('is-enhanced');
    no.removeAttribute('aria-keyshortcuts');
    no.removeAttribute('aria-busy');
    const telas = [...no.querySelectorAll('[data-gallery-slide]')];
    const g = { no, telas, cena: no.closest('[data-cp-cena]'), palco: no.closest('[data-cp-palco]'),
      pontos: [...no.querySelectorAll('[data-gallery-select]')], controles: no.querySelector('[data-gallery-controls]'),
      pausa: no.querySelector('[data-gallery-pause]'), status: no.querySelector('[data-gallery-status]'),
      passo: -1, curso: 1, topo: 92, visivel: false, pausado: false, foco: false, mouse: false, timer: 0, fluxo: false };
    telas.forEach(t => { t.hidden = false; t.inert = false; t.removeAttribute('aria-hidden'); });
    no.dataset.paused = 'true';
    return g;
  });
  // A figura de abertura usa o mesmo controle dos outros vídeos.
  document.querySelectorAll('[data-lp-animation]:has([data-cp-video])').forEach(original => {
    original.querySelector('video').pause();
    const copia = original.cloneNode(true);
    original.replaceWith(copia);
    // Sem botão visível: o próprio vídeo é o controle de pausar (abaixo).
    copia.querySelector('[data-lp-toggle]')?.remove();
  });
  const videos = [...document.querySelectorAll('[data-cp-video]')].map((video, indice) => {
    const g = galerias.find(item => item.no.contains(video));
    // Sem botão visível: o quadro do próprio vídeo é o controle de pausar e continuar (clique, toque, Enter ou Espaço).
    // O nome fica fixo ("Pausar o vídeo"), o estado vai no aria-pressed e a descrição do vídeo, no aria-describedby.
    (g?.no || video.closest('figure'))?.querySelector('[data-cp-video-toggle]')?.remove();
    const botao = video.closest('[data-cp-video-caixa]') || video.parentElement;
    if (!video.id) video.id = 'cp-video-' + (indice + 1);
    let trechos = [];
    try { trechos = JSON.parse(video.dataset.trechos || '[]'); } catch { trechos = []; }
    const v = { video, g, botao, trechos, passo: -1, alvo: 0, visivel: false, pausado: false, manual: false, carregado: false, pedido: false, falhou: false };
    if (g) { g.video = v; g.no.dataset.cpMedia = 'video'; }
    // Todos os vídeos tocam sozinhos, sem som, na linha e em loop (inclusive a abertura da Maratona, que antes parava no fim).
    video.muted = true; video.playsInline = true; video.loop = true;
    // O estado vai no aria-pressed; a dica do mouse diz a ação.
    const rotulo = () => {
      if (!botao || v.falhou) return;
      const parado = video.paused;
      botao.setAttribute('aria-pressed', String(parado));
      botao.title = parado ? 'Continuar o vídeo' : 'Pausar o vídeo';
    };
    video.addEventListener('loadedmetadata', () => {
      v.carregado = true;
      if (Number.isFinite(video.duration)) video.currentTime = Math.min(v.alvo, Math.max(0, video.duration - .1));
      conduzirVideo(v); pedir();
    }, { passive: true });
    ['play', 'pause', 'ended'].forEach(tipo => video.addEventListener(tipo, rotulo, { passive: true }));
    // Cada passo repete só o próprio trecho. A conta usa o tempo de cada quadro mostrado (requestVideoFrameCallback), que é
    // exata; o timeupdate, só umas quatro vezes por segundo, fica de reserva. No fim do arquivo, o loop nativo volta ao zero:
    // um tempo antes do começo do trecho também leva de volta ao começo dele (sem isso, o último passo tocava o vídeo todo).
    const voltarAoTrecho = tempo => {
      if (!ligado || v.pausado || !v.g || !v.trechos.length || video.seeking) return;
      const fim = v.trechos[v.passo + 1] ?? video.duration;
      if ((Number.isFinite(fim) && tempo >= fim - .04) || tempo < v.alvo - .05) video.currentTime = v.alvo;
    };
    video.addEventListener('timeupdate', () => voltarAoTrecho(video.currentTime), { passive: true });
    if (typeof video.requestVideoFrameCallback === 'function') {
      const quadroMostrado = (agora, dados) => { voltarAoTrecho(dados.mediaTime); video.requestVideoFrameCallback(quadroMostrado); };
      video.requestVideoFrameCallback(quadroMostrado);
    } else {
      // Sem esse recurso, a mesma conta roda a cada quadro de animação, só enquanto o vídeo toca. Perto do fim do trecho,
      // um temporizador marcado para a hora certa faz a volta: quando os quadros de animação vêm devagar, a posição
      // passava até 63 ms do fim, uns 2 quadros do trecho seguinte.
      let vigia = 0, temporizador = 0;
      const marcar = () => {
        clearTimeout(temporizador);
        if (video.paused || !ligado || !v.g || !v.trechos.length) return;
        const fim = v.trechos[v.passo + 1] ?? video.duration, falta = (fim - .05 - video.currentTime) * 1000 / (video.playbackRate || 1);
        if (!(falta < 400)) return;
        if (falta <= 4) { voltarAoTrecho(Math.max(video.currentTime, fim - .04)); return; }
        temporizador = setTimeout(marcar, falta);
      };
      const conferirQuadro = () => { vigia = 0; if (video.paused) return; voltarAoTrecho(video.currentTime); marcar(); vigia = requestAnimationFrame(conferirQuadro); };
      video.addEventListener('play', () => { if (!vigia) vigia = requestAnimationFrame(conferirQuadro); }, { passive: true });
    }
    // Sem vídeo, as telas voltam a ser o conteúdo. Com as fontes em <source>, quando todas falham o navegador avisa na última
    // fonte (esse erro não sobe até o vídeo); o erro do próprio vídeo cobre as falhas depois de carregar.
    const falhar = () => {
      if (v.falhou) return;
      v.falhou = true; video.pause();
      if (g) g.no.dataset.cpMedia = 'telas';
      // Sem vídeo, o quadro deixa de ser controle.
      if (botao) { ['role', 'tabindex', 'aria-label', 'aria-pressed', 'aria-describedby', 'title'].forEach(a => botao.removeAttribute(a)); botao.classList.remove('cp-video-alternar'); }
      // A tela do passo atual volta a ser clicável e lida por leitor de tela já agora, sem esperar a troca de passo.
      if (g) { const atual = Math.max(0, g.passo); g.passo = -1; mostrar(g, atual); }
      pedir();
    };
    video.addEventListener('error', falhar, { passive: true });
    [...video.querySelectorAll('source')].pop()?.addEventListener('error', falhar, { passive: true });
    const alternar = () => {
      if (v.falhou) return;
      v.pausado = !video.paused;
      v.manual = !v.pausado;
      if (v.pausado) video.pause();
      else { if (!v.carregado) carregarVideo(v); video.play().catch(rotulo); }
      rotulo();
    };
    if (botao) {
      botao.classList.add('cp-video-alternar');
      botao.setAttribute('role', 'button'); botao.tabIndex = 0;
      botao.setAttribute('aria-label', 'Pausar o vídeo'); botao.setAttribute('aria-describedby', video.id);
      botao.addEventListener('click', alternar, { passive: true });
      // Enter e Espaço no próprio controle, como num botão: o Espaço não rola a página quando o foco está no vídeo.
      botao.addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); alternar(); });
    }
    rotulo();
    return v;
  });

  const trilho = document.querySelector('[data-cp-trilho]');
  const faixa = document.querySelector('[data-cp-faixa]');
  const janela = document.querySelector('[data-cp-janela]');
  const cartoes = [...document.querySelectorAll('[data-cp-cartao]')];
  // Estado de cada linha no celular: o do começo da página (com o grupo aberto pelo endereço) e, depois, o que o visitante
  // escolheu. No computador, os doze cartões ficam abertos na faixa sem mexer nesse registro.
  const abertos = cartoes.map(c => c.open);
  let noComputador = null;
  let distancia = 0, larguraJanela = 0, topoTrilho = 92, trilhoFluxo = false, posicoes = [];
  const aberturas = [...document.querySelectorAll('[data-cp-abertura]')].map(no => ({ no, palavras: [...no.querySelectorAll('.cp-palavra')], recortes: [...no.querySelectorAll('[data-cp-revela]')] }));
  const recortes = [...document.querySelectorAll('.cp-atuacao')];
  const figuras = [...document.querySelectorAll('[data-cp-parallax]')];
  const usos = [...document.querySelectorAll('[data-cp-uso]')].map(no => ({ no, numeros: [...no.querySelectorAll('[data-cp-final]')].map(n => ({ no: n, final: Number(n.dataset.cpFinal), casas: Number(n.dataset.cpCasas), sufixo: n.dataset.cpSufixo, original: n.textContent })) }));
  const capitulos = [...document.querySelectorAll('[data-cp-capitulo]')];
  const fundos = [...document.querySelectorAll('[data-cp-fundo]')];
  const dialogo = document.getElementById('media-dialog');
  let ampliacao = null;

  function agendar(g) {
    clearTimeout(g.timer); g.timer = 0;
    if (!ligado || computador.matches || !g.visivel || g.pausado || g.foco || g.mouse || g.video || document.hidden || dialogo?.open) return;
    g.timer = setTimeout(() => escolher(g, (g.passo + 1) % g.telas.length, false), 7000);
  }
  function carregarVideo(v) {
    if (v.pedido || v.falhou) return;
    v.pedido = true; v.video.preload = 'metadata'; v.video.load();
  }
  function conduzirVideo(v) {
    const pode = (ligado || v.manual) && v.visivel && !v.pausado && !document.hidden && !dialogo?.open && !v.falhou;
    if (!pode) { v.video.pause(); return; }
    carregarVideo(v);
    // Toca já, sem esperar os metadados: o navegador começa assim que puder. Se ele recusar, o ícone fica em "continuar".
    if (v.video.paused) v.video.play().catch(() => {});
  }
  function mostrar(g, passo, anunciar = false) {
    anunciar ||= !!g.anunciar;
    g.anunciar = false;
    const total = g.telas.length;
    passo = Math.max(0, Math.min(total - 1, passo));
    if (passo === g.passo && !anunciar) return;
    const antes = document.activeElement;
    const eraTela = g.telas.some(t => t.contains(antes));
    g.passo = passo;
    g.no.dataset.current = String(passo);
    g.no.dataset.cpPasso = String(passo);
    g.cena.dataset.cpPasso = String(passo);
    g.telas.forEach((t, i) => {
      t.classList.toggle('cp-atual', i === passo);
      const link = t.querySelector('.gallery-open');
      if (!ligado) {
        t.hidden = false; t.inert = false; link.inert = false; link.removeAttribute('aria-hidden');
      } else if (computador.matches) {
        t.hidden = false; t.inert = false;
        link.inert = i !== passo || (g.video && !g.video.falhou);
        if (link.inert) link.setAttribute('aria-hidden', 'true'); else link.removeAttribute('aria-hidden');
      } else {
        t.hidden = i !== passo; t.inert = i !== passo; link.inert = false; link.removeAttribute('aria-hidden');
      }
      const imagem = t.querySelector('img');
      if (ligado && i === passo) imagem.loading = 'eager';
    });
    g.pontos.forEach((p, i) => { if (i === passo) p.setAttribute('aria-current', 'true'); else p.removeAttribute('aria-current'); });
    if (anunciar && g.status) g.status.textContent = g.telas[passo].dataset.title + '. Imagem ' + (passo + 1) + ' de ' + total + '.';
    if (eraTela && teclado && ligado && !(g.video && !g.video.falhou)) g.telas[passo].querySelector('.gallery-open').focus({ preventScroll: true });
    if (g.video) {
      const v = g.video;
      estilo(g.no, '--cp-video-de', Math.max(0, passo / total * 100 - 1) + '%');
      estilo(g.no, '--cp-video-ate', Math.min(100, (passo + 1) / total * 100 + 1) + '%');
      v.passo = passo; v.alvo = v.trechos[passo] || 0;
      if (ligado && v.carregado && Number.isFinite(v.video.duration)) v.video.currentTime = Math.min(v.alvo, Math.max(0, v.video.duration - .1));
      conduzirVideo(v);
    }
    if (!computador.matches || g.fluxo) estilo(g.no, '--cp-p', (passo + 1) / total);
    agendar(g);
  }
  function escolher(g, passo, manual = true) {
    passo = (passo + g.telas.length) % g.telas.length;
    if (ligado && computador.matches && !g.fluxo) {
      const r = g.cena.getBoundingClientRect();
      const alvo = r.top + scrollY - g.topo + g.curso * ((passo + .45) / g.telas.length);
      g.anunciar = manual;
      window.scrollTo({ top: alvo, behavior: 'instant' });
      pedir();
    } else mostrar(g, passo, manual);
  }
  async function imagemAmpliada(g, passo) {
    if (!dialogo) return;
    const t = g.telas[passo], link = t.querySelector('.gallery-open'), imagem = document.getElementById('media-dialog-image');
    document.getElementById('media-dialog-title').textContent = t.dataset.title;
    document.getElementById('media-dialog-description').textContent = t.dataset.description;
    document.getElementById('media-dialog-original').href = link.href;
    // Enquanto a imagem nova carrega, a anterior não fica à vista com o título novo; se ela falhar, aparece o aviso de erro.
    imagem.hidden = true; document.getElementById('media-dialog-error').hidden = true;
    const nova = new Image(); nova.src = link.href;
    try { await nova.decode(); } catch {
      if (dialogo.open && ampliacao?.g === g && ampliacao?.passo === passo) { imagem.removeAttribute('src'); document.getElementById('media-dialog-error').hidden = false; }
      return;
    }
    if (!dialogo.open || ampliacao?.g !== g || ampliacao?.passo !== passo) return;
    imagem.src = link.href; imagem.alt = t.dataset.description;
    imagem.width = nova.naturalWidth; imagem.height = nova.naturalHeight; imagem.hidden = false;
    document.getElementById('media-dialog-error').hidden = true;
  }
  galerias.forEach(g => {
    g.pontos.forEach(b => b.addEventListener('click', () => escolher(g, Number(b.dataset.gallerySelect)), { passive: true }));
    g.no.querySelector('[data-gallery-prev]').addEventListener('click', () => escolher(g, g.passo - 1), { passive: true });
    g.no.querySelector('[data-gallery-next]').addEventListener('click', () => escolher(g, g.passo + 1), { passive: true });
    g.pausa?.addEventListener('click', () => {
      g.pausado = !g.pausado;
      g.pausa.textContent = g.pausado ? 'Retomar' : 'Pausar';
      g.pausa.setAttribute('aria-pressed', String(g.pausado));
      g.pausa.setAttribute('aria-label', g.pausado ? 'Retomar troca automática de imagens' : 'Pausar troca automática de imagens');
      g.no.dataset.paused = String(g.pausado); agendar(g);
    }, { passive: true });
    g.no.addEventListener('focusin', e => { g.foco = teclado && e.target.matches(':focus-visible'); agendar(g); }, { passive: true });
    g.no.addEventListener('focusout', e => { if (!g.no.contains(e.relatedTarget)) { g.foco = false; agendar(g); } }, { passive: true });
    g.no.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { g.mouse = true; agendar(g); } }, { passive: true });
    g.no.addEventListener('pointerleave', () => { g.mouse = false; agendar(g); }, { passive: true });
    g.telas.forEach((t, passo) => t.querySelector('.gallery-open').addEventListener('click', e => {
      if (!dialogo || typeof dialogo.showModal !== 'function' || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      ampliacao = { g, passo, origem: e.currentTarget };
      dialogo.classList.remove('is-zoomed');
      // Como no controlador das galerias: a ampliação abre ajustada à tela, com o botão de zoom no estado inicial.
      const zoom = document.getElementById('media-dialog-zoom');
      if (zoom) { zoom.setAttribute('aria-pressed', 'false'); zoom.textContent = 'Tamanho real'; }
      dialogo.showModal();
      imagemAmpliada(g, passo);
      videos.forEach(conduzirVideo); galerias.forEach(agendar);
    }));
  });
  if (dialogo) {
    fecharDialogo = () => {
      const origem = ampliacao?.origem;
      ampliacao = null; origem?.focus({ preventScroll: true });
      videos.forEach(conduzirVideo); galerias.forEach(agendar);
    };
    dialogo.addEventListener('close', fecharDialogo, { passive: true });
    ['prev', 'next'].forEach((direcao, i) => document.getElementById('media-dialog-' + direcao)?.addEventListener('click', () => {
      if (!ampliacao) return;
      const { g } = ampliacao;
      ampliacao.passo = (ampliacao.passo + (i ? 1 : -1) + g.telas.length) % g.telas.length;
      imagemAmpliada(g, ampliacao.passo);
    }, { passive: true }));
  }

  function configurar() {
    raiz.classList.add('cp-base');
    raiz.classList.toggle('cp-pronto', ligado);
    raiz.classList.toggle('cp-nativo', ligado && nativo);
    raiz.classList.toggle('cp-reserva', ligado && !nativo);
    if (trilho) { trilho.removeAttribute('data-cp-fluxo'); trilhoFluxo = false; }
    const faixaAberta = ligado && computador.matches;
    // Ao sair do celular para o computador, guarda as linhas que o visitante abriu ou fechou, para elas voltarem assim.
    if (faixaAberta && noComputador === false) cartoes.forEach((c, i) => { abertos[i] = c.open; });
    cartoes.forEach((c, i) => { c.open = faixaAberta ? true : abertos[i]; c.classList.remove('cp-focado'); });
    noComputador = faixaAberta;
    galerias.forEach(g => {
      g.cena.removeAttribute('data-cp-fluxo'); g.fluxo = false;
      g.controles.hidden = !ligado;
      g.no.classList.toggle('is-enhanced', ligado && !computador.matches);
      if (g.pausa) {
        g.pausa.hidden = !ligado || computador.matches || !!g.video;
        g.pausa.textContent = g.pausado ? 'Retomar' : 'Pausar';
        g.pausa.setAttribute('aria-pressed', String(g.pausado));
        g.pausa.setAttribute('aria-label', g.pausado ? 'Retomar troca automática de imagens' : 'Pausar troca automática de imagens');
      }
      g.no.dataset.paused = String(!ligado || computador.matches || g.pausado || !!g.video);
      const atual = g.passo < 0 ? 0 : g.passo; g.passo = -1; mostrar(g, atual);
    });
    videos.forEach(v => {
      // Com JavaScript, sem os controles nativos (e sem o botão grande de reproduzir): o próprio quadro do vídeo é o
      // controle de pausar e continuar.
      // A pausa escolhida pelo visitante (v.pausado) continua valendo quando o layout muda, por exemplo ao girar o celular e
      // passar de 761 px: esta função roda de novo nessas mudanças e não zera essa escolha.
      v.video.controls = false;
      conduzirVideo(v);
    });
    document.querySelectorAll('.section-space,.platform-lead,.platform-hero h1').forEach(no => {
      no.getAnimations().filter(a => a.timeline === document.timeline).forEach(a => a.cancel());
    });
    pedir(true);
    requestAnimationFrame(alinharEndereco);
  }
  function medirTudo() {
    const cabecalho = document.querySelector('.site-header').getBoundingClientRect().height;
    const topo = cabecalho + 16, disponivel = innerHeight - topo - 24;
    // Primeiro todas as medidas, depois todas as escritas.
    const cenas = galerias.map(g => {
      const viewport = g.no.querySelector('.gallery-viewport'), r = viewport.getBoundingClientRect();
      const colunas = getComputedStyle(viewport).gridTemplateColumns.split(' ').map(parseFloat);
      const largura = computador.matches ? colunas[colunas.length - 1] || r.width * .67 : r.width;
      const legendas = g.telas.map(t => t.querySelector('figcaption').getBoundingClientRect().height).reduce((a, b) => a + b, 0);
      const atual = g.palco.getBoundingClientRect().height;
      const media = Math.max(140, Math.min(largura * 9 / 16, disponivel - (atual - r.height)));
      const altura = atual - r.height + Math.max(media, legendas);
      return { g, largura, media, altura, fluxo: computador.matches && altura > disponivel + 1 };
    });
    const faixaDados = faixa ? { largura: janela.getBoundingClientRect().width - 8, total: faixa.scrollWidth,
      altura: janela.getBoundingClientRect().height,
      posicoes: cartoes.map(c => ({ esquerda: c.offsetLeft, largura: c.offsetWidth })),
      // O que vem depois do trilho (a área seguinte e o rodapé), sem a folga que esta mesma conta já pôs.
      depois: document.documentElement.scrollHeight - (trilho.getBoundingClientRect().bottom + scrollY) - (parseFloat(trilho.style.getPropertyValue('--cp-folga')) || 0) } : null;
    cenas.forEach(({ g, largura, media, altura, fluxo }) => {
      g.topo = topo;
      g.fluxo = fluxo;
      g.cena.toggleAttribute('data-cp-fluxo', ligado && fluxo);
      g.curso = g.telas.length * Math.max(380, innerHeight * .72);
      estilo(g.cena, '--cp-topo', topo + 'px');
      estilo(g.cena, '--cp-palco-h', altura + 'px');
      estilo(g.cena, '--cp-altura', (altura + g.curso) + 'px');
      estilo(g.no, '--cp-media-w', largura + 'px'); estilo(g.no, '--cp-media-h', media + 'px');
    });
    if (faixaDados) {
      topoTrilho = topo; larguraJanela = faixaDados.largura;
      distancia = Math.max(0, faixaDados.total - larguraJanela);
      trilhoFluxo = computador.matches && faixaDados.altura > disponivel;
      posicoes = faixaDados.posicoes;
      trilho.toggleAttribute('data-cp-fluxo', ligado && trilhoFluxo);
      estilo(trilho, '--cp-topo', topo + 'px');
      estilo(trilho, '--cp-distancia', distancia + 'px');
      estilo(trilho, '--cp-faixa-h', faixaDados.altura + 'px');
      estilo(trilho, '--cp-trilho-h', (faixaDados.altura + distancia) + 'px');
      // No fim do percurso, a janela presa vai do topo até topo + altura, e a página precisa de conteúdo abaixo dela para a
      // rolagem chegar lá. Em janelas altas entre 761 e uns 1.100 px, a área seguinte e o rodapé eram mais baixos que esse
      // espaço e o último cartão nunca entrava inteiro: a folga completa a diferença.
      estilo(trilho, '--cp-folga', (ligado && computador.matches && !trilhoFluxo ? Math.max(0, Math.ceil(innerHeight - topo - faixaDados.altura - faixaDados.depois)) : 0) + 'px');
      cartoes.forEach((c, i) => {
        const inicio = Math.min(1, (posicoes[i].esquerda - larguraJanela * .9) / Math.max(1, distancia));
        const fim = Math.max(inicio + .005, Math.min(1, (posicoes[i].esquerda - larguraJanela * .45) / Math.max(1, distancia)));
        estilo(c, '--cp-cartao-de', inicio * 100 + '%'); estilo(c, '--cp-cartao-ate', fim * 100 + '%');
      });
    }
  }
  function atualizar() {
    if (!ligado) return;
    const altura = innerHeight;
    // Os retângulos são lidos em lote; nada é medido depois de começar a escrever.
    const cenas = galerias.map(g => ({ g, r: g.cena.getBoundingClientRect() }));
    const rTrilho = trilho?.getBoundingClientRect();
    const rAberturas = !nativo ? aberturas.filter(a => perto.has(a.no)).map(a => ({ a, r: a.no.getBoundingClientRect() })) : [];
    const rRecortes = !nativo ? recortes.filter(n => perto.has(n)).map(n => ({ n, r: n.getBoundingClientRect() })) : [];
    const rFiguras = figuras.filter(n => perto.has(n)).map(n => ({ n, r: n.getBoundingClientRect() }));
    const rUsos = usos.filter(u => perto.has(u.no)).map(u => ({ u, r: u.no.querySelector('.stats-grid').getBoundingClientRect() }));
    const rCapitulos = !nativo ? capitulos.map(n => n.getBoundingClientRect()) : [];
    cenas.forEach(({ g, r }) => {
      if (!computador.matches || g.fluxo) return;
      const p = limita((g.topo - r.top) / Math.max(1, g.curso)), q = p * g.telas.length;
      const passo = Math.min(g.telas.length - 1, Math.floor(q));
      mostrar(g, passo);
      if (!nativo) {
        estilo(g.no, '--cp-p', p.toFixed(5));
        estilo(g.no, '--cp-local', (q - passo).toFixed(5));
        g.telas.forEach((t, i) => {
          const local = limita(q - i), opacidade = i === passo ? 1 : 0;
          estilo(t, '--cp-local', local.toFixed(5)); estilo(t, '--cp-opacidade', opacidade);
        });
      }
    });
    if (rTrilho && computador.matches && !trilhoFluxo) {
      const p = limita((topoTrilho - rTrilho.top) / Math.max(1, distancia));
      trilho.dataset.cpProgresso = p.toFixed(5);
      if (!nativo) {
        estilo(faixa, '--cp-p', p.toFixed(5));
        cartoes.forEach((c, i) => {
          const x = posicoes[i].esquerda - distancia * p;
          estilo(c, '--cp-revelado', limita((larguraJanela * .9 - x) / Math.max(1, larguraJanela * .45)).toFixed(5));
        });
      }
    }
    rAberturas.forEach(({ a, r }) => {
      const entrada = limita((altura - r.top) / Math.max(1, Math.min(altura, r.height)));
      a.palavras.forEach((n, i) => estilo(n, '--cp-revelado', limita((entrada - Math.min(i, 6) * .02) / .36).toFixed(5)));
      a.recortes.forEach(n => estilo(n, '--cp-revelado', limita((entrada - .08) / .45).toFixed(5)));
      estilo(a.no, '--cp-p', limita((altura - r.top) / (altura + r.height)).toFixed(5));
    });
    rRecortes.forEach(({ n, r }) => estilo(n, '--cp-revelado', limita((altura - r.top) / Math.max(1, r.height * .7)).toFixed(5)));
    rFiguras.forEach(({ n, r }) => { if (!nativo || !computador.matches) estilo(n, '--cp-p', limita((altura - r.top) / (altura + r.height)).toFixed(5)); });
    rUsos.forEach(({ u, r }) => {
      const p = limita((altura * .92 - r.top) / Math.max(1, altura * .42));
      u.numeros.forEach(n => {
        const valor = p >= 1 ? n.original : formatar(n.final * p, n.casas) + n.sufixo;
        if (n.no.textContent !== valor) n.no.textContent = valor;
      });
    });
    rCapitulos.forEach((r, i) => estilo(fundos[i], '--cp-luz', Math.min(limita((altura - r.top) / altura), limita(r.bottom / altura)).toFixed(5)));
  }

  function levarCartao(cartao, obrigar = false) {
    if (!ligado || !computador.matches || trilhoFluxo || !distancia) return;
    const i = cartoes.indexOf(cartao), ponto = posicoes[i];
    if (!ponto) return;
    const r = trilho.getBoundingClientRect();
    const p = limita((topoTrilho - r.top) / distancia), x = ponto.esquerda - distancia * p;
    if (!obrigar && x >= 0 && x + ponto.largura <= larguraJanela + 1) return;
    const deslocamento = Math.max(0, Math.min(distancia, ponto.esquerda - (larguraJanela - ponto.largura) / 2));
    window.scrollTo({ top: r.top + scrollY - topoTrilho + deslocamento, behavior: 'instant' });
    pedir();
  }
  function alinharEndereco() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (!id) return;
    const alvo = document.getElementById(id);
    if (!alvo) return;
    const cartao = alvo.matches('.cp-cartao') ? alvo : cartoes.find(c => c.dataset.grupo === id);
    if (cartao && ligado && computador.matches && !trilhoFluxo) levarCartao(cartao, true);
    else if (alvo.matches('.cp-capitulo,.cp-tour,.cp-uso')) alvo.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Tab') teclado = true; }, { passive: true });
  document.addEventListener('pointerdown', () => { teclado = false; }, { passive: true });
  document.addEventListener('focusin', e => {
    if (!teclado || !e.target.matches(':focus-visible')) return;
    const recorte = e.target.closest('.cp-atuacao,.cp-cartao');
    if (recorte) recorte.classList.add('cp-focado');
    const cartao = e.target.closest('.cp-cartao');
    if (cartao) levarCartao(cartao);
  }, { passive: true });
  document.addEventListener('focusout', e => {
    const no = e.target.closest('.cp-focado');
    if (no && !no.contains(e.relatedTarget)) no.classList.remove('cp-focado');
  }, { passive: true });
  cartoes.forEach(c => c.addEventListener('toggle', () => pedir(true), { passive: true }));
  const observador = new IntersectionObserver(entradas => {
    entradas.forEach(e => { if (e.isIntersecting) perto.add(e.target); else perto.delete(e.target); });
    pedir();
  }, { rootMargin: '100% 0px 100% 0px' });
  [...aberturas.map(a => a.no), ...recortes, ...figuras, ...usos.map(u => u.no)].forEach(n => observador.observe(n));
  const midias = new IntersectionObserver(entradas => {
    entradas.forEach(e => {
      const g = galerias.find(g => g.no === e.target);
      if (g) { g.visivel = e.isIntersecting && e.intersectionRatio > .12; agendar(g); }
      const v = videos.find(v => v.video === e.target);
      if (v) {
        v.visivel = e.isIntersecting && e.intersectionRatio > .12;
        if (!v.visivel && !ligado) v.manual = false;
        conduzirVideo(v);
      }
    });
    pedir();
  }, { threshold: [0, .12] });
  galerias.forEach(g => midias.observe(g.no)); videos.forEach(v => midias.observe(v.video));
  if (typeof ResizeObserver === 'function') {
    const tamanhos = new ResizeObserver(() => pedir(true));
    galerias.forEach(g => tamanhos.observe(g.palco));
    if (faixa) tamanhos.observe(faixa);
    tamanhos.observe(document.querySelector('.site-header'));
  }
  addEventListener('scroll', () => pedir(), { passive: true });
  addEventListener('resize', () => {
    if (trilhoFluxo && ligado && computador.matches) { trilho.removeAttribute('data-cp-fluxo'); trilhoFluxo = false; }
    pedir(true);
  }, { passive: true });
  // No computador, os doze cartões já estão abertos: um endereço novo pedido ali (#grupo ou #projeto) fica guardado para o
  // celular, que abre as linhas dele na volta, como a lista faz no celular, sem mexer nas outras escolhas do visitante.
  const guardarEndereco = () => {
    if (!noComputador) return;
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (!id) return;
    const doGrupo = cartoes.some(c => c.dataset.grupo === id);
    cartoes.forEach((c, i) => { if (doGrupo ? c.dataset.grupo === id : c.id === id) abertos[i] = true; });
  };
  addEventListener('hashchange', () => { guardarEndereco(); requestAnimationFrame(alinharEndereco); }, { passive: true });
  addEventListener('pageshow', () => pedir(true), { passive: true });
  document.addEventListener('visibilitychange', () => { videos.forEach(conduzirVideo); galerias.forEach(agendar); pedir(); }, { passive: true });
  addEventListener('pagehide', () => { galerias.forEach(g => clearTimeout(g.timer)); videos.forEach(v => v.video.pause()); }, { passive: true });
  computador.addEventListener('change', configurar, { passive: true });
  document.fonts?.ready.then(() => pedir(true));
  configurar();
})();
