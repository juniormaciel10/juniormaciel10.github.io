const {test,expect}=require('@playwright/test');
const {open,jump}=require('./helpers.cjs');

async function enter(page,selector){
 await page.locator(selector).evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
 await expect(page.locator(selector)).toHaveAttribute('data-motion-scene','playing');
}
async function complete(page,selector){await expect(page.locator(selector)).toHaveAttribute('data-motion-scene','complete')}
async function accordionDone(page,selector,open){
 await expect(page.locator(selector)).not.toHaveAttribute('data-motion-changing');
 await expect(page.locator(selector)).toHaveJSProperty('open',open);
 expect(await page.locator(selector).evaluate(e=>e.style.height)).toBe('');
}

for(const width of [390,768,1440,1920])test('Entradas aprovadas e estabilidade em '+width+'px',async({page},info)=>{
 await page.addInitScript(()=>{
  window.motionChecks={cls:0,frames:null};
  new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)motionChecks.cls+=entry.value}).observe({type:'layout-shift',buffered:true});
  (function frame(){if(motionChecks.frames)motionChecks.frames.push([scrollY,document.documentElement.scrollWidth,document.documentElement.scrollHeight]);requestAnimationFrame(frame)})();
 });
 await open(page,width);
 await expect(page.locator('html')).toHaveAttribute('data-intro-state','playing');
 expect(await page.locator('h1').evaluate(e=>getComputedStyle(e).opacity)).toBe('1');
 await expect(page.locator('html')).toHaveAttribute('data-intro-state','complete');
 expect(await page.evaluate(()=>motionChecks.cls)).toBe(0);
 await page.screenshot({path:info.outputPath('abertura.png')});
 for(const selector of ['.software-stage','.document-art','.contact-surface']){
  await enter(page,selector);
  await page.evaluate(()=>{motionChecks.frames=[]});
  if(selector==='.document-art')expect(await page.locator('.sheet-front').evaluate(e=>parseFloat(getComputedStyle(e).rotate))).toBeGreaterThan(.1);
  await complete(page,selector);
  const frames=await page.evaluate(()=>{const frames=motionChecks.frames;motionChecks.frames=null;return frames});
  expect(frames.length).toBeGreaterThan(2);
  expect(Math.max(...frames.map(f=>f[1]))).toBeLessThanOrEqual(width);
  for(const column of [0,2])expect(Math.max(...frames.map(f=>f[column]))-Math.min(...frames.map(f=>f[column]))).toBeLessThan(2);
  await page.screenshot({path:info.outputPath(selector.slice(1)+'.png')});
 }
 await page.screenshot({path:info.outputPath('contato.png')});
});

test('Profundidade ao ponteiro e reentrada do resumo preservam o estado final',async({page})=>{
 await open(page);await expect(page.locator('html')).toHaveAttribute('data-intro-state','complete');
 const hero=await page.locator('.hero').boundingBox();await page.mouse.move(hero.width*.8,hero.y+hero.height*.4);await page.waitForTimeout(750);
 const layers=await page.evaluate(()=>['.art-plinth','.art-screen-back','.art-screen-front','.art-document'].map(s=>parseFloat(getComputedStyle(document.querySelector(s)).translate)));
 expect(layers[0]).toBeGreaterThan(1);for(let i=1;i<layers.length;i++)expect(layers[i]).toBeGreaterThan(layers[i-1]);
 await page.mouse.move(2,20);await page.waitForTimeout(750);expect(await page.locator('.art-document').evaluate(e=>Math.abs(parseFloat(getComputedStyle(e).translate)))).toBeLessThan(.1);
 for(let i=0;i<3;i++){
  await enter(page,'.document-art');await page.waitForTimeout(60);
  await page.locator('.hero').evaluate(e=>e.scrollIntoView({behavior:'instant'}));
  await page.waitForTimeout(50);
 }
 await enter(page,'.document-art');await complete(page,'.document-art');expect(await page.locator('.sheet-front').evaluate(e=>getComputedStyle(e).rotate)).toBe('none');
});

test('Detalhes revertem cliques e mantêm aberto o destino de navegação',async({page})=>{
 await open(page);const selector='#resumo-detalhes',summary=page.locator(selector+'>summary');await jump(page,selector+'>summary');
 await summary.click();await page.waitForTimeout(90);await summary.click();await expect(summary).toHaveAttribute('aria-expanded','false');
 await page.keyboard.press('Tab');expect(await page.locator(selector).evaluate(e=>!e.contains(document.activeElement))).toBe(true);
 await summary.click();await accordionDone(page,selector,true);
 await summary.click();await page.evaluate(()=>{location.hash='#resumo-detalhes'});await page.waitForTimeout(650);await accordionDone(page,selector,true);
 await summary.focus();await page.keyboard.press('Space');await accordionDone(page,selector,false);await page.keyboard.press('Enter');await accordionDone(page,selector,true);
});

test('Animações continuam ativas quando a configuração do sistema muda',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await open(page);
 await expect(page.locator('html')).toHaveAttribute('data-motion','full');
 await expect(page.locator('html')).toHaveAttribute('data-intro-state','playing');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.emulateMedia({reducedMotion:'reduce'});
 await expect(page.locator('html')).toHaveAttribute('data-motion','full');
 await enter(page,'.document-art');expect(await page.locator('.sheet-front').evaluate(e=>parseFloat(getComputedStyle(e).rotate))).toBeGreaterThan(.1);
 await complete(page,'.document-art');
});

test('O conteúdo aparece se o script ultrapassa o prazo e não reinicia ao chegar tarde',async({page})=>{
 let release;const gate=new Promise(resolve=>{release=resolve});
 await page.route('**/assets/js/site.*.js',async route=>{await gate;await route.continue()});
 const navigation=page.goto('/');
 try{
  await page.locator('h1').waitFor({state:'visible'});await expect(page.locator('html')).not.toHaveClass(/motion-pending/,{timeout:5000});
  expect(await page.locator('.art-screen-front').evaluate(e=>getComputedStyle(e).opacity)).toBe('1');
  release();await navigation;await expect(page.locator('html')).toHaveAttribute('data-intro-state','complete');
  expect(await page.locator('.hero').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length)).toBe(0);
 }finally{release();await navigation.catch(()=>{})}
});
