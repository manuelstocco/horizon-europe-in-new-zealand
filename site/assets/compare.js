(()=>{
  const {D,clusterColor,countryColor,fmtMoney,fmtNumber}=window.HE;
  const organisationColours=['#397fd8','#22a99a','#8d67ce'];
  const state={mode:'country',items:[]};
  const params=new URLSearchParams(location.search);
  if(params.get('mode')==='organisation')state.mode='organisation';
  const requested=(params.get('items')||'').split(',').filter(Boolean).slice(0,3);
  const countryName=code=>D.countries.find(country=>country.code===code)?.name||code;
  const orgKey=org=>org.id||`${org.countryCode}|${org.name}`;
  const nzOrganisations=(()=>{const map=new Map();D.projects.forEach(project=>project.organisations.filter(org=>org.countryCode==='NZ').forEach(org=>map.set(orgKey(org),{key:orgKey(org),name:org.short||org.name,fullName:org.name})));return[...map.values()].sort((a,b)=>a.name.localeCompare(b.name))})();
  const options=()=>state.mode==='country'?D.countries.filter(country=>country.code!=='NZ').map(country=>({value:country.code,label:country.name})).sort((a,b)=>a.label.localeCompare(b.label)):nzOrganisations.map(org=>({value:org.key,label:org.name}));
  function countryMetrics(code){
    const projects=D.projects.filter(project=>project.countryCodes.includes(code)),organisations=new Set(),links=new Set(),clusters=new Map();
    projects.forEach(project=>{const partners=project.organisations.filter(org=>org.countryCode===code),nz=project.organisations.filter(org=>org.countryCode==='NZ');partners.forEach(org=>organisations.add(orgKey(org)));nz.forEach(a=>partners.forEach(b=>links.add(`${orgKey(a)}|${orgKey(b)}`)));clusters.set(project.clusterCode,(clusters.get(project.clusterCode)||0)+1)});
    return{key:code,label:countryName(code),projects:projects.length,organisations:organisations.size,clusters:clusters.size,projectValue:projects.reduce((sum,project)=>sum+(project.ecContribution||0),0),links:links.size,clusterCounts:clusters};
  }
  function organisationMetrics(key){
    const definition=nzOrganisations.find(org=>org.key===key),projects=D.projects.filter(project=>project.organisations.some(org=>org.countryCode==='NZ'&&orgKey(org)===key)),partners=new Set(),links=new Set(),clusters=new Map();
    projects.forEach(project=>{project.organisations.filter(org=>org.countryCode!=='NZ').forEach(org=>{partners.add(orgKey(org));links.add(`${key}|${orgKey(org)}`)});clusters.set(project.clusterCode,(clusters.get(project.clusterCode)||0)+1)});
    return{key,label:definition?.name||key,projects:projects.length,organisations:partners.size,clusters:clusters.size,projectValue:projects.reduce((sum,project)=>sum+(project.ecContribution||0),0),links:links.size,clusterCounts:clusters};
  }
  const getMetrics=key=>state.mode==='country'?countryMetrics(key):organisationMetrics(key);
  const entityColour=(key,index)=>state.mode==='country'?countryColor(key):organisationColours[index%organisationColours.length];
  function syncUrl(){const next=new URLSearchParams();next.set('mode',state.mode);if(state.items.length)next.set('items',state.items.join(','));history.replaceState(null,'',`${location.pathname}?${next}`)}
  function showToast(message){const toast=document.querySelector('[data-toast]');toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800)}
  async function share(){syncUrl();await window.HE.copyCurrentView(document.querySelector('[data-share-view]'),'Comparison link copied');showToast('Comparison link copied')}
  function renderSelectors(){
    const root=document.querySelector('[data-compare-selectors]'),values=options();root.replaceChildren();
    for(let index=0;index<3;index+=1){const label=document.createElement('label');label.textContent=`${state.mode==='country'?'Country':'NZ organisation'} ${index+1}`;const select=document.createElement('select');select.className='native-select';select.setAttribute('aria-label',label.textContent);select.append(new Option(index?'Optional comparison':'Choose…',''));values.forEach(option=>select.append(new Option(option.label,option.value)));select.value=state.items[index]||'';select.addEventListener('change',()=>{state.items[index]=select.value;state.items=state.items.filter(Boolean).filter((value,position,array)=>array.indexOf(value)===position).slice(0,3);syncUrl();render()});label.append(select);root.append(label)}
  }
  function render(){
    const rows=state.items.map(getMetrics),summary=document.querySelector('[data-compare-summary]');summary.replaceChildren();
    rows.forEach((row,index)=>{const card=document.createElement('article');card.className='compare-entity-card';card.style.setProperty('--entity-colour',entityColour(row.key,index));card.innerHTML=`<span>${state.mode==='country'?'Partner country':'New Zealand organisation'}</span><h2>${state.mode==='country'?`<a href="country-profile.html?country=${encodeURIComponent(row.key)}">${row.label}</a>`:row.label}</h2><p>${fmtNumber(row.projects)} projects · ${fmtNumber(row.organisations)} ${state.mode==='country'?'organisations':'partner organisations'} · ${fmtNumber(row.links)} active links</p>`;summary.append(card)});
    const dashboard=document.querySelector('.compare-dashboard');
    if(!rows.length){summary.innerHTML='<article class="panel compare-empty"><span aria-hidden="true">⇄</span><h2>Choose the first item to compare</h2><p>Select a country or New Zealand organisation above. The comparison will appear here without assuming a default.</p></article>';dashboard.hidden=true;document.querySelector('[data-compare-bars]').replaceChildren();document.querySelector('[data-compare-clusters]').replaceChildren();document.querySelector('[data-compare-table]').replaceChildren();return}
    dashboard.hidden=false;
    const metrics=[['Projects','projects',fmtNumber], [state.mode==='country'?'Organisations':'Partner organisations','organisations',fmtNumber],['Clusters','clusters',fmtNumber],['Total project value','projectValue',fmtMoney],['Active collaborations','links',fmtNumber]];
    const bars=document.querySelector('[data-compare-bars]');bars.replaceChildren();metrics.forEach(([label,key,formatter])=>{const group=document.createElement('section');group.className='compare-measure';const heading=document.createElement('h3');heading.textContent=label;group.append(heading);const max=Math.max(1,...rows.map(row=>row[key]));rows.forEach((row,index)=>{const item=document.createElement('div');item.className='compare-measure-row';item.innerHTML=`<span>${row.label}</span><span class="compare-measure-track"><i style="width:${Math.max(2,row[key]/max*100)}%;background:${entityColour(row.key,index)}"></i></span><strong>${formatter(row[key])}</strong>`;group.append(item)});bars.append(group)});
    const clusters=document.querySelector('[data-compare-clusters]');clusters.replaceChildren();D.clusters.forEach(cluster=>{const group=document.createElement('section');group.className='compare-cluster-row';const label=document.createElement('h3');label.textContent=cluster.short;group.append(label);rows.forEach((row,index)=>{const value=row.clusterCounts.get(cluster.code)||0,max=Math.max(1,...rows.map(item=>item.clusterCounts.get(cluster.code)||0));const item=document.createElement('div');item.className='compare-cluster-value';item.innerHTML=`<span>${row.label}</span><span class="compare-measure-track"><i style="width:${Math.max(value?4:0,value/max*100)}%;background:${entityColour(row.key,index)}"></i></span><strong>${fmtNumber(value)}</strong>`;group.append(item)});clusters.append(group)});
    const table=document.createElement('table');table.className='project-table compare-table';table.innerHTML=`<caption class="sr-only">Comparison of ${rows.map(row=>row.label).join(', ')}</caption><thead><tr><th scope="col">Measure</th>${rows.map(row=>`<th scope="col">${row.label}</th>`).join('')}</tr></thead><tbody>${metrics.map(([label,key,formatter])=>`<tr><th scope="row">${label}</th>${rows.map(row=>`<td>${formatter(row[key])}</td>`).join('')}</tr>`).join('')}</tbody>`;document.querySelector('[data-compare-table]').replaceChildren(table);
    document.querySelector('[data-compare-announcement]').textContent=`Comparison updated for ${rows.map(row=>row.label).join(', ')}.`;
  }
  document.querySelectorAll('[data-compare-mode]').forEach(button=>button.addEventListener('click',()=>{state.mode=button.dataset.compareMode;state.items=[];document.querySelectorAll('[data-compare-mode]').forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active))});renderSelectors();syncUrl();render()}));
  document.querySelector('[data-compare-reset]').addEventListener('click',()=>{state.items=[];renderSelectors();syncUrl();render()});
  document.querySelector('[data-share-view]').addEventListener('click',share);
  state.items=requested.filter(value=>options().some(option=>option.value===value));
  document.querySelectorAll('[data-compare-mode]').forEach(button=>{const active=button.dataset.compareMode===state.mode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});renderSelectors();render();
})();
