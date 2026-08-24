(() => {
  const D=window.HE_DATA,H=window.HE;
  const EU27=['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','EL','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
  const stage=document.querySelector('[data-circle-stage]'),canvas=document.querySelector('[data-circle-canvas]'),context=canvas.getContext('2d'),countryLayer=document.querySelector('[data-circle-country-layer]');
  const state={measure:'projects',clusters:[],projectId:'',hover:'',locked:''};
  const countryMap=new Map(D.countries.map(country=>[country.code,country.name])),clusterMap=new Map(D.clusters.map(cluster=>[cluster.code,cluster])),projectMap=new Map(D.projects.map(project=>[project.id,project]));
  let rows=new Map(),filteredProjects=[],layout=new Map(),searchIndex=-1,suppressCluster=false;

  const flag=code=>[...(code==='EL'?'GR':code)].map(letter=>String.fromCodePoint(127397+letter.charCodeAt())).join('');
  const plural=(value,singular,pluralForm=`${singular}s`)=>`${value} ${value===1?singular:pluralForm}`;
  const measureLabel=()=>state.measure==='projects'?'projects':'organisations';

  const clusterRoot=document.querySelector('[data-circle-filter="clusters"]');
  const clusterControl=H.mountMultiSelect(clusterRoot,{
    options:H.uniqueOptions('clusters'),placeholder:'All clusters',onChange:values=>{
      state.clusters=values;
      if(!suppressCluster&&state.projectId&&!values.includes(projectMap.get(state.projectId)?.clusterCode))clearProject(false);
      update();
    }
  });
  function closeClusterMenu(){clusterRoot.classList.remove('open');clusterRoot.querySelector('.multi-trigger')?.setAttribute('aria-expanded','false')}
  function closeProjectMenu(){const results=document.querySelector('[data-project-results]'),input=document.querySelector('[data-project-search]');results.hidden=true;results.classList.remove('is-open');input.setAttribute('aria-expanded','false')}
  clusterRoot.addEventListener('change',()=>requestAnimationFrame(closeClusterMenu));
  clusterRoot.querySelector('.multi-trigger')?.addEventListener('click',closeProjectMenu);

  function projectMatches(project,term){return `${project.acronym} ${project.title} ${project.id}`.toLowerCase().includes(term.toLowerCase())}
  function renderSearch(term=''){
    const results=document.querySelector('[data-project-results]'),input=document.querySelector('[data-project-search]'),clean=term.trim(),matches=(clean?D.projects.filter(project=>projectMatches(project,clean)):D.projects).slice(0,12);searchIndex=-1;
    results.innerHTML=matches.length?matches.map(project=>`<button class="circle-search-result" role="option" type="button" data-search-project="${project.id}"><i style="background:${clusterMap.get(project.clusterCode)?.color}"></i><span><strong>${project.acronym}</strong><small>${project.title}</small></span></button>`).join(''):`<div class="circle-search-empty">No projects match “${clean}”.</div>`;
    results.hidden=false;results.classList.add('is-open');input.setAttribute('aria-expanded','true');results.querySelectorAll('[data-search-project]').forEach(button=>button.addEventListener('click',()=>selectProject(button.dataset.searchProject)));
  }
  function selectProject(id){
    const project=projectMap.get(id);if(!project)return;state.projectId=id;state.locked='';state.hover='';const input=document.querySelector('[data-project-search]');input.value=`${project.acronym} — ${project.title}`;document.querySelector('[data-project-clear]').hidden=false;closeProjectMenu();input.blur();
    suppressCluster=true;clusterControl.set([project.clusterCode]);suppressCluster=false;state.clusters=[project.clusterCode];update();
  }
  function clearProject(runUpdate=true){state.projectId='';document.querySelector('[data-project-search]').value='';document.querySelector('[data-project-clear]').hidden=true;closeProjectMenu();if(runUpdate)update()}
  function setupSearch(){
    const input=document.querySelector('[data-project-search]'),results=document.querySelector('[data-project-results]');
    input.addEventListener('focus',()=>{closeClusterMenu();renderSearch(state.projectId?'':input.value)});input.addEventListener('input',()=>{if(state.projectId){state.projectId='';document.querySelector('[data-project-clear]').hidden=true;update()}renderSearch(input.value)});
    input.addEventListener('keydown',event=>{const options=[...results.querySelectorAll('[data-search-project]')];if(event.key==='ArrowDown'){event.preventDefault();searchIndex=Math.min(options.length-1,searchIndex+1)}else if(event.key==='ArrowUp'){event.preventDefault();searchIndex=Math.max(0,searchIndex-1)}else if(event.key==='Enter'){event.preventDefault();const choice=options[Math.max(0,searchIndex)];if(choice)selectProject(choice.dataset.searchProject);return}else if(event.key==='Escape'){closeProjectMenu();return}options.forEach((option,index)=>option.classList.toggle('active',index===searchIndex))});
    document.querySelector('[data-project-clear]').addEventListener('click',()=>{clearProject();input.focus()});document.addEventListener('click',event=>{if(!event.target.closest('.project-filter'))closeProjectMenu()});
  }

  function buildRows(){
    const result=new Map(EU27.map(code=>[code,{code,projects:new Set(),organisations:new Set(),clusters:new Map(),acronyms:new Set()}]));
    filteredProjects.forEach(project=>{
      const organisations=[...new Map(project.organisations.map(org=>[`${org.countryCode}|${org.id||org.name}`,org])).values()];
      EU27.forEach(code=>{const countryOrganisations=organisations.filter(org=>org.countryCode===code);if(!countryOrganisations.length)return;const row=result.get(code);row.projects.add(project.id);row.acronyms.add(project.acronym);countryOrganisations.forEach(org=>row.organisations.add(`${code}|${org.id||org.name}`));const cluster=row.clusters.get(project.clusterCode)||{projects:new Set(),organisations:new Set()};cluster.projects.add(project.id);countryOrganisations.forEach(org=>cluster.organisations.add(`${code}|${org.id||org.name}`));row.clusters.set(project.clusterCode,cluster)});
    });
    result.forEach(row=>{row.projectCount=row.projects.size;row.organisationCount=row.organisations.size;row.value=state.measure==='projects'?row.projectCount:row.organisationCount;const dominant=[...row.clusters].map(([code,item])=>({code,value:state.measure==='projects'?item.projects.size:item.organisations.size})).sort((a,b)=>b.value-a.value)[0];row.color=clusterMap.get(dominant?.code)?.color||'#cbd7d5'});return result;
  }

  function createCountries(){
    countryLayer.innerHTML=EU27.map(code=>`<button class="circle-country" type="button" data-country="${code}" aria-label="${countryMap.get(code)||code}"><span class="flag">${flag(code)}</span><span class="country-name">${countryMap.get(code)||code}</span><b>0</b></button>`).join('');
    countryLayer.addEventListener('pointerover',event=>{const node=event.target.closest('[data-country]');if(!node)return;state.hover=node.dataset.country;refreshFocus();updateReadout();draw()});
    countryLayer.addEventListener('pointerout',event=>{const node=event.target.closest('[data-country]');if(!node||node.contains(event.relatedTarget))return;state.hover='';refreshFocus();updateReadout();draw()});
    countryLayer.addEventListener('click',event=>{const node=event.target.closest('[data-country]');if(!node)return;state.locked=state.locked===node.dataset.country?'':node.dataset.country;state.hover='';refreshFocus();updateReadout();draw()});
  }

  function computeLayout(size){
    const centre={x:size/2,y:size/2},radius=size*.39,positions=new Map();
    EU27.forEach((code,index)=>{const angle=-Math.PI/2+index*Math.PI*2/EU27.length,cos=Math.cos(angle),sin=Math.sin(angle);let labelClass;if(cos>.42)labelClass='label-right';else if(cos<-.42)labelClass='label-left';else if(sin<0)labelClass='label-top';else labelClass='label-bottom';positions.set(code,{x:centre.x+cos*radius,y:centre.y+sin*radius,angle,labelClass})});return{centre,radius,positions};
  }
  function positionCountries(){document.querySelectorAll('[data-country]').forEach(node=>{const point=layout.get(node.dataset.country);if(!point)return;node.style.left=`${point.x}px`;node.style.top=`${point.y}px`;node.classList.remove('label-right','label-left','label-top','label-bottom');node.classList.add(point.labelClass)})}
  function refreshFocus(){const focus=state.locked||state.hover;document.querySelectorAll('[data-country]').forEach(node=>{const row=rows.get(node.dataset.country);node.style.setProperty('--country-color',row?.color||'#cbd7d5');node.querySelector('b').textContent=row?.value||0;node.classList.toggle('inactive',!row?.value);node.classList.toggle('focused',focus===node.dataset.country);node.classList.toggle('dimmed',Boolean(focus)&&focus!==node.dataset.country)})}

  function updateReadout(){
    const focus=state.locked||state.hover,title=document.querySelector('[data-readout-title]'),copy=document.querySelector('[data-readout-copy]'),metrics=document.querySelector('[data-readout-metrics]'),clusters=document.querySelector('[data-readout-clusters]');
    let scopeProjects=filteredProjects,scopeRows=[...rows.values()].filter(row=>row.value),scopeOrgs=new Set();scopeRows.forEach(row=>row.organisations.forEach(org=>scopeOrgs.add(org)));
    if(focus){const row=rows.get(focus);scopeProjects=filteredProjects.filter(project=>row.projects.has(project.id));scopeRows=row.value?[row]:[];scopeOrgs=row.organisations;title.textContent=countryMap.get(focus)||focus;copy.textContent=row.value?`${plural(row.value,state.measure==='projects'?'project':'organisation')} in the current selection. ${[...row.acronyms].sort().join(', ')}.`:'No collaboration in the current selection.';clusters.innerHTML=[...row.clusters].map(([code,item])=>{const cluster=clusterMap.get(code),value=state.measure==='projects'?item.projects.size:item.organisations.size;return `<span class="readout-cluster"><i style="background:${cluster.color}"></i>${cluster.short} <b>${value}</b></span>`}).join('')}
    else if(state.projectId){const project=projectMap.get(state.projectId);title.textContent=project.acronym;copy.textContent=project.title;clusters.innerHTML=`<span class="readout-cluster"><i style="background:${clusterMap.get(project.clusterCode)?.color}"></i>${clusterMap.get(project.clusterCode)?.short}</span>`}
    else{title.textContent='EU27 collaboration';copy.textContent=`The current portfolio connects New Zealand with ${scopeRows.length} EU Member States.`;clusters.innerHTML=D.clusters.map(cluster=>{const count=scopeProjects.filter(project=>project.clusterCode===cluster.code).length;return count?`<span class="readout-cluster"><i style="background:${cluster.color}"></i>${cluster.short} <b>${count}</b></span>`:''}).join('')}
    metrics.innerHTML=`<div class="readout-metric"><strong>${scopeProjects.length}</strong><span>Projects</span></div><div class="readout-metric"><strong>${scopeRows.length}</strong><span>EU27 countries</span></div><div class="readout-metric"><strong>${scopeOrgs.size}</strong><span>EU27 organisations</span></div>`;
  }

  function traceNewZealand(ctx,feature,centre,scaleFactor=1,offsetX=0,offsetY=0){const polygons=feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates:[feature.geometry.coordinates],points=polygons.flat(2),xs=points.map(point=>point[0]),ys=points.map(point=>point[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min(178/(maxX-minX),285/(maxY-minY))*scaleFactor,mapWidth=(maxX-minX)*scale,mapHeight=(maxY-minY)*scale,originX=centre.x-mapWidth/2+offsetX,originY=centre.y-mapHeight/2-37+offsetY;polygons.forEach(polygon=>polygon.forEach(ring=>{ctx.beginPath();ring.forEach((point,index)=>{const x=originX+(point[0]-minX)*scale,y=originY+(maxY-point[1])*scale;index?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.fill();ctx.stroke()}))}

  function draw(){
    const size=stage.clientWidth,ratio=Math.min(window.devicePixelRatio||1,2),target=Math.round(size*ratio);if(canvas.width!==target||canvas.height!==target){canvas.width=target;canvas.height=target}context.setTransform(ratio,0,0,ratio,0,0);context.clearRect(0,0,size,size);const geometry=computeLayout(size);layout=geometry.positions;positionCountries();const centre=geometry.centre,focusCode=state.locked||state.hover,maxValue=Math.max(1,...[...rows.values()].map(row=>row.value));
    context.save();context.beginPath();context.arc(centre.x,centre.y,geometry.radius,0,Math.PI*2);context.strokeStyle='#d8e3e1';context.lineWidth=1;context.stroke();context.restore();
    EU27.forEach(code=>{const row=rows.get(code),point=layout.get(code);if(!row?.value||!point)return;const focus=!focusCode||focusCode===code,clusterRows=[...row.clusters].filter(([clusterCode])=>!state.clusters.length||state.clusters.includes(clusterCode));clusterRows.forEach(([clusterCode,item],index)=>{const cluster=clusterMap.get(clusterCode),value=state.measure==='projects'?item.projects.size:item.organisations.size,dx=point.x-centre.x,dy=point.y-centre.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length,px=-uy,py=ux,start={x:centre.x+ux*72,y:centre.y-28+uy*68},end={x:point.x-ux*33,y:point.y-uy*27},bend=(index-(clusterRows.length-1)/2)*13+Math.sin(point.angle*2)*25,control={x:centre.x+dx*.52+px*bend,y:centre.y-14+dy*.52+py*bend};context.beginPath();context.moveTo(start.x,start.y);context.quadraticCurveTo(control.x,control.y,end.x,end.y);context.strokeStyle=cluster.color;context.lineWidth=Math.max(.7,Math.sqrt(value/maxValue)*4.2);context.globalAlpha=focus?(focusCode?.82:.24):.035;context.shadowColor=focusCode&&focus?cluster.color:'transparent';context.shadowBlur=focusCode&&focus?10:0;context.stroke()})});context.globalAlpha=1;context.shadowBlur=0;
    const nz=window.HE_WORLD?.features?.find(feature=>feature.properties?.code==='NZ');if(nz){const layers=[{s:1.1,x:-8,y:9,f:'#e0ebf7',o:'#cbdced',w:1},{s:1.065,x:-5,y:6,f:'#b8d3ef',o:'#96bde4',w:1},{s:1.03,x:-2,y:3,f:'#6ea8df',o:'#4b8fcf',w:1},{s:1,x:0,y:0,f:'#2f73bd',o:'#1e5d9d',w:1.3}];layers.forEach(layer=>{context.fillStyle=layer.f;context.strokeStyle=layer.o;context.lineWidth=layer.w;context.shadowColor='rgba(23,58,94,.17)';context.shadowBlur=layer.s===1?18:5;traceNewZealand(context,nz,centre,layer.s,layer.x,layer.y)});[.9,.79,.68,.57].forEach((scale,index)=>{context.fillStyle='rgba(255,255,255,0)';context.strokeStyle=index%2?'rgba(255,255,255,.46)':'rgba(23,58,94,.34)';context.lineWidth=.75;context.shadowBlur=0;traceNewZealand(context,nz,centre,scale,0,-1)})}
    context.globalAlpha=1;context.shadowBlur=0;refreshFocus();
  }

  function update(){filteredProjects=D.projects.filter(project=>(!state.projectId||project.id===state.projectId)&&(!state.clusters.length||state.clusters.includes(project.clusterCode)));rows=buildRows();const connected=[...rows.values()].filter(row=>row.value),orgs=new Set();connected.forEach(row=>row.organisations.forEach(org=>orgs.add(org)));document.querySelector('[data-circle-nz-summary]').textContent=state.measure==='projects'?`${filteredProjects.length} projects in view`:`${orgs.size} EU27 organisations in view`;const clusterText=state.clusters.length===1?clusterMap.get(state.clusters[0])?.short:state.clusters.length?`${state.clusters.length} clusters`:'All clusters',projectText=state.projectId?projectMap.get(state.projectId)?.acronym:'All projects';document.querySelector('[data-circle-selection]').textContent=`${clusterText} · ${projectText}`;document.querySelector('[data-circle-empty]').hidden=connected.length>0;if(state.locked&&!rows.get(state.locked)?.value)state.locked='';updateReadout();draw()}

  document.querySelectorAll('input[name="circle-measure"]').forEach(input=>input.addEventListener('change',()=>{state.measure=input.value;update()}));document.querySelector('[data-circle-reset]').addEventListener('click',()=>{state.measure='projects';state.projectId='';state.locked='';state.hover='';document.querySelector('input[name="circle-measure"][value="projects"]').checked=true;clearProject(false);clusterControl.clear();closeClusterMenu()});document.addEventListener('keydown',event=>{if(event.key==='Escape'){state.locked='';state.hover='';closeClusterMenu();closeProjectMenu();refreshFocus();updateReadout();draw()}});new ResizeObserver(draw).observe(stage);
  setupSearch();createCountries();update();
})();
