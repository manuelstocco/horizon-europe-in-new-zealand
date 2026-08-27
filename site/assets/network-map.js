(() => {
  const D=window.HE_DATA,H=window.HE,G=window.HE_GEO_DATA,WORLD=window.HE_WORLD;
  const canvas=document.querySelector('[data-network-map]');
  if(!D||!H||!G||!WORLD||!canvas)return;
  const ctx=canvas.getContext('2d');
  const shell=canvas.closest('.network-map-shell');
  const tooltip=document.querySelector('[data-map-tooltip]');
  const empty=document.querySelector('[data-map-empty]');
  const detail=document.querySelector('[data-map-detail]');
  const projectsPanel=document.querySelector('[data-map-projects]');
  const state={clusters:[],projects:[],countries:[]};
  const view={scale:1,tx:0,ty:0};
  const centreLongitude=170;
  let width=0,height=0,dpr=1,network={projects:[],nodes:[],edges:[],countries:new Set()},hover=null,drag=null,drawQueued=false,selectedDetail=null;
  const countryName=new Map(D.countries.map(country=>[country.code,country.name]));
  const clusterName=new Map(D.clusters.map(cluster=>[cluster.code,cluster.short]));
  const roleNames={participant:'Participant',coordinator:'Coordinator',thirdParty:'Third party',associatedPartner:'Associated partner'};
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const colourWithAlpha=(hex,alpha)=>{
    const value=String(hex||'#708398').replace('#','');
    const full=value.length===3?value.split('').map(char=>char+char).join(''):value;
    const number=parseInt(full,16);
    return `rgba(${number>>16},${number>>8&255},${number&255},${alpha})`;
  };
  const hash=value=>{let result=0;for(const char of String(value))result=((result<<5)-result+char.charCodeAt(0))|0;return Math.abs(result);};
  const displayCode=code=>code==='GB'?'UK':code==='GR'?'EL':code;

  const clusterControl=H.mountMultiSelect(document.querySelector('[data-map-filter="clusters"]'),{
    options:H.uniqueOptions('clusters'),placeholder:'All clusters',onChange:values=>{state.clusters=values;update();}
  });
  const projectOptions=[...D.projects].sort((a,b)=>a.acronym.localeCompare(b.acronym)).map(project=>({value:project.id,label:`${project.acronym} — ${project.title}`}));
  const projectControl=H.mountMultiSelect(document.querySelector('[data-map-filter="projects"]'),{
    options:projectOptions,placeholder:'All projects',searchable:true,searchPlaceholder:'Search projects…',onChange:values=>{state.projects=values;update();}
  });
  const countryControl=H.mountMultiSelect(document.querySelector('[data-map-filter="countries"]'),{
    options:H.uniqueOptions('countries'),placeholder:'All partner countries',searchable:true,searchPlaceholder:'Search countries…',countryActions:true,onChange:values=>{state.countries=values;update();}
  });

  function selectedProjects(){
    const clusters=new Set(state.clusters),projects=new Set(state.projects),countries=new Set(state.countries);
    return D.projects.filter(project=>{
      if(clusters.size&&!clusters.has(project.clusterCode))return false;
      if(projects.size&&!projects.has(project.id))return false;
      if(countries.size&&!project.organisations.some(org=>org.countryCode!=='NZ'&&countries.has(org.countryCode)))return false;
      return true;
    });
  }

  function buildNetwork(){
    const projects=selectedProjects(),countryScope=new Set(state.countries),nodes=new Map(),edges=new Map(),countries=new Set();
    const ensureNode=(org,project)=>{
      const key=`${org.countryCode}|${org.name}`,location=G.organisations[key];
      if(!location)return null;
      let node=nodes.get(key);
      if(!node){node={kind:'node',key,name:org.name,countryCode:org.countryCode,country:org.country,city:location.city,lat:location.lat,lon:location.lon,precision:location.precision,geocodedName:location.geocodedName,projects:new Map(),roles:new Set(),funding:0};nodes.set(key,node);}
      if(!node.projects.has(project.id))node.funding+=org.contribution||0;
      node.projects.set(project.id,project);node.roles.add(org.role||'participant');
      return node;
    };
    projects.forEach(project=>{
      const unique=new Map(project.organisations.map(org=>[`${org.countryCode}|${org.name}`,org]));
      const nz=[...unique.values()].filter(org=>org.countryCode==='NZ');
      const partners=[...unique.values()].filter(org=>org.countryCode!=='NZ'&&(!countryScope.size||countryScope.has(org.countryCode)));
      const nzNodes=nz.map(org=>ensureNode(org,project)).filter(Boolean);
      const partnerNodes=partners.map(org=>ensureNode(org,project)).filter(Boolean);
      partnerNodes.forEach(node=>countries.add(node.countryCode));
      nzNodes.forEach(source=>partnerNodes.forEach(target=>{
        const key=`${source.key}→${target.key}|${project.clusterCode}`;
        let edge=edges.get(key);
        if(!edge){edge={kind:'edge',key,source,target,clusterCode:project.clusterCode,projects:new Map(),screenPoints:[]};edges.set(key,edge);}
        edge.projects.set(project.id,project);
      }));
    });
    return {projects,nodes:[...nodes.values()],edges:[...edges.values()].sort((a,b)=>a.projects.size-b.projects.size),countries};
  }

  function selectionLabels(){
    const labels=[];
    const group=(values,getLabel,noun)=>{
      if(values.length>3)labels.push(`${values.length} ${noun} selected`);
      else values.forEach(value=>labels.push(getLabel(value)));
    };
    group(state.clusters,value=>clusterName.get(value)||value,'clusters');
    group(state.projects,value=>D.projects.find(project=>project.id===value)?.acronym||value,'projects');
    group(state.countries,value=>countryName.get(value)||value,'countries');
    return labels;
  }

  function renderSummary(){
    const partnerNodes=network.nodes.filter(node=>node.countryCode!=='NZ');
    const metrics=[
      ['Projects',network.projects.length,'Distinct projects in scope'],
      ['Organisations',network.nodes.length,'New Zealand and partner organisations'],
      ['Partner countries',network.countries.size,'Countries linked to New Zealand'],
      ['Active links',network.edges.length,'Organisation pairs, separated by cluster']
    ];
    document.querySelector('[data-map-metrics]').innerHTML=metrics.map(([label,value,note])=>`<article class="metric-card"><span class="metric-label">${label}</span><strong>${H.fmtNumber(value)}</strong><small>${note}</small></article>`).join('');
    H.renderChips(document.querySelector('[data-map-selection]'),selectionLabels(),'All clusters, projects and partner countries');
    const names=state.countries.map(code=>countryName.get(code)).filter(Boolean);
    const partnerText=names.length?(names.length===1?names[0]:names.length<=3?names.join(', '):`${names.length} selected countries`):`${network.countries.size} partner countries`;
    document.querySelector('[data-map-narrative]').textContent=network.projects.length?`${network.projects.length} projects connect New Zealand organisations with ${partnerText}, through ${partnerNodes.length} visible partner organisations.`:'No projects match the current selection.';
    const meta=G.metadata;
    document.querySelector('[data-geocoding-summary]').textContent=`${meta.cityPrecision} of ${meta.distinctOrganisations} organisations are positioned at city level.`;
  }

  function renderLegend(){
    const active=new Set(network.projects.map(project=>project.clusterCode));
    document.querySelector('[data-map-legend]').innerHTML=`<div class="map-cluster-legend">${D.clusters.map(cluster=>`<span class="${active.has(cluster.code)?'':'muted'}"><i style="background:${cluster.color}"></i>${escapeHtml(cluster.short)}</span>`).join('')}</div><div class="map-symbol-legend"><span><i class="map-symbol nz"></i>New Zealand organisation</span><span><i class="map-symbol partner"></i>Partner organisation</span></div>`;
  }

  function renderProjectList(){
    const countryScope=new Set(state.countries);
    if(!network.projects.length){projectsPanel.innerHTML='<div class="chart-empty">No projects match the selection.</div>';return;}
    projectsPanel.className='map-project-list';
    projectsPanel.innerHTML=network.projects.map(project=>{
      const partners=[...new Set(project.organisations.filter(org=>org.countryCode!=='NZ'&&(!countryScope.size||countryScope.has(org.countryCode))).map(org=>org.countryCode))];
      return `<a class="map-project-row" href="projects.html#${project.id}"><i style="background:${H.clusterColor(project.clusterCode)}"></i><span><strong>${escapeHtml(project.acronym)}</strong><small>${escapeHtml(project.title)}</small></span><b>${partners.length} ${partners.length===1?'country':'countries'}</b></a>`;
    }).join('');
  }

  function renderDefaultDetail(){
    selectedDetail=null;
    detail.innerHTML='<p class="map-detail-placeholder">Select a point or connection on the map to inspect the organisations, roles and projects behind it.</p>';
  }

  function renderDetail(target){
    if(!target){renderDefaultDetail();return;}
    selectedDetail=target;
    if(target.kind==='node'){
      const projects=[...target.projects.values()];
      detail.innerHTML=`<div class="map-detail-head"><span class="map-detail-country">${escapeHtml(target.country)}</span><h3>${escapeHtml(target.name)}</h3><p>${escapeHtml(target.city)}${target.precision==='country'?' · approximate country position':''}</p></div><dl class="map-detail-metrics"><div><dt>Projects</dt><dd>${projects.length}</dd></div><div><dt>Role</dt><dd>${escapeHtml([...target.roles].map(role=>roleNames[role]||role).join(', '))}</dd></div><div><dt>EU contribution</dt><dd>${H.fmtMoney(target.funding)}</dd></div></dl><div class="map-detail-projects">${projects.map(project=>`<a href="projects.html#${project.id}"><i style="background:${H.clusterColor(project.clusterCode)}"></i><span><strong>${escapeHtml(project.acronym)}</strong><small>${escapeHtml(clusterName.get(project.clusterCode)||project.cluster)}</small></span></a>`).join('')}</div>`;
      return;
    }
    const projects=[...target.projects.values()];
    detail.innerHTML=`<div class="map-detail-head connection"><span class="map-detail-country">${escapeHtml(clusterName.get(target.clusterCode)||target.clusterCode)}</span><h3>${escapeHtml(target.source.name)} <em>↔</em> ${escapeHtml(target.target.name)}</h3><p>${escapeHtml(target.source.city)}, New Zealand · ${escapeHtml(target.target.city)}, ${escapeHtml(target.target.country)}</p></div><dl class="map-detail-metrics"><div><dt>Projects</dt><dd>${projects.length}</dd></div><div><dt>Cluster</dt><dd><i class="detail-cluster-dot" style="background:${H.clusterColor(target.clusterCode)}"></i>${escapeHtml(clusterName.get(target.clusterCode)||target.clusterCode)}</dd></div></dl><div class="map-detail-projects">${projects.map(project=>`<a href="projects.html#${project.id}"><i style="background:${H.clusterColor(project.clusterCode)}"></i><span><strong>${escapeHtml(project.acronym)}</strong><small>${escapeHtml(project.title)}</small></span></a>`).join('')}</div>`;
  }

  function mapDimensions(){
    const mapHeight=Math.min(height,width/2),top=(height-mapHeight)/2;
    return {mapHeight,top};
  }
  function normalisedLongitude(lon){return ((lon-centreLongitude+540)%360)-180;}
  function basePoint(lon,lat){
    const {mapHeight,top}=mapDimensions(),relative=normalisedLongitude(lon);
    return {x:(relative+180)/360*width,y:top+(90-lat)/180*mapHeight};
  }
  function screenPoint(point){return {x:(point.x-width/2)*view.scale+width/2+view.tx,y:(point.y-height/2)*view.scale+height/2+view.ty};}

  function layoutNodes(){
    const groups=new Map();
    network.nodes.forEach(node=>{
      const key=`${node.lat.toFixed(4)}|${node.lon.toFixed(4)}`;
      const rows=groups.get(key)||[];rows.push(node);groups.set(key,rows);
    });
    groups.forEach(rows=>rows.sort((a,b)=>a.key.localeCompare(b.key)).forEach((node,index)=>{
      const point=basePoint(node.lon,node.lat),angle=index*2.3999632297,radius=index?4.2*Math.sqrt(index):0;
      node.base={x:point.x+Math.cos(angle)*radius,y:point.y+Math.sin(angle)*radius};
      node.screen=screenPoint(node.base);
      node.radius=(node.countryCode==='NZ'?5.2:3.2)+Math.min(4,Math.sqrt(node.projects.size)*1.15);
    }));
  }

  function drawGrid(){
    const {mapHeight,top}=mapDimensions();
    ctx.save();ctx.strokeStyle='rgba(175,205,220,.09)';ctx.lineWidth=1;
    for(let degree=-180;degree<=180;degree+=30){
      const x=(degree+180)/360*width,a=screenPoint({x,y:top}),b=screenPoint({x,y:top+mapHeight});
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    for(let latitude=-60;latitude<=60;latitude+=30){
      const y=top+(90-latitude)/180*mapHeight,a=screenPoint({x:0,y}),b=screenPoint({x:width,y});
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    ctx.restore();
  }

  function unwrappedRing(ring){
    let previous=null;
    return ring.map(([lon,lat])=>{
      let relative=normalisedLongitude(lon);
      if(previous!==null){while(relative-previous>180)relative-=360;while(relative-previous<-180)relative+=360;}
      previous=relative;return [relative,lat];
    });
  }

  function drawWorld(){
    const selected=new Set(state.countries),visible=network.countries;
    WORLD.features.forEach(feature=>{
      const code=displayCode(feature.properties.code),polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
      const fill=code==='NZ'?'rgba(37,182,165,.28)':selected.has(code)?'rgba(57,127,216,.28)':visible.has(code)?'rgba(255,255,255,.11)':'rgba(255,255,255,.045)';
      ctx.fillStyle=fill;ctx.strokeStyle='rgba(184,207,220,.22)';ctx.lineWidth=.75;
      polygons.forEach(polygon=>{
        [-360,0,360].forEach(offset=>{
          const path=new Path2D();
          polygon.forEach(ring=>{
            const points=unwrappedRing(ring);
            points.forEach(([relative,lat],index)=>{
              const {mapHeight,top}=mapDimensions();
              const base={x:(relative+offset+180)/360*width,y:top+(90-lat)/180*mapHeight},point=screenPoint(base);
              index?path.lineTo(point.x,point.y):path.moveTo(point.x,point.y);
            });
            path.closePath();
          });
          ctx.fill(path,'evenodd');ctx.stroke(path);
        });
      });
    });
  }

  function curvePoints(edge){
    const a=edge.source.screen,b=edge.target.screen,dx=b.x-a.x,dy=b.y-a.y,length=Math.max(1,Math.hypot(dx,dy));
    const direction=hash(edge.source.key+edge.target.key+edge.clusterCode)%2?1:-1;
    const clusterOffset=D.clusters.findIndex(cluster=>cluster.code===edge.clusterCode)-2.5;
    const bend=direction*Math.min(76,18+length*.09)+clusterOffset*2.5;
    const control={x:(a.x+b.x)/2-dy/length*bend,y:(a.y+b.y)/2+dx/length*bend};
    const points=[];
    for(let step=0;step<=18;step+=1){
      const t=step/18,one=1-t;
      points.push({x:one*one*a.x+2*one*t*control.x+t*t*b.x,y:one*one*a.y+2*one*t*control.y+t*t*b.y});
    }
    return points;
  }

  function drawEdges(){
    network.edges.forEach(edge=>{
      const points=curvePoints(edge);edge.screenPoints=points;
      const related=hover===edge||(hover?.kind==='node'&&(hover===edge.source||hover===edge.target));
      ctx.beginPath();points.forEach((point,index)=>index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y));
      ctx.strokeStyle=colourWithAlpha(H.clusterColor(edge.clusterCode),related ? .92 : (network.edges.length>700 ? .16 : .24));
      ctx.lineWidth=related ? 3.2 : Math.min(2.2,.65+Math.sqrt(edge.projects.size)*.45);ctx.stroke();
    });
  }

  function drawNodes(){
    network.nodes.forEach(node=>{
      const active=hover===node,r=node.radius*(active?1.35:1);
      ctx.beginPath();ctx.arc(node.screen.x,node.screen.y,r,0,Math.PI*2);
      ctx.fillStyle=node.countryCode==='NZ'?'#8bc0ef':'#f3f8f8';ctx.fill();
      ctx.lineWidth=node.countryCode==='NZ'?2.2:1.2;ctx.strokeStyle=node.countryCode==='NZ'?'#09223a':'rgba(11,24,48,.55)';ctx.stroke();
      if(active){ctx.beginPath();ctx.arc(node.screen.x,node.screen.y,r+4,0,Math.PI*2);ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();}
    });
  }

  function draw(){
    drawQueued=false;if(!width||!height)return;
    ctx.clearRect(0,0,width,height);
    const gradient=ctx.createLinearGradient(0,0,0,height);gradient.addColorStop(0,'#102a43');gradient.addColorStop(1,'#07182d');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
    drawGrid();drawWorld();layoutNodes();drawEdges();drawNodes();
    empty.hidden=network.edges.length>0;
  }
  function requestDraw(){if(drawQueued)return;drawQueued=true;requestAnimationFrame(draw);}

  function distanceToSegment(point,a,b){
    const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    if(!length)return Math.hypot(point.x-a.x,point.y-a.y);
    const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/length));
    return Math.hypot(point.x-(a.x+t*dx),point.y-(a.y+t*dy));
  }
  function hitTest(x,y){
    let best=null,distance=Infinity;
    network.nodes.forEach(node=>{const current=Math.hypot(x-node.screen.x,y-node.screen.y);if(current<=node.radius+7&&current<distance){best=node;distance=current;}});
    if(best)return best;
    network.edges.forEach(edge=>{
      const points=edge.screenPoints;
      for(let index=1;index<points.length;index+=1){
        const current=distanceToSegment({x,y},points[index-1],points[index]);
        if(current<6&&current<distance){best=edge;distance=current;}
      }
    });
    return best;
  }

  function tooltipContent(target){
    if(target.kind==='node')return `<strong>${escapeHtml(target.name)}</strong><span>${escapeHtml(target.city)}, ${escapeHtml(target.country)}</span><small>${target.projects.size} ${target.projects.size===1?'project':'projects'} · ${escapeHtml([...target.roles].map(role=>roleNames[role]||role).join(', '))}${target.precision==='country'?' · approximate position':''}</small>`;
    const projects=[...target.projects.values()];
    return `<strong>${escapeHtml(clusterName.get(target.clusterCode)||target.clusterCode)}</strong><span>${escapeHtml(target.source.name)} ↔ ${escapeHtml(target.target.name)}</span><small>${projects.slice(0,3).map(project=>escapeHtml(project.acronym)).join(', ')}${projects.length>3?` +${projects.length-3} more`:''}</small>`;
  }
  function showTooltip(target,x,y){
    if(!target){tooltip.classList.remove('show');return;}
    tooltip.innerHTML=tooltipContent(target);tooltip.classList.add('show');
    const maxX=Math.max(12,width-292),maxY=Math.max(12,height-128);
    tooltip.style.left=`${Math.min(maxX,x+16)}px`;tooltip.style.top=`${Math.min(maxY,y+16)}px`;
  }

  function pointerPosition(event){const rect=canvas.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};}
  canvas.addEventListener('pointerdown',event=>{const point=pointerPosition(event);drag={startX:point.x,startY:point.y,tx:view.tx,ty:view.ty,moved:false};canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');});
  canvas.addEventListener('pointermove',event=>{
    const point=pointerPosition(event);
    if(drag){const dx=point.x-drag.startX,dy=point.y-drag.startY;if(Math.hypot(dx,dy)>3)drag.moved=true;view.tx=drag.tx+dx;view.ty=drag.ty+dy;tooltip.classList.remove('show');requestDraw();return;}
    const target=hitTest(point.x,point.y);
    if(target!==hover){hover=target;requestDraw();}
    showTooltip(target,point.x,point.y);canvas.style.cursor=target?'pointer':'grab';
  });
  canvas.addEventListener('pointerup',event=>{if(!drag)return;const point=pointerPosition(event),wasMoved=drag.moved;drag=null;canvas.classList.remove('dragging');if(!wasMoved){const target=hitTest(point.x,point.y);renderDetail(target);}canvas.releasePointerCapture(event.pointerId);});
  canvas.addEventListener('pointerleave',()=>{if(!drag){hover=null;tooltip.classList.remove('show');requestDraw();}});
  function zoomAt(factor,x=width/2,y=height/2){
    const previous=view.scale,next=Math.max(1,Math.min(4,previous*factor));
    const baseX=(x-width/2-view.tx)/previous,baseY=(y-height/2-view.ty)/previous;
    view.scale=next;view.tx=x-width/2-baseX*next;view.ty=y-height/2-baseY*next;requestDraw();
  }
  canvas.addEventListener('wheel',event=>{event.preventDefault();const point=pointerPosition(event);zoomAt(event.deltaY<0?1.18:.85,point.x,point.y);},{passive:false});
  document.querySelector('[data-map-zoom-in]').addEventListener('click',()=>zoomAt(1.25));
  document.querySelector('[data-map-zoom-out]').addEventListener('click',()=>zoomAt(.8));
  document.querySelector('[data-map-reset-view]').addEventListener('click',()=>{view.scale=1;view.tx=0;view.ty=0;requestDraw();});
  document.querySelector('[data-map-clear]').addEventListener('click',()=>{clusterControl.clear();projectControl.clear();countryControl.clear();});
  window.addEventListener('he:currency-change',()=>{if(selectedDetail)renderDetail(selectedDetail);});

  function resize(){
    const rect=canvas.getBoundingClientRect();width=Math.max(320,Math.round(rect.width));height=Math.max(420,Math.round(rect.height));dpr=Math.min(2,window.devicePixelRatio||1);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);requestDraw();
  }
  new ResizeObserver(resize).observe(shell);

  function update(){
    network=buildNetwork();hover=null;tooltip.classList.remove('show');renderSummary();renderLegend();renderProjectList();renderDefaultDetail();requestDraw();
  }
  update();resize();
})();
