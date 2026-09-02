(()=>{
  const {D,clusterColor,fmtNumber,formatDate,mountMultiSelect,uniqueOptions}=window.HE;
  const store=window.HE_PROJECT_RESULTS||{projects:[]};
  const stageLabels={signed:'Signed',ongoing:'Ongoing',outputs:'Outputs available',completed:'Completed'};
  const stageOrder=['signed','ongoing','outputs','completed'];
  const outputLabels={deliverable:'Deliverable',paper:'Publication',pilot:'Pilot',demonstrator:'Demonstrator','policy-report':'Policy report',dataset:'Dataset',report:'Report',website:'Website',other:'Other'};
  const records=new Map(store.projects.map(record=>[record.projectId,record]));
  const today=new Date().toISOString().slice(0,10);
  const params=new URLSearchParams(location.search);
  const readList=(key,legacyKey='')=>(params.get(key)||params.get(legacyKey)||'').split(',').filter(Boolean);
  const state={
    q:params.get('search')||params.get('q')||'',
    stage:params.get('stage')||'',
    clusters:readList('clusters','cluster'),
    schemes:readList('schemes'),
    countries:readList('countries'),
    selectedId:decodeURIComponent(location.hash.slice(1)||'')
  };

  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
  const safeUrl=value=>/^https?:\/\//i.test(String(value||''))?String(value):'';
  const plural=(count,singular,pluralForm=`${singular}s`)=>`${fmtNumber(count)} ${count===1?singular:pluralForm}`;

  function inferred(project){
    if(project.start&&project.start>today)return'signed';
    if(project.end&&project.end<today)return'completed';
    if(project.results?.length)return'outputs';
    return'ongoing';
  }

  function enriched(project){
    const record=records.get(project.id);
    const stage=record?.stage||inferred(project);
    return{project,record,stage,outputs:record?.outputs||project.results||[]};
  }

  const rows=D.projects.map(enriched);
  const rowById=new Map(rows.map(row=>[String(row.project.id),row]));

  function syncUrl(hash=location.hash){
    const next=new URLSearchParams();
    if(state.q)next.set('search',state.q);
    if(state.stage)next.set('stage',state.stage);
    if(state.clusters.length)next.set('clusters',state.clusters.join(','));
    if(state.schemes.length)next.set('schemes',state.schemes.join(','));
    if(state.countries.length)next.set('countries',state.countries.join(','));
    history.replaceState(null,'',`${location.pathname}${next.size?`?${next}`:''}${hash||''}`);
  }

  function showToast(message){
    const toast=document.querySelector('[data-toast]');
    toast.textContent=message;
    toast.classList.add('show');
    setTimeout(()=>toast.classList.remove('show'),1800);
  }

  async function share(){
    syncUrl();
    await window.HE.copyCurrentView(document.querySelector('[data-share-view]'),'Results view link copied');
    showToast('Results view link copied');
  }

  function projectCountryCodes(project){
    return project.countryCodes||project.countryParticipation?.map(item=>item.code)||project.organisations?.map(item=>item.countryCode)||[];
  }

  function filtered({ignoreStage=false}={}){
    const q=state.q.toLowerCase();
    return rows.filter(row=>{
      const project=row.project;
      const countries=projectCountryCodes(project);
      const coordinator=project.coordinator||project.organisations?.find(item=>item.coordinator);
      const haystack=`${project.id} ${project.acronym} ${project.title} ${project.teaser||''} ${project.focus||''} ${coordinator?.name||''} ${coordinator?.short||''} ${row.record?.summary||''} ${row.outputs.map(output=>`${output.title} ${output.description||''} ${(output.authors||[]).join(' ')}`).join(' ')}`.toLowerCase();
      return(ignoreStage||!state.stage||row.stage===state.stage)
        &&(!state.clusters.length||state.clusters.includes(project.clusterCode))
        &&(!state.schemes.length||state.schemes.includes(project.schemeCode))
        &&(!state.countries.length||state.countries.some(code=>countries.includes(code)))
        &&(!q||haystack.includes(q));
    });
  }

  function renderOverview(){
    const root=document.querySelector('[data-stage-overview]');
    root.replaceChildren();
    stageOrder.forEach(stage=>{
      const button=document.createElement('button');
      button.type='button';
      button.className=`result-stage-card ${stage}${state.stage===stage?' active':''}`;
      button.setAttribute('aria-pressed',String(state.stage===stage));
      const count=filtered({ignoreStage:true}).filter(row=>row.stage===stage).length;
      button.innerHTML=`<span>${stageLabels[stage]}</span><strong>${fmtNumber(count)}</strong><small>${stage==='outputs'?'Projects with public outputs recorded':'Projects in this implementation stage'}</small>`;
      button.addEventListener('click',()=>{
        state.stage=state.stage===stage?'':stage;
        syncUrl();
        render();
      });
      root.append(button);
    });
  }

  function outputMarkup(output){
    const label=outputLabels[output.type]||'Output';
    const dateLabel=output.published?formatDate(output.published):output.publishedYear||(output.sourceUpdated?`Updated ${formatDate(output.sourceUpdated)}`:'Date not reported');
    const source=output.source==='Manual'?'Manually added':'CORDIS';
    const meta=[output.subtype,dateLabel,source].filter(Boolean).map(escapeHtml).join(' · ');
    const title=escapeHtml(output.title||label);
    const description=output.description&&output.description!==output.title?`<p>${escapeHtml(output.description)}</p>`:'';
    const url=safeUrl(output.url);
    const content=`<span>${escapeHtml(label)}</span><strong>${title}</strong>${description}<small>${meta}${url?' · Open source ↗':''}</small>`;
    return url?`<a class="public-output-item" href="${escapeHtml(url)}" target="_blank" rel="noopener">${content}</a>`:`<div class="public-output-item">${content}</div>`;
  }

  function outputsMarkup(outputs){
    if(!outputs.length)return'<div class="public-output-empty"><strong>No public outputs recorded yet</strong><p>The project record will update when CORDIS publishes evidence or an item is added through the Site Manager.</p></div>';
    const visible=outputs.slice(0,6).map(outputMarkup).join('');
    const remaining=outputs.slice(6);
    return`${visible}${remaining.length?`<details class="public-output-extra"><summary>Show ${plural(remaining.length,'more output','more outputs')}</summary><div>${remaining.map(outputMarkup).join('')}</div></details>`:''}`;
  }

  function outputBreakdown(outputs){
    const counts=new Map();
    outputs.forEach(output=>{const label=outputLabels[output.type]||'Other';counts.set(label,(counts.get(label)||0)+1)});
    return[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([label,count])=>`${count} ${label.toLowerCase()}${count===1?'':'s'}`).join(' · ')||'Awaiting public evidence';
  }

  function projectCard({project,record,stage,outputs}){
    const article=document.createElement('article');
    article.className='public-result-card';
    article.id=`result-${project.id}`;
    article.dataset.resultProjectId=project.id;
    article.dataset.projectStage=stage;
    article.style.setProperty('--cluster-colour',clusterColor(project.clusterCode));
    const source=record?.stageSource==='manual'?'Implementation stage manually verified':record?.stageSource==='CORDIS results'?'Outputs imported from the CORDIS project record':'Implementation stage derived from the project dates';
    const summary=record?.summary||`The project runs from ${formatDate(project.start)} to ${formatDate(project.end)}.${outputs.length?` CORDIS currently records ${plural(outputs.length,'public output')}.`:''}`;
    const consortium=[project.organisationCount?plural(project.organisationCount,'organisation'):null,project.countryCount?plural(project.countryCount,'country','countries'):null].filter(Boolean);
    const duration=project.duration?`${fmtNumber(project.duration)} months`:'Not reported';
    const scheme=project.scheme||'Not reported';
    const explorerUrl=`projects.html#${encodeURIComponent(project.id)}`;
    const cordisUrl=`https://cordis.europa.eu/project/id/${encodeURIComponent(project.id)}`;
    article.innerHTML=`
      <div class="public-result-accent" aria-hidden="true"></div>
      <div class="public-result-inner">
        <header class="public-result-head">
          <div>
            <div class="public-result-kicker"><span>Project results</span><span class="public-result-cluster">${escapeHtml(project.cluster)}</span></div>
            <h2><a href="${explorerUrl}">${escapeHtml(project.acronym)}</a></h2>
            <p>${escapeHtml(project.title)}</p>
          </div>
          <div class="public-result-identity"><span>Grant ${escapeHtml(project.id)}</span><strong class="public-result-stage ${stage}"><i aria-hidden="true"></i>${stageLabels[stage]}</strong></div>
        </header>
        <section class="public-result-metrics" aria-label="${escapeHtml(project.acronym)} project metrics">
          <div><span>Timeline</span><strong>${duration}</strong><small>${formatDate(project.start)} – ${formatDate(project.end)}</small></div>
          <div class="scheme"><span>Funding scheme</span><strong>${escapeHtml(scheme)}</strong><small>${escapeHtml(project.schemeCode||'Horizon Europe')}</small></div>
          <div><span>Consortium</span><strong>${consortium[0]||'Not reported'}</strong><small>${consortium[1]||'Country coverage not reported'}</small></div>
          <div><span>Public outputs</span><strong>${fmtNumber(outputs.length)}</strong><small>${escapeHtml(outputBreakdown(outputs))}</small></div>
        </section>
        <div class="public-result-body">
          <section class="public-result-summary"><h3><span aria-hidden="true"></span>Implementation</h3><p>${escapeHtml(summary)}</p><small>${escapeHtml(source)}${record?.reviewed?` · Data checked ${formatDate(record.reviewed)}`:''}</small></section>
          <section class="public-result-outputs"><div class="public-result-section-head"><h3><span aria-hidden="true"></span>Public outputs</h3><b>${fmtNumber(outputs.length)}</b></div><div class="public-output-list">${outputsMarkup(outputs)}</div></section>
        </div>
        <footer class="public-result-footer"><span>Source: CORDIS project records and verified Site Manager additions.</span><div><a href="${explorerUrl}">Open in Project Explorer</a><a href="${cordisUrl}" target="_blank" rel="noopener">Open on CORDIS ↗</a></div></footer>
      </div>`;
    return article;
  }

  function renderProjectList(visible){
    const list=document.querySelector('[data-results-project-list]');
    list.replaceChildren();
    document.querySelector('[data-results-list-count]').textContent=plural(visible.length,'project');
    if(!visible.length){
      list.innerHTML='<div class="focus-empty">No projects match these filters. Try a different search or reset the filters.</div>';
      return;
    }
    visible.forEach(({project})=>{
      const cluster=D.clusters.find(item=>item.code===project.clusterCode);
      const button=document.createElement('button');
      button.type='button';
      button.className=`focus-project-item${String(project.id)===String(state.selectedId)?' active':''}`;
      button.setAttribute('role','option');
      button.setAttribute('aria-selected',String(String(project.id)===String(state.selectedId)));
      button.style.setProperty('--item-colour',clusterColor(project.clusterCode));
      button.innerHTML=`<span class="focus-project-bar" aria-hidden="true"></span><span><span class="focus-project-acronym">${escapeHtml(project.acronym)}</span><span class="focus-project-title" title="${escapeHtml(project.title)}">${escapeHtml(project.title)}</span><span class="focus-project-id">${escapeHtml(project.id)} · ${escapeHtml(cluster?.short||project.cluster)}</span></span>`;
      button.addEventListener('click',()=>{
        state.selectedId=String(project.id);
        syncUrl(`#${encodeURIComponent(project.id)}`);
        renderProjectList(visible);
        document.getElementById(`result-${project.id}`)?.scrollIntoView({behavior:'smooth',block:'start'});
      });
      list.append(button);
    });
  }

  function render(){
    const visible=filtered();
    if(!visible.some(row=>String(row.project.id)===String(state.selectedId)))state.selectedId=visible[0]?String(visible[0].project.id):'';
    renderOverview();
    document.querySelector('[data-results-stage]').value=stageLabels[state.stage]?state.stage:'';
    document.querySelector('[data-results-count]').textContent=`${plural(visible.length,'project')} shown · ${plural(visible.reduce((sum,row)=>sum+row.outputs.length,0),'public output')}`;
    const list=document.querySelector('[data-results-list]');
    list.replaceChildren();
    renderProjectList(visible);
    if(!visible.length){list.innerHTML='<article class="panel chart-empty">No projects match these filters.</article>';return}
    visible.forEach(row=>list.append(projectCard(row)));
  }

  const clusterControl=mountMultiSelect(document.querySelector('[data-results-filter="clusters"]'),{options:uniqueOptions('clusters'),placeholder:'All clusters',clearAction:true,onChange:values=>{state.clusters=values;syncUrl('');render();}});
  const schemeControl=mountMultiSelect(document.querySelector('[data-results-filter="schemes"]'),{options:uniqueOptions('schemes'),placeholder:'All funding schemes',clearAction:true,onChange:values=>{state.schemes=values;syncUrl('');render();}});
  const countryControl=mountMultiSelect(document.querySelector('[data-results-filter="countries"]'),{options:uniqueOptions('countries'),placeholder:'All partner countries',searchable:true,countryActions:true,clearAction:true,onChange:values=>{state.countries=values;syncUrl('');render();}});
  clusterControl.set(state.clusters);
  schemeControl.set(state.schemes);
  countryControl.set(state.countries);
  document.querySelector('[data-results-search]').value=state.q;
  document.querySelector('[data-results-stage]').value=stageLabels[state.stage]?state.stage:'';
  document.querySelector('[data-results-search]').addEventListener('input',event=>{state.q=event.target.value.trim();syncUrl();render()});
  document.querySelector('[data-results-stage]').addEventListener('change',event=>{state.stage=event.target.value;syncUrl();render()});
  document.querySelector('[data-results-reset]').addEventListener('click',()=>{
    state.q='';state.stage='';state.clusters=[];state.schemes=[];state.countries=[];state.selectedId='';
    document.querySelector('[data-results-search]').value='';document.querySelector('[data-results-stage]').value='';
    clusterControl.set([]);schemeControl.set([]);countryControl.set([]);
    syncUrl('');render();document.querySelector('[data-results-search]').focus();
  });
  document.querySelector('[data-share-view]').addEventListener('click',share);
  window.addEventListener('hashchange',()=>{
    const id=decodeURIComponent(location.hash.slice(1)||'');
    if(!rowById.has(id))return;
    state.selectedId=id;
    const visible=filtered();
    renderProjectList(visible);
    document.getElementById(`result-${id}`)?.scrollIntoView({block:'start'});
  });
  render();
})();
