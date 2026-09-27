const {test,expect}=require('@playwright/test');

async function open(page,width=1440){
 await page.setViewportSize({width,height:width>760?960:844});
 await page.goto('/');await page.keyboard.press('Shift');
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('#projetos').evaluate(e=>e.scrollIntoView({behavior:'instant',block:'start'}));
}
async function finishTransition(page){
 await page.evaluate(()=>document.getAnimations().filter(animation=>animation.effect?.pseudoElement?.startsWith('::view-transition')).forEach(animation=>animation.finish()));
 await expect(page.locator('html')).not.toHaveAttribute('data-card-transition','active');
}
async function frameAt(page,time){
 return page.evaluate(time=>{
  const animations=document.getAnimations().filter(animation=>animation.effect?.pseudoElement?.startsWith('::view-transition'));
  animations.forEach(animation=>{animation.pause();animation.currentTime=time;});
  const style=getComputedStyle(document.documentElement,'::view-transition-group(root)');
  const matrix=new DOMMatrixReadOnly(style.transform);
  return {width:parseFloat(style.width),height:parseFloat(style.height),x:matrix.m41,y:matrix.m42,animations:animations.length};
 },time);
}

for(const target of ['estudos','plataforma','jogos'])test('A prévia de '+target+' cresce até se tornar a página real',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await open(page);
 const card=page.locator(`[data-page-card="${target}"]`);
 const preview=card.locator('[data-page-preview]');
 await preview.locator('img').evaluate(image=>image.decode());
 expect(await preview.locator('img').evaluate(image=>image.complete&&image.naturalWidth>0)).toBe(true);
 expect(await preview.locator('img').evaluate(image=>image.currentSrc)).toContain('/previews/'+target+'-');
 const bounds=await preview.boundingBox();
 await card.click();
 await expect(page).toHaveURL(new RegExp('/'+target+'/$'));
 await expect(page.locator('html')).toHaveAttribute('data-card-transition','active');
 const first=await frameAt(page,0);
 expect(first.animations).toBeGreaterThan(0);
 expect(Math.abs(first.width-bounds.width)).toBeLessThan(2);
 expect(Math.abs(first.height-bounds.height)).toBeLessThan(2);
 const middle=await frameAt(page,140);
 expect(middle.width).toBeGreaterThan(first.width+40);
 expect(middle.width).toBeLessThan(1440);
 const end=await frameAt(page,840);
 expect(end.width).toBeCloseTo(1440,0);expect(end.height).toBeCloseTo(960,0);
 expect(end.x).toBeCloseTo(0,0);expect(end.y).toBeCloseTo(0,0);
 await finishTransition(page);
 await expect(page.locator('main h1')).toBeVisible();
 await expect(page.locator('.page-portal')).toHaveCount(0);
 expect(errors).toEqual([]);
});

test('Voltar fecha a página no card e restaura a inicial com Saturno',async({page})=>{
 await open(page,390);
 const card=page.locator('[data-page-card="plataforma"]');
 await card.scrollIntoViewIfNeeded();
 const scroll=await page.evaluate(()=>scrollY);
 await card.click();
 await expect(page.locator('html')).toHaveAttribute('data-card-transition','active');
 await finishTransition(page);
 await page.goBack();
 await expect(page.locator('html')).toHaveAttribute('data-card-transition','active');
 await expect(page.locator('html')).toHaveAttribute('data-card-direction','close');
 const first=await frameAt(page,0),middle=await frameAt(page,140);
 expect(first.width).toBeCloseTo(390,0);expect(first.height).toBeCloseTo(844,0);
 expect(middle.height).toBeLessThan(first.height-40);
 await finishTransition(page);
 expect(Math.abs((await page.evaluate(()=>scrollY))-scroll)).toBeLessThan(3);
 await expect(page.locator('.saturn-scene')).toHaveAttribute('data-renderer','webgl',{timeout:20000});
 await expect(page.locator('.saturn-scene canvas')).toHaveCount(1);
 await expect(card).not.toHaveAttribute('aria-busy','true');
});

test('Abertura por Enter conserva o destino e o conteúdo de habilidades',async({page})=>{
 await open(page,390);
 await expect(page.locator('#method-title')).toHaveText('Qualidades e habilidades.');
 await expect(page.locator('.skills-summary')).toContainText('Automação e coordenação de agentes de IA');
 await expect(page.locator('.skills-summary')).toContainText('Organização');
 await expect(page.locator('.skills-summary')).toContainText('Python, Node.js e Playwright');
 await page.locator('[data-page-card="jogos"]').focus();
 await page.keyboard.press('Enter');
 await expect(page).toHaveURL(/\/jogos\/$/);
 await expect(page.locator('html')).toHaveAttribute('data-card-transition','active');
 await finishTransition(page);
 await expect(page.locator('#games-title')).toBeVisible();
});

test('Sem transições entre documentos, a imagem expande e o link navega',async({page})=>{
 await page.addInitScript(()=>{const supports=CSS.supports.bind(CSS);CSS.supports=(property,...args)=>property==='view-transition-name'?false:supports(property,...args);});
 await open(page,390);
 await page.locator('[data-page-card="jogos"]').click({noWaitAfter:true});
 await expect(page.locator('.page-portal')).toBeVisible();
 await expect(page).toHaveURL(/\/jogos\/$/);
 await expect(page.locator('#games-title')).toBeVisible();
 await expect(page.locator('.page-portal')).toHaveCount(0);
});

test('Falha do aquecimento e indisponibilidade do storage não impedem a navegação',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('Unavailable','SecurityError')}}));
 await page.route('**/estudos/',route=>route.request().resourceType()==='fetch'?route.abort('failed'):route.continue());
 await open(page);
 await page.locator('[data-page-card="estudos"]').click();
 await expect(page).toHaveURL(/\/estudos\/$/);
 await expect(page.locator('#hero-title')).toBeVisible();
 expect(errors).toEqual([]);
});

test('Os cards funcionam sem JavaScript',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,javaScriptEnabled:false});
 try{
  const page=await context.newPage();await page.goto('/');
  await expect(page.locator('[data-page-card]')).toHaveCount(3);
  await page.locator('[data-page-card="plataforma"]').click();
  await expect(page).toHaveURL(/\/plataforma\/$/);
  await expect(page.locator('#platform-title')).toBeVisible();
 }finally{await context.close()}
});

test('Uma interação de leitura encerra a transição sem bloquear a página',async({page})=>{
 await open(page);
 await page.locator('[data-page-card="plataforma"]').click();
 await expect(page.locator('html')).toHaveAttribute('data-card-transition','active');
 await page.mouse.wheel(0,200);
 await expect(page.locator('html')).not.toHaveAttribute('data-card-transition','active');
 await expect(page).toHaveURL(/\/plataforma\/$/);
 await expect(page.locator('#platform-title')).toBeVisible();
});

test('Cliques modificados conservam o comportamento nativo do link',async({page})=>{
 await open(page);
 for(const modifier of ['ctrlKey','metaKey','shiftKey']){
  const intercepted=await page.evaluate(modifier=>{
   let intercepted;
   document.addEventListener('click',event=>{intercepted=event.defaultPrevented;event.preventDefault();},{once:true});
   document.querySelector('[data-page-card="estudos"]').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0,[modifier]:true}));
   return intercepted;
  },modifier);
  expect(intercepted).toBe(false);
 }
 await expect(page.locator('[data-page-card][aria-busy]')).toHaveCount(0);
});

test('A última seleção rápida vence um carregamento anterior',async({page})=>{
 await page.route(/\/estudos\/$/,async route=>{
  await new Promise(resolve=>setTimeout(resolve,500));
  await route.continue();
 });
 await open(page);
 await page.evaluate(()=>{
  document.querySelector('[data-page-card="estudos"]').click();
  setTimeout(()=>document.querySelector('[data-page-card="jogos"]').click(),35);
 });
 await expect(page).toHaveURL(/\/jogos\/$/);
 await expect(page.locator('#games-title')).toBeVisible();
});

test('O início de navegação tem orçamento explícito e as imagens pertencem ao build',async({request})=>{
 const build=await(await request.get('/assets/build.json')).json();
 const manifest=await(await request.get('/manifest.json')).json();
 for(const file of ['index.html','estudos/index.html','plataforma/index.html','jogos/index.html']){
  expect(build.pages[file].earlyJsBytes).toBeGreaterThan(0);
  expect(build.pages[file].earlyJsBytes).toBeLessThanOrEqual(6000);
 }
 for(const page of ['estudos','plataforma','jogos'])for(const width of [640,960])expect(manifest.files[`assets/img/portfolio/previews/${page}-${width}.webp`]).toBeTruthy();
 expect(Object.keys(manifest.files).some(file=>file.includes('dribbble')||file.includes('original-c317463'))).toBe(false);
});
