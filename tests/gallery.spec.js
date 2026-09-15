const {test,expect}=require('@playwright/test');
const {open,jump}=require('./helpers.cjs');
const names=['disponibilidade','disciplinas','formatos','retomada','tarefas','revisoes'];
const src=index=>'assets/img/estudo-galeria-'+names[index]+'.png';
async function gallery(page,width=1440){await open(page,width);await jump(page,'#software-gallery');await page.mouse.move(5,400);await expect(page.locator('#gallery-image')).toHaveJSProperty('complete',true)}
async function screen(page,index){await expect(page.locator('#software-gallery')).toHaveAttribute('data-current',String(index));await expect(page.locator('#gallery-image')).toHaveAttribute('src',src(index));await expect(page.locator('[data-slide][aria-current]')).toHaveAttribute('href',src(index));await expect.poll(()=>page.locator('#gallery-image').evaluate(e=>e.naturalWidth)).toBeGreaterThan(900)}

test('Imagens completas são carregadas conforme o uso, sem seis downloads antecipados',async({page})=>{
 const full=new Set();page.on('request',r=>{if(/estudo-galeria-.*\.png$/.test(r.url()))full.add(r.url().split('/').pop())});
 await gallery(page);expect([...full].every(file=>/disponibilidade|disciplinas/.test(file))).toBe(true);
 await page.locator('#gallery-pause').click();await page.locator('[data-slide="4"]').click();await screen(page,4);
 await page.locator('#gallery-expand').click();await expect(page.locator('#gallery-dialog')).toBeVisible();await expect(page.locator('#dialog-image')).toHaveAttribute('src',src(4));
 await page.keyboard.press('ArrowLeft');await screen(page,3);await expect(page.locator('#dialog-original')).toHaveAttribute('href',src(3));
 await page.keyboard.press('Escape');await expect(page.locator('#gallery-expand')).toBeFocused();
});

test('Uma escolha posterior vence um carregamento anterior mais lento',async({page})=>{
 await page.route('**/estudo-galeria-retomada.png',async route=>{await new Promise(r=>setTimeout(r,650));await route.continue()});
 await gallery(page);await page.locator('[data-slide="3"]').click();await page.locator('[data-slide="5"]').click();await screen(page,5);await page.waitForTimeout(800);await screen(page,5);await expect(page.locator('#software-gallery')).not.toHaveAttribute('aria-busy','true');
});

test('Falha de imagem permite abrir o original e tentar novamente',async({page})=>{
 await gallery(page);await page.locator('#gallery-pause').click();await page.route('**/estudo-galeria-retomada.png',route=>route.abort('internetdisconnected'));
 await page.locator('[data-slide="3"]').click();await expect(page.locator('.gallery-error')).toBeVisible();await expect(page.locator('#gallery-fallback')).toHaveAttribute('href',src(3));await expect(page.locator('#gallery-announcement')).toContainText('Não foi possível carregar');
 await page.unroute('**/estudo-galeria-retomada.png');await page.locator('[data-slide="3"]').click();await screen(page,3);await expect(page.locator('.gallery-error')).not.toBeVisible();await expect(page.locator('#software-gallery')).not.toHaveAttribute('aria-busy','true');
});

for(const width of [390,1440])test('Autoplay, pausa, retomada e estabilidade em '+width+'px',async({page})=>{
 await gallery(page,width);const y=await page.evaluate(()=>scrollY);await screen(page,1);expect(Math.abs(await page.evaluate(()=>scrollY)-y)).toBeLessThan(2);
 await page.locator('#gallery-pause').click();const current=await page.locator('#gallery-image').getAttribute('src');await page.waitForTimeout(6200);await expect(page.locator('#gallery-image')).toHaveAttribute('src',current);
 await page.locator('#gallery-pause').click();await screen(page,2);await page.locator('[data-slide="5"]').click();await screen(page,5);await screen(page,0);
});

test('Toque emulado: seleção, ampliação, navegação e fechamento',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
 try{await page.goto('/');await page.evaluate(()=>document.fonts.ready);await page.locator('#gallery-pause').tap();await page.locator('[data-slide="3"]').tap();await screen(page,3);await page.locator('#gallery-expand').tap();await expect(page.locator('#gallery-dialog')).toBeVisible();await page.locator('#dialog-next').tap();await screen(page,4);await page.getByRole('button',{name:'Fechar imagem'}).tap();await expect(page.locator('#gallery-dialog')).not.toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)}finally{await context.close()}
});

test('Deslize horizontal no modal troca a tela; gesto vertical preserva a seleção',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width:390,height:844},isMobile:true,hasTouch:true});const page=await context.newPage();
 try{
  await page.goto('/');await page.locator('#gallery-pause').tap();await page.locator('#gallery-expand').tap();
  const session=await context.newCDPSession(page);const rect=await page.locator('.dialog-image-wrap').boundingBox();const y=rect.y+rect.height/2;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width*.8,y}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:rect.x+rect.width*.2,y}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await screen(page,1);
  await page.getByRole('button',{name:'Fechar imagem'}).tap();await expect(page.locator('#gallery-dialog')).not.toBeVisible();await expect(page.locator('#gallery-expand')).toBeFocused();
  await page.locator('#gallery-expand').tap();
  const after=await page.locator('.dialog-image-wrap').boundingBox(),x=after.x+after.width/2;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:after.y+after.height*.3}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:after.y+after.height*.7}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await screen(page,1);
 }finally{await context.close()}
});
