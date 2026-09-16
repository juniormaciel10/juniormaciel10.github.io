const {test,expect}=require('@playwright/test');
const {open,jump,settle}=require('./helpers.cjs');
for(const width of [1024,1440,1920])test('Roda, registros horizontais e teclado sem saltos em '+width+'px',async({page})=>{
 await page.addInitScript(()=>{
  window.scrollProbe=null;addEventListener('wheel',e=>{if(scrollProbe)scrollProbe.inputs.push({trusted:e.isTrusted,record:!!e.target.closest?.('.registro-rolagem')})},{passive:true});
  (function frame(){if(scrollProbe)scrollProbe.frames.push(scrollY);requestAnimationFrame(frame)})();
 });
 await open(page,width);await jump(page,'#metodo-detalhes>summary');await page.locator('#metodo-detalhes>summary').click();
 for(const id of ['registro-supervisao','registro-validacao']){
  const selector='#'+id+' .registro-rolagem',record=page.locator(selector);await jump(page,selector);await page.mouse.move(5,450);
  const before=await page.evaluate(()=>{scrollProbe={frames:[],inputs:[]};return scrollY});await page.mouse.wheel(0,80);await settle(page);
  const box=await record.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  for(let i=0;i<8;i++){await page.mouse.wheel(0,40);await page.waitForTimeout(50)}await settle(page);
  const data=await page.evaluate(()=>{const data={...scrollProbe,y:scrollY};scrollProbe=null;return data});
  expect(Math.abs(data.y-before-400)).toBeLessThan(3);expect(data.inputs.every(e=>e.trusted)).toBe(true);expect(data.inputs.some(e=>e.record)).toBe(true);expect(data.frames.filter((y,i,all)=>i&&y<all[i-1]-2)).toEqual([]);
 }
 await page.mouse.move(5,400);await page.mouse.wheel(0,160);await page.keyboard.press('End');await page.waitForTimeout(900);expect(await page.evaluate(()=>document.documentElement.scrollHeight-innerHeight-scrollY)).toBeLessThan(2);
 await page.mouse.wheel(0,-160);await page.keyboard.press('Home');await page.waitForTimeout(900);expect(await page.evaluate(()=>scrollY)).toBeLessThan(2);
 if(width===1024){const record=page.locator('#registro-validacao .registro-rolagem');await jump(page,'#registro-validacao .registro-rolagem');const box=await record.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);const y=await page.evaluate(()=>scrollY);await page.mouse.wheel(160,0);await expect.poll(()=>record.evaluate(e=>e.scrollLeft)).toBeGreaterThan(20);await record.focus();await page.keyboard.press('ArrowLeft');await page.keyboard.down('Shift');await page.mouse.wheel(0,160);await page.keyboard.up('Shift');await page.waitForTimeout(450);expect(Math.abs(await page.evaluate(()=>scrollY)-y)).toBeLessThan(2)}
});
