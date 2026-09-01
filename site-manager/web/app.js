(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = {events:null, projectResults:{projects:[]}, projectReference:[], countryStatus:null, countryReference:[], portfolio:{}, projectStore:{projects:[]}, resourceLibrary:{items:[]}, exchangeStore:{current:{},history:[]}, exchangeCandidate:null, today:'', activeItemId:null, activeResultId:null};
  const typeLabels = {'event':'Event','deadline':'Deadline','news':'News','site-update':'Site update'};
  const typeColors = {'event':'#397fd8','deadline':'#ef6a61','news':'#8b68d0','site-update':'#2aa99d'};
  const dateFormat = new Intl.DateTimeFormat('en-NZ',{day:'numeric',month:'short',year:'numeric'});
  const contentForm = $('[data-content-form]');
  const countryForm = $('[data-country-form]');
  let toastTimer = 0;

  function notify(message, error = false) {
    const toast = $('[data-toast]');
    toast.textContent = message;
    toast.classList.toggle('error',error);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>toast.classList.remove('show'),3600);
  }
  function safeDate(value) { return value ? new Date(`${value.slice(0,10)}T00:00:00`) : null; }
  function formatDate(value) { const date=safeDate(value);return date && !Number.isNaN(date.valueOf()) ? dateFormat.format(date) : 'No date'; }
  function slugify(value) { return String(value||'item').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60) || 'item'; }
  function splitCodes(value) { return [...new Set(String(value||'').split(/[\s,;]+/).map(code=>code.trim()).filter(Boolean))]; }
  function api(path, options={}) {
    return fetch(path,{...options,headers:{...(options.headers||{}),'Content-Type':options.body instanceof Blob ? 'application/zip' : 'application/json'}}).then(async response=>{
      const payload=await response.json();
      if(!response.ok||payload.ok===false){const error=new Error(payload.message||'The operation failed.');error.details=payload.details||[];error.payload=payload;throw error;}
      return payload;
    });
  }

  function switchView(name) {
    $$('[data-view]').forEach(view=>view.classList.toggle('active',view.dataset.view===name));
    $$('[data-view-button]').forEach(button=>button.classList.toggle('active',button.dataset.viewButton===name));
    location.hash=name;
    window.scrollTo({top:0,behavior:'smooth'});
  }
  $$('[data-view-button]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.viewButton)));
  $$('[data-go]').forEach(control=>control.addEventListener('click',event=>{event.preventDefault();switchView(control.dataset.go)}));

  function metric(label,value,note) {
    const card=document.createElement('article');card.className='metric-card';
    const labelElement=document.createElement('span');labelElement.textContent=label;
    const valueElement=document.createElement('strong');valueElement.textContent=value;
    const noteElement=document.createElement('small');noteElement.textContent=note;
    card.append(labelElement,valueElement,noteElement);return card;
  }
  function renderDashboard() {
    const published=state.events.items.filter(item=>item.status==='published');
    const upcoming=published.filter(item=>['event','deadline'].includes(item.type)&&item.start&&item.start.slice(0,10)>=state.today);
    const metrics=$('[data-dashboard-metrics]');metrics.replaceChildren(
      metric('Projects',state.portfolio.projects,'Current CORDIS portfolio'),
      metric('Published updates',published.length,'Visible on the public page'),
      metric('Upcoming dates',upcoming.length,'Events and deadlines'),
      metric('Associated countries',state.countryStatus.associated.length,`Checked ${formatDate(state.countryStatus.metadata.checked)}`)
    );
    const checked=safeDate(state.countryStatus.metadata.checked),today=safeDate(state.today);
    const age=checked&&today?Math.round((today-checked)/86400000):0;
    $('[data-next-action-title]').textContent=age>90?'Review the country-status reference':upcoming.length?'Review upcoming events':'Add the next event or update';
    $('[data-next-action-copy]').textContent=age>90?`The programme-status reference was checked ${age} days ago.`:upcoming.length?`${upcoming.length} upcoming item${upcoming.length===1?' is':'s are'} currently published.`:'The portfolio is current, but no upcoming dates are published yet.';
  }

  function renderContentList() {
    const search=$('[data-content-search]').value.trim().toLowerCase();
    const filter=$('[data-content-filter]').value;
    const list=$('[data-content-list]');list.replaceChildren();
    const items=state.events.items.filter(item=>(filter==='all'||item.status===filter)&&(!search||`${item.title} ${item.summary} ${item.source}`.toLowerCase().includes(search)));
    if(!items.length){const empty=document.createElement('p');empty.style.cssText='padding:30px;color:#7b8fa0;text-align:center';empty.textContent='No content matches the current filters.';list.append(empty);return;}
    items.forEach(item=>{
      const row=document.createElement('button');row.type='button';row.className='content-row';row.classList.toggle('active',item.id===state.activeItemId);row.style.setProperty('--row-color',typeColors[item.type]||'#397fd8');
      const mark=document.createElement('span');mark.className='content-row-mark';
      const copy=document.createElement('span');const title=document.createElement('strong');title.textContent=item.title;const meta=document.createElement('small');meta.textContent=`${typeLabels[item.type]||item.type} · ${formatDate(item.start||item.published)}`;copy.append(title,meta);
      const status=document.createElement('span');status.className=`status-pill ${item.status}`;status.textContent=item.status;
      row.append(mark,copy,status);row.addEventListener('click',()=>editItem(item.id));list.append(row);
    });
  }
  function editItem(id, options={}) {
    const item=state.events.items.find(row=>row.id===id);if(!item)return;
    state.activeItemId=id;$('[data-editor-empty]').hidden=true;$('[data-editor-fields]').hidden=false;
    $('[data-editor-title]').textContent=item.title||'New item';
    Object.entries(item).forEach(([key,value])=>{
      const field=contentForm.elements.namedItem(key);if(!field)return;
      if(field.type==='checkbox')field.checked=Boolean(value);
      else if(Array.isArray(value))field.value=value.join(', ');
      else field.value=value??'';
    });
    updateEventDateVisibility();updateSummaryCount();renderPublicationState();if(!options.preserveState)setEditorState('No unsaved changes');renderContentList();
  }
  function blankItem() {
    const stamp=Date.now().toString().slice(-6);
    return {id:`new-item-${stamp}`,type:'event',status:'draft',title:'',summary:'',published:state.today,start:'',end:'',timezone:'Pacific/Auckland',location:'',url:'',source:'',clusters:[],countries:[],featured:false};
  }
  function addItem() {switchView('content');const item=blankItem();state.events.items.unshift(item);editItem(item.id);hideErrors('[data-form-errors]');setEditorState('New draft · not saved yet','warning');$('[name="title"]',contentForm).focus();}
  $$('[data-new-item]').forEach(button=>button.addEventListener('click',addItem));
  function readEditor() {
    const data=new FormData(contentForm),current=state.events.items.find(item=>item.id===state.activeItemId)||blankItem();
    const title=String(data.get('title')||'').trim();
    let id=String(data.get('id')||'').trim();
    if(!id||id.startsWith('new-item-')){
      const base=`${slugify(title)}-${String(data.get('published')||state.today)}`;
      const used=new Set(state.events.items.filter(row=>row.id!==state.activeItemId).map(row=>row.id));
      id=base;let suffix=2;while(used.has(id)){id=`${base}-${suffix++}`}
    }
    return {...current,id,type:data.get('type'),status:data.get('status'),title,summary:String(data.get('summary')||'').trim(),published:data.get('published'),start:data.get('start'),end:data.get('end'),timezone:String(data.get('timezone')||'Pacific/Auckland').trim(),location:String(data.get('location')||'').trim(),url:String(data.get('url')||'').trim(),source:String(data.get('source')||'').trim(),clusters:splitCodes(data.get('clusters')),countries:splitCodes(data.get('countries')).map(code=>code.toUpperCase()),featured:Boolean(data.get('featured'))};
  }
  async function saveEditor(event) {
    event.preventDefault();hideErrors('[data-form-errors]');setEditorState('Checking the required fields…','busy');
    const validation=validateEditor();
    if(validation.errors.length){
      const error=new Error('The event has not been saved yet. Complete the highlighted fields.');error.details=validation.errors;
      setEditorState(`Not saved · ${validation.errors.length} field${validation.errors.length===1?' needs':'s need'} attention`,'warning');showErrors('[data-form-errors]',error);notify(error.message,true);
      validation.first?.focus({preventScroll:true});validation.first?.scrollIntoView({behavior:'smooth',block:'center'});return;
    }
    const item=readEditor(),index=state.events.items.findIndex(row=>row.id===state.activeItemId);if(index<0){setEditorState('Not saved · select or create an item first','warning');return}
    const nextStore={...state.events,items:state.events.items.map((row,rowIndex)=>rowIndex===index?item:row)};
    const saveButton=$('[data-editor-save]');saveButton.disabled=true;saveButton.textContent='Saving…';setEditorState('Saving locally…','busy');
    try{const payload=await api('/api/events',{method:'POST',body:JSON.stringify(nextStore)});state.events=payload.events;state.activeItemId=item.id;hideErrors('[data-form-errors]');renderContentList();renderDashboard();editItem(item.id,{preserveState:true});const time=new Intl.DateTimeFormat('en-NZ',{hour:'2-digit',minute:'2-digit'}).format(new Date());setEditorState(`Saved at ${time} · ${item.status==='published'?'visible online after publishing to GitHub':item.status}`,'saved');notify(item.status==='published'?'Saved. This item is included in the public Updates page and feed.':payload.message);}
    catch(error){setEditorState('Not saved · check the message below','warning');showErrors('[data-form-errors]',error);notify(error.message,true)}
    finally{saveButton.disabled=false;saveButton.textContent='Save changes'}
  }
  contentForm.addEventListener('submit',saveEditor);
  $('[data-editor-save]').addEventListener('click',saveEditor);
  contentForm.addEventListener('input',event=>{event.target.classList?.remove('invalid-field');event.target.removeAttribute?.('aria-invalid');setEditorState('Unsaved changes · press Save changes to keep them','warning')});
  contentForm.elements.namedItem('type').addEventListener('change',()=>{updateEventDateVisibility();renderPublicationState()});
  contentForm.elements.namedItem('status').addEventListener('change',renderPublicationState);
  contentForm.elements.namedItem('start').addEventListener('change',renderPublicationState);
  contentForm.elements.namedItem('summary').addEventListener('input',updateSummaryCount);
  function validateEditor(){
    $$('input,select,textarea',contentForm).forEach(field=>{field.classList.remove('invalid-field');field.removeAttribute('aria-invalid')});
    const errors=[],required=[['title','Enter a title.'],['summary','Enter a short summary.'],['published','Choose the publication date.']];
    if(['event','deadline'].includes(contentForm.elements.namedItem('type').value))required.push(['start','Choose when the event or deadline starts.']);
    let first=null;required.forEach(([name,message])=>{const field=contentForm.elements.namedItem(name);if(String(field?.value||'').trim())return;errors.push(message);field?.classList.add('invalid-field');field?.setAttribute('aria-invalid','true');first=first||field});
    return {errors,first};
  }
  function setEditorState(message,tone=''){
    const element=$('[data-editor-state]');element.textContent=message;element.className=tone;
    const feedback=$('[data-save-feedback]');if(!feedback)return;feedback.className=`save-feedback ${tone}`;
    const title=$('strong',feedback),copy=$('small',feedback),icon=$('span',feedback);
    if(tone==='saved'){icon.textContent='✓';title.textContent='Save completed';copy.textContent=message}
    else if(tone==='warning'){icon.textContent='!';title.textContent='Not saved yet';copy.textContent=message}
    else if(tone==='busy'){icon.textContent='…';title.textContent='Saving in progress';copy.textContent=message}
    else{icon.textContent='●';title.textContent='Saved local version';copy.textContent=message}
  }
  function updateSummaryCount(){$('[data-summary-count]').textContent=contentForm.elements.namedItem('summary').value.length}
  function updateEventDateVisibility(){const visible=['event','deadline'].includes(contentForm.elements.namedItem('type').value);$('.event-date-fields').hidden=!visible}
  function renderPublicationState(){
    const type=contentForm.elements.namedItem('type').value,status=contentForm.elements.namedItem('status').value,start=contentForm.elements.namedItem('start').value;
    const box=$('[data-publication-state]'),title=$('[data-publication-title]'),copy=$('[data-publication-copy]'),icon=$('[data-publication-icon]'),archive=$('[data-archive-item]');
    box.className=`publication-state ${status}`;
    if(status==='published'){
      icon.textContent='✓';title.textContent='Published — included in the public website';
      copy.textContent=['event','deadline'].includes(type)?`Visible in Updates & Events${start?` and in the calendar on ${formatDate(start)}`:'; add a start date to place it in the calendar'}.`:'Visible in Updates & Events and in the RSS feed.';
      archive.textContent=['event','deadline'].includes(type)?'Remove from public calendar':'Remove from public page';
    }else if(status==='archived'){
      icon.textContent='↶';title.textContent='Archived — not visible online';copy.textContent='Kept locally and recoverable. Restore it as a draft to edit and republish it.';archive.textContent='Restore as draft';
    }else{
      icon.textContent='○';title.textContent='Draft — not visible online';copy.textContent='Saved locally until you choose Published and prepare the GitHub update.';archive.textContent='Archive draft';
    }
  }
  $('[data-duplicate-item]').addEventListener('click',()=>{const item=readEditor(),copy={...item,id:`${item.id}-copy`,title:`${item.title} — copy`,status:'draft',featured:false};state.events.items.unshift(copy);editItem(copy.id);setEditorState('Save this duplicate to keep it')});
  $('[data-archive-item]').addEventListener('click',()=>{const status=contentForm.elements.namedItem('status');status.value=status.value==='archived'?'draft':'archived';renderPublicationState();setEditorState('Unsaved status change','warning');notify(status.value==='archived'?'Save to remove this item from the public page and calendar.':'Restored as a draft. Save to keep this change.')});
  $('[data-delete-item]').addEventListener('click',async()=>{
    const current=state.events.items.find(item=>item.id===state.activeItemId);if(!current)return;
    if(!window.confirm(`Delete “${current.title||'this item'}” permanently?\n\nIt will be removed from the local manager, public page, calendar and RSS feed. This cannot be undone.`))return;
    const nextStore={...state.events,items:state.events.items.filter(item=>item.id!==current.id)};
    try{const payload=await api('/api/events',{method:'POST',body:JSON.stringify(nextStore)});state.events=payload.events;state.activeItemId=null;$('[data-editor-fields]').hidden=true;$('[data-editor-empty]').hidden=false;renderContentList();renderDashboard();notify('Item deleted permanently.');}
    catch(error){showErrors('[data-form-errors]',error);notify(error.message,true)}
  });
  $('[data-content-search]').addEventListener('input',renderContentList);$('[data-content-filter]').addEventListener('change',renderContentList);
  function showErrors(selector,error){const box=$(selector);box.hidden=false;box.textContent=[error.message,...(error.details||[])].join('\n')}
  function hideErrors(selector){const box=$(selector);box.hidden=true;box.textContent=''}

  const resultForm=$('[data-result-form]');
  const outputTypeLabels={deliverable:'Deliverable',paper:'Publication',pilot:'Pilot',demonstrator:'Demonstrator','policy-report':'Policy report',dataset:'Dataset',report:'Report',website:'Website',other:'Other'};
  function inferredResultStage(project){if(project.start&&project.start>state.today)return'signed';if(project.end&&project.end<state.today)return'completed';if(project.results?.length)return'outputs';return'ongoing'}
  function resultRecord(projectId){return state.projectResults.projects.find(row=>row.projectId===projectId)||null}
  function hasManualResult(record){const manual=record?.manual||{};return Boolean(manual.stage||manual.reviewed||manual.summary||(manual.outputs||[]).length)}
  function renderResultProjects(){
    const term=$('[data-result-search]').value.trim().toLowerCase(),list=$('[data-result-project-list]');list.replaceChildren();
    state.projectReference.filter(project=>!term||`${project.id} ${project.acronym} ${project.title}`.toLowerCase().includes(term)).forEach(project=>{
      const record=resultRecord(project.id),stage=record?.stage||inferredResultStage(project),button=document.createElement('button');button.type='button';button.className=`result-project-row${project.id===state.activeResultId?' active':''}`;button.setAttribute('aria-pressed',String(project.id===state.activeResultId));
      const copy=document.createElement('span'),title=document.createElement('strong'),meta=document.createElement('small'),pill=document.createElement('span');title.textContent=project.acronym||project.id;const outputCount=record?.outputs?.length||project.results?.length||0;meta.textContent=`${project.title}${outputCount?` · ${outputCount} public ${outputCount===1?'output':'outputs'}`:''}`;copy.append(title,meta);pill.className=`result-stage-pill ${stage}`;pill.textContent=`${stage.replace('outputs','outputs available')}${hasManualResult(record)?' · edited':''}`;button.append(copy,pill);button.addEventListener('click',()=>editProjectResult(project.id));list.append(button);
    });
  }
  function outputRow(output={type:'deliverable',title:'',url:'',published:''}){
    const row=document.createElement('div');row.className='result-output-row';
    row.innerHTML=`<label>Type<select data-output="type">${Object.entries(outputTypeLabels).map(([value,label])=>`<option value="${value}"${value===output.type?' selected':''}>${label}</option>`).join('')}</select></label><label>Title<input data-output="title" maxlength="220"></label><label>Public link<input data-output="url" type="url" placeholder="https://…"></label><label>Date<input data-output="published" type="date"></label><button class="quiet-action danger" type="button" aria-label="Remove output">Remove</button>`;
    row.querySelector('[data-output="title"]').value=output.title||'';row.querySelector('[data-output="url"]').value=output.url||'';row.querySelector('[data-output="published"]').value=output.published||'';
    row.querySelector('button').addEventListener('click',()=>{row.remove();markResultsDirty()});row.addEventListener('input',markResultsDirty);return row;
  }
  function renderCordisEvidence(record){
    const outputs=record?.cordis?.outputs||[],list=$('[data-result-cordis-output-list]');list.replaceChildren();$('[data-result-cordis-count]').textContent=`${outputs.length} ${outputs.length===1?'output':'outputs'}`;$('[data-result-cordis-status]').textContent=`Automatic stage: ${(record?.cordis?.stage||record?.stage||'ongoing').replace('outputs','outputs available')} · CORDIS status: ${record?.cordis?.status||'not reported'}${record?.cordis?.sourceUpdated?` · source updated ${record.cordis.sourceUpdated}`:''}`;
    if(!outputs.length){const empty=document.createElement('p');empty.className='result-cordis-empty';empty.textContent='CORDIS does not currently expose a public result for this project.';list.append(empty);return}
    outputs.forEach(output=>{const row=document.createElement('div');row.className='result-cordis-output';const type=document.createElement('span');type.textContent=outputTypeLabels[output.type]||'Output';const title=output.url?document.createElement('a'):document.createElement('strong');title.textContent=output.title;if(output.url){title.href=output.url;title.target='_blank';title.rel='noopener'}const meta=document.createElement('small');meta.textContent=[output.subtype,output.published||output.publishedYear||output.sourceUpdated,output.doi?`DOI ${output.doi}`:''].filter(Boolean).join(' · ');row.append(type,title,meta);list.append(row)});
  }
  function editProjectResult(projectId){
    const project=state.projectReference.find(row=>row.id===projectId);if(!project)return;state.activeResultId=projectId;
    $('[data-result-empty]').hidden=true;$('[data-result-fields]').hidden=false;$('[data-result-title]').textContent=`${project.acronym} · ${project.id}`;
    const record=resultRecord(projectId)||{projectId,stage:inferredResultStage(project),cordis:{status:project.status||'',stage:inferredResultStage(project),sourceUpdated:'',outputs:project.results||[]},manual:{stage:'',reviewed:'',summary:'',outputs:[]}};const manual=record.manual||{stage:'',reviewed:'',summary:'',outputs:[]};
    resultForm.elements.namedItem('projectId').value=projectId;resultForm.elements.namedItem('stage').value=manual.stage||'';resultForm.elements.namedItem('reviewed').value=manual.reviewed||'';resultForm.elements.namedItem('summary').value=manual.summary||'';
    renderCordisEvidence(record);const outputs=$('[data-result-output-list]');outputs.replaceChildren(...(manual.outputs||[]).map(outputRow));$('[data-result-state]').textContent=hasManualResult(record)?'CORDIS data and manual additions saved':`CORDIS data active · ${record.outputs?.length||0} public outputs`;hideErrors('[data-result-errors]');renderResultProjects();
  }
  function readProjectResult(){const projectId=resultForm.elements.namedItem('projectId').value,current=resultRecord(projectId)||{projectId,cordis:{status:'',stage:'ongoing',sourceUpdated:'',outputs:[]}};return{...current,projectId,manual:{stage:resultForm.elements.namedItem('stage').value,reviewed:resultForm.elements.namedItem('reviewed').value,summary:resultForm.elements.namedItem('summary').value.trim(),outputs:$$('.result-output-row',resultForm).map(row=>({type:$('[data-output="type"]',row).value,title:$('[data-output="title"]',row).value.trim(),url:$('[data-output="url"]',row).value.trim(),published:$('[data-output="published"]',row).value})).filter(output=>output.title||output.url)}}}
  function markResultsDirty(){$('[data-result-state]').textContent='Unsaved changes'}
  $('[data-result-search]').addEventListener('input',renderResultProjects);resultForm.addEventListener('input',markResultsDirty);
  $('[data-result-output-add]').addEventListener('click',()=>{$('[data-result-output-list]').append(outputRow());markResultsDirty()});
  resultForm.addEventListener('submit',async event=>{event.preventDefault();const record=readProjectResult(),next={...state.projectResults,projects:[...state.projectResults.projects.filter(row=>row.projectId!==record.projectId),record]};try{const payload=await api('/api/project-results',{method:'POST',body:JSON.stringify(next)});state.projectResults=payload.projectResults;$('[data-result-state]').textContent='Saved locally';hideErrors('[data-result-errors]');renderResultProjects();notify(payload.message)}catch(error){showErrors('[data-result-errors]',error);$('[data-result-state]').textContent='Not saved';notify(error.message,true)}});
  $('[data-result-reset]').addEventListener('click',async()=>{const project=state.projectReference.find(row=>row.id===state.activeResultId),current=project&&resultRecord(project.id);if(!project||!current||!hasManualResult(current))return;if(!confirm(`Clear the manual additions for ${project.acronym}?\n\nThe imported CORDIS outputs and automatic implementation stage will remain available.`))return;const updated={...current,manual:{stage:'',reviewed:'',summary:'',outputs:[]}},next={...state.projectResults,projects:[...state.projectResults.projects.filter(row=>row.projectId!==project.id),updated]};try{const payload=await api('/api/project-results',{method:'POST',body:JSON.stringify(next)});state.projectResults=payload.projectResults;editProjectResult(project.id);notify('Manual additions cleared; CORDIS data was preserved.')}catch(error){showErrors('[data-result-errors]',error);notify(error.message,true)}});

  function countryName(code){return state.countryReference.find(row=>row.code===code)?.name||code}
  function renderCountries() {
    const associated=new Set(state.countryStatus.associated),lmic=new Set(state.countryStatus.lowMiddleIncome);
    ['associated','lowMiddleIncome'].forEach(group=>{
      const select=$(`[data-country-select="${group}"]`);select.replaceChildren(new Option('Choose a country…',''));
      state.countryReference.forEach(row=>select.append(new Option(`${row.name} (${row.code})`,row.code)));
      const chips=$(`[data-country-chips="${group}"]`);chips.replaceChildren();
      state.countryStatus[group].forEach(code=>{
        const chip=document.createElement('span');chip.className='country-chip';if(associated.has(code)&&lmic.has(code))chip.classList.add('overlap');
        const name=document.createElement('span');name.textContent=countryName(code);const strong=document.createElement('b');strong.textContent=code;const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${countryName(code)}`);remove.addEventListener('click',()=>{state.countryStatus[group]=state.countryStatus[group].filter(value=>value!==code);markCountriesDirty();renderCountries()});
        chip.append(name,strong,remove);chips.append(chip);
      });
      $(`[data-country-count="${group}"]`).textContent=state.countryStatus[group].length;
    });
    const metrics=$('[data-country-metrics]');metrics.replaceChildren(metric('EU Member States','27','Fixed EU27 reference'),metric('Associated countries',associated.size,'Editable programme list'),metric('Income-eligible countries',lmic.size,'Editable General Annexes list'),metric('Overlapping status',[...associated].filter(code=>lmic.has(code)).length,'Association takes precedence'));
    Object.entries(state.countryStatus.metadata).forEach(([name,value])=>{const field=countryForm.elements.namedItem(name);if(field)field.value=value||''});
    renderCountryFreshness();
  }
  function renderCountryFreshness(){const checked=safeDate(countryForm.elements.namedItem('checked').value),today=safeDate(state.today),age=checked&&today?Math.max(0,Math.round((today-checked)/86400000)):0;const box=$('[data-country-freshness]');box.classList.toggle('warning',age>90);box.replaceChildren();const strong=document.createElement('strong');strong.textContent=age>90?'Review recommended':'Reference is current';const span=document.createElement('span');span.textContent=age?`Checked ${age} days ago`:'Checked today';box.append(strong,span)}
  $$('[data-country-add]').forEach(button=>button.addEventListener('click',()=>{const group=button.dataset.countryAdd,select=$(`[data-country-select="${group}"]`),code=select.value;if(!code)return;if(!state.countryStatus[group].includes(code))state.countryStatus[group].push(code);markCountriesDirty();renderCountries()}));
  function markCountriesDirty(){$('[data-country-state]').textContent='Unsaved changes'}
  countryForm.addEventListener('input',()=>{markCountriesDirty();renderCountryFreshness()});
  countryForm.addEventListener('submit',async event=>{event.preventDefault();const data=new FormData(countryForm);state.countryStatus.metadata={checked:data.get('checked'),programmePeriod:String(data.get('programmePeriod')||'').trim(),associationSource:String(data.get('associationSource')||'').trim(),eligibilitySource:String(data.get('eligibilitySource')||'').trim()};try{const payload=await api('/api/country-status',{method:'POST',body:JSON.stringify(state.countryStatus)});state.countryStatus=payload.countryStatus;hideErrors('[data-country-errors]');$('[data-country-state]').textContent='Saved locally';renderCountries();renderDashboard();notify(payload.message)}catch(error){showErrors('[data-country-errors]',error);notify(error.message,true)}});

  function projectIdFromReference(value){const text=String(value||'').trim();if(/^\d{6,12}$/.test(text))return text;return text.match(/cordis\.europa\.eu\/project\/id\/(\d{6,12})(?:[\/#?]|$)/i)?.[1]||''}
  function markProjectListDirty(){$('[data-project-list-state]').textContent='Unsaved changes'}
  function renderProjectList(){
    const search=$('[data-project-search]').value.trim().toLowerCase();
    const list=$('[data-project-list]');list.replaceChildren();
    const rows=state.projectStore.projects.filter(row=>!search||`${row.id} ${row.acronym} ${row.title}`.toLowerCase().includes(search));
    $('[data-project-count]').textContent=state.projectStore.projects.filter(row=>row.enabled!==false).length;
    if(!rows.length){const empty=document.createElement('p');empty.style.cssText='padding:30px;color:#7b8fa0;text-align:center';empty.textContent='No projects match the current search.';list.append(empty);return}
    rows.forEach(row=>{
      const item=document.createElement('article');item.className='project-row';
      const toggle=document.createElement('label');toggle.className='project-row-toggle';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=row.enabled!==false;checkbox.setAttribute('aria-label',`Include ${row.acronym||row.id}`);checkbox.addEventListener('change',()=>{row.enabled=checkbox.checked;markProjectListDirty();renderProjectList()});toggle.append(checkbox);
      const copy=document.createElement('div');copy.className='project-row-copy';const title=document.createElement('div');title.className='project-row-title';const strong=document.createElement('strong');strong.textContent=row.acronym||'New project';const id=document.createElement('span');id.textContent=row.id;title.append(strong,id);const subtitle=document.createElement('small');subtitle.textContent=row.title||'Title will be read from CORDIS during validation';const status=document.createElement('span');status.className=`project-status ${row.lastStatus==='Downloaded'?'ok':row.lastStatus==='Error'?'error':''}`;status.textContent=row.lastFetched?`${row.lastStatus} · ${formatDate(row.lastFetched)}`:row.lastStatus||'Not checked';copy.append(title,subtitle,status);
      const actions=document.createElement('div');actions.className='project-row-actions';const link=document.createElement('a');link.href=row.cordisUrl;link.target='_blank';link.rel='noopener';link.textContent='CORDIS ↗';const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.addEventListener('click',()=>{state.projectStore.projects=state.projectStore.projects.filter(project=>project.id!==row.id);markProjectListDirty();renderProjectList()});actions.append(link,remove);
      item.append(toggle,copy,actions);list.append(item);
    });
  }
  $('[data-project-search]').addEventListener('input',renderProjectList);
  $('[data-project-add-focus]').addEventListener('click',()=>{switchView('portfolio');$('[data-project-add-form] textarea').focus()});
  $('[data-project-add-form]').addEventListener('submit',event=>{event.preventDefault();const field=event.currentTarget.elements.namedItem('references');const references=String(field.value||'').split(/[\n,;\s]+/).filter(Boolean);let added=0,invalid=0;references.forEach(reference=>{const id=projectIdFromReference(reference);if(!id){invalid++;return}if(state.projectStore.projects.some(row=>row.id===id))return;const page=`https://cordis.europa.eu/project/id/${id}`;state.projectStore.projects.push({id,acronym:'',title:'',cordisUrl:page,xmlUrl:`${page}?format=xml`,enabled:true,lastFetched:'',lastStatus:'Not checked'});added++});field.value='';if(added)markProjectListDirty();renderProjectList();notify(invalid?`${added} project${added===1?'':'s'} added; ${invalid} invalid reference${invalid===1?' was':'s were'} skipped.`:`${added} project${added===1?'':'s'} added to the list.`,invalid>0&&added===0)});
  async function saveProjectList(silent=false){try{const payload=await api('/api/portfolio-list',{method:'POST',body:JSON.stringify(state.projectStore)});state.projectStore=payload.projectStore;$('[data-project-list-state]').textContent='Saved locally';renderProjectList();if(!silent)notify(payload.message);return true}catch(error){notify(error.message,true);return false}}
  $('[data-project-list-save]').addEventListener('click',()=>saveProjectList(false));
  $$('[data-sync-run]').forEach(button=>button.addEventListener('click',()=>runPortfolioSync(button.dataset.syncRun==='validate')));

  const resourceForm=$('[data-resource-form]'),resourceFile=$('[data-resource-file]');
  function readableBytes(value){const bytes=Number(value||0);if(bytes<1024)return `${bytes} B`;if(bytes<1024*1024)return `${(bytes/1024).toFixed(1)} KB`;return `${(bytes/(1024*1024)).toFixed(1)} MB`}
  function renderResources(){
    const search=$('[data-resource-search]').value.trim().toLowerCase(),items=(state.resourceLibrary.items||[]).filter(item=>!search||`${item.title} ${item.country} ${item.format} ${item.fileName}`.toLowerCase().includes(search));
    $('[data-resource-count]').textContent=(state.resourceLibrary.items||[]).length;
    const list=$('[data-resource-list]');list.replaceChildren();
    if(!items.length){const empty=document.createElement('p');empty.className='resource-empty';empty.textContent=search?'No resources match this search.':'No public resources have been added yet.';list.append(empty);return}
    items.forEach(item=>{const row=document.createElement('article');row.className=`resource-row${item.exists?'':' missing'}`;const icon=document.createElement('span');icon.className='resource-row-icon';icon.textContent=item.format||item.fileName.split('.').pop().toUpperCase();const copy=document.createElement('div');copy.className='resource-row-copy';const title=document.createElement('strong');title.textContent=item.title;const meta=document.createElement('span');meta.textContent=[item.country,item.language,item.updated,item.sizeBytes?readableBytes(item.sizeBytes):'File missing'].filter(Boolean).join(' · ');const file=document.createElement('small');file.textContent=item.fileName;copy.append(title,meta,file);const actions=document.createElement('div');actions.className='resource-row-actions';if(item.exists){const open=document.createElement('a');open.href=`/site/${item.file}`;open.target='_blank';open.textContent='Open ↗';actions.append(open)}const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.addEventListener('click',()=>deleteResource(item));actions.append(remove);row.append(icon,copy,actions);list.append(row)});
  }
  async function deleteResource(item){if(!confirm(`Remove “${item.title}” from the public Resource Library?\n\nA recoverable copy of the file will remain on this Mac.`))return;try{const payload=await api('/api/repository-delete',{method:'POST',body:JSON.stringify({id:item.id})});state.resourceLibrary=payload.resourceLibrary;renderResources();notify(payload.message)}catch(error){notify(error.message,true)}}
  resourceFile.addEventListener('change',()=>{$('[data-resource-file-name]').textContent=resourceFile.files[0]?.name||'Choose a document'});
  $('[data-resource-search]').addEventListener('input',renderResources);
  resourceForm.addEventListener('submit',async event=>{event.preventDefault();hideErrors('[data-resource-errors]');const file=resourceFile.files[0];if(!file){const error=new Error('Choose the document to add.');showErrors('[data-resource-errors]',error);notify(error.message,true);return}const data=new FormData(resourceForm),query=new URLSearchParams({filename:file.name,title:String(data.get('title')||'').trim(),description:String(data.get('description')||'').trim(),country:String(data.get('country')||'General').trim(),countryCode:String(data.get('countryCode')||'INT').trim(),language:String(data.get('language')||'English').trim(),version:String(data.get('version')||'').trim(),updated:String(data.get('updated')||state.today),format:String(data.get('format')||'').trim(),featured:data.get('featured')?'true':'false'}),button=$('[data-resource-save]');button.disabled=true;button.textContent='Adding document…';try{const payload=await api(`/api/repository-upload?${query}`,{method:'POST',body:file});state.resourceLibrary=payload.resourceLibrary;resourceForm.reset();resourceForm.elements.namedItem('country').value='General';resourceForm.elements.namedItem('countryCode').value='INT';resourceForm.elements.namedItem('language').value='English';resourceForm.elements.namedItem('updated').value=state.today;$('[data-resource-file-name]').textContent='Choose a document';renderResources();notify(payload.message)}catch(error){showErrors('[data-resource-errors]',error);notify(error.message,true)}finally{button.disabled=false;button.textContent='Add to Resource Library'}});

  let progressPollTimer=0,progressElapsedTimer=0,progressStarted=0,processingActive=false,progressOperation='portfolio-sync';
  function formatElapsed(milliseconds){const seconds=Math.max(0,Math.floor(milliseconds/1000));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`}
  function renderProcessing(progress){
    const panel=$('[data-processing-progress]');panel.hidden=false;panel.classList.toggle('error',progress.stage==='error');panel.classList.toggle('complete',progress.stage==='completed');
    const total=Number(progress.total||0),current=Number(progress.current||0),determinate=total>0;
    $('[data-processing-title]').textContent=progress.operation==='xml-update'?'Processing XML archive':'Processing portfolio projects';
    $('[data-processing-detail]').textContent=progress.message||'Working…';
    $('[data-processing-count]').textContent=determinate?`${Math.min(current,total)} / ${total}`:'Working';
    $('[data-processing-stage]').textContent=({downloading:'Downloading from CORDIS',building:'Building website data',processing:'Reading XML projects',completed:'Completed',error:'Stopped'})[progress.stage]||'Starting';
    const bar=$('[data-processing-bar]');bar.classList.toggle('indeterminate',!determinate&&progress.active);bar.style.width=determinate?`${Math.max(2,Math.min(100,(current/total)*100))}%`:(progress.stage==='completed'?'100%':'32%');
  }
  async function pollProcessing(){try{const payload=await api('/api/progress');renderProcessing(payload.progress)}catch(_error){/* Keep the visible local timer running if one poll is missed. */}}
  function beginProcessing(operation,total,message){
    processingActive=true;progressOperation=operation;progressStarted=Date.now();clearInterval(progressPollTimer);clearInterval(progressElapsedTimer);
    renderProcessing({active:true,operation,stage:operation==='xml-update'?'processing':'downloading',current:0,total,message});
    $('[data-processing-elapsed]').textContent='00:00';progressPollTimer=setInterval(pollProcessing,550);progressElapsedTimer=setInterval(()=>{$('[data-processing-elapsed]').textContent=formatElapsed(Date.now()-progressStarted)},1000);
  }
  async function finishProcessing(success,message){
    await pollProcessing();processingActive=false;clearInterval(progressPollTimer);clearInterval(progressElapsedTimer);
    const currentText=$('[data-processing-count]').textContent,total=Number(currentText.split('/')[1]||0);renderProcessing({active:false,operation:progressOperation,stage:success?'completed':'error',current:success&&total?total:0,total,message});
    $('[data-processing-elapsed]').textContent=formatElapsed(Date.now()-progressStarted);
  }
  window.addEventListener('beforeunload',event=>{if(!processingActive)return;event.preventDefault();event.returnValue=''});
  async function runPortfolioSync(dryRun){if(!await saveProjectList(true))return;const published=$('[data-sync-form] [name="date"]').value||state.today,total=state.projectStore.projects.filter(row=>row.enabled!==false).length;const status=$('[data-xml-status]'),output=$('[data-xml-output]');status.className='report-status';status.textContent=dryRun?'Downloading':'Updating';output.textContent=`Downloading ${total} current XML records from CORDIS…`;beginProcessing('portfolio-sync',total,'Connecting to CORDIS…');$$('[data-sync-run],[data-xml-run]').forEach(button=>button.disabled=true);try{const payload=await api(`/api/portfolio-sync?date=${encodeURIComponent(published)}&dryRun=${dryRun}`,{method:'POST',body:JSON.stringify({})});status.classList.add('success');status.textContent=dryRun?'Valid':'Updated';output.textContent=payload.output||payload.message;state.portfolio=payload.portfolio||state.portfolio;state.projectStore=payload.projectStore||state.projectStore;renderProjectList();renderDashboard();await finishProcessing(true,payload.message);notify(payload.message)}catch(error){status.classList.add('error');status.textContent='Stopped';output.textContent=error.payload?.output||[error.message,...(error.details||[])].join('\n');if(error.payload?.projectStore)state.projectStore=error.payload.projectStore;renderProjectList();await finishProcessing(false,error.message);notify(error.message,true)}finally{$$('[data-sync-run],[data-xml-run]').forEach(button=>button.disabled=false)}}

  function renderExchange(){const current=state.exchangeStore.current||state.portfolio.exchangeRate||{};$('[data-current-rate]').textContent=current.value?`NZ$${Number(current.value).toFixed(4)}`:'NZ$—';$('[data-current-rate-period]').textContent=current.period||'—';$('[data-current-rate-retrieved]').textContent=formatDate(current.retrieved);const history=$('[data-rate-history]');history.replaceChildren();(state.exchangeStore.history||[]).forEach((row,index)=>{const item=document.createElement('div');item.className='rate-history-row';const period=document.createElement('strong');period.textContent=row.period||'—';const rate=document.createElement('span');rate.textContent=`€1 = NZ$${Number(row.value||0).toFixed(4)}${index===0?' · Current':''}`;const retrieved=document.createElement('small');retrieved.textContent=`Retrieved ${formatDate(row.retrieved)}`;item.append(period,rate,retrieved);history.append(item)});if(!history.children.length){const empty=document.createElement('p');empty.textContent='No approved-rate history is available yet.';history.append(empty)}}
  $('[data-rate-form]').addEventListener('submit',async event=>{event.preventDefault();hideErrors('[data-rate-errors]');const period=event.currentTarget.elements.namedItem('period').value;const button=$('[data-rate-check]');button.disabled=true;button.textContent='Checking InforEuro…';try{const payload=await api(`/api/exchange-rate/check?period=${encodeURIComponent(period)}`);state.exchangeCandidate=payload.rate;$('[data-candidate-rate]').textContent=`NZ$${Number(payload.rate.value).toFixed(4)}`;$('[data-candidate-period]').textContent=payload.rate.period;$('[data-rate-candidate]').hidden=false;notify(payload.message)}catch(error){showErrors('[data-rate-errors]',error);$('[data-rate-candidate]').hidden=true;state.exchangeCandidate=null;notify(error.message,true)}finally{button.disabled=false;button.textContent='Check official rate'}});
  $('[data-rate-apply]').addEventListener('click',async()=>{if(!state.exchangeCandidate)return;const button=$('[data-rate-apply]');button.disabled=true;button.textContent='Applying…';hideErrors('[data-rate-errors]');try{const payload=await api(`/api/exchange-rate/apply?period=${encodeURIComponent(state.exchangeCandidate.period)}`,{method:'POST',body:JSON.stringify({})});state.exchangeStore=payload.exchangeStore;state.portfolio=payload.portfolio||state.portfolio;state.exchangeCandidate=null;$('[data-rate-candidate]').hidden=true;renderExchange();renderDashboard();notify(payload.message)}catch(error){showErrors('[data-rate-errors]',error);notify(error.message,true)}finally{button.disabled=false;button.textContent='Apply this rate to the website'}});

  const xmlFile=$('[data-xml-file]');
  xmlFile.addEventListener('change',()=>{$('[data-xml-file-name]').textContent=xmlFile.files[0]?.name||'Choose the complete XML archive'});
  $$('[data-xml-run]').forEach(button=>button.addEventListener('click',()=>runXml(button.dataset.xmlRun==='validate')));
  async function runXml(dryRun){const file=xmlFile.files[0];if(!file){notify('Choose the complete XML ZIP first.',true);return}const published=$('[data-xml-form] [name="date"]').value||state.today;const status=$('[data-xml-status]'),output=$('[data-xml-output]');status.className='report-status';status.textContent=dryRun?'Validating':'Updating';output.textContent='Processing the XML archive…';beginProcessing('xml-update',0,'Uploading and reading the XML archive…');$$('[data-xml-run]').forEach(button=>button.disabled=true);try{const payload=await api(`/api/xml-update?date=${encodeURIComponent(published)}&dryRun=${dryRun}`,{method:'POST',body:file});status.classList.add('success');status.textContent=dryRun?'Valid':'Updated';output.textContent=payload.output||payload.message;state.portfolio=payload.portfolio||state.portfolio;renderDashboard();await finishProcessing(true,payload.message);notify(payload.message)}catch(error){status.classList.add('error');status.textContent='Stopped';output.textContent=error.payload?.output||[error.message,...(error.details||[])].join('\n');await finishProcessing(false,error.message);notify(error.message,true)}finally{$$('[data-xml-run]').forEach(button=>button.disabled=false)}}

  $('[data-prepare]').addEventListener('click',async()=>{const card=$('.readiness-card');try{const payload=await api('/api/prepare',{method:'POST',body:JSON.stringify({})});card.classList.remove('error');$('[data-readiness-icon]').textContent='✓';$('[data-readiness-title]').textContent='Website files are ready';$('[data-readiness-copy]').textContent=payload.message;const result=$('[data-prepare-result]');result.hidden=false;const list=$('[data-prepared-files]');list.replaceChildren(...payload.files.map(file=>{const item=document.createElement('li');item.textContent=file;return item}));notify(payload.message)}catch(error){card.classList.add('error');$('[data-readiness-icon]').textContent='!';$('[data-readiness-title]').textContent='Some items need attention';$('[data-readiness-copy]').textContent=[error.message,...(error.details||[])].join(' ');notify(error.message,true)}});

  async function init(){try{const payload=await api('/api/state');Object.assign(state,{events:payload.events,projectResults:payload.projectResults,projectReference:payload.projectReference,countryStatus:payload.countryStatus,countryReference:payload.countryReference,portfolio:payload.portfolio,projectStore:payload.projectStore,resourceLibrary:payload.resourceLibrary||{items:[]},exchangeStore:payload.exchangeStore,today:payload.today});$('[data-xml-form] [name="date"]').value=state.today;$('[data-sync-form] [name="date"]').value=state.today;$('[data-rate-form] [name="period"]').value=state.portfolio.exchangeRate?.period||state.today.slice(0,7);resourceForm.elements.namedItem('updated').value=state.today;renderDashboard();renderContentList();renderResultProjects();renderCountries();renderProjectList();renderResources();renderExchange();const requested=location.hash.slice(1);if($(`[data-view="${requested}"]`))switchView(requested)}catch(error){notify(`The Site Manager could not start: ${error.message}`,true)}}
  init();
})();
