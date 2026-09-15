# Franklin Junior Maciel · Portfólio

Site pessoal de automação e orquestração de agentes de IA, publicado em https://juniormaciel10.github.io/.

HTML, CSS e JavaScript, com fontes locais, animações em CSS e rolagem nativa. O build reúne e minifica CSS/JavaScript, identifica os arquivos por hash e gera um pacote estático para o GitHub Pages.

As entradas em camadas e a profundidade ao ponteiro ficam em `assets/js/motion.js`; transições, folhas em leque e movimento do contato usam `assets/css/motion.css`. A preferência de movimento reduzido do sistema é respeitada, inclusive quando muda durante a visita. Os detalhes têm transições reversíveis e a galeria mantém sua pausa própria.

## Desenvolvimento

Requer Node.js 22 ou superior.

```sh
npm ci
npx playwright install chromium
npm run dev
```

A prévia abre em `http://127.0.0.1:4175`. Execute `npm run build` após alterar os arquivos-fonte para atualizar a prévia.

As páginas de projeto ficam em `projetos/`, com as entradas listadas em `scripts/pages.json`. O build compartilha os bundles entre as páginas, resolve as referências relativas e gera `sitemap.xml` e `robots.txt`.

A página do planejador oferece um percurso de 24 segundos pelas seis telas reais, em MP4, com legendas e descrição textual. O vídeo carrega sob demanda e pausa quando sua área é fechada.

## Verificação

```sh
npm run verify
```

A suíte usa o próprio Playwright do projeto e verifica layout responsivo, navegação, rolagem, carregamento progressivo, galeria, recuperação de erros, downloads e conteúdo sem JavaScript. Relatórios ficam em `playwright-report/` e evidências em `test-results/`.

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

`dist/assets/build.json` e `dist/manifest.json` são gerados automaticamente a partir do commit, sem informações técnicas no rodapé e sem um segundo commit manual. O diretório temporário de publicação é removido ao final.

## Estrutura

- `index.html` e `assets/`: conteúdo, estilos, comportamento e mídia.
- `projetos/`: páginas de apresentação dos principais trabalhos.
- `scripts/`: build, prévia, auditoria e publicação.
- `tests/`: verificações de interface e funcionamento.
- `dist/`: saída gerada, não versionada.

Ícones Tabler sob licença MIT, incorporada no HTML. As fontes incluem documentação de origem e licença em `assets/fonts/`. `scripts/public-assets.json` preserva URLs de arquivos públicos e os bundles da versão anterior para visitantes com a página em cache. Os bundles anteriores conservam os avisos de GSAP e Lenis.
