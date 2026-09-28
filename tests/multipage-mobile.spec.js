const {test,expect}=require('@playwright/test');
const {jump}=require('./helpers.cjs');

test('Modelagem: miniaturas, ficha e ampliação acompanham a seleção',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/jogos/');
 await page.evaluate(()=>document.fonts.ready);
 const gallery=page.locator('#roblox-gallery');
 await expect(gallery).toHaveClass(/is-inspected/);
 await gallery.locator('[data-gallery-pause]').focus();await page.keyboard.press('Enter');
 await expect(gallery).toHaveAttribute('data-paused','true');
 await jump(page,'#roblox-gallery [data-gallery-select="2"]');
 await gallery.locator('[data-gallery-select="2"]').click();
 await expect(gallery).toHaveAttribute('data-current','2');
 await expect(gallery.locator('[data-model-panel]:not([hidden]) h3')).toHaveText('Óculos Prisma Grafite');
 await expect(gallery.locator('[data-model-position]')).toHaveText('03 / 04');
 await gallery.focus();await page.keyboard.press('End');
 await expect(gallery).toHaveAttribute('data-current','3');
 await expect(gallery.locator('[data-model-panel]:not([hidden]) h3')).toHaveText('Satélite Órbita');
 await expect(gallery.locator('[data-model-position]')).toHaveText('04 / 04');
 await gallery.locator('[data-gallery-slide]:not([hidden]) .gallery-open').click();
 await expect(page.locator('#media-dialog')).toBeVisible();
 await expect(page.locator('#media-dialog-image')).toHaveAttribute('src',/modelo-satelite-orbita\.webp$/);
 await page.keyboard.press('Escape');
 await expect(gallery.locator('[data-gallery-slide]:not([hidden]) .gallery-open')).toBeFocused();
 await gallery.locator('[data-gallery-select="0"]').focus();await page.keyboard.press('Enter');
 await expect(gallery.locator('[data-model-panel]:not([hidden]) h3')).toHaveText('Bolsa Metro Grafite');
 await expect(gallery.locator('[data-model-position]')).toHaveText('01 / 04');
});

test('Celular: menu, carrossel dos terminais e ampliação em WebKit/Chromium',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('/');await page.evaluate(()=>document.fonts.ready);
  await page.locator('.menu-toggle').tap();
  await page.locator('#main-nav a[href="#metodo"]').tap();
  const gallery=page.locator('#workspace-gallery');await gallery.scrollIntoViewIfNeeded();
  await gallery.locator('[data-gallery-pause]').tap();
  await gallery.locator('[data-gallery-next]').tap();
  await expect(gallery).toHaveAttribute('data-current','1');
  await gallery.locator('[data-gallery-slide]:not([hidden]) .gallery-open').tap();
  await expect(page.locator('#media-dialog')).toBeVisible();
  await page.locator('#media-dialog-next').tap();
  await expect(page.locator('#media-dialog-image')).toHaveAttribute('src',/trabalho-06\.webp$/);
  await page.getByRole('button',{name:'Fechar imagem',exact:true}).tap();
  await expect(page.locator('#media-dialog')).not.toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
 }finally{await context.close()}
});
for(const route of ['/plataforma/','/jogos/'])test('Celular: tema, imagens e retorno em '+route,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:390,height:844});await page.goto(route);
 await page.evaluate(()=>document.fonts.ready);
 const gallery=page.locator('[data-gallery]').first();
 // Settle the control itself; WebKit can otherwise click during a pending scroll.
 await jump(page,'#'+await gallery.getAttribute('id')+' [data-gallery-next]');
 await gallery.locator('[data-gallery-next]').click();
 await expect(gallery).toHaveAttribute('data-current','1');
 expect(await gallery.locator('[data-gallery-slide]:not([hidden]) img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await page.locator('.back-link').click();
 await expect(page).toHaveURL(/\/$/);
 await page.keyboard.press('Shift');
 await expect(page.locator('.destination-grid>a')).toHaveCount(3);
 expect(errors).toEqual([]);
});
