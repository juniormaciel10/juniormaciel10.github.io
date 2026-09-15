const {test,expect}=require('@playwright/test');

for(const width of [390,1440])test('Movimento inicia sem botão ou escolha prévia em '+width+'px',async({page})=>{
 await page.setViewportSize({width,height:960});await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>localStorage.setItem('portfolio-motion','reduced'));
 await page.goto('/');await expect(page.locator('html')).toHaveAttribute('data-motion','full');
 await expect(page.locator('#motion-toggle,.motion-control')).toHaveCount(0);
 await expect(page.locator('html')).toHaveAttribute('data-intro-state','playing');
 expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
 await page.locator('.document-art').evaluate(e=>e.scrollIntoView({behavior:'instant',block:'center'}));
 await expect(page.locator('.document-art')).toHaveAttribute('data-motion-scene','playing');
 expect(await page.locator('.sheet-front').evaluate(e=>parseFloat(getComputedStyle(e).rotate))).toBeGreaterThan(.1);
});

test('Páginas dos projetos usam o mesmo padrão e não acessam a preferência antiga',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{Storage.prototype.getItem=function(){throw new Error('Armazenamento indisponível')}});
 for(const url of ['/projetos/planejamento-de-estudos/','/projetos/resumos-de-estudo/']){
  await page.goto(url);await expect(page.locator('body')).toHaveClass(/\bjs\b/);await expect(page.locator('html')).toHaveAttribute('data-motion','full');
  await expect(page.locator('#motion-toggle,.motion-control')).toHaveCount(0);
 }
 expect(errors).toEqual([]);
});
