const {test,expect}=require('@playwright/test');
const {open}=require('./helpers.cjs');
const toggle=page=>page.getByRole('checkbox',{name:'Animações',exact:true});

test('Escolha do visitante ativa movimento apesar do sistema e persiste ao recarregar',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await open(page);
 await expect(toggle(page)).not.toBeChecked();await expect(page.locator('html')).toHaveAttribute('data-motion','reduced');
 await toggle(page).check();await expect(page.locator('html')).toHaveAttribute('data-motion','full');
 expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
 await expect(page.locator('html')).toHaveAttribute('data-intro-state','playing');
 expect(await page.evaluate(()=>localStorage.getItem('portfolio-motion'))).toBe('full');
 await page.reload();await expect(toggle(page)).toBeChecked();await expect(page.locator('html')).toHaveAttribute('data-motion','full');
 await page.locator('.document-art').evaluate(e=>e.scrollIntoView({behavior:'instant',block:'center'}));
 await expect(page.locator('.document-art')).toHaveAttribute('data-motion-scene','playing');
 expect(await page.locator('.sheet-front').evaluate(e=>parseFloat(getComputedStyle(e).rotate))).toBeGreaterThan(.1);
});

test('Preferência acompanha as páginas e a escolha de reduzir prevalece sobre o sistema',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await open(page);await toggle(page).check();
 for(const url of ['/projetos/planejamento-de-estudos/','/projetos/resumos-de-estudo/']){
  await page.goto(url);await expect(toggle(page)).toBeChecked();await expect(page.locator('html')).toHaveAttribute('data-motion','full');
 }
 await toggle(page).uncheck();await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto('/');await expect(toggle(page)).not.toBeChecked();await expect(page.locator('html')).toHaveAttribute('data-motion','reduced');
 expect(await page.evaluate(()=>localStorage.getItem('portfolio-motion'))).toBe('reduced');
 expect(await page.locator('.hero').evaluate(e=>e.getAnimations({subtree:true}).length)).toBe(0);
});

for(const mode of ['bloqueado','inválido'])test('Preferência permanece funcional com armazenamento '+mode,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(mode=>{
  if(mode==='bloqueado'){
   Storage.prototype.getItem=function(){throw new DOMException('Indisponível','SecurityError')};
   Storage.prototype.setItem=function(){throw new DOMException('Indisponível','SecurityError')};
  }else localStorage.setItem('portfolio-motion','invalid');
 },mode);
 await open(page);await expect(toggle(page)).not.toBeChecked();await toggle(page).check();
 await expect(page.locator('html')).toHaveAttribute('data-motion','full');await expect(page.locator('html')).toHaveAttribute('data-intro-state','playing');expect(errors).toEqual([]);
});

test('Escolha se propaga entre abas da mesma origem',async({page,context})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await open(page);
 const other=await context.newPage();
 try{
  await other.emulateMedia({reducedMotion:'reduce'});await other.goto('/projetos/resumos-de-estudo/');
  await expect(toggle(other)).not.toBeChecked();await toggle(page).check();await expect(toggle(other)).toBeChecked();
  await toggle(other).uncheck();await expect(toggle(page)).not.toBeChecked();await expect(page.locator('html')).toHaveAttribute('data-motion','reduced');
  await other.evaluate(()=>localStorage.removeItem('portfolio-motion'));
  await expect(page.locator('html')).toHaveAttribute('data-motion-preference','system');
 }finally{await other.close()}
});

test.describe('Preferência no celular',()=>{
 test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 test('Toque ativa as animações e fecha o menu com foco preservado',async({page})=>{
  await page.goto('/');await page.locator('.menu-toggle').tap();await expect(toggle(page)).toBeVisible();
  const box=await page.locator('.motion-control').boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);
  await page.locator('.motion-control').tap();await expect(page.locator('#motion-toggle')).toBeChecked();await expect(page.locator('#main-nav')).toHaveJSProperty('inert',true);
  await expect(page.locator('.menu-toggle')).toBeFocused();await expect(page.locator('html')).toHaveAttribute('data-intro-state','playing');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
});
