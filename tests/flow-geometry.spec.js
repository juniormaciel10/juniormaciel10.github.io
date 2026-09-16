const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const {open}=require('./helpers.cjs');

// Compare the optimized curve interpolation with the browser's independent SVG
// geometry implementation, including points between the sampled vertices.
const source=fs.readFileSync('assets/js/backdrops.js','utf8');
const helpers=source.slice(source.indexOf(' function buildPathLookup('),source.indexOf('\n const rounded='));

test('A geometria otimizada preserva o percurso em curvas e mudanças de largura',async({page})=>{
 expect(helpers).toContain('function pointAt(');
 await open(page);
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:960});
  await page.waitForFunction(()=>{
   const svg=document.querySelector('.story-thread'),main=document.querySelector('main');
   return svg?.viewBox.baseVal.width===main.clientWidth&&Number(svg.dataset.height)===main.clientHeight;
  });
  const maximum=await page.evaluate(code=>{
   const path=document.querySelector('.story-thread-line'),length=path.getTotalLength();
   const sample=new Function('d','length',code+'\n const routeLength=length,pathLookup=buildPathLookup(d,length); return pointAt;')(path.getAttribute('d'),length);
   let maximum=0;
   for(let index=0;index<=400;index++){
    const distance=length*index/400,actual=path.getPointAtLength(distance),optimized=sample(distance);
    maximum=Math.max(maximum,Math.hypot(actual.x-optimized.x,actual.y-optimized.y));
   }
   return maximum;
  },helpers);
  expect(maximum,'Desvio do percurso em '+width+'px').toBeLessThan(.75);
 }
});
