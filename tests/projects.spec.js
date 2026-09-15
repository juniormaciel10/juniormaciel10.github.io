const {test,expect}=require('@playwright/test');
const crypto=require('node:crypto');
const routes=['/projetos/planejamento-de-estudos/','/projetos/resumos-de-estudo/'];
const problems=new WeakMap();
test.beforeEach(async({page})=>{const errors=[];problems.set(page,errors);page.on('pageerror',e=>errors.push(e.message))});
test.afterEach(async({page})=>{expect(problems.get(page)).toEqual([])});
async function visit(page,route,width=1440){await page.setViewportSize({width,height:960});await page.goto(route);await page.evaluate(()=>document.fonts.ready);await expect(page.locator('body')).toHaveClass(/\bjs\b/)}

for(const route of routes)for(const width of [320,390,768,1024,1440,1920])test('Projeto '+route+' em '+width+'px',async({page},info)=>{
 await visit(page,route,width);await expect(page.locator('h1')).toHaveCount(1);await expect(page.locator('.case-cover img')).toBeVisible();
 expect(await page.locator('.case-cover img').evaluate(e=>e.naturalWidth)).toBeGreaterThan(0);
 await page.screenshot({path:info.outputPath('abertura.png')});
 for(const heading of await page.locator('main h1,main h2,.case-facts,.case-next').all()){
  await heading.scrollIntoViewIfNeeded({timeout:8000});await expect(heading).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const box=await heading.boundingBox();expect(box.x).toBeGreaterThanOrEqual(-1);expect(box.x+box.width).toBeLessThanOrEqual(width+1);
 }
 const ids=await page.locator('[id]').evaluateAll(es=>es.map(e=>e.id));expect(new Set(ids).size).toBe(ids.length);
 expect(await page.locator('a[href^="#"]').evaluateAll(es=>es.map(e=>e.hash).filter(hash=>!document.getElementById(hash.slice(1))))).toEqual([]);
 expect(await page.locator('.button,.case-next>a,.case-breadcrumb>a').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height>=44))).toBe(true);
 await page.screenshot({path:info.outputPath('pagina.png'),fullPage:true});
});

test('Páginas compartilham bundles íntegros, canonical e sitemap',async({page,request,baseURL})=>{
 const manifest=await(await request.get('/manifest.json')).json();
 let bundles;
 for(const route of routes){
  await visit(page,route);await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://juniormaciel10.github.io'+route);
  const schema=JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());expect(schema['@type']).toBe('WebPage');expect(schema.author.name).toBe('Franklin Junior Maciel');
  const files=await page.locator('link[rel="stylesheet"],script[src]').evaluateAll(es=>es.map(e=>new URL(e.href||e.src).pathname.slice(1)));
  expect(files).toHaveLength(2);if(bundles)expect(files).toEqual(bundles);else bundles=files;
  for(const file of files){const response=await request.get('/'+file);expect(response.status()).toBe(200);expect(crypto.createHash('sha256').update(await response.body()).digest('hex')).toBe(manifest.files[file].sha256)}
  const redirect=await request.get(route.slice(0,-1),{maxRedirects:0});expect([301,308]).toContain(redirect.status());expect(new URL(redirect.headers().location,baseURL).pathname).toBe(route);
 }
 const sitemap=await request.get('/sitemap.xml');expect(sitemap.status()).toBe(200);expect(sitemap.headers()['content-type']).toContain('xml');
 for(const route of routes)expect(await sitemap.text()).toContain('https://juniormaciel10.github.io'+route);
 expect(await(await request.get('/robots.txt')).text()).toContain('Sitemap: https://juniormaciel10.github.io/sitemap.xml');
 expect((await request.get('/scripts/pages.json')).status()).toBe(404);
});

test('Navegação entre os projetos, menu por teclado e download da amostra',async({page})=>{
 await visit(page,routes[0],390);await page.locator('.menu-toggle').focus();await page.keyboard.press('Space');await expect(page.locator('#main-nav')).toHaveJSProperty('inert',false);
 await page.keyboard.press('Tab');await expect(page.locator('#main-nav>a').first()).toBeFocused();await page.keyboard.press('Escape');await expect(page.locator('.menu-toggle')).toBeFocused();await expect(page.locator('#main-nav')).toHaveJSProperty('inert',true);
 await page.locator('.case-next>a').click();await expect(page).toHaveURL(new RegExp(routes[1]+'$'));await expect(page.locator('h1')).toHaveText('Da aulaao resumo.');
 const download=page.waitForEvent('download');await page.locator('a[download]').first().click();expect((await download).suggestedFilename()).toBe('Resumo-Inteligencia-Artificial.docx');
 await page.locator('.case-breadcrumb>a').click();await expect(page).toHaveURL(/\/#projetos$/);await expect(page.locator('#projetos')).toBeInViewport();
});

test('Galeria na página do planejador conserva seleção, modal e foco',async({page})=>{
 await visit(page,routes[0],390);await page.locator('#gallery-pause').click();await page.locator('[data-slide="4"]').click();await expect(page.locator('#software-gallery')).toHaveAttribute('data-current','4');
 await page.locator('#gallery-expand').click();await expect(page.locator('#gallery-dialog')).toBeVisible();await page.keyboard.press('ArrowRight');await expect(page.locator('#software-gallery')).toHaveAttribute('data-current','5');await page.keyboard.press('Escape');await expect(page.locator('#gallery-expand')).toBeFocused();
});

test('O percurso de 24 segundos carrega sob demanda, toca e pausa ao fechar',async({page,request})=>{
 const videos=[];page.on('request',request=>{if(request.url().endsWith('planejamento-percurso.mp4'))videos.push(request.url())});
 await visit(page,routes[0],390);expect(videos).toEqual([]);
 await page.locator('#percurso>summary').click();const video=page.locator('#project-video');await expect(video).toBeVisible();await expect(video).toHaveJSProperty('controls',true);await expect(video).toHaveJSProperty('autoplay',false);
 await video.evaluate(e=>e.play());await expect.poll(()=>video.evaluate(e=>e.currentTime)).toBeGreaterThan(.1);
 const duration=await video.evaluate(e=>e.duration);expect(duration).toBeGreaterThan(23.8);expect(duration).toBeLessThan(24.2);
 await video.evaluate(e=>{e.textTracks[0].mode='showing';e.currentTime=16.2});
 await expect.poll(()=>video.evaluate(e=>e.currentTime)).toBeGreaterThan(16);
 await expect.poll(()=>video.evaluate(e=>e.textTracks[0].activeCues?.[0]?.text||'')).toContain('Tarefas');
 await page.locator('#percurso>summary').click();await expect(video).toHaveJSProperty('paused',true);
 expect(videos.length).toBeGreaterThan(0);
 const captions=await request.get('/assets/video/planejamento-percurso.vtt');expect(captions.status()).toBe(200);expect(captions.headers()['content-type']).toContain('text/vtt');expect(await captions.text()).toContain('00:20.000 --> 00:24.000');
});

test('Servidor atende intervalos do vídeo e rejeita intervalos fora do arquivo',async({request})=>{
 const url='/assets/video/planejamento-percurso.mp4',full=await(await request.get(url)).body();
 const first=await request.get(url,{headers:{Range:'bytes=0-31'}});expect(first.status()).toBe(206);expect(first.headers()['content-range']).toBe('bytes 0-31/'+full.length);expect(await first.body()).toEqual(full.subarray(0,32));
 const suffix=await request.get(url,{headers:{Range:'bytes=-16'}});expect(suffix.status()).toBe(206);expect(await suffix.body()).toEqual(full.subarray(-16));
 const invalid=await request.get(url,{headers:{Range:'bytes='+full.length+'-'}});expect(invalid.status()).toBe(416);
});

for(const route of routes)test('Sem JavaScript: projeto completo em '+route,async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,javaScriptEnabled:false,viewport:{width:390,height:844}}),page=await context.newPage();
 try{await page.goto(route);await expect(page.locator('h1')).toBeVisible();await expect(page.locator('#main-nav')).toBeVisible();await expect(page.locator('.menu-toggle')).not.toBeVisible();await expect(page.locator('.case-next>a')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);const nav=await page.locator('#main-nav').boundingBox(),crumb=await page.locator('.case-breadcrumb>a').boundingBox();expect(crumb.y).toBeGreaterThan(nav.y+nav.height)}finally{await context.close()}
});

for(const route of routes)test('Zoom de 200% e espelhamento em '+route,async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width:720,height:480},deviceScaleFactor:2}),page=await context.newPage();
 try{await page.goto(route);await page.evaluate(()=>document.fonts.ready);for(const dir of ['ltr','rtl']){await page.locator('html').evaluate((e,dir)=>{e.dir=dir},dir);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('.case-next>a').scrollIntoViewIfNeeded();await expect(page.locator('.case-next>a')).toBeVisible()}}finally{await context.close()}
});
