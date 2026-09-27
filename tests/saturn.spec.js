const {test,expect}=require('@playwright/test');
const {gzipSync}=require('node:zlib');
const crypto=require('node:crypto');
const sections=['inicio','projetos','metodo','sobre','contato'];

async function instrument(page){
 await page.addInitScript(()=>{
  window.saturnProbe={draws:0,contexts:new Set()};
  if(!window.WebGL2RenderingContext)return;
  const draw=WebGL2RenderingContext.prototype.drawElements;
  WebGL2RenderingContext.prototype.drawElements=function(...args){
   window.saturnProbe.draws++;window.saturnProbe.contexts.add(this);
   return draw.apply(this,args);
  };
 });
}
async function open(page,width=390){
 await page.setViewportSize({width,height:width>760?960:844});
 await page.goto('/');await page.evaluate(()=>document.fonts.ready);await page.keyboard.press('Shift');
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-renderer','webgl',{timeout:20000});
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-motion','idle');
}
async function go(page,id){
 await page.locator('#'+id).evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-pose',id);
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-motion','idle');
}
async function assertNoDraws(page){
 // Leave time for the browser to deliver its final resize/observer callbacks.
 await page.waitForTimeout(180);
 const draws=await page.evaluate(()=>window.saturnProbe.draws);
 await page.waitForTimeout(400);
 expect(await page.evaluate(()=>window.saturnProbe.draws)).toBe(draws);
}
async function assertAlive(page){
 await page.waitForTimeout(200);
 const before=await page.evaluate(()=>({draws:window.saturnProbe.draws,pose:document.querySelector('.saturn-scene').dataset.pose}));
 await page.waitForTimeout(500);
 const after=await page.evaluate(()=>({draws:window.saturnProbe.draws,pose:document.querySelector('.saturn-scene').dataset.pose}));
 expect(after.pose).toBe(before.pose);
 expect(after.draws-before.draws).toBeGreaterThan(0);
 expect(after.draws-before.draws).toBeLessThanOrEqual(48);
}

for(const width of [390,1440])test('Saturno: nome e projetos livres, três poses e percurso de volta em '+width+'px',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await instrument(page);await page.emulateMedia({reducedMotion:'reduce'});await open(page,width);
 await expect(page.locator('html')).toHaveAttribute('data-motion','full');
 const snapshots=[];
 for(const id of [...sections,...sections.slice(0,-1).reverse()]){
  await go(page,id);
  await expect(page.locator('.saturn-scene canvas')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(id==='inicio'||id==='projetos'){
   await expect(page.locator('.saturn-scene')).toHaveCSS('visibility','hidden');
   await assertNoDraws(page);
  }else{
   await expect(page.locator('.saturn-scene')).toHaveCSS('visibility','visible');
   snapshots.push(await page.evaluate(()=>window.saturnProbe.draws));
  }
 }
 for(let i=1;i<snapshots.length;i++)expect(snapshots[i]).toBeGreaterThan(snapshots[i-1]);
 expect(await page.evaluate(()=>window.saturnProbe.contexts.size)).toBe(1);
 await go(page,'metodo');
 await assertAlive(page);
 expect(errors).toEqual([]);
});

test('Saturno acompanha rolagem rápida e links sem enfileirar movimentos',async({page})=>{
 await instrument(page);await open(page);
 await page.mouse.wheel(0,650);
 await expect(page.locator('.saturn-scene')).toHaveCSS('visibility','hidden');
 await assertNoDraws(page);
 await page.mouse.wheel(0,1100);
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-motion','moving');
 for(const id of ['metodo','sobre','projetos','sobre']){
  await page.locator('#'+id).evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
  await page.waitForTimeout(80);
 }
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-pose','sobre');
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-motion','idle',{timeout:1800});
 await assertAlive(page);
 await page.locator('.menu-toggle').click();await page.locator('#main-nav a[href="#contato"]').click();
 await expect(page.locator('#contato')).toBeFocused();
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-pose','contato');
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-motion','idle');
 await page.locator('.footer-bottom a[href="#inicio"]').click();
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-pose','inicio');
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-motion','idle');
 await expect(page.locator('.saturn-scene')).toHaveCSS('visibility','hidden');
 await assertNoDraws(page);
});

test('Saturno pausa na ampliação e em aba oculta e retoma o destino atual',async({page})=>{
 await instrument(page);await open(page);
 const gallery=page.locator('#workspace-gallery');
 await gallery.scrollIntoViewIfNeeded();
 await gallery.locator('[data-gallery-slide]:not([hidden]) .gallery-open').click();
 await expect(page.locator('#media-dialog')).toBeVisible();
 await assertNoDraws(page);
 await page.keyboard.press('Escape');
 await expect(page.locator('#media-dialog')).not.toBeVisible();
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-motion','idle');
 await page.locator('#sobre').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-motion','moving');
 await page.evaluate(()=>{
  Object.defineProperty(document,'hidden',{configurable:true,value:true});
  document.dispatchEvent(new Event('visibilitychange'));
 });
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-motion','paused');
 await assertNoDraws(page);
 await page.evaluate(()=>{
  delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));
 });
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-pose','sobre');
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-motion','idle');
 await assertAlive(page);
});

test('Saturno mantém uma cena ao redimensionar, abrir detalhes e restaurar a página',async({page})=>{
 await instrument(page);await open(page,1440);
 await go(page,'metodo');
 await page.locator('#metodo-detalhes>summary').click();
 await expect(page.locator('#registro-subagentes')).toBeVisible();
 await go(page,'sobre');
 await page.setViewportSize({width:390,height:844});
 await go(page,'sobre');
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-quality','compact');
 const buffer=await page.locator('.saturn-canvas').evaluate(canvas=>({width:canvas.width,height:canvas.height,rect:canvas.getBoundingClientRect().toJSON()}));
 expect(buffer.width/buffer.rect.width).toBeLessThanOrEqual(1.75);
 expect(buffer.width*buffer.height).toBeLessThanOrEqual(3000000);
 await page.setViewportSize({width:3840,height:2160});
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-quality','full');
 expect(await page.locator('.saturn-canvas').evaluate(canvas=>canvas.width*canvas.height)).toBeLessThanOrEqual(3000000);
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 await assertNoDraws(page);
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
 await go(page,'contato');
 expect(await page.evaluate(()=>window.saturnProbe.contexts.size)).toBe(1);
 await expect(page.locator('.saturn-scene canvas')).toHaveCount(1);
});

for(const failure of ['webgl','module','material'])test('Saturno conserva imagem e navegação quando falha '+failure,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(failure==='webgl')await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args)};
 });
 if(failure==='module')await page.route('**/assets/js/scene.*.js',route=>route.abort('failed'));
 if(failure==='material')await page.route('**/assets/img/saturn/surface.webp',route=>route.abort('failed'));
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.keyboard.press('Shift');
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-renderer','image',{timeout:20000});
 await expect(page.locator('.saturn-scene')).toHaveCSS('visibility','hidden');
 await page.locator('#projetos').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
 await expect(page.locator('.saturn-scene')).toHaveCSS('visibility','hidden');
 await page.locator('#metodo').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
 await expect(page.locator('.saturn-fallback')).toBeVisible();
 expect(await page.locator('.saturn-fallback img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await expect(page.locator('.saturn-scene canvas')).toHaveCount(0);
 await expect(page.locator('h1')).toBeVisible();
 await expect(page.locator('.destination-grid>a')).toHaveCount(3);
 await expect(page.locator('#workspace-gallery [data-gallery-slide]')).toHaveCount(7);
 await page.locator('.menu-toggle').click();await page.locator('#main-nav a[href="#metodo"]').click();
 await expect(page.locator('#metodo')).toBeFocused();
 if(failure!=='module'){
  await expect(page.locator('.saturn-scene')).toHaveAttribute('data-pose','metodo');
  await expect(page.locator('.saturn-scene')).toHaveAttribute('data-motion','idle');
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('.footer-bottom a[href="#inicio"]').click();
 await expect(page.locator('.saturn-scene')).toHaveCSS('visibility','hidden');
 expect(errors).toEqual([]);
});

test('Saturno troca para imagem após perder o contexto WebGL',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await instrument(page);await open(page);
 const supported=await page.evaluate(()=>{
  const gl=[...window.saturnProbe.contexts][0];
  const extension=gl.getExtension('WEBGL_lose_context');if(!extension)return false;
  extension.loseContext();return true;
 });
 expect(supported).toBe(true);
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-renderer','image');
 await expect(page.locator('.saturn-scene canvas')).toHaveCount(0);
 await expect(page.locator('.saturn-fallback')).toHaveCSS('opacity','0.64');
 await go(page,'contato');await assertNoDraws(page);
 expect(errors).toEqual([]);
});

test('Mudanças de altura preservam o percurso em andamento e a qualidade entre poses',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width:390,height:844},deviceScaleFactor:2});
 const page=await context.newPage();
 try{
  await instrument(page);await page.goto('/');await page.keyboard.press('Shift');
  await expect(page.locator('.saturn-scene')).toHaveAttribute('data-renderer','webgl',{timeout:20000});
  const quality=()=>page.locator('.saturn-canvas').evaluate(canvas=>({width:canvas.width,height:canvas.height}));
  const initial=await quality();
  expect(initial.width/390).toBeGreaterThan(1.5);
  expect(await page.evaluate(()=>[...window.saturnProbe.contexts][0].getContextAttributes().antialias)).toBe(true);
  await page.locator('#sobre').evaluate(e=>e.scrollIntoView({behavior:'instant',block:'start'}));
  await expect(page.locator('.saturn-scene')).toHaveAttribute('data-motion','moving');
  expect(await quality()).toEqual(initial);
  await page.setViewportSize({width:390,height:784});
  await expect(page.locator('.saturn-scene')).toHaveAttribute('data-motion','moving');
  await expect(page.locator('.saturn-scene')).toHaveAttribute('data-motion','idle');
  await assertAlive(page);
  const resized=await quality();
  await go(page,'contato');
  expect(await quality()).toEqual(resized);
 }finally{await context.close()}
});

test('O módulo 3D é separado, íntegro e solicitado somente pela inicial',async({page,request})=>{
 const build=await(await request.get('/assets/build.json')).json();
 const manifest=await(await request.get('/manifest.json')).json();
 const modules=build.pages['index.html'].modules;
 expect(modules).toHaveLength(1);
 const response=await request.get('/'+modules[0]);expect(response.status()).toBe(200);
 const data=await response.body();
 expect(crypto.createHash('sha256').update(data).digest('hex')).toBe(manifest.files[modules[0]].sha256);
 expect(data.length).toBeLessThan(560000);expect(gzipSync(data).length).toBeLessThan(145000);
 const requested=[];page.on('request',r=>{if(/\/scene\.[\w]+\.js/.test(r.url()))requested.push(r.url())});
 for(const file of Object.keys(build.pages).filter(file=>file!=='index.html')){
  expect(build.pages[file].modules).toEqual([]);
  await page.goto('/'+file);await expect(page.locator('.saturn-scene,canvas.saturn-canvas')).toHaveCount(0);
 }
 expect(requested).toEqual([]);
});
