const {test,expect}=require('@playwright/test');
const crypto=require('node:crypto');
const {gzipSync}=require('node:zlib');
const routes=['/','/plataforma/','/jogos/'];
async function visit(page,route='/',width=1440){
 await page.setViewportSize({width,height:960});
 await page.goto(route);
 await page.evaluate(()=>document.fonts.ready);
 await expect(page.locator('body')).toHaveClass(/\bjs\b/);
 await page.keyboard.press('Shift');
}
for(const route of routes)for(const width of [320,390,1024,1440])test('Página '+route+' mantém leitura e navegação em '+width+'px',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await visit(page,route,width);
 await expect(page.locator('h1')).toBeVisible();
 await expect(page.locator('#main-nav a').filter({hasText:/^Início$/})).toHaveJSProperty('pathname','/');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const heading of await page.locator('main h2').all()){
  if(!await heading.isVisible())continue;
  await heading.scrollIntoViewIfNeeded();
  const box=await heading.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(-1);expect(box.x+box.width).toBeLessThanOrEqual(width+1);
 }
 await expect(page.locator('#contato')).toBeVisible();
 const ids=await page.locator('[id]').evaluateAll(es=>es.map(e=>e.id));
 expect(new Set(ids).size).toBe(ids.length);
 expect(await page.locator('a[href]').evaluateAll(es=>es.filter(e=>e.origin===location.origin&&e.pathname===location.pathname&&e.hash.length>1&&!document.getElementById(decodeURIComponent(e.hash.slice(1)))).map(e=>e.href))).toEqual([]);
 expect(errors).toEqual([]);
 expect(await page.locator('.site-header').evaluate(el=>el.getBoundingClientRect().height)).toBeLessThanOrEqual(80);
});

test('Três banners levam às áreas e o método conserva suas etapas e registros',async({page})=>{
 await visit(page);
 expect(await page.locator('.destination-grid>a').evaluateAll(es=>es.map(e=>e.getAttribute('href')))).toEqual(['estudos/','plataforma/','jogos/']);
 for(const link of await page.locator('.destination-grid>a,.brand').all()){
  const visible=(await link.innerText()).replace(/\s+/g,' ').trim();
  await expect(link).toHaveAccessibleName(visible);
 }
 await expect(page.locator('#workspace-gallery [data-gallery-slide]')).toHaveCount(7);
 await page.locator('#metodo-detalhes>summary').click();
 expect(await page.locator('.metodo-passos h4').allTextContents()).toEqual(['Delimitar.','Distribuir.','Supervisionar.','Verificar.','Revisar.','Aprovar e registrar.']);
 await expect(page.locator('#registro-subagentes')).toBeVisible();
 await expect(page.locator('#registro-supervisao')).toBeVisible();
 await expect(page.locator('#registro-validacao')).toBeVisible();
 await expect(page.locator('#p-instagram')).toHaveCount(1);
 await expect(page.locator('#p-copy')).toHaveCount(1);
});

test('O carrossel dos terminais permite selecionar, ampliar, ler em tamanho real e recuperar o foco',async({page})=>{
 await visit(page,'/',390);
 const gallery=page.locator('#workspace-gallery');
 await gallery.scrollIntoViewIfNeeded();
 await gallery.locator('[data-gallery-pause]').click();
 await expect(gallery).toHaveAttribute('data-paused','true');
 await expect(gallery.locator('[data-gallery-slide]:not([hidden]) .gallery-open')).toHaveAttribute('href',/trabalho-02\.webp$/);
 await gallery.locator('[data-gallery-next]').click();
 await expect(gallery).toHaveAttribute('data-current','1');
 await gallery.locator('[data-gallery-slide]:not([hidden]) .gallery-open').click();
 const dialog=page.locator('#media-dialog');
 await expect(dialog).toBeVisible();
 await expect(dialog).not.toHaveAttribute('aria-busy');
 await expect(page.locator('#media-dialog-image')).toHaveAttribute('src',/trabalho-01\.webp$/);
 await page.locator('#media-dialog-next').click();
 await expect(page.locator('#media-dialog-image')).toHaveAttribute('src',/trabalho-06\.webp$/);
 await page.locator('#media-dialog-zoom').click();
 await expect(dialog).toHaveClass(/is-zoomed/);
 expect(await page.locator('#media-dialog-image').evaluate(img=>Math.round(img.getBoundingClientRect().width)===img.naturalWidth)).toBe(true);
 await page.keyboard.press('Escape');
 await expect(dialog).not.toBeVisible();
 await expect(gallery.locator('[data-gallery-slide]:not([hidden]) .gallery-open')).toBeFocused();
 await expect(gallery).toHaveAttribute('data-paused','true');
 await gallery.locator('[data-gallery-slide]:not([hidden]) .gallery-open').click();
 await expect(page.locator('#media-dialog-zoom')).toHaveText('Tamanho real');
 await expect(dialog).not.toHaveClass(/is-zoomed/);
 await page.keyboard.press('Escape');
});

test('Seleção rápida conserva a última escolha e falha de imagem mantém a captura anterior',async({page})=>{
 await page.route('**/trabalho-06*.webp',route=>route.abort('failed'));
 await page.route('**/trabalho-03*.webp',async route=>{await new Promise(resolve=>setTimeout(resolve,500));await route.continue()});
 await visit(page);
 const gallery=page.locator('#workspace-gallery');
 await gallery.scrollIntoViewIfNeeded();
 await gallery.locator('[data-gallery-pause]').click();
 await gallery.locator('[data-gallery-select="2"]').click();
 await expect(gallery.locator('[data-gallery-status]')).toContainText('Não foi possível');
 await expect(gallery).toHaveAttribute('data-current','0');
 await gallery.locator('[data-gallery-select="3"]').click();
 await gallery.locator('[data-gallery-select="4"]').click();
 await expect(gallery).toHaveAttribute('data-current','4');
 await page.waitForTimeout(600);
 await expect(gallery).toHaveAttribute('data-current','4');
 await expect(gallery).not.toHaveAttribute('aria-busy');
});

test('Troca automática respeita pausa manual e saída da área visível',async({page})=>{
 await visit(page);
 const gallery=page.locator('#workspace-gallery');
 await gallery.scrollIntoViewIfNeeded();
 await expect(gallery).toHaveAttribute('data-visible','true');
 await gallery.evaluate(e=>e.dataset.interval='300');
 await page.mouse.move(0,0);
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await expect.poll(()=>gallery.getAttribute('data-current')).not.toBe('0');
 await gallery.locator('[data-gallery-pause]').click();
 const paused=await gallery.getAttribute('data-current');
 await page.waitForTimeout(800);
 await expect(gallery).toHaveAttribute('data-current',paused);
 await page.locator('h1').scrollIntoViewIfNeeded();
 await expect(gallery).toHaveAttribute('data-visible','false');
 await expect(gallery).toHaveAttribute('data-paused','true');
});

test('Galerias da plataforma e de modelagem usam imagens reais e mantêm ações independentes',async({page,request})=>{
 await visit(page,'/plataforma/',390);
 const platform=page.locator('#platform-gallery');
 await expect(platform.locator('[data-gallery-slide]')).toHaveCount(4);
 await platform.scrollIntoViewIfNeeded();
 await platform.locator('[data-gallery-select="1"]').click();
 await expect(platform).toHaveAttribute('data-current','1');
 await expect.poll(()=>platform.locator('[data-gallery-slide]:not([hidden]) img').evaluate(img=>img.currentSrc)).toMatch(/plataforma-aulas-mobile\.webp$/);
 await visit(page,'/jogos/');
 const roblox=page.locator('#roblox-gallery'),game=page.locator('#gametwo-gallery');
 await expect(roblox.locator('[data-gallery-slide]')).toHaveCount(4);
 await expect(game.locator('[data-gallery-slide]')).toHaveCount(3);
 await game.locator('[data-gallery-pause]').focus();await page.keyboard.press('Enter');
 await expect(game).toHaveAttribute('data-paused','true');
 await game.locator('[data-gallery-select="1"]').click();
 await expect(game).toHaveAttribute('data-current','1');
 const modelFrame=await roblox.locator('[data-gallery-slide]:not([hidden]) picture').boundingBox();
 const gameFrame=await game.locator('[data-gallery-slide]:not([hidden]) picture').boundingBox();
 expect(modelFrame.width).toBeLessThanOrEqual(640);expect(modelFrame.height).toBeLessThanOrEqual(480);
 expect(gameFrame.width).toBeLessThanOrEqual(840);expect(gameFrame.height).toBeLessThanOrEqual(473);
 await roblox.locator('[data-gallery-select="2"]').click();
 await expect(roblox).toHaveAttribute('data-current','2');
 await expect(game).toHaveAttribute('data-current','1');
 const pdf=await request.get('/assets/downloads/portfolio-modelagem-3d.pdf');
 expect(pdf.status()).toBe(200);expect(pdf.headers()['content-type']).toContain('application/pdf');
 await expect(page.locator('#p-gametwo')).toContainText('em parceria com Gabriel');
 await expect(page.locator('#p-govoice')).toContainText(/em desenvolvimento/i);
});

test('Cada tema tem bundle próprio e as seis páginas mantêm metadados e pacote íntegro',async({page,request})=>{
 const manifest=await(await request.get('/manifest.json')).json();
 const build=await(await request.get('/assets/build.json')).json();
 expect(Object.keys(build.pages)).toHaveLength(6);
 expect(new Set(['index.html','estudos/index.html','plataforma/index.html','jogos/index.html'].map(key=>build.pages[key].css)).size).toBe(4);
 expect(build.pages['plataforma/index.html'].js).not.toBe(build.pages['jogos/index.html'].js);
 for(const route of routes){
  await visit(page,route);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://juniormaciel10.github.io'+route);
  const files=await page.locator('link[rel="stylesheet"],script[src]').evaluateAll(es=>es.map(e=>new URL(e.href||e.src).pathname.slice(1)));
  expect(files).toHaveLength(2);
  for(const file of files){
   const response=await request.get('/'+file);expect(response.status()).toBe(200);
   const data=await response.body();expect(crypto.createHash('sha256').update(data).digest('hex')).toBe(manifest.files[file].sha256);
   if(file.endsWith('.js')){expect(data.length).toBeLessThan(route==='/'?18000:12000);expect(gzipSync(data).length).toBeLessThan(6500)}
  }
  const schema=JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect((schema.mainEntity||schema.author).name).toBe('Franklin Júnior Maciel');
 }
 const sitemap=await(await request.get('/sitemap.xml')).text();
 for(const route of [...routes,'/estudos/','/projetos/planejamento-de-estudos/','/projetos/resumos-de-estudo/'])expect(sitemap).toContain('https://juniormaciel10.github.io'+route);
 expect(Object.keys(manifest.files).some(file=>/^(?:portfolio-linkedin|artifacts|scripts|tests|node_modules)\//.test(file))).toBe(false);
});

test('Âncoras já compartilhadas levam aos projetos e abrem os detalhes',async({page})=>{
 for(const [hash,destination] of [['#p-ciclo','/estudos/#p-ciclo'],['#resumo-detalhes','/estudos/#resumo-detalhes'],['#p-gametwo','/jogos/#p-gametwo']]){
  await page.goto('/'+hash);await expect(page).toHaveURL(new RegExp(destination+'$'));
  await expect(page.locator(hash)).toBeInViewport();
 }
 await expect(page.locator('#p-gametwo')).toContainText('game-two');
});

test('Menu móvel, destino por teclado e cópia do e-mail funcionam na inicial',async({page})=>{
 await visit(page,'/',390);
 const menu=page.locator('.menu-toggle');
 await menu.click();await expect(page.locator('#main-nav')).toHaveJSProperty('inert',false);
 await page.keyboard.press('Escape');await expect(menu).toBeFocused();
 await menu.click();await page.locator('#main-nav a[href="#metodo"]').click();
 await expect(page.locator('#metodo')).toBeFocused();
 await expect(menu).toHaveAttribute('aria-expanded','false');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.copiedEmail=text}}));
 await page.locator('[data-copy-email]').click();
 await expect(page.locator('[data-copy-email]')).toHaveText('E-mail copiado');
 expect(await page.evaluate(()=>window.copiedEmail)).toBe('jrmaciell92@gmail.com');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('unavailable')}}}));
 await page.locator('[data-copy-email]').click();
 await expect(page.locator('[data-copy-status]')).toBeVisible();
 await expect(page.locator('[data-copy-status]')).toContainText('Não foi possível');
});

for(const route of routes)test('Sem JavaScript: conteúdo, navegação e imagens em '+route,async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,javaScriptEnabled:false,viewport:{width:390,height:844}});
 const page=await context.newPage();
 try{
  await page.goto(route);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('#main-nav')).toBeVisible();
  await expect(page.locator('.menu-toggle')).not.toBeVisible();
  await expect(page.locator('[data-gallery-controls]').first()).not.toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('[data-gallery-slide]:not([hidden])').count()).toBeGreaterThan(1);
  const target=route==='/'?'#metodo':route==='/jogos/'?'#roblox':'#por-dentro';
  await page.locator('a[href="'+target+'"]').first().click();
  expect((await page.locator(target).boundingBox()).y).toBeGreaterThanOrEqual(-1);
  expect((await page.locator('.site-header').boundingBox()).y).toBeLessThan(0);
 }finally{await context.close()}
});

test('Abertura mantém a sequência e a interação libera a leitura imediatamente',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');
 await expect(page.locator('html')).toHaveAttribute('data-motion','full');
 await expect(page.locator('html')).toHaveAttribute('data-intro','playing');
 await expect(page.locator('[data-opening-name]')).toHaveCSS('opacity','0');
 await page.keyboard.press('Tab');
 await expect(page.locator('html')).toHaveAttribute('data-intro','complete');
 await expect(page.locator('[data-opening-name]')).toHaveCSS('opacity','1');
 await expect(page.locator('.skip-link')).toBeFocused();
 await expect(page.locator('#motion-toggle,.motion-control')).toHaveCount(0);
});

test('Falha do JavaScript conserva a abertura, o menu e os links das fotos',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/assets/js/site.*.js',route=>route.abort('failed'));
 await page.goto('/');
 await expect(page.locator('h1')).toBeVisible();
 await expect(page.locator('#main-nav')).toBeVisible();
 await expect(page.locator('.menu-toggle')).not.toBeVisible();
 await expect(page.locator('#workspace-gallery .gallery-open')).toHaveCount(7);
});
