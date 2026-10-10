(() => {
  'use strict';
  const root=document.documentElement;
  const pageColor=document.querySelector('meta[name="theme-color"]')?.content;
  if(pageColor&&CSS.supports('color',pageColor))root.style.setProperty('--page-transition-bg',pageColor);
  const home=new URL(document.currentScript?.dataset.home||'./',document.baseURI);
  const native='onpageswap' in window&&'onpagereveal' in window&&CSS.supports('view-transition-name','root');
  const entryKey='portfolio:card-entry:v1',lastKey='portfolio:card-last:v1';
  const samePage=(a,b)=>{try{const x=new URL(a,location.href),y=new URL(b,location.href);return x.origin===y.origin&&x.pathname.replace(/index\.html$/,'')===y.pathname.replace(/index\.html$/,'');}catch{return false;}};
  const read=key=>{try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}};
  const write=(key,value)=>{try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}};
  const remove=key=>{try{sessionStorage.removeItem(key);}catch{}};
  const fresh=record=>record&&Date.now()-record.time<15000;
  const incoming=read(entryKey);
  if(fresh(incoming)&&samePage(incoming.to,location.href)){
    root.dataset.cardEntry='true';
    root.classList.remove('motion-pending');
    if(samePage(location.href,home.href))root.dataset.intro='complete';
    if(incoming.kind==='close'&&incoming.color&&CSS.supports('color',incoming.color))root.style.setProperty('--page-transition-bg',incoming.color);
    if(!native)remove(entryKey);
  }
  let queued=null,surface=null,overlay=null,activeTransition=null,generation=0;
  function resetVisuals(){
    surface?.style.removeProperty('view-transition-name');surface=null;
    root.style.removeProperty('view-transition-name');
    if(pageColor&&CSS.supports('color',pageColor))root.style.setProperty('--page-transition-bg',pageColor);
    delete root.dataset.cardDirection;delete root.dataset.cardTransition;
    document.querySelectorAll('[data-page-card][aria-busy]').forEach(card=>card.removeAttribute('aria-busy'));
    overlay?.remove();overlay=null;
  }
  function cardFor(url){return [...document.querySelectorAll('[data-page-card]')].find(card=>samePage(card.href,url));}
  function nameCard(card){
    surface=card.querySelector('[data-page-preview]')||card;
    root.style.viewTransitionName='page-backdrop';
    surface.style.viewTransitionName='root';
  }
  function eligible(event){
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return null;
    const card=event.target.closest?.('a[data-page-card]');
    if(!card||card.hasAttribute('download')||(card.target&&card.target!=='_self'))return null;
    return new URL(card.href,document.baseURI).origin===location.origin?card:null;
  }
  async function fallback(card,url,token){
    if(typeof Element.prototype.animate!=='function'){location.assign(url);return;}
    const preview=card.querySelector('[data-page-preview]')||card;
    const rect=preview.getBoundingClientRect();
    overlay=document.createElement('div');overlay.className='page-portal';overlay.setAttribute('aria-hidden','true');
    const image=preview.querySelector('img');
    if(image){const clone=document.createElement('img');clone.src=image.currentSrc||image.src;clone.alt='';overlay.append(clone);}
    document.body.append(overlay);
    const animation=overlay.animate([
      {left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',borderRadius:'3px'},
      {left:'0px',top:'0px',width:innerWidth+'px',height:innerHeight+'px',borderRadius:'0px'}
    ],{duration:650,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
    await animation.finished.catch(()=>{});
    if(token===generation)location.assign(url);
  }
  document.addEventListener('click',event=>{
    const card=eligible(event);
    if(!card){
      if(overlay&&event.target.closest?.('a[href]')&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){generation++;queued=null;resetVisuals();remove(entryKey);}
      return;
    }
    event.preventDefault();
    if(queued?.card===card)return;
    resetVisuals();
    const token=++generation;
    const record={from:location.href,to:card.href,scrollY,card:card.dataset.pageCard,time:Date.now(),kind:'open'};
    queued={card,record};card.setAttribute('aria-busy','true');
    write(entryKey,record);write(lastKey,record);
    if(native)location.assign(record.to);
    else fallback(card,record.to,token);
  });
  addEventListener('pageswap',event=>{
    if(!native){event.viewTransition?.skipTransition();return;}
    const destination=event.activation?.entry?.url;
    const last=read(lastKey);
    if(queued&&samePage(queued.record.to,destination)){
      root.dataset.cardDirection='open';nameCard(queued.card);
    }else if(event.activation?.navigationType==='traverse'&&last&&samePage(last.to,location.href)&&samePage(last.from,destination)&&samePage(destination,home.href)){
      root.dataset.cardDirection='close';
      write(entryKey,{...last,from:location.href,to:destination,time:Date.now(),kind:'close',color:pageColor});
    }else{
      remove(entryKey);event.viewTransition?.skipTransition();return;
    }
    const token=generation;
    event.viewTransition?.finished.catch(()=>{}).then(()=>{if(token===generation)resetVisuals();});
  });
  addEventListener('pagereveal',event=>{
    if(!native){event.viewTransition?.skipTransition();resetVisuals();return;}
    const record=read(entryKey);
    if(!fresh(record)||!samePage(record.to,location.href))return;
    const token=++generation;
    root.dataset.cardDirection=record.kind;
    if(record.kind==='close'){
      root.dataset.intro='complete';
      if(record.color&&CSS.supports('color',record.color))root.style.setProperty('--page-transition-bg',record.color);
      const card=cardFor(record.from);
      if(!card){event.viewTransition?.skipTransition();resetVisuals();remove(entryKey);return;}
      scrollTo({top:Number(record.scrollY)||0,behavior:'instant'});nameCard(card);
    }
    remove(entryKey);
    if(event.viewTransition){
      activeTransition=event.viewTransition;
      event.viewTransition.ready.then(()=>{if(token===generation)root.dataset.cardTransition='active';}).catch(()=>{});
      event.viewTransition.finished.catch(()=>{}).then(()=>{if(token===generation){activeTransition=null;resetVisuals();}});
    }else resetVisuals();
  });
  addEventListener('pagehide',()=>{generation++;});
  addEventListener('pageshow',event=>{if(event.persisted){generation++;queued=null;resetVisuals();}});
  addEventListener('wheel',()=>activeTransition?.skipTransition(),{passive:true});
  addEventListener('touchstart',()=>activeTransition?.skipTransition(),{passive:true});
  addEventListener('keydown',()=>activeTransition?.skipTransition());
  addEventListener('popstate',()=>{if(overlay){generation++;queued=null;resetVisuals();remove(entryKey);}});
})();
