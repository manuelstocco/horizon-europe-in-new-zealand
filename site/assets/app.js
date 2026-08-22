(() => {
  const { D, uniqueOptions, filterProjects, metrics, mountMultiSelect, renderChips, setMetrics, groupCount, renderBars, renderHbars, renderRank, organisationRows, renderProjectTable, renderClusterBubbles, renderFlow, clusterColor, countryColor, schemeColor, projectPartnerCodes, projectPartnerNames, formatDate, fmtMoney, fmtNumber } = window.HE;
  const page = document.body.dataset.page;

  function commonFilters({ countries=true, clusters=false, schemes=false, search=false, eu27OnlyCountries=false, onUpdate }) {
    const state={countries:[],clusters:[],schemes:[],search:''};
    const update=()=>onUpdate({...state});
    const countryOptions=uniqueOptions('countries').filter(option=>!eu27OnlyCountries||option.eu);
    if(countries) mountMultiSelect(document.querySelector('[data-filter="countries"]'),{options:countryOptions,placeholder:eu27OnlyCountries?'All EU27 partner countries':'All partner countries',searchable:true,countryActions:!eu27OnlyCountries,onChange:v=>{state.countries=v;update();}});
    if(clusters) state.clusterControl=mountMultiSelect(document.querySelector('[data-filter="clusters"]'),{options:uniqueOptions('clusters'),placeholder:'All clusters',onChange:v=>{state.clusters=v;update();}});
    if(schemes) mountMultiSelect(document.querySelector('[data-filter="schemes"]'),{options:uniqueOptions('schemes'),placeholder:'All funding schemes',onChange:v=>{state.schemes=v;update();}});
    if(search) document.querySelector('[data-filter="search"]').addEventListener('input',event=>{state.search=event.target.value;update();});
    update();
    return state;
  }

  function selectedLabels(state) {
    const values=[];
    state.clusters?.forEach(code=>values.push(D.clusters.find(c=>c.code===code)?.short||code));
    state.countries?.forEach(code=>values.push(D.countries.find(c=>c.code===code)?.name||code));
    state.schemes?.forEach(code=>values.push(D.projects.find(p=>p.schemeCode===code)?.scheme||code));
    return values;
  }

  function yearRows(projects) { return groupCount(projects,p=>p.start?.slice(0,4)).sort((a,b)=>a.key.localeCompare(b.key)).map(r=>({...r,label:r.key})); }
  function clusterRows(projects) { return groupCount(projects,p=>p.clusterCode); }
  function schemeRows(projects) { return groupCount(projects,p=>p.schemeCode); }
  function countryRows(projects) { return groupCount(projects,p=>projectPartnerCodes(p)); }

  function visibleCountryCodes(selected=[], eu27Only=false) {
    return selected.length ? new Set(selected) : eu27Only ? window.HE.EU27 : null;
  }

  function scopedCountryRows(projects, selected=[], eu27Only=false) {
    const allowed=visibleCountryCodes(selected,eu27Only);
    return countryRows(projects).filter(row=>!allowed||allowed.has(row.key));
  }

  function scopedMetrics(projects, countryCodes=null) {
    const base=metrics(projects);
    if(!countryCodes)return base;
    const allowed=countryCodes instanceof Set?countryCodes:new Set(countryCodes);
    const partnerCountries=new Set();
    projects.forEach(project=>project.organisations.forEach(org=>{
      if(org.countryCode!=='NZ'&&allowed.has(org.countryCode))partnerCountries.add(org.countryCode);
    }));
    return {...base,partnerCountries:partnerCountries.size};
  }

  function renderClusterMix(element, projects) {
    const rows=clusterRows(projects);
    element.replaceChildren();
    element.className='cluster-mix-chart';
    if(!rows.length){element.innerHTML='<div class="chart-empty">No projects match the selection.</div>';return;}
    const max=Math.max(...rows.map(row=>row.value),1);
    rows.forEach(row=>{
      const cluster=D.clusters.find(item=>item.code===row.key);
      const color=clusterColor(row.key);
      const item=document.createElement('div');item.className='cluster-mix-row';
      const track=document.createElement('div');track.className='cluster-mix-track';
      const fill=document.createElement('span');fill.className='cluster-mix-fill';fill.style.width=`${Math.max(3,row.value/max*100)}%`;fill.style.background=color;
      const label=document.createElement('span');label.className='cluster-mix-name';label.textContent=cluster?.short||row.key;label.title=cluster?.name||row.key;
      const value=document.createElement('strong');value.className='cluster-mix-value';value.textContent=fmtNumber(row.value);
      track.append(fill,label);item.append(track,value);element.appendChild(item);
    });
  }

  function renderSchemeMix(element, projects) {
    const rows=schemeRows(projects);
    element.replaceChildren();
    element.className='cluster-mix-chart scheme-mix-chart';
    if(!rows.length){element.innerHTML='<div class="chart-empty">No funding schemes match the selection.</div>';return;}
    const max=Math.max(...rows.map(row=>row.value),1);
    rows.forEach(row=>{
      const name=D.projects.find(project=>project.schemeCode===row.key)?.scheme||row.key;
      const item=document.createElement('div');item.className='cluster-mix-row scheme-mix-row';
      const track=document.createElement('div');track.className='cluster-mix-track';
      const fill=document.createElement('span');fill.className='cluster-mix-fill';fill.style.width=`${Math.max(3,row.value/max*100)}%`;fill.style.background=schemeColor(row.key);
      const label=document.createElement('span');label.className='cluster-mix-name';label.textContent=name;label.title=name;
      const value=document.createElement('strong');value.className='cluster-mix-value';value.textContent=fmtNumber(row.value);
      track.append(fill,label);item.append(track,value);element.appendChild(item);
    });
  }

  function renderNzOrganisationTable(element, projects) {
    const rows=organisationRows(projects,'NZ').filter(row=>row.funding>0);
    element.replaceChildren();
    element.className='organisation-table-wrap';
    if(!rows.length){element.innerHTML='<div class="chart-empty">No funded New Zealand organisations match the selection.</div>';return;}
    const exactMoney=new Intl.NumberFormat('en-NZ',{style:'currency',currency:'EUR',maximumFractionDigits:0});
    const roleNames={participant:'Participant',coordinator:'Coordinator',thirdParty:'Third party',associatedPartner:'Associated partner'};
    const table=document.createElement('table');table.className='organisation-table';
    const thead=document.createElement('thead');thead.innerHTML='<tr><th>Organisation</th><th>Head office city</th><th>Role</th><th>Projects</th><th>Total EU contribution</th></tr>';
    const tbody=document.createElement('tbody');
    rows.forEach(row=>{
      const tr=document.createElement('tr');
      const name=document.createElement('td');name.className='organisation-name';name.textContent=row.name;
      const city=document.createElement('td');city.textContent=row.city||'Not reported';
      const role=document.createElement('td');role.className='organisation-role';role.textContent=row.roles.map(value=>roleNames[value]||value).join(', ');
      const projectsCell=document.createElement('td');projectsCell.textContent=fmtNumber(row.projectCount);
      const funding=document.createElement('td');funding.className='organisation-funding';funding.textContent=row.funding>0?exactMoney.format(row.funding):'Not reported';
      tr.append(name,city,role,projectsCell,funding);tbody.appendChild(tr);
    });
    table.append(thead,tbody);element.appendChild(table);
  }

  function renderEu27OrganisationTable(element, projects, allowedCountries) {
    const allowed=allowedCountries instanceof Set?allowedCountries:new Set(allowedCountries||[]);
    const rows=organisationRows(projects).filter(row=>allowed.has(row.key.split('|')[0])&&row.funding>0);
    element.replaceChildren();
    element.className='organisation-table-wrap';
    if(!rows.length){element.innerHTML='<div class="chart-empty">No funded EU27 organisations match the selection.</div>';return;}
    const exactMoney=new Intl.NumberFormat('en-NZ',{style:'currency',currency:'EUR',maximumFractionDigits:0});
    const roleNames={participant:'Participant',coordinator:'Coordinator',thirdParty:'Third party',associatedPartner:'Associated partner'};
    const table=document.createElement('table');table.className='organisation-table eu27-organisation-table';
    const thead=document.createElement('thead');thead.innerHTML='<tr><th>Organisation</th><th>Country</th><th>Head office city</th><th>Role</th><th>Projects</th><th>Total EU contribution</th></tr>';
    const tbody=document.createElement('tbody');
    rows.forEach(row=>{
      const tr=document.createElement('tr');
      const name=document.createElement('td');name.className='organisation-name';name.textContent=row.name;
      const country=document.createElement('td');country.textContent=row.country||'Not reported';
      const city=document.createElement('td');city.textContent=row.city||'Not reported';
      const role=document.createElement('td');role.className='organisation-role';role.textContent=row.roles.map(value=>roleNames[value]||value).join(', ');
      const projectsCell=document.createElement('td');projectsCell.textContent=fmtNumber(row.projectCount);
      const funding=document.createElement('td');funding.className='organisation-funding';funding.textContent=exactMoney.format(row.funding);
      tr.append(name,country,city,role,projectsCell,funding);tbody.appendChild(tr);
    });
    table.append(thead,tbody);element.appendChild(table);
  }

  function initOverview(){
    let countryScope='all';
    let currentProjects=D.projects;
    const scopeControl=document.querySelector('[data-country-scope]');
    const renderLeadingCountries=()=>{
      let rows=countryRows(currentProjects);
      if(countryScope==='eu') rows=rows.filter(row=>window.HE.EU27.has(row.key));
      if(countryScope==='non-eu') rows=rows.filter(row=>!window.HE.EU27.has(row.key));
      renderHbars(document.querySelector('[data-chart="countries"]'),rows,{label:r=>D.countries.find(c=>c.code===r.key)?.name||r.key,color:r=>countryColor(r.key),limit:rows.length});
    };
    scopeControl.addEventListener('click',event=>{
      const button=event.target.closest('[data-country-group]');
      if(!button)return;
      countryScope=button.dataset.countryGroup;
      scopeControl.querySelectorAll('[data-country-group]').forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));});
      renderLeadingCountries();
    });
    commonFilters({countries:true,onUpdate:state=>{
      const projects=filterProjects(state), m=metrics(projects);
      currentProjects=projects;
      setMetrics(document.querySelector('[data-metrics]'),m); renderChips(document.querySelector('[data-selection]'),selectedLabels(state),'All partner countries');
      const names=state.countries.map(code=>D.countries.find(c=>c.code===code)?.name).filter(Boolean);
      document.querySelector('[data-narrative]').textContent=names.length?`${fmtNumber(projects.length)} projects connect New Zealand with ${names.join(names.length>2?', ': ' and ')}${names.length>2?' and other selected partners':''}.`:`Across ${fmtNumber(projects.length)} signed projects, New Zealand organisations collaborate with partners in ${fmtNumber(m.partnerCountries)} countries.`;
      renderBars(document.querySelector('[data-chart="years"]'),yearRows(projects));
      renderClusterMix(document.querySelector('[data-chart="clusters"]'),projects);
      renderLeadingCountries();
      renderNzOrganisationTable(document.querySelector('[data-chart="nz-orgs"]'),projects);
      renderProjectTable(document.querySelector('[data-project-table]'),projects,projects.length);
    }});
  }

  function initClusterOverview(){
    let stateRef;
    stateRef=commonFilters({countries:true,clusters:true,eu27OnlyCountries:true,onUpdate:state=>{
      const projects=filterProjects(state), allowedCountries=visibleCountryCodes(state.countries,true), m=scopedMetrics(projects,allowedCountries);
      setMetrics(document.querySelector('[data-metrics]'),m); renderChips(document.querySelector('[data-selection]'),selectedLabels(state),'All clusters and EU27 partner countries');
      const selected=state.clusters.length?state.clusters.map(code=>D.clusters.find(c=>c.code===code)?.short).join(', '):'the six Pillar II clusters';
      document.querySelector('[data-narrative]').textContent=`Explore how New Zealand participation is distributed across ${selected}, then refine the picture by EU27 partner country.`;
      renderClusterBubbles(document.querySelector('[data-chart="cluster-bubbles"]'),projects,code=>{
        const next=new Set(stateRef.clusterControl.values); next.has(code)?next.delete(code):next.add(code); stateRef.clusterControl.set([...next]);
      },state.clusters);
      renderBars(document.querySelector('[data-chart="years"]'),yearRows(projects),{color:row=>'#25b6a5'});
      renderSchemeMix(document.querySelector('[data-chart="schemes"]'),projects);
      const countries=scopedCountryRows(projects,state.countries,true);
      renderHbars(document.querySelector('[data-chart="countries"]'),countries,{label:r=>D.countries.find(c=>c.code===r.key)?.name||r.key,color:r=>countryColor(r.key),limit:countries.length});
      renderNzOrganisationTable(document.querySelector('[data-chart="nz-orgs"]'),projects);
      renderEu27OrganisationTable(document.querySelector('[data-chart="partner-orgs"]'),projects,allowedCountries);
      renderProjectTable(document.querySelector('[data-project-table]'),projects,projects.length,{countryCodes:allowedCountries});
    }});
  }

  function initFlow(levels,{eu27Only=false}={}){
    commonFilters({countries:true,clusters:true,schemes:levels.includes('scheme'),eu27OnlyCountries:eu27Only,onUpdate:state=>{
      const projects=filterProjects(state), countryScope=visibleCountryCodes(state.countries,eu27Only);
      const allLabel=eu27Only?(levels.includes('scheme')?'All clusters, funding schemes and EU27 partner countries':'All clusters and EU27 partner countries'):'All filters';
      setMetrics(document.querySelector('[data-metrics]'),scopedMetrics(projects,countryScope)); renderChips(document.querySelector('[data-selection]'),selectedLabels(state),allLabel);
      renderFlow(document.querySelector('[data-flow]'),projects,levels,{countryCodes:countryScope,countryValueRight:eu27Only});
    }});
  }

  function initProjects(){
    const state={countries:[],clusters:[],schemes:[],search:'',filtered:[...D.projects],selectedId:''};
    const list=document.querySelector('[data-project-list]');
    const slide=document.querySelector('[data-focus-slide]');
    const previous=document.querySelector('[data-previous]');
    const next=document.querySelector('[data-next]');
    const fullMoney=new Intl.NumberFormat('en-NZ',{style:'currency',currency:'EUR',maximumFractionDigits:0});
    const countryName=code=>D.countries.find(country=>country.code===code)?.name||({EL:'Greece',UK:'United Kingdom'}[code]||code);
    const flag=code=>{const normalised=code==='UK'?'GB':code==='EL'?'GR':code;return /^[A-Z]{2}$/.test(normalised)?String.fromCodePoint(...[...normalised].map(char=>127397+char.charCodeAt(0))):'•';};
    const roleName=role=>({coordinator:'Coordinator',participant:'Participant',thirdParty:'Third party'}[role]||String(role||'Participant').replace(/([A-Z])/g,' $1').replace(/^./,char=>char.toUpperCase()));
    const put=(selector,value)=>{const element=document.querySelector(selector);if(element)element.textContent=value??'';};
    const money=value=>Number(value)>0?fullMoney.format(value):'Not reported';

    let controlsReady=false;
    const applyFilters=()=>{
      if(!controlsReady)return;
      const term=state.search.trim().toLowerCase();
      state.filtered=filterProjects({...state,search:''}).filter(project=>!term||[
        project.id,project.acronym,project.title,project.teaser,project.focus,project.topic,
        project.coordinator?.name,project.coordinator?.short
      ].join(' ').toLowerCase().includes(term));
      if(state.filtered.length&&!state.filtered.some(project=>project.id===state.selectedId)) state.selectedId=state.filtered[0].id;
      renderList();
      if(state.filtered.length) renderProject(D.projects.find(project=>project.id===state.selectedId));
      slide.hidden=!state.filtered.length;
      updatePosition();
    };

    const clusterControl=mountMultiSelect(document.querySelector('[data-filter="clusters"]'),{options:uniqueOptions('clusters'),placeholder:'All clusters',onChange:values=>{state.clusters=values;applyFilters();}});
    const schemeControl=mountMultiSelect(document.querySelector('[data-filter="schemes"]'),{options:uniqueOptions('schemes'),placeholder:'All funding schemes',onChange:values=>{state.schemes=values;applyFilters();}});
    const countryControl=mountMultiSelect(document.querySelector('[data-filter="countries"]'),{options:uniqueOptions('countries'),placeholder:'All partner countries',searchable:true,countryActions:true,onChange:values=>{state.countries=values;applyFilters();}});
    controlsReady=true;

    function renderList(){
      list.replaceChildren();
      const countText=`${fmtNumber(state.filtered.length)} ${state.filtered.length===1?'project':'projects'}`;
      put('[data-result-count]',countText);put('[data-list-count]',countText);
      if(!state.filtered.length){const empty=document.createElement('div');empty.className='focus-empty';empty.textContent='No projects match these filters. Try a different search or clear the filters.';list.appendChild(empty);return;}
      state.filtered.forEach(project=>{
        const cluster=D.clusters.find(item=>item.code===project.clusterCode);
        const button=document.createElement('button');button.type='button';button.className=`focus-project-item${project.id===state.selectedId?' active':''}`;button.setAttribute('role','option');button.setAttribute('aria-selected',String(project.id===state.selectedId));button.style.setProperty('--item-colour',clusterColor(project.clusterCode));
        const bar=document.createElement('span');bar.className='focus-project-bar';bar.setAttribute('aria-hidden','true');
        const content=document.createElement('span');
        const acronym=document.createElement('span');acronym.className='focus-project-acronym';acronym.textContent=project.acronym;
        const title=document.createElement('span');title.className='focus-project-title';title.textContent=project.title;title.title=project.title;
        const id=document.createElement('span');id.className='focus-project-id';id.textContent=`${project.id} · ${cluster?.short||project.cluster}`;
        content.append(acronym,title,id);button.append(bar,content);button.addEventListener('click',()=>selectProject(project.id,true));list.appendChild(button);
      });
    }

    function renderConsortium(project){
      const body=document.querySelector('[data-consortium-list]');body.replaceChildren();
      const selectedCountries=new Set(state.countries);
      const organisations=[...project.organisations].sort((a,b)=>{
        const priorityRank=org=>{if(!selectedCountries.size)return 0;if(!selectedCountries.has(org.countryCode))return 2;return Number(org.contribution)>0&&['coordinator','participant'].includes(org.role)?0:1;};
        const selectedOrder=priorityRank(a)-priorityRank(b);if(selectedOrder)return selectedOrder;
        if(!selectedCountries.size){const coordinatorOrder=Number(Boolean(b.coordinator))-Number(Boolean(a.coordinator));if(coordinatorOrder)return coordinatorOrder;const nzOrder=Number(b.countryCode==='NZ')-Number(a.countryCode==='NZ');if(nzOrder)return nzOrder;}
        return countryName(a.countryCode).localeCompare(countryName(b.countryCode))||(a.short||a.name).localeCompare(b.short||b.name);
      });
      const funded=organisations.filter(org=>Number(org.contribution)>0).length;
      const countries=new Set(organisations.map(org=>org.countryCode));
      const priorityNames=state.countries.map(countryName).filter(Boolean);
      put('[data-consortium-summary]',`${fmtNumber(organisations.length)} organisations · ${fmtNumber(countries.size)} countries · ${fmtNumber(funded)} with a recorded EU contribution${priorityNames.length?` · ${priorityNames.join(', ')} listed first`:''}`);
      organisations.forEach(org=>{
        const row=document.createElement('tr');
        if(org.coordinator)row.classList.add('coordinator');
        if(org.countryCode==='NZ')row.classList.add('nz');
        if(selectedCountries.has(org.countryCode))row.classList.add('priority-country');

        const organisation=document.createElement('td');organisation.className='organisation-name';organisation.textContent=org.name;
        if(org.short&&org.short!==org.name)organisation.title=org.short;

        const country=document.createElement('td');country.textContent=`${flag(org.countryCode)} ${countryName(org.countryCode)}`;
        const city=document.createElement('td');city.textContent=org.city||'Not reported';

        const role=document.createElement('td');role.className='organisation-role';role.textContent=[roleName(org.role),org.sme?'SME':null].filter(Boolean).join(' · ');

        const contribution=document.createElement('td');contribution.className='organisation-funding';contribution.textContent=Number(org.contribution)>0?money(org.contribution):'No allocation reported';
        if(!(Number(org.contribution)>0))contribution.classList.add('unfunded');

        row.append(organisation,country,city,role,contribution);body.appendChild(row);
      });
    }

    function renderProject(project){
      if(!project)return;
      const cluster=D.clusters.find(item=>item.code===project.clusterCode);
      const nz=project.organisations.filter(org=>org.countryCode==='NZ');
      const nzFunding=nz.reduce((sum,org)=>sum+(org.contribution||0),0);
      const countryRows=project.countryParticipation||[...new Set(project.countryCodes)].map(code=>({code,organisations:project.organisations.filter(org=>org.countryCode===code).length}));
      slide.style.setProperty('--cluster-colour',clusterColor(project.clusterCode));slide.style.setProperty('--scheme-colour',schemeColor(project.schemeCode));
      put('[data-project-cluster]',cluster?.name||project.cluster);put('[data-project-acronym]',project.acronym);put('[data-project-title]',project.title);put('[data-project-id]',`Grant ${project.id}`);put('[data-project-status]',project.status||'Status not reported');
      put('[data-project-contribution]',money(project.ecContribution));put('[data-project-cost]',project.totalCost>0?`Total project cost ${money(project.totalCost)}`:'Total project cost not reported');
      put('[data-project-duration]',project.duration?`${fmtNumber(project.duration)} months`:'Not reported');put('[data-project-dates]',`${formatDate(project.start)} – ${formatDate(project.end)}`);
      put('[data-project-organisations]',`${fmtNumber(project.organisationCount||project.organisations.length)} organisations`);put('[data-project-countries]',`${fmtNumber(project.countryCount||countryRows.length)} countries represented`);
      put('[data-project-nz-funding]',money(nzFunding));put('[data-project-nz-count]',`${nz.length} NZ ${nz.length===1?'organisation':'organisations'}`);
      put('[data-project-focus]',project.focus||project.teaser||'No project objective is available in the source record.');put('[data-project-scheme]',project.scheme||'Not reported');put('[data-project-scheme-code]',project.schemeCode);put('[data-project-call]',project.callCode||'Not reported');put('[data-project-topic]',project.topic||'Not reported');put('[data-project-topic-code]',project.topicCode);
      const coordinator=project.coordinator||project.organisations.find(org=>org.coordinator);
      put('[data-coordinator-name]',coordinator?(coordinator.short||coordinator.name):'Not reported');put('[data-coordinator-meta]',coordinator?[countryName(coordinator.countryCode),coordinator.city,coordinator.contribution>0?`${money(coordinator.contribution)} EU contribution`:null].filter(Boolean).join(' · '):'');

      const keywords=document.querySelector('[data-project-keywords]');keywords.replaceChildren();(project.keywords||[]).forEach(keyword=>{const chip=document.createElement('span');chip.className='focus-keyword';chip.textContent=keyword;keywords.appendChild(chip);});keywords.hidden=!keywords.children.length;
      const participants=document.querySelector('[data-nz-participation]');participants.replaceChildren();
      if(!nz.length){const empty=document.createElement('div');empty.className='focus-empty';empty.textContent='No New Zealand participant reported.';participants.appendChild(empty);}
      nz.forEach(org=>{const item=document.createElement('div');item.className='focus-participant';const name=document.createElement('strong');name.textContent=org.short||org.name;name.title=org.name;const meta=document.createElement('small');meta.textContent=[roleName(org.role),org.city,org.contribution>0?`${money(org.contribution)} EU contribution`:'Contribution not reported'].filter(Boolean).join(' · ');item.append(name,meta);participants.appendChild(item);});
      const chips=document.querySelector('[data-country-chips]');chips.replaceChildren();countryRows.forEach(row=>{const chip=document.createElement('span');chip.className=`focus-country-chip${row.code==='NZ'?' nz':''}`;chip.textContent=`${flag(row.code)} ${countryName(row.code)} · ${row.organisations}`;chip.title=`${countryName(row.code)}: ${row.organisations} ${row.organisations===1?'organisation':'organisations'}`;chips.appendChild(chip);});
      renderConsortium(project);
      const cordis=document.querySelector('[data-cordis-link]');cordis.href=`https://cordis.europa.eu/project/id/${encodeURIComponent(project.id)}`;cordis.setAttribute('aria-label',`Open ${project.acronym} on CORDIS`);
      document.title=`${project.acronym} · Horizon Europe Project Explorer`;
    }

    function selectProject(id,updateHash=false){
      const project=D.projects.find(item=>item.id===id);if(!project)return;state.selectedId=project.id;renderProject(project);renderList();updatePosition();
      if(updateHash&&location.hash.slice(1)!==project.id)history.replaceState(null,'',`#${project.id}`);
      list.querySelector('.focus-project-item.active')?.scrollIntoView({block:'nearest'});
    }
    function updatePosition(){const index=state.filtered.findIndex(project=>project.id===state.selectedId);put('[data-position]',index>=0?`${index+1} of ${state.filtered.length}`:'—');previous.disabled=index<=0;next.disabled=index<0||index>=state.filtered.length-1;}
    function move(direction){const index=state.filtered.findIndex(project=>project.id===state.selectedId);const target=state.filtered[index+direction];if(target)selectProject(target.id,true);}
    let toastTimer;function showToast(message){const toast=document.querySelector('[data-toast]');toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),1800);}
    async function copyLink(){const url=`${location.href.split('#')[0]}#${state.selectedId}`;try{await navigator.clipboard.writeText(url);}catch(error){const input=document.createElement('textarea');input.value=url;input.style.position='fixed';input.style.opacity='0';document.body.appendChild(input);input.select();document.execCommand('copy');input.remove();}showToast('Project link copied');}

    document.querySelector('[data-filter="search"]').addEventListener('input',event=>{state.search=event.target.value;applyFilters();});
    document.querySelector('[data-clear-filters]').addEventListener('click',()=>{document.querySelector('[data-filter="search"]').value='';state.search='';clusterControl.clear();schemeControl.clear();countryControl.clear();applyFilters();document.querySelector('[data-filter="search"]').focus();});
    previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));document.querySelector('[data-copy-link]').addEventListener('click',copyLink);document.querySelector('[data-print]').addEventListener('click',()=>window.print());
    window.addEventListener('hashchange',()=>{const id=location.hash.slice(1);if(id)selectProject(id,false);});
    document.addEventListener('keydown',event=>{if(event.target.matches('input,button'))return;if(event.key==='ArrowLeft')move(-1);if(event.key==='ArrowRight')move(1);});
    const requested=location.hash.slice(1);state.selectedId=D.projects.some(project=>project.id===requested)?requested:D.projects[0]?.id||'';applyFilters();
  }

  function initNcps(){
    const search=document.querySelector('[data-filter="search"]'); const area=document.querySelector('[data-filter="area"]');
    const render=()=>{const term=search.value.trim().toLowerCase(),value=area.value;const rows=D.ncps.filter(n=>(!value||n.pillar===value)&&(!term||`${n.name} ${n.role} ${n.coverage}`.toLowerCase().includes(term)));document.querySelector('[data-ncp-count]').textContent=`${rows.length} contacts`;document.querySelector('[data-ncp-list]').innerHTML=rows.map(n=>`<article class="ncp-card"><span class="ncp-area">${n.pillar}</span><h2>${n.name}</h2><span class="ncp-role">${n.role}</span><p class="ncp-coverage">${n.coverage}</p><a href="mailto:${n.email}">${n.email}</a></article>`).join('')||'<div class="chart-empty">No contact matches the selection.</div>';};
    search.addEventListener('input',render);area.addEventListener('change',render);render();
  }

  if(page==='overview') initOverview();
  if(page==='cluster-overview') initClusterOverview();
  if(page==='funding-flows') initFlow(['cluster','scheme','country'],{eu27Only:true});
  if(page==='cluster-country') initFlow(['cluster','country'],{eu27Only:true});
  if(page==='projects') initProjects();
  if(page==='ncp') initNcps();
})();
