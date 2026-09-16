const {test,expect}=require('@playwright/test');
const {open,jump}=require('./helpers.cjs');

async function guideReady(page){
 await expect(page.locator('.route-guide')).toHaveAttribute('data-motion',/settled|held/,{timeout:10000});
}

test('Fundos aprovados são publicados sem os controles da comparação',async({page})=>{
 await open(page);
 await expect(page.locator('body')).toHaveClass(/portfolio-home/);
 await expect(page.locator('.section-backdrop')).toHaveCount(6);
 await expect(page.locator('[data-option],.study-controls,[data-study]')).toHaveCount(0);
 await guideReady(page);
 const path=await page.locator('.story-thread-line').evaluate(el=>({start:el.getPointAtLength(0).y,length:el.getTotalLength()}));
 expect(path.start).toBeLessThan(0);expect(path.length).toBeGreaterThan(1000);
 await expect(page.locator('.route-guide-button')).toHaveAccessibleName(/Localização na página: Início/);
 const light=await page.locator('.story-thread-ambient').evaluate(el=>({width:parseFloat(getComputedStyle(el).strokeWidth),opacity:parseFloat(getComputedStyle(el).opacity)}));
 expect(light.width).toBeGreaterThan(4);expect(light.opacity).toBeGreaterThan(.9);
 await expect(page.locator('.story-thread-ambient-halo')).toHaveCount(1);
});

for(const width of [390,1440])test('Indicador identifica a dobra e mantém a etiqueta acessível em '+width+'px',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await open(page,width);
 await jump(page,'.document-copy');await guideReady(page);
 const button=page.locator('.route-guide-button'),tooltip=page.locator('.route-guide-tooltip');
 await expect(button).toHaveAccessibleName('Localização na página: Resumos');
 const alignment=await button.evaluate(el=>{
  const guide=el.parentElement,path=document.querySelector('.story-thread-line'),main=document.querySelector('main').getBoundingClientRect();
  const expected=path.getPointAtLength(Number(guide.dataset.distance)),rect=el.getBoundingClientRect();
  return{error:Math.hypot(rect.x+rect.width/2-main.x-expected.x,rect.y+rect.height/2-main.y-expected.y),width:rect.width,height:rect.height};
 });
 expect(alignment.error).toBeLessThan(1);expect(alignment.width).toBeGreaterThanOrEqual(24);expect(alignment.height).toBeGreaterThanOrEqual(44);
 await button.hover();await expect(tooltip).toBeVisible();await expect(tooltip).toContainText('Resumos');
 const rect=await tooltip.boundingBox();expect(rect.x).toBeGreaterThanOrEqual(10);expect(rect.x+rect.width).toBeLessThanOrEqual(width-10);
 await page.mouse.move(1,1);await expect(tooltip).not.toBeVisible();
 await button.click();await page.mouse.move(1,1);await expect(tooltip).toBeVisible();await page.keyboard.press('Escape');await expect(tooltip).not.toBeVisible();
 await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(button).toBeFocused();await expect(tooltip).toBeVisible();
 await page.keyboard.press('Escape');await expect(tooltip).not.toBeVisible();
 const hero=width<=760?'.backdrop-mobile-routes .route-signal':'.backdrop-desktop-routes .route-signal';
 await expect(page.locator('.hero '+hero)).toHaveCSS('animation-play-state','paused');
 await expect(page.locator('.document-case .ambient-trace').first()).toHaveCSS('animation-play-state','running');
 const trace=page.locator('.document-case .ambient-trace').first();
 await expect(trace).toHaveCSS('animation-name','presence-trace');
 const dash=await trace.evaluate(el=>getComputedStyle(el).strokeDashoffset);
 await page.waitForTimeout(650);
 expect(await trace.evaluate(el=>getComputedStyle(el).strokeDashoffset)).not.toBe(dash);
 expect(errors).toEqual([]);
});

test('Toque abre e fecha a localização; detalhes preservam o percurso',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 try{
  const page=await context.newPage();await page.goto('/');await page.evaluate(()=>document.fonts.ready);
  await jump(page,'.document-copy');await guideReady(page);
  const button=page.locator('.route-guide-button'),tooltip=page.locator('.route-guide-tooltip');
  await button.tap();await expect(tooltip).toBeVisible();await button.tap();await expect(tooltip).not.toBeVisible();
  await page.locator('#resumo-detalhes>summary').tap();await expect(page.locator('#resumo-detalhes')).not.toHaveAttribute('data-motion-changing');
  await expect.poll(()=>page.evaluate(()=>Number(document.querySelector('.story-thread').dataset.height)===document.querySelector('main').clientHeight)).toBe(true);
  expect(await page.evaluate(()=>document.querySelector('.story-thread-line').getAttribute('d')===document.querySelector('.story-thread-ambient-halo').getAttribute('d'))).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-motion','full');
 }finally{await context.close()}
});

test('O controlador da página inicial não interfere nas páginas dos projetos',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const route of ['/projetos/planejamento-de-estudos/','/projetos/resumos-de-estudo/']){
  await page.goto(route);await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.route-guide,.story-thread,.section-backdrop')).toHaveCount(0);
 }
 expect(errors).toEqual([]);
});
