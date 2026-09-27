(() => {
  const host=document.querySelector('[data-saturn-module]');
  if(!host)return;
  const start=document.getElementById('metodo');
  const header=document.querySelector('.site-header');
  let visibilityFrame=0;
  const reveal=()=>{
    visibilityFrame=0;
    const visible=start.getBoundingClientRect().top<=header.offsetHeight+32;
    if(visible===host.hasAttribute('data-visible'))return;
    host.toggleAttribute('data-visible',visible);
    host.dispatchEvent(new Event('saturnvisibilitychange'));
  };
  const scheduleReveal=()=>{
    if(!visibilityFrame)visibilityFrame=requestAnimationFrame(reveal);
  };
  window.addEventListener('scroll',scheduleReveal,{passive:true});
  window.addEventListener('resize',scheduleReveal,{passive:true});
  window.addEventListener('pageshow',scheduleReveal);
  new ResizeObserver(scheduleReveal).observe(document.getElementById('projetos'));
  reveal();
  let started=false;
  const load=()=>{
    if(started)return;
    started=true;
    import(new URL(host.dataset.saturnModule,document.baseURI).href)
      .then(module=>module.mountSaturn(host))
      .catch(()=>{host.dataset.renderer='image';});
  };
  const schedule=()=>{
    if('requestIdleCallback' in window)requestIdleCallback(load,{timeout:1200});
    else setTimeout(load,180);
  };
  if(document.readyState==='complete')schedule();
  else window.addEventListener('load',schedule,{once:true});
})();
