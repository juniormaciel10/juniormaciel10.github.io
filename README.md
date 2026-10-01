# Franklin Júnior Maciel · Portfólio

Site pessoal de automação e orquestração de agentes de IA, publicado em https://juniormaciel10.github.io/.

HTML, CSS e JavaScript, com fontes locais e rolagem nativa. O build minifica CSS/JavaScript por conjunto de fontes: cada página carrega seu tema e páginas com os mesmos recursos compartilham o bundle. Os arquivos recebem hash e formam um pacote estático para o GitHub Pages.

## Páginas

- `/`: apresentação pessoal, três cards com prévias das páginas, qualidades e habilidades, carrossel da área de trabalho, registros, trajetória e contato.
- `/estudos/`: ferramenta de planejamento e resumos, com a identidade e o indicador do portfólio anterior. O bloco de transcrição foi removido; a âncora antiga encaminha para os resumos.
- `/plataforma/`: apresentação anônima de uma plataforma de estudos, com capturas protegidas.
- `/jogos/`: modelagem no Blender, programação em Godot, otimização de modelos 3D e integrações em C#, com galerias e catálogo de exemplos.
- `/projetos/planejamento-de-estudos/` e `/projetos/resumos-de-estudo/`: páginas de aprofundamento, nos endereços já compartilhados.

A abertura de `/jogos/` usa uma captura nativa da versão em Godot do game-two (Expedição 02), registrada em 30/09/2026. A galeria reúne três capturas nativas recortadas em 16:9, com limite de 840 px de largura. A seção de otimização 3D mostra veículos CC BY 4.0 do Sketchfab tratados por um pipeline em Python no Blender; os créditos exigidos pela licença ficam na própria seção. A seleção de modelagem contém Bolsa Metro Grafite, Cabelo Wolf Cut, Óculos Prisma Grafite e Satélite Órbita. Os novos enquadramentos usam a geometria e os materiais dos arquivos 3D originais, criados no Blender e validados localmente em avatar R15. Sua galeria tem limite de 640 px, e as quatro páginas do PDF apresentam a mesma seleção. As imagens de 1600 × 1200 px continuam disponíveis na ampliação. Os projetos externos foram apenas consultados; as fontes e evidências de produção permanecem locais.

As referências visuais das páginas internas orientam dois temas: 3D e programação usa verde escuro e âmbar, com o jogo em Godot antes da modelagem; Plataforma usa superfícies claras e violeta, com tecnologias, galeria e funcionalidades agrupadas. A primeira destaca o jogo, a seleção dos quatro modelos e as práticas em C#; a segunda apresenta a interface e a atuação no projeto. As capturas da plataforma foram feitas em 30/09/2026, no tema escuro padrão, a partir dos arquivos da versão publicada, conferidos por hash, com dados públicos atuais e uma conta fictícia em ambiente isolado. São quatro telas da plataforma e a LP do próprio projeto, em desktop e celular. O logotipo da empresa e os nomes de pessoas estão protegidos nos arquivos; o nome da campanha fica visível. Nenhuma conta real foi acessada. A seção “Em uso.” traz a abertura animada da LP em `assets/video/plataforma-lp-animacao.mp4`, controlada por `assets/js/lp-animation.js` (somente em `/plataforma/`): reproduz uma vez ao entrar na tela, tem botão de pausa e não inicia com movimento reduzido. Os números da seção são totais agregados dos relatórios da campanha.

A proteção inclui a marca decorativa do fundo, retirada de sua camada antes da captura, preservando os textos e controles que ficam à frente. A proteção dos nomes é aplicada depois, nos pixels das imagens. Todas as versões menores partem da captura já tratada.

`assets/js/model-gallery.js` é incluído somente no bundle de `/jogos/`. Ele acompanha a seleção do carrossel para atualizar a ficha e o contador do modelo. As miniaturas, o teclado e a ampliação usam o controlador de galeria existente. Sem essa melhoria, as legendas originais continuam disponíveis. Os modelos usam imagens com transparência na galeria e fundo neutro na ampliação e no PDF. O título de modelagem tem uma coluna dimensionada pela palavra inteira, sem quebra entre suas letras. Os tamanhos públicos anteriores continuam no pacote de compatibilidade.

A inicial preserva a abertura da referência Gabriel V2 em `assets/js/home-opening.js` e `assets/css/home-opening.css`, com o nome e sua animação, sem a legenda abaixo dele. Desenvolvimento full stack aparece como um conhecimento adicional; o método e a atuação descrevem desenvolvimento, implementação, testes e coordenação de agentes. `portfolio.css` reúne navegação, contato e galerias das páginas novas; `home.css`, `platform.css` e `games.css` definem suas composições.

Os acessos a Estudos, Plataforma de estudos e Jogos usam capturas reais das páginas dentro de cards sobre fundo preto, com bordas discretas e setas. Ficam em três colunas no desktop e empilhados no celular. A prévia cresce até ocupar a janela e se tornar a página de destino; o botão Voltar do navegador faz o caminho inverso e restaura a posição anterior.

`assets/js/page-transitions.js` registra os eventos de transição antes da primeira pintura. O build transforma seu `<script data-inline>` em um inicializador compacto no cabeçalho das quatro páginas principais, com limite de 6 KB por documento e tamanho registrado em `earlyJsBytes`. `page-transitions.css` anima os snapshots nativos entre documentos; a página continua com URL, título e histórico próprios. Sem essa API, a imagem se expande antes da navegação. Cliques modificados, ausência de JavaScript e storage indisponível conservam a navegação. Uma interação de leitura encerra a transição nativa imediatamente.

`assets/js/card-previews.js`, carregado de forma adiada somente na inicial, prepara estilos, fontes e imagens principais após intenção por mouse ou teclado. As capturas responsivas estão em `assets/img/portfolio/previews/`. A seção antes chamada “Como eu trabalho” apresenta qualidades e conhecimentos, mantendo as âncoras existentes e os registros de apoio.

A seção Sobre apresenta a biografia em um parágrafo e reúne as informações de apoio em “Áreas de atuação” e “Experiência e formação”. Os controles usam `details`/`summary`, funcionam sem JavaScript e mantêm as âncoras já compartilhadas. As cinco áreas aparecem em uma coluna ao expandir. A altura mínima da seção preserva sua etapa no percurso de Saturno, e o conteúdo cresce livremente quando aberto.

Saturno aparece somente na inicial, depois da segunda dobra: a apresentação do nome e os três cards ficam livres do planeta. `assets/js/saturn-loader.js` posiciona a cena abaixo dos projetos, acompanhando a seção de habilidades enquanto ela entra na tela. O planeta já está preparado na primeira pose; sua chegada acompanha a rolagem, sem um ponto que o faça surgir por mudança de opacidade. Quando o topo das habilidades chega ao topo da janela, o deslocamento de entrada termina e o percurso das seções seguintes continua. A imagem de reserva usa o mesmo posicionamento. A animação pausa quando a cena fica fora da janela. Sem JavaScript, os fundos da apresentação e dos cards cobrem o poster.

`assets/js/saturn-scene.js` define três poses visíveis, com enquadramentos próprios para desktop e celular: habilidades, Sobre e contato. Os estados `inicio` e `projetos` preparam a pose das habilidades antes de ela entrar na tela. Nas seções seguintes, o planeta muda de posição, escala e orientação em cerca de um segundo. Ao chegar, continua com rotação da atmosfera, flutuação e uma leve oscilação do conjunto, com cadência de até 24 quadros por segundo durante a leitura. No contato, o centro horizontal fica fixo no meio da janela, mantendo a composição vinda de baixo. Uma nova seção interrompe o percurso anterior a partir da posição atual. A rolagem continua nativa, e o link do rodapé retorna à abertura sem recarregar a página.

A seleção das poses acompanha a rolagem em um callback passivo, agrupado por quadro, e usa a altura atual da janela, separada da altura estável do canvas. Como o rodapé é curto, a transição final começa quando metade dele fica visível. Isso permite concluir o percurso no centro mesmo parando pouco antes do fim e evita depender de um evento de interseção a 100%, que pode não ocorrer por arredondamento da altura da página. Os testes cobrem passos de roda do mouse, a tecla End, retorno e a imagem renderizada em 390, 1440 e 1916 px.

`assets/js/saturn-model.js` constrói o corpo achatado, os anéis transparentes e a atmosfera, com sombras entre os elementos e texturas procedurais em `assets/img/saturn/`. Os anéis têm transições suaves de densidade e filtragem por mipmaps; a sombra usa derivadas explícitas para amostrar a textura. `saturn.css` mantém o canvas atrás do HTML e protege o contraste com uma sombra ampla. A cena usa três chamadas de desenho, suavização de bordas também no celular e limite de 3 milhões de pixels. O DPR fica limitado a 1,75 no celular e 2 no desktop, sem redução de resolução durante o movimento. A animação pausa em aba oculta, durante a ampliação das fotos e quando a cena é suprimida para impressão ou cores forçadas. Uma imagem de 52 KB permanece disponível sem JavaScript, sem WebGL ou quando o módulo, os materiais ou o contexto gráfico falham, com movimento discreto de reserva. A licença MIT do Three.js acompanha os arquivos.

No WebKit, cada quadro WebGL é copiado para o canvas 2D de apresentação, na mesma tarefa de desenho. Isso evita o desaparecimento do planeta na abertura e após redimensionar a tela; o contexto WebGL e a cena continuam únicos. A cópia acompanha a cadência da animação e suas pausas. Chrome e Edge apresentam o canvas WebGL diretamente para evitar uma leitura síncrona dos pixels a cada quadro. A cena usa a altura estável da janela (`lvh`, com fallback para `vh`), e mudanças de altura preservam o percurso em andamento. Ao abrir os registros do método, o fundo fica mais discreto para proteger os textos pequenos. O poster recebe essa atenuação enquanto não há controlador de poses.

Os carrosséis de `assets/js/portfolio-ui.js` têm seleção, pausa, navegação por teclado, ampliação e tamanho real. A troca automática pausa durante a leitura por mouse/teclado, fora da tela, em aba oculta e com a ampliação aberta. As sete capturas da área de trabalho aparecem da mais recente à mais antiga, conforme a proveniência dos originais. Comandos genéricos de Git e Python, trechos de interface e resultados de verificações ficam legíveis. Nomes de clientes e modelos, contas, caminhos pessoais, identificadores e conteúdo reservado são desfocados nos próprios arquivos. As versões menores, as ampliações e os arquivos de compatibilidade usam os mesmos recortes protegidos. A página da plataforma apresenta o trabalho sem identificar o cliente; suas capturas também protegem a marca e dados de pessoas. Os registros da edição e as cópias de trabalho sem proteção permanecem nos artefatos locais. O build usa os arquivos já tratados.

Na página de Estudos, as entradas em camadas e a profundidade ao ponteiro ficam em `assets/js/motion.js`; transições, folhas em leque e movimento do contato usam `assets/css/motion.css`. Os detalhes têm transições reversíveis e a galeria mantém sua pausa própria.

As animações ficam ativas por padrão, sem botão de ativação, conforme a escolha do autor. A preferência de movimento reduzido do sistema e escolhas antigas salvas no navegador não desligam os efeitos. Galeria e vídeo mantêm seus controles próprios de pausa.

As superfícies de Estudos ficam em `assets/css/surfaces.css`; seus grafismos e percurso luminoso, em `assets/css/backdrops.css` e `assets/js/backdrops.js`. O indicador entra pelo alto, acompanha a rolagem e informa a dobra atual com mouse, teclado ou toque. O movimento pausa fora da área visível ou quando a aba fica oculta; a rolagem permanece nativa.

O percurso usa uma tabela geométrica calculada quando o desenho muda, com subdivisão adaptativa das curvas. A animação reutiliza essa tabela sem consultar a geometria SVG a cada quadro. Leituras de layout precedem as atualizações do desenho, os nós de máscara e gradiente são reutilizados e o conteúdo de detalhes fechados não é medido. Os testes comparam a interpolação com a geometria nativa do navegador.

No celular, a iluminação usa um trecho do SVG limitado à área próxima da tela, com recorte vetorial para proteger os textos. O quadrado responde mais rápido à rolagem, passa atrás das imagens da abertura e das folhas do resumo e percorre a borda do painel de estudos. O foco por teclado o traz à frente. As cores acompanham as superfícies claras, escuras e azuis, também no desktop.

## Desenvolvimento

A apresentação de Saturno tem verificações visuais em Chromium e WebKit, incluindo alta densidade, abertura completa e mudança de orientação da tela.

Requer Node.js 22 ou superior.

```sh
npm ci
npx playwright install chromium webkit
npm run dev
```

A prévia abre em `http://127.0.0.1:4175`. Execute `npm run build` após alterar os arquivos-fonte para atualizar a prévia.

As páginas de projeto ficam em `projetos/`, com as entradas listadas em `scripts/pages.json`. O build compartilha os bundles entre as páginas, resolve as referências relativas e gera `sitemap.xml` e `robots.txt`.

A página do planejador oferece um percurso de 24 segundos pelas seis telas reais, em MP4, com legendas e descrição textual. O vídeo carrega sob demanda e pausa quando sua área é fechada.

## Verificação

```sh
npm run verify
```

A suíte usa o Playwright do projeto e verifica layout responsivo, navegação entre páginas, rolagem, carregamento progressivo, carrosséis, recuperação de erros, downloads, indicador e conteúdo sem JavaScript. O indicador móvel, os novos carrosséis e Saturno também são verificados em WebKit. Os testes de Saturno incluem retorno, rolagem rápida, movimento ambiente com cadência limitada, pausas, redimensionamento até 4K e falhas do módulo, dos materiais e do contexto WebGL. Comparações de pixels confirmam a presença do planeta e a mudança de sua imagem durante a leitura. Há cobertura da abertura, da orientação com DPR 2 e de mudanças de altura durante uma transição. O estado `data-motion="idle"` indica a chegada à pose da seção; a animação ambiente continua. WebKit no Windows não substitui a conferência em um iPhone físico.

O JavaScript de Estudos conserva os limites de 38 KB minificados e 13,5 KB comprimidos; a interface da inicial tem limite de 18 KB e os dois novos casos, de 12 KB. O módulo 3D tem orçamento separado de 560 KB minificados e 145 KB com gzip, e não é solicitado pelas páginas internas. Relatórios ficam em `playwright-report/` e evidências em `test-results/`.

Para executar contra o site publicado, configure a variável `SITE_URL`. Os testes usam somente os arquivos e o ambiente deste projeto.

```sh
npm run audit
```

O Lighthouse usa a prévia já aberta e salva os relatórios em `artifacts/`. É possível informar outra URL após `--`.

## Publicação

O código-fonte fica em `main`; o pacote compilado de `dist/` é publicado em `gh-pages`. Fontes, capturas completas, PDF e DOCX continuam acessíveis; as imagens principais usam WebP e as capturas originais continuam disponíveis. Arquivos de desenvolvimento não são incluídos no site.

A publicação requer Git e GitHub CLI autenticados, com acesso de escrita ao repositório e à configuração do GitHub Pages. Não exige permissão para criar workflows.

Depois de revisar e commitar as alterações:

```sh
npm run publish:site
```

O comando gera o build, executa os testes, confere a integridade do pacote e envia `main` e `gh-pages`, sem sobrescrever o histórico remoto. Também configura o GitHub Pages para servir `gh-pages`. O GitHub conclui a atualização do endereço público após receber o pacote.

`dist/assets/build.json` e `dist/manifest.json` são gerados automaticamente a partir do commit, sem informações técnicas no rodapé e sem um segundo commit manual. O campo `pages` do build registra os bundles de cada página, incluindo `modules` para carregamento separado; `css` e `js` continuam apontando para a interface da inicial. O diretório temporário de publicação é removido ao final.

## Estrutura

- `index.html`, `estudos/`, `plataforma/` e `jogos/`: páginas principais.
- `assets/`: estilos, comportamento, fontes e mídia.
- `projetos/`: páginas de apresentação dos principais trabalhos.
- `scripts/`: build, prévia, auditoria e publicação.
- `tests/`: verificações de interface e funcionamento.
- `dist/`: saída gerada, não versionada.

Ícones Tabler sob licença MIT, incorporada no HTML. As fontes incluem documentação de origem e licença em `assets/fonts/`. `scripts/public-assets.json` preserva URLs de arquivos públicos e os bundles da versão anterior para visitantes com a página em cache. Os bundles anteriores conservam os avisos de GSAP e Lenis.
