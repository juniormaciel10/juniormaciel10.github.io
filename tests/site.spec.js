const {test,expect}=require('@playwright/test');
const crypto=require('node:crypto');
const {gzipSync}=require('node:zlib');
const {open,jump,settle}=require('./helpers.cjs');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');

test('Publicação contém apenas o site; bundles íntegros e metadados do perfil',async({page,request})=>{
 const manifest=await(await request.get('/manifest.json')).json();
 expect(Object.keys(manifest.files).some(file=>/^(?:scripts|tests|tools|node_modules|\.prototypes|\.github)\//.test(file))).toBe(false);
 for(const file of ['/package.json','/scripts/build.mjs','/tests/site.spec.js','/README.md','/.prototypes/premium-v2.html'])expect((await request.get(file)).status()).toBe(404);
 await open(page);
 const css=await page.locator('link[rel="stylesheet"]').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
 const js=await page.locator('script[src]').evaluateAll(es=>es.map(e=>e.getAttribute('src')));
 expect(css).toHaveLength(1);expect(js).toHaveLength(1);
 expect(css[0]).toMatch(/^assets\/css\/site\.[a-f0-9]{12}\.css$/);
 expect(js[0]).toMatch(/^assets\/js\/site\.[a-f0-9]{12}\.js$/);
 for(const file of [...css,...js])expect(sha(await(await request.get('/'+file)).body())).toBe(manifest.files[file].sha256);
 // O percurso animado tem um controlador próprio; limitar também o custo de transferência.
 const javascript=await(await request.get('/'+js[0])).body();
 expect(manifest.files[js[0]].bytes).toBeLessThan(36000);
 expect(gzipSync(javascript).length).toBeLessThan(12500);
 expect(await page.content()).not.toMatch(/preview-replay|motion-preview-tools|__motionPreview/);
 expect(javascript.toString('utf8')).not.toMatch(/__motionPreview|preview-replay|data-option|study-description/);
 await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href','https://juniormaciel10.github.io/');
 const profile=JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
 expect(profile.mainEntity.name).toBe('Franklin Junior Maciel');expect(profile.mainEntity.sameAs).toHaveLength(2);
 const ids=await page.locator('[id]').evaluateAll(es=>es.map(e=>e.id));expect(new Set(ids).size).toBe(ids.length);
 expect(await page.locator('a[href^="#"]').evaluateAll(es=>es.map(e=>e.hash).filter(hash=>!document.getElementById(hash.slice(1))))).toEqual([]);
});

test('Visual aprovado, ordem dos projetos, textos removidos e rodapé simples',async({page})=>{
 await open(page);
 await expect(page.locator('h1')).toHaveText('Inteligênciaem aplicação.');
 await expect(page.locator('.hero-intro')).toContainText('Desenho soluções e coordeno agentes de IA.');
 expect(await page.locator('#p-ciclo,#p-resumos,#p-funil,#p-transcricao,#p-copy,#experimentos').evaluateAll(es=>es.map(e=>e.id))).toEqual(['p-ciclo','p-resumos','p-funil','p-transcricao','p-copy','experimentos']);
 expect(await page.locator('body').innerText()).not.toMatch(/confiro cada entrega|copywriter|remoto.*Bagé|setembro/i);
 await expect(page.locator('footer')).toHaveText('© 2026 Franklin Junior Maciel.');
 await page.locator('.hero .button').click();await settle(page);
 await expect(page).toHaveURL(/#projetos$/);await expect(page.locator('#projetos')).toBeFocused();
});

for(const width of [320,390,768,1000,1024,1440,1920]){
 test('Layout e leitura sem cortes em '+width+'px',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page,width);
  const cta=await page.locator('.hero .button').boundingBox();expect(cta.y+cta.height).toBeLessThan(960);
  for(const selector of ['#hero-title','#work-title','#software-title','#document-title','.other-work>h3','#method-title','#contact-title']){
   await jump(page,selector);await expect(page.locator(selector)).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const box=await page.locator(selector).boundingBox();expect(box.x).toBeGreaterThanOrEqual(-1);expect(box.x+box.width).toBeLessThanOrEqual(width+1);
  }
  await jump(page,'#software-gallery');
  expect(await page.locator('#gallery-expand').evaluate(e=>{const r=e.getBoundingClientRect(),s=e.closest('.software-stage').getBoundingClientRect();return r.top>=s.top&&r.left>=s.left&&r.bottom<=s.bottom&&r.right<=s.right})).toBe(true);
  for(const id of ['#ciclo-detalhes','#resumo-detalhes','#p-funil','#p-instagram','#metodo-detalhes','#experiencia']){
   await jump(page,id+' > summary');await page.locator(id+' > summary').click();await expect(page.locator(id)).toHaveJSProperty('open',true);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  const controls=await page.locator('.button,.menu-toggle,.case-details>summary,.project-row>summary,[data-slide],.copy-email').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().height));
  // Uma translação pode representar 44px como 43.99993896484375 no DOMRect.
  expect(controls.every(h=>Math.round(h*1000)/1000>=44)).toBe(true);expect(errors).toEqual([]);
 });
}

test('Menu móvel, Escape e navegação restauram o foco',async({page})=>{
 await open(page,390);const toggle=page.locator('.menu-toggle');
 await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');
 await page.keyboard.press('Escape');await expect(toggle).toHaveAttribute('aria-expanded','false');await expect(toggle).toBeFocused();
 await toggle.click();await page.locator('#main-nav a[href="#metodo"]').click();await expect(toggle).toHaveAttribute('aria-expanded','false');await settle(page);
 await expect(page.locator('#metodo')).toBeFocused();
 await toggle.click();await page.setViewportSize({width:1440,height:960});await expect(toggle).toHaveAttribute('aria-expanded','false');
});

test('Links dos projetos e endereços antigos abrem o conteúdo completo',async({page})=>{
 await open(page);await jump(page,'#p-ciclo .project-footnote');await page.getByRole('link',{name:'Conhecer o projeto',exact:true}).click();
 await expect(page).toHaveURL(/\/projetos\/planejamento-de-estudos\/$/);await expect(page.locator('h1')).toHaveText('Planejamentode estudos.');
 for(const [hash,parent] of [['#p-funil','#p-funil'],['#p-instagram','#p-instagram'],['#resumo-detalhes','#resumo-detalhes'],['#registro-validacao','#metodo-detalhes'],['#experiencia','#experiencia']]){
  await page.goto('/'+hash);await page.evaluate(()=>document.fonts.ready);await expect(page.locator(parent)).toHaveJSProperty('open',true);
  await expect(page.locator(hash)).toBeInViewport();
 }
 for(const hash of ['#quem-sou','#como-trabalho','#na-pratica','#titulo','#ci-galeria']){await page.goto('/'+hash);await expect(page.locator(hash)).toHaveCount(1)}
 await page.goto('/#experimentos');await expect(page.locator('#p-gametwo')).toContainText('de outro desenvolvedor');await expect(page.locator('#p-govoice')).toContainText('código ainda não publicado');
});

test('PDF e DOCX íntegros, com download por ação do visitante',async({page,request})=>{
 const pdf=await request.get('/assets/downloads/resumo-inteligencia-artificial.pdf');expect(pdf.status()).toBe(200);expect(pdf.headers()['content-type']).toContain('application/pdf');
 expect(sha(await pdf.body())).toBe('0cb787ab5c935a464a85a11b66aeec8798e8cf464ab96be9186a0a4cc1eb3c3c');
 await open(page);await jump(page,'#resumo-download');const waiting=page.waitForEvent('download');await page.locator('#resumo-download').click();expect((await waiting).suggestedFilename()).toBe('Resumo-Inteligencia-Artificial.docx');
 expect(sha(await(await request.get('/assets/downloads/resumo-inteligencia-artificial.docx')).body())).toBe('3fdfc0a0def3e8e62299fc1ac91ff628c23433e83b684a2d4f96c73c48a44699');
});

for(const width of [390,1440])test('Sem JavaScript: navegação, detalhes e seis capturas em '+width+'px',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,javaScriptEnabled:false,viewport:{width,height:960}});const page=await context.newPage();
 try{await page.goto('/');await expect(page.locator('#main-nav')).toBeVisible();await expect(page.locator('.menu-toggle')).not.toBeVisible();await expect(page.locator('#gallery-pause')).not.toBeVisible();await expect(page.locator('[data-slide]')).toHaveCount(6);
  await page.locator('#p-funil>summary').click();await expect(page.locator('#p-funil')).toHaveJSProperty('open',true);await expect(page.locator('#resumo-pdf')).toHaveAttribute('href',/\.pdf$/);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context.close()}
});

test('Cópia do e-mail sinaliza sucesso e indisponibilidade da permissão',async({page})=>{
 await open(page,390);await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.copiedEmail=value}}}));
 await page.locator('.copy-email').click();await expect(page.locator('.copy-email span')).toHaveText('E-mail copiado');expect(await page.evaluate(()=>window.copiedEmail)).toBe('jrmaciell92@gmail.com');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Negado')}}}));
 await page.locator('.copy-email').click();await expect(page.locator('#copy-status')).toContainText('Não foi possível');
});

test('Animações são o padrão também quando o sistema pede movimento reduzido',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,reducedMotion:'reduce',viewport:{width:390,height:844}});const page=await context.newPage();
 try{await page.goto('/');await expect(page.locator('h1')).toBeVisible();await expect(page.locator('html')).toHaveAttribute('data-motion','full');await expect(page.locator('#motion-toggle')).toHaveCount(0);await page.locator('.hero .button').click();await expect(page).toHaveURL(/#projetos$/)}finally{await context.close()}
});

test('JavaScript lento não desloca a abertura no celular',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 let release;const gate=new Promise(resolve=>{release=resolve});
 await page.route('**/assets/js/site.*.js',async route=>{await gate;await route.continue()});
 const navigation=page.goto('/');
 try{
  await page.locator('h1').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('link[rel="stylesheet"]').sheet);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);
  const before=await page.locator('#inicio').boundingBox();
  release();await navigation;await expect(page.locator('body')).toHaveClass(/\bjs\b/);
  const after=await page.locator('#inicio').boundingBox();expect(Math.abs(after.y-before.y)).toBeLessThanOrEqual(1);
 }finally{release();await navigation.catch(()=>{})}
});

test('Falha do JavaScript conserva o menu e os links das capturas',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.route('**/assets/js/site.*.js',route=>route.abort('failed'));
 await page.goto('/');await expect(page.locator('#main-nav')).toBeVisible();await expect(page.locator('.menu-toggle')).not.toBeVisible();await expect(page.locator('h1')).toBeVisible();await expect(page.locator('[data-slide]')).toHaveCount(6);
});
