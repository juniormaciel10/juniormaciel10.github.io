import {
  Scene, PerspectiveCamera, WebGLRenderer, ACESFilmicToneMapping,
  SRGBColorSpace, Quaternion, Euler, MathUtils
} from 'three';
import { createSaturnModel } from './saturn-model.js';

const IDS = ['inicio', 'projetos', 'metodo', 'sobre', 'contato'];
const DESKTOP = [
  [.84,.28,.49,.52,-.08,.27,.92],
  [.91,.16,.28,.76,.10,.08,.74],
  [1.01,.29,.43,.40,-.16,-.19,.76],
  [.015,.50,.47,.66,.12,-.28,.57],
  [.50,.87,.56,.83,-.12,.08,.78]
];
const MOBILE = [
  [.91,.21,.66,.62,-.04,.27,.80],
  [1.02,.17,.48,.83,.10,.08,.68],
  [1.07,.22,.63,.46,-.13,-.20,.68],
  [-.075,.39,.68,.70,.10,-.24,.51],
  [.50,.84,.83,.86,-.12,.07,.66]
];
const instances = new WeakMap();
const ease = t => t*t*(3-2*t);
const pose = values => ({
  x:values[0], y:values[1], size:values[2], intensity:values[6],
  quaternion:new Quaternion().setFromEuler(new Euler(values[3], values[4], values[5]))
});
const copyPose = p => ({...p,quaternion:p.quaternion.clone()});

export async function mountSaturn(host) {
  if (instances.has(host)) return instances.get(host);
  const sections=IDS.map(id=>document.getElementById(id));
  if (sections.some(section=>!section)) return;
  const root=document.documentElement;
  const fallback=host.querySelector('.saturn-fallback');
  const canvas=document.createElement('canvas');
  canvas.className='saturn-canvas';
  canvas.setAttribute('aria-hidden','true');
  // WebKit needs a retained presentation buffer after resizing. Chromium keeps
  // its native GPU surface, avoiding a synchronous readback on every live frame.
  const webkit=/AppleWebKit/.test(navigator.userAgent)&&!/(?:Chrome|Chromium|Edg|OPR)\//.test(navigator.userAgent);
  const renderCanvas=webkit?document.createElement('canvas'):canvas;
  const abort=new AbortController();
  const events={signal:abort.signal};
  let renderer=null,model=null,presenter=null,ready=false,frame=0,layoutFrame=0,sectionFrame=0,transition=null;
  let active=-1,width=0,height=0,compact=false,disposed=false,hiddenPage=false,pauseAt=0;
  let positions=[],contactHeight=0,current=pose(DESKTOP[2]),renderRatio=0;
  let lifeTime=0,lastTick=0,lastDraw=0,dirty=true;
  const lifeEuler=new Euler();
  const lifeQuaternion=new Quaternion();
  const hiddenScene=matchMedia('(forced-colors: active), print');
  const world=new Scene();
  const camera=new PerspectiveCamera(32,1,.1,100);
  camera.position.z=8;
  const api={dispose};
  instances.set(host,api);
  host.dataset.renderer='loading';
  host.dataset.motion='idle';

  function blocked(includeOpening=true) {
    return (includeOpening&&!host.hasAttribute('data-visible')) || document.hidden || hiddenPage || hiddenScene.matches || Boolean(document.querySelector('dialog[open]'));
  }
  function target(index) { return pose((compact?MOBILE:DESKTOP)[index]); }
  function drift() {
    const unit=Math.min(width,height);
    return {x:active===4?0:Math.sin(lifeTime*.37)*unit*.008/width,y:Math.sin(lifeTime*.46)*unit*.012/height};
  }
  function fallbackPose(p) {
    const diameter=p.size*Math.min(width,height);
    const angles=new Euler().setFromQuaternion(p.quaternion);
    const offset=drift();
    fallback.style.width=(diameter*3.098)+'px';
    fallback.style.left=((p.x+offset.x)*100)+'%';
    fallback.style.top=((p.y+offset.y)*100)+'%';
    fallback.style.transform='translate(-50%, -50%) rotate('+((angles.z-.27+Math.sin(lifeTime*.31)*.018)*180/Math.PI)+'deg)';
    fallback.style.opacity=String(p.intensity*.8);
  }
  function draw(prepare=false) {
    if (disposed || blocked(!prepare) || !width || !height) return;
    if (!renderer || !model || !ready) { fallbackPose(current);dirty=false;return; }
    sizeRenderer();
    const worldHeight=2*Math.tan(MathUtils.degToRad(camera.fov*.5))*camera.position.z;
    const scale=current.size*Math.min(width,height)*worldHeight/(height*2);
    const offset=drift();
    model.group.position.set((current.x+offset.x-.5)*worldHeight*camera.aspect,(.5-current.y-offset.y)*worldHeight,0);
    model.group.scale.setScalar(scale);
    lifeEuler.set(Math.sin(lifeTime*.38)*.025,Math.sin(lifeTime*.23)*.035,Math.sin(lifeTime*.31)*.018);
    model.group.quaternion.copy(current.quaternion).multiply(lifeQuaternion.setFromEuler(lifeEuler));
    model.update(camera,current.intensity,lifeTime);
    renderer.render(world,camera);
    if(presenter){
      presenter.clearRect(0,0,canvas.width,canvas.height);
      // Copy in the drawing task, before WebGL releases its default buffer.
      presenter.drawImage(renderCanvas,0,0);
    }
    if(host.dataset.renderer==='loading')host.dataset.renderer='webgl';
    dirty=false;
  }
  function animate(now) {
    frame=0;
    if (disposed || blocked()) return;
    if(lastTick)lifeTime+=Math.min((now-lastTick)/1000,.08);
    lastTick=now;
    const moving=Boolean(transition);
    if (transition) {
      const t=Math.min(1,Math.max(0,(now-transition.start)/transition.duration));
      const progress=ease(t);
      current.x=MathUtils.lerp(transition.from.x,transition.to.x,progress);
      current.y=MathUtils.lerp(transition.from.y,transition.to.y,progress)+Math.sin(Math.PI*progress)*transition.arc;
      current.size=Math.exp(MathUtils.lerp(Math.log(transition.from.size),Math.log(transition.to.size),progress));
      current.intensity=MathUtils.lerp(transition.from.intensity,transition.to.intensity,progress);
      current.quaternion.slerpQuaternions(transition.from.quaternion,transition.to.quaternion,progress);
      if (t===1) {
        current=copyPose(transition.to);
        transition=null;
        host.dataset.motion='idle';
        fallbackPose(current);
      }
    }
    // Keep a slow continuous life at 24 fps; section travel uses each available frame.
    const interval=1000/24;
    if(dirty||moving||now-lastDraw>=interval-1){
      const forced=dirty||moving||!lastDraw;
      draw();
      lastDraw=forced?now:lastDraw+Math.max(1,Math.floor((now-lastDraw+1)/interval))*interval;
    }
    if(ready||transition||host.dataset.renderer==='image')requestFrame();
  }
  function requestFrame() {
    if (!frame && !disposed && !blocked()) frame=requestAnimationFrame(animate);
  }
  function select(index,immediate=false,retarget=false) {
    if(index===active&&!immediate&&!retarget)return;
    const previous=active;
    active=index;
    dirty=true;
    host.dataset.pose=IDS[index];
    const destination=target(Math.max(2,index));
    // The first visible pose is already in place while the section approaches.
    if(immediate || previous<0 || index<=1 || (previous<=1&&index===2)) {
      current=copyPose(destination);
      transition=null;
      host.dataset.motion='idle';
      fallbackPose(current);
      requestFrame();
      return;
    }
    transition={
      from:copyPose(current),to:destination,start:performance.now(),duration:compact?920:1080,
      arc:(index>previous?-1:1)*Math.min(.05,Math.abs(current.x-destination.x)*.09)
    };
    host.dataset.motion=blocked()?'paused':'moving';
    if(blocked())pauseAt=performance.now();
    requestFrame();
  }
  function readSection(immediate=false,retarget=false) {
    if(disposed||!positions.length)return;
    const scroll=window.scrollY;
    // Section selection follows the scrolling viewport, not the stable lvh canvas.
    const viewport=window.innerHeight;
    const reading=scroll+viewport*.34;
    let index=0;
    positions.forEach((top,i)=>{if(top<=reading)index=i;});
    // A short footer cannot reach the usual reading line. Start its journey once
    // half the footer is visible, without waiting for the last (rounded) pixel.
    const contactReading=scroll+viewport-Math.min(contactHeight,viewport)*.5;
    if(positions[4]<=contactReading || root.scrollHeight-viewport-scroll<=1)index=4;
    select(index,immediate,retarget);
  }
  function scheduleSection() {
    if(!sectionFrame&&!disposed)sectionFrame=requestAnimationFrame(()=>{
      sectionFrame=0;
      readSection();
    });
  }
  function sizeRenderer(force=false) {
    if(!renderer)return;
    // Keep the drawing buffer stable during motion. Desktop renders above 1x on
    // standard screens so ring edges stay smooth while the planet moves.
    const dpr=window.devicePixelRatio||1;
    const desired=compact?Math.min(dpr,1.75):Math.min(Math.max(dpr,1.5),2);
    const ratio=Math.min(desired,Math.sqrt((compact?3000000:6500000)/(width*height)));
    if(!force&&ratio===renderRatio)return;
    renderRatio=ratio;
    renderer.setPixelRatio(ratio);
    renderer.setSize(width,height,false);
    if(presenter){canvas.width=renderCanvas.width;canvas.height=renderCanvas.height;}
    dirty=true;
  }
  function measure() {
    layoutFrame=0;
    if(disposed)return;
    const bounds=host.getBoundingClientRect();
    const newWidth=Math.max(1,Math.round(bounds.width)),newHeight=Math.max(1,Math.round(bounds.height));
    const resized=newWidth!==width||newHeight!==height;
    const wasCompact=compact;
    width=newWidth;height=newHeight;compact=width<=760;
    positions=sections.map(section=>section.getBoundingClientRect().top+window.scrollY);
    contactHeight=sections[4].getBoundingClientRect().height;
    host.dataset.quality=compact?'compact':'full';
    if(resized) {
      camera.aspect=width/height;
      camera.updateProjectionMatrix();
      sizeRenderer(true);
    }
    // Height changes (browser chrome, rotation) must not snap an ongoing journey.
    readSection(active<0,wasCompact!==compact);
    dirty=true;
    requestFrame();
  }
  function scheduleMeasure() {
    if(!layoutFrame&&!disposed)layoutFrame=requestAnimationFrame(measure);
  }
  function sync() {
    if(disposed)return;
    const suspended=blocked();
    // Resume an existing journey before selecting a new one. Waiting on the
    // opening must not be added to the start time of the first visible journey.
    if(!suspended){
      if(pauseAt&&transition)transition.start+=performance.now()-pauseAt;
      pauseAt=0;
    }
    readSection();
    if(suspended) {
      if(!pauseAt)pauseAt=performance.now();
      lastTick=0;
      if(frame){cancelAnimationFrame(frame);frame=0;}
      if(transition)host.dataset.motion='paused';
      return;
    }
    dirty=true;
    host.dataset.motion=transition?'moving':'idle';
    requestFrame();
  }
  const sectionObserver=new IntersectionObserver(()=>readSection(),{rootMargin:'-28% 0px -58% 0px',threshold:0});
  sections.forEach(section=>sectionObserver.observe(section));
  const endObserver=new IntersectionObserver(()=>readSection(),{threshold:[0,.5,1]});
  endObserver.observe(sections[4]);
  const resizeObserver=new ResizeObserver(scheduleMeasure);
  resizeObserver.observe(host);
  resizeObserver.observe(document.getElementById('conteudo'));
  resizeObserver.observe(sections[4]);
  resizeObserver.observe(document.querySelector('.site-header'));
  const introObserver=new MutationObserver(scheduleMeasure);
  introObserver.observe(root,{attributes:true,attributeFilter:['data-intro']});
  window.addEventListener('scroll',scheduleSection,{...events,passive:true});
  window.addEventListener('resize',scheduleMeasure,{...events,passive:true});
  window.visualViewport?.addEventListener('resize',scheduleMeasure,{...events,passive:true});
  window.addEventListener('hashchange',scheduleMeasure,events);
  window.addEventListener('portfolio:focus-destination',scheduleMeasure,events);
  window.addEventListener('portfolio:dialog-change',sync,events);
  host.addEventListener('saturnvisibilitychange',sync,events);
  hiddenScene.addEventListener('change',()=>{scheduleMeasure();sync();},events);
  canvas.addEventListener('transitionend',event=>{
    if(event.propertyName==='opacity')requestFrame();
  },events);
  document.addEventListener('visibilitychange',sync,events);
  window.addEventListener('pagehide',event=>{
    hiddenPage=true;sync();
    if(!event.persisted)dispose();
  },events);
  window.addEventListener('pageshow',event=>{
    if(event.persisted){hiddenPage=false;measure();sync();}
  },events);

  function useImage() {
    if(disposed)return;
    ready=false;
    dirty=true;
    host.dataset.renderer='image';
    if(renderer){renderer.dispose();renderer=null;}
    if(model){world.remove(model.group);model.dispose();model=null;}
    canvas.remove();
    fallbackPose(current);
    requestFrame();
  }
  function dispose() {
    if(disposed)return;
    disposed=true;
    ready=false;
    abort.abort();
    if(frame)cancelAnimationFrame(frame);
    if(layoutFrame)cancelAnimationFrame(layoutFrame);
    if(sectionFrame)cancelAnimationFrame(sectionFrame);
    sectionObserver.disconnect();endObserver.disconnect();resizeObserver.disconnect();introObserver.disconnect();
    if(renderer)renderer.dispose();
    if(model)model.dispose();
    canvas.remove();
    instances.delete(host);
  }
  measure();
  try {
    const context=renderCanvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'low-power',premultipliedAlpha:true});
    if(!context){useImage();return api;}
    if(webkit){
      presenter=canvas.getContext('2d',{alpha:true});
      if(!presenter){useImage();return api;}
    }
    renderer=new WebGLRenderer({canvas:renderCanvas,context,alpha:true,antialias:true,powerPreference:'low-power'});
    renderer.setClearColor(0x000000,0);
    renderer.outputColorSpace=SRGBColorSpace;
    renderer.toneMapping=ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.0;
    sizeRenderer(true);
    renderCanvas.addEventListener('webglcontextlost',event=>{event.preventDefault();useImage();},events);
    const loaded=await createSaturnModel({
      surfaceUrl:new URL((compact&&host.dataset.saturnSurfaceCompact)||host.dataset.saturnSurface,document.baseURI).href,
      ringUrl:new URL(host.dataset.saturnRings,document.baseURI).href,
      compact
    });
    if(disposed||!renderer){loaded.dispose();return api;}
    model=loaded;
    world.add(model.group);
    // Compile before the first draw so a capable driver can do this in parallel.
    await renderer.compileAsync(world,camera);
    if(disposed||!renderer||!model)return api;
    host.append(canvas);
    ready=true;
    draw(true);
    measure();sync();
  } catch {
    useImage();
  }
  return api;
}
