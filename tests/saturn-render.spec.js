const {test,expect}=require('@playwright/test');

async function visibleFraction(page,scene,clip){
 const visible=await page.screenshot({clip,scale:'css'});
 let hidden;
 await scene.evaluate(e=>e.style.visibility='hidden');
 try{hidden=await page.screenshot({clip,scale:'css'});}
 finally{await scene.evaluate(e=>e.style.removeProperty('visibility'));}
 return page.evaluate(async({visible,hidden})=>{
  async function pixels(encoded){
   const image=new Image();image.src='data:image/png;base64,'+encoded;await image.decode();
   const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
   return ctx.getImageData(0,0,canvas.width,canvas.height).data;
  }
  const [a,b]=await Promise.all([pixels(visible),pixels(hidden)]);
  let different=0;
  for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>30)different++;
  return different/(a.length/4);
 },{visible:visible.toString('base64'),hidden:hidden.toString('base64')});
}

async function cardEdgeClip(page,scene){
 const card=await page.locator('.destination').last().boundingBox();
 const bounds=await scene.boundingBox();
 const x=Math.ceil(card.x+card.width+4);
 return {x,y:140,width:Math.floor(bounds.width-x-4),height:80};
}

test('Saturno permanece visível após a entrada e o repouso em tela móvel de alta densidade',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});
 const page=await context.newPage();
 try{
  await page.goto('/');await page.keyboard.press('Shift');
  const scene=page.locator('.saturn-scene');
  await expect(scene).toHaveAttribute('data-renderer','webgl',{timeout:20000});
  await expect(page.locator('.saturn-canvas')).toHaveCSS('opacity','1');
  for(const id of ['inicio','projetos','metodo','contato','inicio']){
   await page.locator('#'+id).evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
   await expect(scene).toHaveAttribute('data-pose',id);
   await expect(scene).toHaveAttribute('data-motion','idle');
   await page.waitForTimeout(200);
   const clip=id==='projetos'?await cardEdgeClip(page,scene):id==='contato'?{x:230,y:690,width:120,height:65}:{x:260,y:100,width:110,height:80};
   const changed=await visibleFraction(page,scene,clip);
   if(id==='inicio'||id==='projetos')expect(changed,'Nome e projetos devem permanecer sem Saturno').toBe(0);
   else expect(changed,'Saturno deve aparecer na imagem composta em '+id).toBeGreaterThan(.25);
  }
 }finally{await context.close()}
});

for(const width of [390,1440])test('A superfície de Saturno continua em movimento durante a leitura em '+width+'px',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width,height:width>760?960:844},deviceScaleFactor:width>760?1:2});
 const page=await context.newPage();
 try{
  await page.goto('/');await page.keyboard.press('Shift');
  const scene=page.locator('.saturn-scene');
  await expect(scene).toHaveAttribute('data-renderer','webgl',{timeout:20000});
  await expect(page.locator('.saturn-canvas')).toHaveCSS('opacity','1');
  await page.locator('#metodo').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
  await expect(scene).toHaveAttribute('data-pose','metodo');
  await expect(scene).toHaveAttribute('data-motion','idle');
  const clip=width>760?{x:1320,y:140,width:100,height:100}:{x:260,y:100,width:110,height:80};
  const first=await page.screenshot({clip,scale:'css'});
  await page.waitForTimeout(1800);
  const second=await page.screenshot({clip,scale:'css'});
  const changed=await page.evaluate(async({first,second})=>{
   const pixels=async encoded=>{const image=new Image();image.src='data:image/png;base64,'+encoded;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height).data;};
   const [a,b]=await Promise.all([pixels(first),pixels(second)]);let count=0;
   for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>9)count++;
   return count/(a.length/4);
  },{first:first.toString('base64'),second:second.toString('base64')});
  expect(changed,'A imagem do planeta deve mudar sem rolar a página').toBeGreaterThan(.025);
  await expect(scene).toHaveAttribute('data-pose','metodo');
  await expect(scene).toHaveAttribute('data-motion','idle');
 }finally{await context.close()}
});

test('Saturno aparece depois dos projetos e permanece inteiro nas poses de desktop',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width:1440,height:960},deviceScaleFactor:1});
 const page=await context.newPage();
 try{
  await page.goto('/');await page.keyboard.press('Shift');
  const scene=page.locator('.saturn-scene');
  await expect(scene).toHaveAttribute('data-renderer','webgl',{timeout:20000});
  await expect(page.locator('.saturn-canvas')).toHaveCSS('opacity','1');
  for(const [id,clip]of [
   ['inicio',{x:1280,y:140,width:100,height:100}],
   ['projetos',null],
   ['metodo',{x:1320,y:140,width:100,height:100}],
   ['contato',{x:780,y:760,width:120,height:100}],
   ['inicio',{x:1280,y:140,width:100,height:100}]
  ]){
   await page.locator('#'+id).evaluate(e=>e.scrollIntoView({behavior:'instant',block:'start'}));
   await expect(scene).toHaveAttribute('data-pose',id);
   await expect(scene).toHaveAttribute('data-motion','idle');
   const changed=await visibleFraction(page,scene,clip||await cardEdgeClip(page,scene));
   if(id==='inicio'||id==='projetos')expect(changed,'Saturno deve ficar oculto no nome e nos projetos, incluindo o retorno').toBe(0);
   else expect(changed,'O corpo deve estar presente em '+id).toBeGreaterThan(.25);
  }
 }finally{await context.close()}
});

test('A abertura fica livre e Saturno continua visível nas habilidades ao mudar a orientação',async({browser,baseURL})=>{
 const context=await browser.newContext({baseURL,viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});
 const page=await context.newPage();
 try{
  await page.goto('/');
  const scene=page.locator('.saturn-scene');
  await expect(scene).toHaveAttribute('data-renderer','webgl',{timeout:20000});
  await expect(page.locator('.saturn-canvas')).toHaveCSS('opacity','1');
  await expect(page.locator('html')).toHaveAttribute('data-intro','complete',{timeout:12000});
  for(const [width,height,clip]of [
   [390,844,{x:260,y:100,width:110,height:80}],
   [844,390,{x:640,y:100,width:110,height:80}],
   [390,844,{x:260,y:100,width:110,height:80}]
  ]){
   await page.setViewportSize({width,height});
   await expect(scene).toHaveAttribute('data-quality',width>760?'full':'compact');
   await expect(scene).toHaveAttribute('data-pose','inicio');
   await expect(scene).toHaveAttribute('data-motion','idle');
   await page.waitForTimeout(200);
   expect(await visibleFraction(page,scene,clip),'A abertura deve ficar livre em '+width+' × '+height).toBe(0);
   await page.locator('#metodo').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
   await expect(scene).toHaveAttribute('data-pose','metodo');
   await expect(scene).toHaveAttribute('data-motion','idle');
   const bounds=await scene.boundingBox();
   const body={x:Math.floor(bounds.width-50),y:Math.floor(height*(width>760?.29:.22)-20),width:40,height:40};
   expect(await visibleFraction(page,scene,body),'Saturno deve continuar visível em '+width+' × '+height).toBeGreaterThan(.25);
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   await expect(scene).toHaveAttribute('data-pose','inicio');
  }
 }finally{await context.close()}
});
