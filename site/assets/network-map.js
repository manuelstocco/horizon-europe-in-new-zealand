(() => {
  const D=window.HE_DATA,H=window.HE,WORLD=window.HE_WORLD,STATUS=window.HE_COUNTRY_STATUS;
  const canvas=document.querySelector('[data-network-map]');
  if(!D||!H||!WORLD||!STATUS||!canvas)return;

  const ctx=canvas.getContext('2d');
  const shell=canvas.closest('.network-map-shell');
  const tooltip=document.querySelector('[data-map-tooltip]');
  const empty=document.querySelector('[data-map-empty]');
  const state={clusters:[],projects:[],countries:[]};
  const view={scale:1,tx:0,ty:0};
  const centreLongitude=15;
  let width=0,height=0,dpr=1,scope=null,hover=null,drag=null,drawQueued=false,drawnAreas=[],drawnMarkers=[];

  const normaliseCode=code=>code==='UK'?'GB':code==='EL'?'GR':code;
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const countryName=new Map(D.countries.map(country=>[normaliseCode(country.code),country.name]));
  const clusterName=new Map(D.clusters.map(cluster=>[cluster.code,cluster.short]));
  const eu=new Set(STATUS.eu27),associated=new Set(STATUS.associated),lmic=new Set(STATUS.lowMiddleIncome);
  const octMapCodes=new Set(STATUS.overseasCountriesTerritories.map(item=>item.mapCode).filter(Boolean));
  const statusStyle={
    'new-zealand':{label:'New Zealand',description:'Associated to Horizon Europe Pillar II',colour:'#e9a82f'},
    eu:{label:'EU27',description:'EU Member State or EU outermost region',colour:'#397fd8'},
    associated:{label:'Associated country',description:'Associated to Horizon Europe',colour:'#24a79a'},
    oct:{label:'Overseas country or territory',description:'Linked to an EU Member State and eligible under Horizon Europe',colour:'#79b8e8'},
    lmic:{label:'Low- or middle-income country',description:'Automatically eligible for funding under the General Annexes',colour:'#ef6b61'},
    other:{label:'Other country',description:'Participation and funding depend on the call conditions',colour:'#cbd4dc'}
  };

  function statusFor(code){
    const normalised=normaliseCode(code);
    if(normalised==='NZ')return 'new-zealand';
    if(eu.has(normalised))return 'eu';
    if(associated.has(normalised))return 'associated';
    if(octMapCodes.has(normalised))return 'oct';
    if(lmic.has(normalised))return 'lmic';
    return 'other';
  }

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

  function organisationsFor(project){
    const rows=[project.coordinator,...project.organisations].filter(Boolean),unique=new Map();
    rows.forEach(org=>unique.set(`${normaliseCode(org.countryCode)}|${org.id||org.name}`,org));
    return [...unique.values()];
  }

  function selectedProjects(){
    const clusters=new Set(state.clusters),projects=new Set(state.projects),countries=new Set(state.countries);
    return D.projects.filter(project=>{
      if(clusters.size&&!clusters.has(project.clusterCode))return false;
      if(projects.size&&!projects.has(project.id))return false;
      if(countries.size&&!organisationsFor(project).some(org=>org.countryCode!=='NZ'&&countries.has(org.countryCode)))return false;
      return true;
    });
  }

  function buildScope(){
    const projects=selectedProjects(),organisations=new Set(),countries=new Map(),links=new Set();
    projects.forEach(project=>{
      const rows=organisationsFor(project),nz=rows.filter(org=>normaliseCode(org.countryCode)==='NZ'),partners=rows.filter(org=>normaliseCode(org.countryCode)!=='NZ');
      rows.forEach(org=>{
        const code=normaliseCode(org.countryCode),key=`${code}|${org.id||org.name}`;
        organisations.add(key);
        let entry=countries.get(code);
        if(!entry){entry={code,name:org.country||countryName.get(code)||code,projects:new Set(),organisations:new Set()};countries.set(code,entry);}
        entry.projects.add(project.id);entry.organisations.add(key);
      });
      nz.forEach(source=>partners.forEach(target=>links.add(`${source.id||source.name}→${normaliseCode(target.countryCode)}|${target.id||target.name}|${project.clusterCode}`)));
    });
    return {projects,organisations,countries,links};
  }

  function selectionLabels(){
    const labels=[];
    const group=(values,getLabel,noun)=>{
      if(values.length>3)labels.push(`${values.length} ${noun} selected`);
      else values.forEach(value=>labels.push(getLabel(value)));
    };
    group(state.clusters,value=>clusterName.get(value)||value,'clusters');
    group(state.projects,value=>D.projects.find(project=>project.id===value)?.acronym||value,'projects');
    group(state.countries,value=>countryName.get(normaliseCode(value))||value,'countries');
    return labels;
  }

  function renderSummary(){
    const partnerCountries=[...scope.countries.keys()].filter(code=>code!=='NZ');
    const metrics=[
      ['Projects',scope.projects.length,'Distinct projects in the selected scope'],
      ['Organisations',scope.organisations.size,'Distinct consortium organisations'],
      ['Partner countries',partnerCountries.length,'Countries represented alongside New Zealand'],
      ['Active links',scope.links.size,'Distinct NZ–partner organisation pairs by cluster']
    ];
    document.querySelector('[data-map-metrics]').innerHTML=metrics.map(([label,value,note])=>`<article class="metric-card"><span class="metric-label">${label}</span><strong>${H.fmtNumber(value)}</strong><small>${note}</small></article>`).join('');
    H.renderChips(document.querySelector('[data-map-selection]'),selectionLabels(),'All clusters, projects and partner countries');
    document.querySelector('[data-map-narrative]').innerHTML=scope.projects.length?`<strong>${scope.projects.length} ${scope.projects.length===1?'project connects':'projects connect'} New Zealand with ${partnerCountries.length} partner ${partnerCountries.length===1?'country':'countries'}.</strong> The map keeps programme status visible while highlighting the countries represented across ${scope.organisations.size} organisations.`:'<strong>No projects match the current filters.</strong> Adjust the selection to restore the active portfolio.';
    canvas.setAttribute('aria-label',`World map centred on Europe. ${scope.projects.length} selected projects involve ${partnerCountries.length} partner countries and ${scope.organisations.size} organisations.`);
  }

  function renderLegend(){
    const items=['eu','new-zealand','associated','oct','lmic','other'];
    document.querySelector('[data-map-legend]').innerHTML=`<div class="map-status-legend">${items.map(key=>`<span><i style="background:${statusStyle[key].colour}"></i>${escapeHtml(statusStyle[key].label)}</span>`).join('')}</div><div class="map-symbol-legend"><span><i class="map-symbol active-country"></i>Represented in selected projects</span><span><i class="map-symbol territory"></i>Small territory reference point</span></div>`;
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
  function unwrappedRing(ring){
    let previous=null;
    return ring.map(([lon,lat])=>{
      let relative=normalisedLongitude(lon);
      if(previous!==null){while(relative-previous>180)relative-=360;while(relative-previous<-180)relative+=360;}
      previous=relative;return [relative,lat];
    });
  }

  function drawGrid(){
    const {mapHeight,top}=mapDimensions();
    ctx.save();ctx.strokeStyle='rgba(72,111,143,.12)';ctx.lineWidth=1;
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

  function colourWithAlpha(hex,alpha){
    const value=hex.replace('#',''),number=parseInt(value,16);
    return `rgba(${number>>16},${number>>8&255},${number&255},${alpha})`;
  }

  function buildAreaPath(feature,offset){
    const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates,path=new Path2D();
    polygons.forEach(polygon=>polygon.forEach(ring=>{
      const points=unwrappedRing(ring);
      points.forEach(([relative,lat],index)=>{
        const {mapHeight,top}=mapDimensions(),base={x:(relative+offset+180)/360*width,y:top+(90-lat)/180*mapHeight},point=screenPoint(base);
        index?path.lineTo(point.x,point.y):path.moveTo(point.x,point.y);
      });
      path.closePath();
    }));
    return path;
  }

  function drawWorld(){
    const active=new Set(scope.countries.keys()),selected=new Set(state.countries.map(normaliseCode));
    drawnAreas=[];
    WORLD.features.forEach(feature=>{
      const code=normaliseCode(feature.properties.code),status=statusFor(code),style=statusStyle[status],isActive=active.has(code),isSelected=selected.has(code);
      [-360,0,360].forEach(offset=>{
        const path=buildAreaPath(feature,offset);
        ctx.fillStyle=colourWithAlpha(style.colour,isActive ? .92 : (status==='other' ? .42 : .56));
        ctx.fill(path,'evenodd');
        ctx.strokeStyle=isSelected?'#102f50':isActive?'#173a5e':'rgba(69,96,117,.34)';
        ctx.lineWidth=isSelected?3.1:isActive?1.8:.65;
        ctx.stroke(path);
        drawnAreas.push({kind:'country',code,name:countryName.get(code)||feature.properties.name,status,path,active:isActive,selected:isSelected});
      });
    });
  }

  function markerRows(){
    const outermost=STATUS.outermostRegions.map(item=>({...item,kind:'outermost',status:'eu'}));
    const oct=STATUS.overseasCountriesTerritories.filter(item=>!item.mapCode).map(item=>({...item,kind:'oct',status:'oct'}));
    const small=STATUS.smallCountryMarkers.map(item=>({...item,kind:'country'}));
    const pacific=(STATUS.pacificIslandCountries||[]).map(item=>({...item,kind:'pacific',status:statusFor(item.code)}));
    return [...outermost,...oct,...small,...pacific];
  }

  function drawMarkers(){
    const active=new Set(scope.countries.keys()),selected=new Set(state.countries.map(normaliseCode));
    drawnMarkers=markerRows().map(item=>{
      const point=screenPoint(basePoint(item.lon,item.lat)),activeCode=normaliseCode(item.code),isActive=active.has(activeCode),isSelected=selected.has(activeCode),zoomBoost=item.kind==='pacific'?Math.min(1.65,.7+view.scale*.3):1,radius=(item.kind==='country'?4.8:item.kind==='pacific'?3.6:4.2)*(isActive?1.2:1)*zoomBoost;
      ctx.beginPath();ctx.arc(point.x,point.y,radius+2.5,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.9)';ctx.fill();
      ctx.beginPath();ctx.arc(point.x,point.y,radius,0,Math.PI*2);ctx.fillStyle=statusStyle[item.status].colour;ctx.fill();
      ctx.lineWidth=isSelected?2.8:isActive?2:1;ctx.strokeStyle=isSelected?'#102f50':isActive?'#173a5e':'rgba(38,65,84,.5)';ctx.stroke();
      return {...item,point,radius,active:isActive,selected:isSelected};
    });
  }

  function draw(){
    drawQueued=false;if(!width||!height||!scope)return;
    ctx.clearRect(0,0,width,height);
    const gradient=ctx.createLinearGradient(0,0,0,height);gradient.addColorStop(0,'#eef6fb');gradient.addColorStop(1,'#dfeef6');ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
    drawGrid();drawWorld();drawMarkers();
    empty.hidden=scope.projects.length>0;
  }
  function requestDraw(){if(drawQueued)return;drawQueued=true;requestAnimationFrame(draw);}

  function hitTest(x,y){
    for(let index=drawnMarkers.length-1;index>=0;index-=1){
      const marker=drawnMarkers[index];
      if(Math.hypot(x-marker.point.x,y-marker.point.y)<=marker.radius+7)return marker;
    }
    for(let index=drawnAreas.length-1;index>=0;index-=1){
      const area=drawnAreas[index];
      if(ctx.isPointInPath(area.path,x*dpr,y*dpr,'evenodd'))return area;
    }
    return null;
  }

  function targetStatus(target){return statusStyle[target.status||statusFor(target.code)];}
  function tooltipContent(target){
    const style=targetStatus(target),code=normaliseCode(target.code),stats=scope.countries.get(code);
    const relation=target.kind==='outermost'?`EU outermost region · ${target.parent}`:target.kind==='oct'?`${style.label} · linked to ${target.parent}`:target.kind==='pacific'?`Pacific island country · ${style.label}`:style.label;
    let activity=stats?`${stats.projects.size} ${stats.projects.size===1?'project':'projects'} · ${stats.organisations.size} ${stats.organisations.size===1?'organisation':'organisations'} in the selected scope`:'Not represented in the selected project scope';
    if((target.kind==='outermost'||target.kind==='oct')&&!stats)activity='Project records do not identify this territory separately';
    return `<strong>${escapeHtml(target.name)}</strong><span>${escapeHtml(relation)}</span><small>${escapeHtml(style.description)}</small><small>${escapeHtml(activity)}${target.selected?' · Country filter selected':''}</small>`;
  }
  function showTooltip(target,x,y){
    if(!target){tooltip.classList.remove('show');return;}
    tooltip.innerHTML=tooltipContent(target);tooltip.classList.add('show');
    const box=tooltip.getBoundingClientRect(),maxX=Math.max(12,width-box.width-12),maxY=Math.max(12,height-box.height-12);
    tooltip.style.left=`${Math.min(maxX,x+16)}px`;tooltip.style.top=`${Math.min(maxY,y+16)}px`;
  }

  function pointerPosition(event){const rect=canvas.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};}
  canvas.addEventListener('pointerdown',event=>{const point=pointerPosition(event);drag={startX:point.x,startY:point.y,tx:view.tx,ty:view.ty,moved:false};canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');});
  canvas.addEventListener('pointermove',event=>{
    const point=pointerPosition(event);
    if(drag){const dx=point.x-drag.startX,dy=point.y-drag.startY;if(Math.hypot(dx,dy)>3)drag.moved=true;view.tx=drag.tx+dx;view.ty=drag.ty+dy;tooltip.classList.remove('show');requestDraw();return;}
    hover=hitTest(point.x,point.y);showTooltip(hover,point.x,point.y);canvas.style.cursor=hover?'pointer':'grab';
  });
  canvas.addEventListener('pointerup',event=>{if(!drag)return;drag=null;canvas.classList.remove('dragging');canvas.releasePointerCapture(event.pointerId);});
  canvas.addEventListener('pointerleave',()=>{if(!drag){hover=null;tooltip.classList.remove('show');}});

  function zoomAt(factor,x=width/2,y=height/2){
    const previous=view.scale,next=Math.max(1,Math.min(5,previous*factor));
    const baseX=(x-width/2-view.tx)/previous,baseY=(y-height/2-view.ty)/previous;
    view.scale=next;view.tx=x-width/2-baseX*next;view.ty=y-height/2-baseY*next;requestDraw();
  }
  canvas.addEventListener('wheel',event=>{event.preventDefault();const point=pointerPosition(event);zoomAt(event.deltaY<0?1.18:.85,point.x,point.y);},{passive:false});
  document.querySelector('[data-map-zoom-in]').addEventListener('click',()=>zoomAt(1.25));
  document.querySelector('[data-map-zoom-out]').addEventListener('click',()=>zoomAt(.8));
  document.querySelector('[data-map-reset-view]').addEventListener('click',()=>{view.scale=1;view.tx=0;view.ty=0;requestDraw();});
  document.querySelector('[data-map-clear]').addEventListener('click',()=>{clusterControl.clear();projectControl.clear();countryControl.clear();});

  function resize(){
    const rect=canvas.getBoundingClientRect();width=Math.max(320,Math.round(rect.width));height=Math.max(420,Math.round(rect.height));dpr=Math.min(2,window.devicePixelRatio||1);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);requestDraw();
  }
  new ResizeObserver(resize).observe(shell);

  function update(){scope=buildScope();hover=null;tooltip.classList.remove('show');renderSummary();renderLegend();requestDraw();}
  update();resize();
})();
