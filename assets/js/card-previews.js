(() => {
  'use strict';
  const warmed=new Map(),preloads=new Set();
  function preload(url,as,crossOrigin){
    if(url.origin!==location.origin||preloads.has(url.href))return;
    preloads.add(url.href);
    const link=document.createElement('link');link.rel='preload';link.as=as;link.href=url.href;
    if(crossOrigin)link.crossOrigin='anonymous';
    document.head.append(link);
  }
  function warm(card){
    const url=new URL(card.href,document.baseURI);
    if(url.origin!==location.origin||warmed.has(url.href))return;
    const task=fetch(url.href,{credentials:'same-origin'}).then(async response=>{
      if(!response.ok)return;
      const preview=new DOMParser().parseFromString(await response.text(),'text/html');
      preview.querySelectorAll('link[rel="stylesheet"]').forEach(link=>preload(new URL(link.getAttribute('href'),url),'style'));
      preview.querySelectorAll('link[rel="preload"][as="font"]').forEach(link=>preload(new URL(link.getAttribute('href'),url),'font',true));
      const pictures=[...preview.querySelectorAll('img[fetchpriority="high"],.hero-art img:not([loading="lazy"])')].slice(0,4);
      return Promise.all(pictures.map(picture=>{
        const source=new URL(picture.getAttribute('src'),url);
        if(source.origin!==location.origin)return;
        const image=new Image();image.decoding='async';image.fetchPriority='low';
        if(picture.hasAttribute('srcset'))image.srcset=picture.getAttribute('srcset').split(',').map(item=>{const [file,...size]=item.trim().split(/\s+/);return new URL(file,url).href+' '+size.join(' ');}).join(',');
        image.sizes=picture.getAttribute('sizes')||'100vw';image.src=source.href;
        return image.decode().catch(()=>{});
      }));
    }).catch(()=>{});
    warmed.set(url.href,task);
  }
  document.addEventListener('pointerover',event=>{const card=event.target.closest?.('[data-page-card]');if(card&&!card.contains(event.relatedTarget))warm(card);},{passive:true});
  for(const type of ['focusin','pointerdown'])document.addEventListener(type,event=>{const card=event.target.closest?.('[data-page-card]');if(card)warm(card);},{passive:true});
})();
