/* Percurso de localização e iluminação dos fundos da página inicial. */
(()=>{
 const main=document.getElementById('conteudo');
 if(!main||!document.body.classList.contains('portfolio-home'))return;
 const header=document.querySelector('.site-header');
 const footer=document.querySelector('.site-footer');
 const sectionHeading=main.querySelector('.section-heading');
 const ns='http://www.w3.org/2000/svg';
 const make=(tag,attributes={})=>{
  const element=document.createElementNS(ns,tag);
  for(const [key,value]of Object.entries(attributes))element.setAttribute(key,String(value));
  return element;
 };
 const setAttributes=(element,attributes)=>{
  for(const [key,value]of Object.entries(attributes))if(element.getAttribute(key)!==String(value))element.setAttribute(key,String(value));
 };
 const canvas=make('svg',{'class':'story-thread','aria-hidden':'true',focusable:'false'});
 const definitions=make('defs');
 const gradient=make('linearGradient',{id:'story-thread-colors',gradientUnits:'userSpaceOnUse',x1:0,y1:0,x2:0,y2:1});
 const mask=make('mask',{id:'story-thread-safe',maskUnits:'userSpaceOnUse',maskContentUnits:'userSpaceOnUse'});
 const maskBase=make('rect',{fill:'white'});
 mask.append(maskBase);
 definitions.append(gradient,mask);
 canvas.append(definitions);
 const lines=make('g',{mask:'url(#story-thread-safe)'});
 const bed=make('path',{'class':'story-thread-bed'});
 const line=make('path',{'class':'story-thread-line'});
 const progress=make('path',{'class':'story-thread-progress',pathLength:1});
 const branches=make('path',{'class':'story-thread-branches'});
 lines.append(bed,line,progress,branches);
 const ports=make('g');
 canvas.append(lines,ports);
 main.append(canvas);
 // Keep mobile illumination in a small native-scrolling SVG. Its geometry is
 // cropped only when the viewport approaches an edge of the buffered window.
 const windowCanvas=make('svg',{'class':'story-thread-window','aria-hidden':'true',focusable:'false',hidden:''});
 const windowDefs=make('defs');
 const windowClip=make('clipPath',{id:'story-window-safe',clipPathUnits:'userSpaceOnUse'});
 const windowCutouts=make('path',{'clip-rule':'evenodd'});
 windowClip.append(windowCutouts);windowDefs.append(windowClip);windowCanvas.append(windowDefs);
 const windowLines=make('g',{'clip-path':'url(#story-window-safe)'});
 const windowProgress=make('path',{'class':'story-window-progress',pathLength:1});
 const windowHalo=make('path',{'class':'story-window-halo'});
 const windowLight=make('path',{'class':'story-window-light'});
 windowLines.append(windowProgress,windowHalo,windowLight);windowCanvas.append(windowLines);main.append(windowCanvas);
 let windowRange=null;

 const guide=document.createElement('div');
 guide.className='route-guide';
 const button=document.createElement('button');
 button.type='button';button.className='route-guide-button';
 button.setAttribute('aria-label','Localização na página: Início');
 button.setAttribute('aria-expanded','false');
 button.setAttribute('aria-controls','route-guide-location');
 const symbol=document.createElement('span');symbol.className='route-guide-symbol';symbol.setAttribute('aria-hidden','true');
 button.append(symbol);
 const tooltip=document.createElement('div');
 tooltip.id='route-guide-location';tooltip.className='route-guide-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;
 const introduction=document.createElement('span');introduction.textContent='Você está em';
 const locationName=document.createElement('strong');locationName.textContent='Início';
 tooltip.append(introduction,locationName);guide.append(button,tooltip);
 main.querySelector('.hero').after(guide);
 let routeLength=0,samples=[],currentLength=0,targetLength=0,initialized=false,motionFrame=0,lastTime=0;
 let velocity=0;
 let cachedPath='',pathLookup=[],collisionFrame=0,tooltipSize=null;
 const lengthProbe=make('path');
 let geometryData=null,collisions=[],sections=[],hovered=false,focused=false,pinned=false,suppressed=false,held=false,closeTimer=0;

 const selectors={hero:'.hero',software:'.software-case',stage:'.software-stage',paper:'.document-case',paperArt:'.document-art',method:'.method-section',workspace:'.workspace',contact:'.contact-surface'};
 const elements=Object.fromEntries(Object.entries(selectors).map(([key,selector])=>[key,main.querySelector(selector)]));
 if(Object.values(elements).some(element=>!element)){canvas.remove();return;}

 // Offset geometry ignores entrance transforms, so the joins stay attached to the layout.
 const box=element=>{
  let x=0,y=0,current=element;
  while(current&&current!==main){x+=current.offsetLeft;y+=current.offsetTop;current=current.offsetParent;}
  return{x,y,width:element.offsetWidth,height:element.offsetHeight,right:x+element.offsetWidth,bottom:y+element.offsetHeight};
 };
 const computedStyles=new WeakMap();
 const styleOf=element=>{if(!computedStyles.has(element))computedStyles.set(element,getComputedStyle(element));return computedStyles.get(element);};
 const padding=(element,edge)=>parseFloat(styleOf(element)['padding'+edge])||0;

 // Flatten only the generated M/L/Q/C geometry. Adaptive subdivision keeps the
 // guide on the curve without querying SVG layout on every animation frame.
 function buildPathLookup(d,length){
  const tokens=d.match(/[MLQC]|[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi);
  let index=0,current={x:0,y:0},distance=0;
  const points=[];
  const point=()=>({x:Number(tokens[index++]),y:Number(tokens[index++])});
  const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const middle=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const add=end=>{distance+=gap(current,end);points.push({...end,distance});current=end;};
  const deviation=(p,a,b)=>{
   const size=gap(a,b);return size?Math.abs((b.y-a.y)*p.x-(b.x-a.x)*p.y+b.x*a.y-b.y*a.x)/size:gap(p,a);
  };
  function quadratic(a,b,c,depth=0){
   if(depth>=14||(deviation(b,a,c)<.02&&gap(a,b)+gap(b,c)-gap(a,c)<.01)){add(c);return;}
   const ab=middle(a,b),bc=middle(b,c),center=middle(ab,bc);
   quadratic(a,ab,center,depth+1);quadratic(center,bc,c,depth+1);
  }
  function cubic(a,b,c,d,depth=0){
   if(depth>=14||(Math.max(deviation(b,a,d),deviation(c,a,d))<.02&&gap(a,b)+gap(b,c)+gap(c,d)-gap(a,d)<.01)){add(d);return;}
   const ab=middle(a,b),bc=middle(b,c),cd=middle(c,d),left=middle(ab,bc),right=middle(bc,cd),center=middle(left,right);
   cubic(a,ab,left,center,depth+1);cubic(center,right,cd,d,depth+1);
  }
  while(index<tokens.length){
   const command=tokens[index++];
   if(command==='M'){current=point();points.push({...current,distance});}
   else if(command==='L')add(point());
   else if(command==='Q'){const control=point(),end=point();quadratic(current,control,end);}
   else if(command==='C'){const first=point(),second=point(),end=point();cubic(current,first,second,end);}
   else throw new Error('Comando de percurso inválido.');
  }
  const factor=distance?length/distance:1;
  return points.map(item=>({...item,distance:item.distance*factor}));
 }
 function pointAt(distance){
  const target=Math.max(0,Math.min(routeLength,distance));
  let low=0,high=pathLookup.length-1;
  while(low+1<high){const middle=(low+high)>>1;if(pathLookup[middle].distance<target)low=middle;else high=middle;}
  const a=pathLookup[low],b=pathLookup[high],fraction=Math.max(0,Math.min(1,(target-a.distance)/(b.distance-a.distance||1)));
  return{x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction};
 }
 const rounded=(points,radius)=>{
  let result=`M${points[0][0]},${points[0][1]}`;
  for(let index=1;index<points.length-1;index++){
   const [px,py]=points[index-1],[x,y]=points[index],[nx,ny]=points[index+1];
   const incoming=Math.hypot(x-px,y-py),outgoing=Math.hypot(nx-x,ny-y);
   const distance=Math.min(radius,incoming/2,outgoing/2);
   if(!incoming||!outgoing)continue;
   const before=[x-(x-px)/incoming*distance,y-(y-py)/incoming*distance];
   const after=[x+(nx-x)/outgoing*distance,y+(ny-y)/outgoing*distance];
   result+=`L${before[0]},${before[1]}Q${x},${y} ${after[0]},${after[1]}`;
  }
  return result+`L${points.at(-1)[0]},${points.at(-1)[1]}`;
 };

 const protectedSelectors='.section-heading,.project-heading,.gallery-toolbar,.project-footnote,.document-copy,.case-details,.project-index,.method-top,.profile-note,.experience-section,.contact-surface h2,.contact-bottom';
 const protectedElements=[...main.querySelectorAll(protectedSelectors)];
 const controls=[...main.querySelectorAll('a,button,summary')].filter(element=>!guide.contains(element)&&!element.closest('.gallery-tabs'));
 const mobileControls=[...controls,...main.querySelectorAll('.hero-art .art-screen,.hero-art .art-document,.hero-art .art-plinth')];
 const maskRects=protectedElements.map(()=>make('rect',{rx:3,fill:'black'}));
 mask.append(...maskRects);
 const gradientStops=Array.from({length:9},()=>make('stop'));
 gradient.append(...gradientStops);
 const portRects=Array.from({length:4},()=>make('rect',{'class':'story-thread-port',rx:2}));
 ports.append(...portRects);

 function readCollisions(data){
  const result=[];
  for(const element of data.mobile?mobileControls:controls){
   let hidden=false;
   // Querying geometry inside a closed details element can lay out its entire
   // hidden subtree. Check native disclosure state before any style or size read.
   for(let ancestor=element;ancestor&&ancestor!==main;ancestor=ancestor.parentElement){
    if(ancestor.tagName==='DETAILS'&&!ancestor.open&&!ancestor.querySelector(':scope>summary')?.contains(element)){hidden=true;break;}
   }
   if(hidden)continue;
   for(let ancestor=element;ancestor&&ancestor!==main;ancestor=ancestor.parentElement){
    const style=styleOf(ancestor);if(style.display==='none'||style.visibility==='hidden'){hidden=true;break;}
   }
   if(hidden)continue;
   const rect=element.getBoundingClientRect();
   if(!rect.width||!rect.height)continue;
   result.push({left:rect.left-data.mainLeft,right:rect.right-data.mainLeft,top:rect.top+scrollY-data.mainTop,bottom:rect.bottom+scrollY-data.mainTop});
  }
  return result;
 }
 let queued=0;
 function draw(){
  queued=0;
  const width=main.clientWidth,height=main.clientHeight;
  if(!width||!height)return;
  const boxes=Object.fromEntries(Object.entries(elements).map(([key,element])=>[key,box(element)]));
  const mobile=matchMedia('(max-width:760px)').matches;
  const gutter=padding(elements.hero,'Left');
  const compact=width<=1050;
  const rail=mobile?12:compact?18:Math.max(28,Math.min(38,gutter*.5));
  const left=rail,right=width-rail;
  const heroSvg=main.querySelector(mobile?'.backdrop-mobile-routes':'.backdrop-desktop-routes');
  const svgBounds=heroSvg?.getBoundingClientRect();
  const mainRect=main.getBoundingClientRect();
  if(!mobile&&svgBounds.width&&svgBounds.height){
   const scale=Math.max(svgBounds.width/1440,svgBounds.height/850);
   const junction=svgBounds.top-mainRect.top+(svgBounds.height-850*scale)/2+670*scale;
   const aspect=junction>boxes.hero.bottom-40?'none':'xMidYMid slice';
   if(heroSvg.getAttribute('preserveAspectRatio')!==aspect)heroSvg.setAttribute('preserveAspectRatio',aspect);
  }
  const matrix=svgBounds?.width&&svgBounds?.height?heroSvg.getScreenCTM():null;
  const map=(x,y)=>{
   if(matrix){const point=new DOMPoint(x,y).matrixTransform(matrix);return{x:point.x-mainRect.left,y:point.y-mainRect.top};}
   return{x:boxes.hero.x+x*boxes.hero.width/(mobile?390:1440),y:boxes.hero.y+y*boxes.hero.height/850};
  };
  const coordinate=(x,y)=>{const point=map(x,y);return`${point.x},${point.y}`;};
  const start=map(mobile?367:820,mobile?-40:-60);
  const junction=map(mobile?220:510,mobile?477:670);
  const exitX=junction.x,junctionY=junction.y,startY=start.y;
  const introGap=Math.max(10,Math.min(36,(box(sectionHeading).y-boxes.hero.bottom)*.5));
  const paperEntry=boxes.paper.y+padding(elements.paper,'Top')*.44;
  const paperExit=boxes.paper.bottom-padding(elements.paper,'Bottom')*.44;
  const methodEntry=boxes.method.y+padding(elements.method,'Top')*.44;
  const methodExit=boxes.method.bottom-padding(elements.method,'Bottom')*.44;
  const contactY=boxes.contact.y+padding(elements.contact,'Top')*.46;
  const contactX=boxes.contact.x+boxes.contact.width*.86;
  const curveDrop=Math.min(mobile?80:96,(boxes.hero.bottom+introGap-junctionY)*.68);
  const curveShift=Math.min(mobile?40:70,exitX-left-30);
  const curveX=exitX-curveShift,curveY=junctionY+curveDrop;
  const points=[
   [curveX,curveY],[curveX,boxes.hero.bottom+introGap],
   [left,boxes.hero.bottom+introGap],
   ...(mobile?[
    [left,boxes.stage.y+boxes.stage.height*.8],
    [boxes.stage.x+boxes.stage.width*.2,boxes.stage.y+boxes.stage.height*.8],
    [boxes.stage.x+boxes.stage.width*.2,boxes.stage.bottom-18],
    [left,boxes.stage.bottom-18]
   ]:[]),
   [left,paperEntry],[right,paperEntry],
   [right,paperExit],[left,paperExit],[left,methodEntry],[right,methodEntry],
   [right,methodExit],[left,methodExit],[left,contactY],[contactX,contactY]
  ];
  const tail=rounded(points,mobile?14:30).replace(/^M[^LQ]+/,'');
  const entry=mobile
   ?`M${coordinate(367,-40)}L${coordinate(367,355)}Q${coordinate(367,412)} ${coordinate(310,412)}L${coordinate(250,412)}Q${coordinate(220,412)} ${coordinate(220,442)}L${coordinate(220,477)}`
   :`M${coordinate(820,-60)}L${coordinate(820,504)}Q${coordinate(820,560)} ${coordinate(764,560)}L${coordinate(565,560)}Q${coordinate(510,560)} ${coordinate(510,615)}L${coordinate(510,670)}`;
  const path=entry+`C${exitX},${junctionY+curveDrop*.62} ${curveX},${junctionY+curveDrop*.38} ${curveX},${curveY}`+tail;
  const data={width,height,mobile,compact,paper:boxes.paper,accent:[boxes.stage,boxes.contact],mainTop:mainRect.top+scrollY,mainLeft:mainRect.left,startY,endY:contactY,scale:matrix?.a||1,
   headerBottom:header.getBoundingClientRect().bottom,documentHeight:Math.max(innerHeight,footer?footer.getBoundingClientRect().bottom+scrollY:mainRect.top+scrollY+height)};
  const rectangles=protectedElements.map(box);
  data.rectangles=rectangles;
  const nextSections=[
   ['.hero','Início'],['.selected-work','Projetos'],['.document-case','Resumos'],
   ['.other-work','Outros projetos'],['.method-section','Como trabalho'],
   ['.experience-section','Experiência'],['.contact-section','Contato']
  ].map(([selector,label])=>({y:box(main.querySelector(selector)).y,label}));
  const nextCollisions=readCollisions(data);
  if(path!==cachedPath){
   lengthProbe.setAttribute('d',path);
   routeLength=lengthProbe.getTotalLength();
   pathLookup=buildPathLookup(path,routeLength);
   cachedPath=path;
  }
  // All layout reads are complete before updating SVG and HTML attributes.
  setAttributes(canvas,{viewBox:`0 0 ${width} ${height}`});
  if(canvas.style.height!==height+'px')canvas.style.height=height+'px';
  for(const element of [bed,line,progress])if(element.getAttribute('d')!==path)element.setAttribute('d',path);
  setAttributes(gradient,{y2:height});
  const stops=[
   [0,'#6389c7'],[boxes.paper.y-2,'#6389c7'],[boxes.paper.y+2,'#5a78a2'],
   [boxes.paper.bottom-2,'#5a78a2'],[boxes.paper.bottom+2,'#7790b4'],
   [boxes.method.y,'#7195b2'],[boxes.contact.y,'#7195b2'],[contactY,'#b6caff'],[height,'#b6caff']
  ];
  stops.forEach(([y,color],index)=>setAttributes(gradientStops[index],{offset:Math.max(0,Math.min(1,y/height)),'stop-color':color}));
  setAttributes(maskBase,{width,height});setAttributes(mask,{x:0,y:0,width,height});
  rectangles.forEach((rect,index)=>setAttributes(maskRects[index],{x:rect.x-5,y:rect.y-4,width:rect.width+10,height:rect.height+8}));
  const anchors=[
   {rail:left,x:boxes.stage.x-1,y:boxes.stage.y+boxes.stage.height*.44,tone:'dark'},
   {rail:right,x:boxes.paper.right-2,y:boxes.paperArt.y+boxes.paperArt.height*.65,tone:'paper'},
   {rail:right,x:boxes.workspace.right+1,y:boxes.workspace.y+boxes.workspace.height*.5,tone:'dark'}
  ];
  setAttributes(branches,{d:anchors.map(({rail,x,y})=>`M${rail},${y}H${x}`).join('')});
  const size=mobile?5:7;
  anchors.forEach(({rail,y,tone},index)=>setAttributes(portRects[index],{'data-tone':tone,x:rail-size/2,y:y-size/2,width:size,height:size}));
  setAttributes(portRects[3],{'data-tone':'contact',x:contactX-3,y:contactY-3,width:6,height:6});
  canvas.dataset.ready='true';
  canvas.dataset.height=height;
  sections=nextSections;collisions=nextCollisions;
  updateGuideGeometry(data);
  windowRange=null;
  windowCanvas.toggleAttribute('hidden',!mobile);
  canvas.toggleAttribute('data-windowed',mobile);
 }
 const schedule=()=>{if(!queued)queued=requestAnimationFrame(draw);};
 const resize=new ResizeObserver(schedule);
 [main,...Object.values(elements)].forEach(element=>resize.observe(element));
 main.addEventListener('toggle',schedule,true);
 window.addEventListener('resize',schedule,{passive:true});
 document.fonts.ready.then(schedule);
 schedule();
 function updateGuideGeometry(data){
  const resized=geometryData&&geometryData.width!==data.width;
  geometryData=data;
  const weight=data.mobile ? .18 : Math.min(.055,(innerHeight-data.headerBottom)/(data.width*10));
  const raw=pathLookup.map(point=>({distance:point.distance,virtual:point.y+point.distance*weight}));
  const min=raw[0].virtual,span=raw.at(-1).virtual-min;
  samples=raw.map(sample=>({distance:sample.distance,y:data.startY+(sample.virtual-min)/span*(data.endY-data.startY)}));
  tooltipSize=null;
  guide.style.setProperty('--guide-size',data.mobile?'16px':data.compact?'20px':Math.min(50,Math.max(32,38*data.scale))+'px');
  guide.style.setProperty('--guide-hit',data.compact?'28px':Math.max(44,Math.min(54,38*data.scale+4))+'px');
  requestMotion(Boolean(resized));
 }
 function pointClear(point){
  const halfWidth=geometryData.compact?12:Math.max(22,Math.min(27,38*geometryData.scale/2+2));
  const halfHeight=geometryData.compact?22:halfWidth;
  if(point.x-halfWidth<-.25||point.x+halfWidth>geometryData.width+.25)return false;
  return !collisions.some(rect=>point.x+halfWidth>rect.left&&point.x-halfWidth<rect.right&&point.y+halfHeight>rect.top&&point.y-halfHeight<rect.bottom);
 }
 function distanceForY(y){
  let low=0,high=samples.length-1;
  while(low+1<high){const mid=(low+high)>>1;if(samples[mid].y<y)low=mid;else high=mid;}
  const a=samples[low],b=samples[high],fraction=Math.max(0,Math.min(1,(y-a.y)/(b.y-a.y||1)));
  return a.distance+(b.distance-a.distance)*fraction;
 }
 function updateWindow(){
  const data=geometryData,viewTop=Math.max(0,scrollY-data.mainTop),viewBottom=viewTop+innerHeight;
  if(!windowRange||windowRange.viewport!==innerHeight||viewTop<windowRange.top+64&&windowRange.top>0||viewBottom>windowRange.bottom-64&&windowRange.bottom<data.height){
   const top=Math.max(0,viewTop-192),bottom=Math.min(data.height,viewBottom+192);
   const cut=(y,a,b)=>{
    const fraction=Math.max(0,Math.min(1,(y-a.y)/(b.y-a.y||1)));
    return{x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,distance:a.distance+(b.distance-a.distance)*fraction};
   };
   let start=pathLookup.findIndex(point=>point.y>=top);
   if(start<0)start=pathLookup.length-1;
   const points=[start?cut(top,pathLookup[start-1],pathLookup[start]):pathLookup[0]];
   let index=start;
   for(;index<pathLookup.length&&pathLookup[index].y<=bottom;index++)points.push(pathLookup[index]);
   if(index<pathLookup.length&&index>0)points.push(cut(bottom,pathLookup[index-1],pathLookup[index]));
   const d=points.map((point,index)=>`${index?'L':'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join('');
   windowRange={top,bottom,viewport:innerHeight,start:points[0].distance,end:points.at(-1).distance};
   setAttributes(windowCanvas,{viewBox:`0 ${top} ${data.width} ${bottom-top}`});
   windowCanvas.style.top=top+'px';windowCanvas.style.height=(bottom-top)+'px';
   for(const path of [windowProgress,windowHalo,windowLight])setAttributes(path,{d});
   for(const [name,value]of Object.entries({origin:windowRange.start,dash:routeLength*.024,gap:routeLength*.144,step:routeLength*.168}))windowCanvas.style.setProperty('--window-'+name,value+'px');
   // Union intersecting text boxes before using even-odd clipping. This avoids
   // an alpha mask allocation and prevents overlapping holes from reopening.
   const areas=[];
   for(const rect of data.rectangles){
    const area={x:rect.x-5,y:Math.max(top,rect.y-4),right:rect.right+5,bottom:Math.min(bottom,rect.bottom+4)};
    if(area.bottom<=area.y)continue;
    for(let index=0;index<areas.length;index++){
     const other=areas[index];
     if(area.x>other.right||area.right<other.x||area.y>other.bottom||area.bottom<other.y)continue;
     area.x=Math.min(area.x,other.x);area.y=Math.min(area.y,other.y);area.right=Math.max(area.right,other.right);area.bottom=Math.max(area.bottom,other.bottom);
     areas.splice(index,1);index=-1;
    }
    areas.push(area);
   }
   const outline=rect=>`M${rect.x},${rect.y}H${rect.right}V${rect.bottom}H${rect.x}Z`;
   setAttributes(windowCutouts,{d:outline({x:0,y:top,right:data.width,bottom})+areas.map(outline).join('')});
  }
  const offset=1-Math.max(0,Math.min(1,(currentLength-windowRange.start)/(windowRange.end-windowRange.start||1)));
  if(windowProgress.style.strokeDashoffset!==String(offset))windowProgress.style.strokeDashoffset=String(offset);
 }
 function chooseTarget(distance){
  if(distance<1)return 0;
  let sectionIndex=0;
  sections.forEach((section,index)=>{if(section.y<=geometryData.readingY)sectionIndex=index;});
  const top=Math.max(sections[sectionIndex].y,scrollY-geometryData.mainTop+geometryData.headerBottom+28);
  const bottom=Math.min(sections[sectionIndex+1]?.y??geometryData.height,scrollY-geometryData.mainTop+innerHeight-28);
  for(let offset=0;offset<=innerHeight*1.5;offset+=24){
   for(const candidate of offset?[distance+offset,distance-offset]:[distance]){
    if(candidate<0||candidate>routeLength)continue;
    const point=pointAt(candidate);
    if(point.y>=top&&point.y<=bottom&&pointClear(point))return candidate;
   }
  }
  return distance;
 }
 function requestMotion(snap=false){
  if(!geometryData||!samples.length||document.body.dataset.background!=='fluxos')return;
  const headerBottom=geometryData.headerBottom;
  const focal=headerBottom+(innerHeight-headerBottom)*.55;
  geometryData.readingY=scrollY+focal-geometryData.mainTop;
  const y=Math.max(geometryData.startY,Math.min(geometryData.endY,scrollY+focal-geometryData.mainTop));
  const atEnd=scrollY>=geometryData.documentHeight-innerHeight-2;
  targetLength=chooseTarget(atEnd?routeLength:distanceForY(y));
  if(!initialized){
   currentLength=scrollY<40?0:targetLength;velocity=0;initialized=true;lastTime=0;
   guide.dataset.motion='entering';
  }else if(snap||Math.abs(pointAt(targetLength).y-pointAt(currentLength).y)>innerHeight*1.6){
   currentLength=targetLength;velocity=0;lastTime=0;
  }
  if(!motionFrame){lastTime=0;motionFrame=requestAnimationFrame(moveGuide);}
 }
 function moveGuide(time){
  motionFrame=0;
  if(document.hidden||document.body.dataset.background!=='fluxos'){
   velocity=0;lastTime=0;guide.dataset.motion='paused';return;
  }
  const elapsed=(lastTime?Math.min(geometryData.mobile?250:40,time-lastTime):16)/1000;lastTime=time;
  if(!held){
   // Critically damped motion preserves velocity when the scroll direction changes.
   const omega=geometryData.mobile?22:5.5,offset=currentLength-targetLength,combined=velocity+omega*offset,decay=Math.exp(-omega*elapsed);
   let next=targetLength+(offset+combined*elapsed)*decay;
   let nextVelocity=(velocity-omega*combined*elapsed)*decay;
   const maxSpeed=geometryData.mobile?5000:geometryData.compact?950:1550,maxStep=maxSpeed*elapsed;
   if(Math.abs(next-currentLength)>maxStep){next=currentLength+Math.sign(next-currentLength)*maxStep;nextVelocity=Math.sign(next-currentLength)*maxSpeed;}
   currentLength=next;velocity=nextVelocity;
  }else velocity=0;
  if(Math.abs(currentLength-targetLength)<.35&&Math.abs(velocity)<4){currentLength=targetLength;velocity=0;}
  currentLength=Math.max(0,Math.min(routeLength,currentLength));
  const point=pointAt(currentLength);
  guide.style.transform=`translate3d(${point.x}px,${point.y}px,0)`;
  if(!guide.hasAttribute('data-ready'))guide.setAttribute('data-ready','');
  guide.dataset.distance=currentLength.toFixed(2);
  const motion=held?'held':currentLength===targetLength?'settled':'following';
  if(guide.dataset.motion!==motion)guide.dataset.motion=motion;
  const pointerEvents=focused||pinned||pointClear(point)?'auto':'none';
  if(button.style.pointerEvents!==pointerEvents)button.style.pointerEvents=pointerEvents;
  if(geometryData.mobile)updateWindow();
  else progress.style.strokeDashoffset=String(1-currentLength/routeLength);
  let section=sections[0];
  for(const candidate of sections){if(candidate.y<=geometryData.readingY+1)section=candidate;else break;}
  if(locationName.textContent!==section.label){
   locationName.textContent=section.label;
   button.setAttribute('aria-label','Localização na página: '+section.label);
   tooltipSize=null;
  }
  if(guide.dataset.section!==section.label)guide.dataset.section=section.label;
  const paper=geometryData.paper;
  const tone=geometryData.accent.some(rect=>point.x>=rect.x&&point.x<=rect.right&&point.y>=rect.y&&point.y<=rect.bottom)
   ?'accent':point.y>=paper.y&&point.y<=paper.bottom?'paper':'dark';
  if(guide.dataset.tone!==tone)guide.dataset.tone=tone;
  if(!tooltip.hidden)placeTooltip(point);
  if(!held&&(currentLength!==targetLength||Math.abs(velocity)>=4))motionFrame=requestAnimationFrame(moveGuide);
 }
 function placeTooltip(point){
  if(!tooltipSize){const bounds=tooltip.getBoundingClientRect();tooltipSize={width:bounds.width,height:bounds.height};}
  const bounds=tooltipSize,viewportWidth=geometryData.width;
  const viewX=geometryData.mainLeft+point.x,viewY=geometryData.mainTop+point.y-scrollY;
  const gap=(geometryData.compact?12:Math.max(22,Math.min(27,38*geometryData.scale/2+2)))+10;
  let x=viewX+gap;
  if(x+bounds.width>viewportWidth-12)x=viewX-gap-bounds.width;
  x=Math.max(12,Math.min(viewportWidth-bounds.width-12,x));
  const ceiling=geometryData.headerBottom+8;
  const y=Math.max(ceiling,Math.min(innerHeight-bounds.height-12,viewY-bounds.height/2));
  tooltip.style.transform=`translate(${x-viewX}px,${y-viewY}px)`;
 }
 function renderTooltip(){
  const open=!suppressed&&(hovered||focused||pinned);
  tooltip.hidden=!open;button.setAttribute('aria-expanded',String(open));
  if(open){button.setAttribute('aria-describedby',tooltip.id);placeTooltip(pointAt(currentLength));}
  else button.removeAttribute('aria-describedby');
 }
 function dismiss(){pinned=false;hovered=false;held=false;suppressed=true;renderTooltip();requestMotion();}
 guide.addEventListener('pointerenter',event=>{
  if(event.pointerType!=='mouse')return;
  clearTimeout(closeTimer);hovered=true;held=true;suppressed=false;renderTooltip();
 });
 guide.addEventListener('pointerleave',event=>{
  if(event.pointerType!=='mouse')return;
  closeTimer=setTimeout(()=>{hovered=false;held=false;renderTooltip();requestMotion();},140);
 });
 button.addEventListener('focus',()=>{focused=button.matches(':focus-visible');suppressed=false;held=focused;renderTooltip();});
 button.addEventListener('blur',()=>{focused=false;held=false;suppressed=false;renderTooltip();requestMotion();});
 button.addEventListener('pointerdown',()=>{held=true;velocity=0;});
 button.addEventListener('click',()=>{if(pinned)dismiss();else{pinned=true;suppressed=false;renderTooltip();}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!tooltip.hidden){event.preventDefault();dismiss();}});
 document.addEventListener('pointerdown',event=>{if(!guide.contains(event.target)&&!tooltip.hidden)dismiss();});
 // Layout work is cached; scrolling only updates a point on the path, once per frame.
 document.addEventListener('scroll',()=>{held=false;requestMotion();},{passive:true});
 document.addEventListener('visibilitychange',()=>{
  if(document.hidden){cancelAnimationFrame(motionFrame);motionFrame=0;velocity=0;lastTime=0;}
  else requestMotion();
 });
 const refreshCollisions=()=>{
  if(queued||collisionFrame||!geometryData)return;
  collisionFrame=requestAnimationFrame(()=>{collisionFrame=0;collisions=readCollisions(geometryData);requestMotion();});
 };
 const sceneChanges=new MutationObserver(records=>{if(records.some(record=>record.target.dataset.motionScene==='complete'))refreshCollisions();});
 sceneChanges.observe(main,{subtree:true,attributes:true,attributeFilter:['data-motion-scene']});
 const introChanges=new MutationObserver(()=>{if(document.documentElement.dataset.introState==='complete')refreshCollisions();});
 introChanges.observe(document.documentElement,{attributes:true,attributeFilter:['data-intro-state']});
 window.addEventListener('pagehide',()=>{cancelAnimationFrame(queued);queued=0;cancelAnimationFrame(collisionFrame);collisionFrame=0;cancelAnimationFrame(motionFrame);motionFrame=0;clearTimeout(closeTimer);});
 window.addEventListener('pageshow',schedule);
})();

;
(()=>{
 if(!document.body.classList.contains('portfolio-home'))return;
 const visible=new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.classList.toggle('is-backdrop-visible',entry.isIntersecting)),{threshold:.1});
 document.querySelectorAll('.section-backdrop').forEach(element=>visible.observe(element));
 const root=document.documentElement;
 const ns='http://www.w3.org/2000/svg';

 document.querySelectorAll('.backdrop-routes:not(.backdrop-desktop-routes):not(.backdrop-mobile-routes)').forEach((svg,sceneIndex)=>{
  const group=document.createElementNS(ns,'g');
  group.setAttribute('aria-hidden','true');
  [...svg.querySelectorAll('path')].slice(0,3).forEach((path,index)=>{
   const trace=document.createElementNS(ns,'path');
   trace.setAttribute('d',path.getAttribute('d'));
   trace.setAttribute('pathLength','1');
   trace.setAttribute('class','ambient-trace');
   trace.style.setProperty('--ambient-delay',(-2-sceneIndex*1.2-index*2.1)+'s');
   group.append(trace);
  });
  svg.append(group);
 });

 // Share the existing path and mask; resizing never creates a second route.
 const thread=document.querySelector('.story-thread-line');
 let geometry;
 if(thread){
  const sheen=document.createElementNS(ns,'path');
  sheen.setAttribute('class','story-thread-ambient');
  sheen.setAttribute('pathLength','1');
  const sync=()=>sheen.setAttribute('d',thread.getAttribute('d')||'');
  sync();
  thread.parentElement.append(sheen);
  geometry=new MutationObserver(sync);
  geometry.observe(thread,{attributes:true,attributeFilter:['d']});
 }

 const visibility=()=>root.toggleAttribute('data-ambient-paused',document.hidden);
 document.addEventListener('visibilitychange',visibility);
 window.addEventListener('pagehide',()=>root.setAttribute('data-ambient-paused',''));
 window.addEventListener('pageshow',visibility);
 visibility();
})();

;
(()=>{
 if(!document.body.classList.contains('portfolio-home'))return;
 const ns='http://www.w3.org/2000/svg';
 const base=document.getElementById('story-thread-colors');
 const sheen=document.querySelector('.story-thread-ambient');
 if(base&&sheen){
  const light=document.createElementNS(ns,'linearGradient');
  light.id='story-thread-light';
  base.after(light);
  const colors={'#6389c7':'#c4dcff','#5a78a2':'#305bb7','#7790b4':'#b8d2ff','#7195b2':'#a6ddeb','#b6caff':'#e5edff'};
  const syncColors=()=>{
   for(const name of ['gradientUnits','x1','y1','x2','y2']){const value=base.getAttribute(name)||'0';if(light.getAttribute(name)!==value)light.setAttribute(name,value);}
   if(light.children.length!==base.children.length)light.replaceChildren(...[...base.children].map(()=>document.createElementNS(ns,'stop')));
   [...base.children].forEach((stop,index)=>{
    const copy=light.children[index],offset=stop.getAttribute('offset')||'0',color=colors[stop.getAttribute('stop-color')]||'#c4dcff';
    if(copy.getAttribute('offset')!==offset)copy.setAttribute('offset',offset);
    if(copy.getAttribute('stop-color')!==color)copy.setAttribute('stop-color',color);
   });
  };
  const halo=document.createElementNS(ns,'path');
  halo.setAttribute('class','story-thread-ambient-halo');halo.setAttribute('pathLength','1');
  sheen.before(halo);
  const syncPath=()=>halo.setAttribute('d',sheen.getAttribute('d')||'');
  syncColors();syncPath();
  new MutationObserver(syncColors).observe(base,{attributes:true,childList:true,subtree:true});
  new MutationObserver(syncPath).observe(sheen,{attributes:true,attributeFilter:['d']});
 }
})();
