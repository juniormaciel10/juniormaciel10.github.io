(() => {
  'use strict';
  const root = document.documentElement;
  const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(min-width:1024px) and (pointer:fine)');
  const smallScreen = matchMedia('(max-width:760px)');
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const initialEntrance = root.classList.contains('motion-pending');
  root.classList.add('has-motion');
  const activeAnimations = new Set();
  const scenes = [];
  const accordions = new Map();
  let enabled = !systemMotion.matches;
  root.dataset.motion = enabled ? 'full' : 'reduced';
  let heroVisible = true, heroReady = false, introToken = 0, pointerFrame = 0;
  let lastPointer = { x:0, y:0 };
  const ease = 'cubic-bezier(.16,1,.3,1)';
  const heroPieces = [
    { selector:'.art-initial', x:22, y:12, angle:0, delay:30, duration:1500, depth:.3 },
    { selector:'.art-plinth', x:36, y:66, angle:-4, delay:80, duration:1250, depth:.22 },
    { selector:'.art-screen-back', x:72, y:-12, angle:5, delay:190, duration:1350, depth:.45 },
    { selector:'.art-screen-front', x:42, y:44, angle:-4, delay:350, duration:1250, depth:.8 },
    { selector:'.art-document', x:-38, y:64, angle:-10, delay:540, duration:1250, depth:1.2 }
  ].map(piece => ({...piece, element:hero.querySelector(piece.selector)}));
  let introAnimations = [];
  function animate(element, keyframes, options = {}) {
    if (!element || !enabled) return null;
    const animation = element.animate(keyframes, {duration:950, easing:ease, fill:'both', ...options});
    activeAnimations.add(animation);
    animation.finished.then(() => {
      activeAnimations.delete(animation);
      animation.cancel();
    }, () => activeAnimations.delete(animation));
    return animation;
  }
  function offset(x,y) {
    const factor = smallScreen.matches ? .72 : 1;
    return (x*factor) + 'px ' + (y*factor) + 'px';
  }
  function entrance(element, spec = {}) {
    if (!element) return null;
    const { x=0,y=28,angle=0,opacity=1,delay=0,duration=950 } = spec;
    element.style.removeProperty('translate');
    element.style.removeProperty('rotate');
    element.style.removeProperty('opacity');
    return animate(element, [
      {translate:offset(x,y),rotate:angle+'deg',opacity},
      {translate:'0px 0px',rotate:'0deg',opacity:1}
    ], {delay,duration});
  }
  function resetPointer() {
    lastPointer = {x:0,y:0};
    heroPieces.forEach(({element}) => {
      element.style.setProperty('--layer-x','0px');
      element.style.setProperty('--layer-y','0px');
      element.style.setProperty('--layer-r','0deg');
    });
  }
  function applyPointer() {
    pointerFrame = 0;
    if (!enabled || !heroReady || !heroVisible || !finePointer.matches) return;
    heroPieces.forEach(({element,depth}) => {
      element.style.setProperty('--layer-x',(lastPointer.x*40*depth)+'px');
      element.style.setProperty('--layer-y',(lastPointer.y*26*depth)+'px');
      element.style.setProperty('--layer-r',(lastPointer.x*1.6*depth)+'deg');
    });
  }
  hero.addEventListener('pointermove', event => {
    if (!enabled || !finePointer.matches) return;
    const rect = hero.getBoundingClientRect();
    lastPointer = {x:(event.clientX-rect.left)/rect.width-.5,y:(event.clientY-rect.top)/rect.height-.5};
    if (!pointerFrame) pointerFrame = requestAnimationFrame(applyPointer);
  }, {passive:true});
  hero.addEventListener('pointerleave', resetPointer);
  async function playIntro(initial = false) {
    const token = ++introToken;
    heroReady = false;
    root.dataset.introState = 'waiting';
    introAnimations.forEach(animation => animation?.cancel());
    introAnimations = [];
    resetPointer();
    if (!enabled) {
      root.classList.remove('motion-pending');
      root.dataset.introState = 'complete';
      return;
    }
    await Promise.race([
      Promise.all([document.fonts.ready, ...[...hero.querySelectorAll('img')].map(img => img.decode().catch(() => {}))]),
      new Promise(resolve => setTimeout(resolve,1800))
    ]);
    if (token !== introToken || !enabled) return;
    if (initial && !root.classList.contains('motion-pending')) {
      heroReady = true;
      root.dataset.introState = 'complete';
      return;
    }
    if (document.hidden) {
      root.classList.remove('motion-pending');
      root.dataset.introState = 'waiting';
      return;
    }
    root.classList.remove('motion-pending');
    root.dataset.introState = 'playing';
    hero.querySelectorAll('h1>span').forEach((line,index) => {
      introAnimations.push(entrance(line,{y:34,delay:index*120,duration:1100}));
    });
    introAnimations.push(entrance(hero.querySelector('.hero-intro'),{y:16,delay:240,duration:900}));
    heroPieces.forEach(piece => introAnimations.push(entrance(piece.element,{...piece,opacity:piece.selector === '.art-initial' ? .2 : 0})));
    await Promise.all(introAnimations.filter(Boolean).map(animation => animation.finished.catch(() => {})));
    if (token !== introToken || !enabled) return;
    heroReady = true;
    root.dataset.introState = 'complete';
    applyPointer();
  }
  const heroObserver = new IntersectionObserver(entries => {
    const wasVisible = heroVisible;
    heroVisible = entries[0].isIntersecting;
    if (!heroVisible) {
      introToken++;
      introAnimations.forEach(animation => animation?.cancel());
      introAnimations = [];
      heroReady = false;
      root.dataset.introState = 'idle';
      root.classList.remove('motion-pending');
      resetPointer();
    } else if (!wasVisible) playIntro();
  }, {threshold:0});
  heroObserver.observe(hero);
  function prepareScene(scene) {
    if (!enabled) return;
    scene.items.forEach(({element,spec}) => {
      if (!element) return;
      element.style.translate = offset(spec.x||0,spec.y||0);
      element.style.rotate = (spec.angle||0)+'deg';
      element.style.opacity = spec.opacity === undefined ? '1' : String(spec.opacity);
    });
    scene.node.dataset.motionScene = 'ready';
  }
  function restoreScene(scene) {
    scene.token++;
    scene.running = false;
    scene.animations.forEach(animation => animation?.cancel());
    scene.animations = [];
    scene.items.forEach(({element}) => {
      element?.style.removeProperty('translate');
      element?.style.removeProperty('rotate');
      element?.style.removeProperty('opacity');
    });
  }
  function playScene(scene) {
    if (!enabled || scene.running) return;
    const token = ++scene.token;
    scene.running = true;
    scene.node.dataset.motionScene = 'playing';
    scene.animations = scene.items.map(({element,spec}) => entrance(element,spec));
    Promise.all(scene.animations.filter(Boolean).map(animation => animation.finished.catch(() => {}))).then(() => {
      if (scene.running && scene.token === token) scene.node.dataset.motionScene = 'complete';
    });
  }
  const sceneObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const scene = scenes.find(item => item.node === entry.target);
      if (!scene) return;
      if (entry.isIntersecting) playScene(scene);
      else if (entry.intersectionRatio === 0) {
        restoreScene(scene);
        if (entry.boundingClientRect.top > innerHeight || entry.boundingClientRect.bottom < 0) prepareScene(scene);
      }
    });
  }, {threshold:.12,rootMargin:'0px 0px -5% 0px'});
  function scene(selector, items) {
    const node = document.querySelector(selector);
    if (!node) return;
    const result = {node,items:items.map(([selector,spec])=>({element:selector==='&'?node:node.querySelector(selector),spec})),animations:[],running:false,token:0};
    scenes.push(result);
    if (node.getBoundingClientRect().top > innerHeight) prepareScene(result);
    sceneObserver.observe(node);
  }
  scene('.section-heading', [['h2',{y:36,duration:1050}],['p',{y:18,delay:150,opacity:.65}]]);
  scene('.project-heading', [['h3',{y:28}],['p',{y:16,delay:120}]]);
  scene('.software-stage', [
    ['.main-screen',{x:-24,y:24,angle:-1.2,duration:1200,delay:90}],
    ['.secondary-screen',{x:56,y:-16,angle:4,duration:1350,delay:210,opacity:.35}],
    ['.stage-plane',{y:28,opacity:.2,duration:1350}],
    ['.stage-word',{x:-20,opacity:.35,delay:280,duration:1300}]
  ]);
  scene('.document-art', [
    ['.sheet-front',{x:30,y:26,angle:10,duration:1400,delay:100}],
    ['.sheet-back',{x:-60,y:18,angle:-10,duration:1500,delay:250,opacity:.45}],
    ['.document-orbit',{x:20,y:18,angle:5,duration:1600,opacity:.3}],
    ['.document-word',{x:-20,delay:240,opacity:.35,duration:1300}]
  ]);
  scene('.document-copy', [['h3',{y:28,duration:1100}],['p',{y:16,opacity:.6,delay:130}],['.document-file',{y:12,delay:230}]]);
  scene('.other-work', [
    ['h3',{y:30}],
    ...[...document.querySelectorAll('.project-row')].map((_,i)=>['.project-row:nth-child('+(i+1)+')',{y:18,delay:120+i*85,duration:900}])
  ]);
  scene('.method-top', [['h2',{y:34,duration:1100}],['.method-copy p:first-child',{y:18,delay:130}],['.method-copy p:last-child',{y:18,delay:240}]]);
  scene('.workspace', [['&',{y:24,duration:1150}]]);
  scene('.contact-surface', [
    ['&',{y:28,duration:1050}],
    ['h2',{y:20,delay:130,duration:1100}],
    ['.contact-motion-ornament',{x:50,y:22,angle:12,delay:180,duration:1500,opacity:.2}]
  ]);
  // O efeito das setas acontece dentro da área clicável, que permanece parada.
  document.querySelectorAll('.button-icon,.round-link,.text-link,.nav-contact,.email-link,.social-links a').forEach(holder => {
    const icon = [...holder.children].find(child => child.matches?.('svg.icon'));
    if (!icon) return;
    const track = document.createElement('span');
    track.className = 'motion-arrow-track';
    track.setAttribute('aria-hidden','true');
    const link = holder.closest('a');
    track.dataset.direction = link?.hash === '#projetos' || holder.classList.contains('document-download') ? 'right' : 'up';
    const copy = icon.cloneNode(true);
    copy.removeAttribute('style');
    icon.classList.add('motion-arrow-main');
    copy.classList.add('motion-arrow-echo');
    holder.insertBefore(track,icon);
    track.append(icon,copy);
  });
  function clearAccordionTransition(details, state) {
    clearTimeout(state.timer);
    details.removeEventListener('transitionend',state.onEnd);
    state.contentAnimation?.cancel();
  }
  function completeAccordion(details, state) {
    if (accordions.get(details) !== state) return;
    accordions.delete(details);
    clearAccordionTransition(details,state);
    details.open = state.wanted;
    details.removeAttribute('data-motion-changing');
    details.removeAttribute('data-motion-closing');
    details.style.removeProperty('height');
    details.style.removeProperty('transition');
    state.contents.forEach(({element,inert})=>{element.inert=inert});
    state.summary.removeAttribute('aria-expanded');
  }
  function finishAccordions(except) {
    [...accordions].forEach(([details,state])=>{if(details!==except)completeAccordion(details,state)});
  }
  function toggleAccordion(details, summary) {
    finishAccordions(details);
    const previous = accordions.get(details);
    const before = details.getBoundingClientRect().height;
    const wanted = previous ? !previous.wanted : !details.open;
    accordions.delete(details);
    if (previous) clearAccordionTransition(details,previous);
    details.style.setProperty('transition','none','important');
    details.style.removeProperty('height');
    details.open = true;
    const style = getComputedStyle(details);
    const borders = parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth)+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);
    const expanded = details.getBoundingClientRect().height;
    const collapsed = summary.getBoundingClientRect().height+borders;
    const contents = previous?.contents || [...details.children].filter(element=>element!==summary).map(element=>({element,inert:element.inert}));
    const state = {wanted,summary,contents};
    accordions.set(details,state);
    details.setAttribute('data-motion-changing','');
    details.toggleAttribute('data-motion-closing',!wanted);
    summary.setAttribute('aria-expanded',String(wanted));
    contents.forEach(({element,inert})=>{element.inert=wanted?inert:true});
    const end = wanted ? expanded : collapsed;
    details.style.height = before+'px';
    // Fixar o tamanho já renderizado permite reverter a transição sem saltar.
    details.getBoundingClientRect();
    state.onEnd = event=>{
      if (event.target===details && event.propertyName==='height' && Math.abs(details.getBoundingClientRect().height-end)<1) completeAccordion(details,state);
    };
    details.addEventListener('transitionend',state.onEnd);
    details.style.removeProperty('transition');
    details.style.height = end+'px';
    state.timer = setTimeout(()=>completeAccordion(details,state),(wanted?420:260)+80);
    if (wanted) {
      state.contentAnimation = entrance(contents[0]?.element,{y:10,opacity:.65,delay:70,duration:350});
    }
    if (Math.abs(before-end)<1) completeAccordion(details,state);
  }
  document.querySelectorAll('details').forEach(details => {
    const summary = details.querySelector(':scope>summary');
    if (!summary) return;
    summary.addEventListener('click',event=>{
      if (!enabled || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      toggleAccordion(details,summary);
    });
  });
  document.addEventListener('click',event=>{
    if (event.target.closest('a[href^="#"]')) finishAccordions();
  },true);
  // O destino deve permanecer aberto mesmo se o hash mudar durante a saída.
  addEventListener('hashchange',()=>{
    let target;
    try {target=document.getElementById(decodeURIComponent(location.hash.slice(1)))} catch {}
    accordions.forEach((state,details)=>{if(target && details.contains(target))state.wanted=true});
    finishAccordions();
  });
  document.addEventListener('keydown',event=>{
    if (['Home','End','PageUp','PageDown'].includes(event.key)) finishAccordions();
  },true);
  addEventListener('resize',()=>{finishAccordions();resetPointer()},{passive:true});
  function setMotion(value, replay = true) {
    enabled = value;
    root.dataset.motion = enabled ? 'full' : 'reduced';
    introToken++;
    introAnimations.forEach(animation=>animation?.cancel());
    introAnimations = [];
    [...activeAnimations].forEach(animation=>animation.cancel());
    if (!enabled) document.getElementById('gallery-image').getAnimations().forEach(animation=>animation.cancel());
    finishAccordions();
    resetPointer();
    root.classList.remove('motion-pending');
    root.dataset.introState = 'complete';
    heroReady = enabled;
    scenes.forEach(item=>{
      restoreScene(item);
      const rect = item.node.getBoundingClientRect();
      if (enabled && rect.bottom>80 && rect.top<innerHeight*.95) playScene(item);
      else if (enabled) prepareScene(item);
      else item.node.dataset.motionScene = 'static';
    });
    if (enabled && replay && heroVisible) playIntro();
  }
  systemMotion.addEventListener('change',event=>setMotion(!event.matches));
  const pausedWhenHidden = new Set();
  document.addEventListener('visibilitychange',()=>{
    if (document.hidden) {
      finishAccordions();
      activeAnimations.forEach(animation=>{
        if (animation.playState==='running') {animation.pause();pausedWhenHidden.add(animation)}
      });
    } else {
      pausedWhenHidden.forEach(animation=>{
        if (enabled && animation.playState==='paused') animation.play();
      });
      pausedWhenHidden.clear();
      if (enabled && heroVisible && root.dataset.introState==='waiting') playIntro();
    }
  });
  addEventListener('pagehide',()=>{
    finishAccordions();
    introToken++;
    [...activeAnimations].forEach(animation=>animation.cancel());
    cancelAnimationFrame(pointerFrame);
    resetPointer();
  });
  addEventListener('pageshow',event=>{
    if (event.persisted) setMotion(enabled);
  });
  if (!enabled) setMotion(false);
  else if (initialEntrance) playIntro(true);
  else {heroReady=true;root.dataset.introState='complete'}
})();
