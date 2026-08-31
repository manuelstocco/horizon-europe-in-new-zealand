(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = {events:null, countryStatus:null, countryReference:[], portfolio:{}, projectStore:{projects:[]}, exchangeStore:{current:{},history:[]}, exchangeCandidate:null, today:'', activeItemId:null};
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
  function editItem(id) {
    const item=state.events.items.find(row=>row.id===id);if(!item)return;
    state.activeItemId=id;$('[data-editor-empty]').hidden=true;$('[data-editor-fields]').hidden=false;
    $('[data-editor-title]').textContent=item.title||'New item';
    Object.entries(item).forEach(([key,value])=>{
      const field=contentForm.elements.namedItem(key);if(!field)return;
      if(field.type==='checkbox')field.checked=Boolean(value);
      else if(Array.isArray(value))field.value=value.join(', ');
      else field.value=value??'';
    });
    updateEventDateVisibility();updateSummaryCount();setEditorState('No unsaved changes');renderContentList();
  }
  function blankItem() {
    const stamp=Date.now().toString().slice(-6);
    return {id:`new-item-${stamp}`,type:'event',status:'draft',title:'',summary:'',published:state.today,start:'',end:'',timezone:'Pacific/Auckland',location:'',url:'',source:'',clusters:[],countries:[],featured:false};
  }
  function addItem() {switchView('content');const item=blankItem();state.events.items.unshift(item);editItem(item.id);hideErrors('[data-form-errors]');$('[name="title"]',contentForm).focus();}
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
    event.preventDefault();const item=readEditor(),index=state.events.items.findIndex(row=>row.id===state.activeItemId);if(index<0)return;
    const nextStore={...state.events,items:state.events.items.map((row,rowIndex)=>rowIndex===index?item:row)};
    try{const payload=await api('/api/events',{method:'POST',body:JSON.stringify(nextStore)});state.events=payload.events;state.activeItemId=item.id;hideErrors('[data-form-errors]');renderContentList();renderDashboard();editItem(item.id);notify(payload.message);}
    catch(error){showErrors('[data-form-errors]',error);notify(error.message,true)}
  }
  contentForm.addEventListener('submit',saveEditor);
  contentForm.addEventListener('input',()=>setEditorState('Unsaved changes'));
  contentForm.elements.namedItem('type').addEventListener('change',updateEventDateVisibility);
  contentForm.elements.namedItem('summary').addEventListener('input',updateSummaryCount);
  function setEditorState(message){$('[data-editor-state]').textContent=message}
  function updateSummaryCount(){$('[data-summary-count]').textContent=contentForm.elements.namedItem('summary').value.length}
  function updateEventDateVisibility(){const visible=['event','deadline'].includes(contentForm.elements.namedItem('type').value);$('.event-date-fields').hidden=!visible}
  $('[data-duplicate-item]').addEventListener('click',()=>{const item=readEditor(),copy={...item,id:`${item.id}-copy`,title:`${item.title} — copy`,status:'draft',featured:false};state.events.items.unshift(copy);editItem(copy.id);setEditorState('Save this duplicate to keep it')});
  $('[data-archive-item]').addEventListener('click',()=>{contentForm.elements.namedItem('status').value='archived';setEditorState('Unsaved changes');notify('The item will be archived when you save it.')});
  $('[data-content-search]').addEventListener('input',renderContentList);$('[data-content-filter]').addEventListener('change',renderContentList);
  function showErrors(selector,error){const box=$(selector);box.hidden=false;box.textContent=[error.message,...(error.details||[])].join('\n')}
  function hideErrors(selector){const box=$(selector);box.hidden=true;box.textContent=''}

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
  async function runPortfolioSync(dryRun){if(!await saveProjectList(true))return;const published=$('[data-sync-form] [name="date"]').value||state.today;const status=$('[data-xml-status]'),output=$('[data-xml-output]');status.className='report-status';status.textContent=dryRun?'Downloading':'Updating';output.textContent=`Downloading ${state.projectStore.projects.filter(row=>row.enabled!==false).length} current XML records from CORDIS…`;$$('[data-sync-run],[data-xml-run]').forEach(button=>button.disabled=true);try{const payload=await api(`/api/portfolio-sync?date=${encodeURIComponent(published)}&dryRun=${dryRun}`,{method:'POST',body:JSON.stringify({})});status.classList.add('success');status.textContent=dryRun?'Valid':'Updated';output.textContent=payload.output||payload.message;state.portfolio=payload.portfolio||state.portfolio;state.projectStore=payload.projectStore||state.projectStore;renderProjectList();renderDashboard();notify(payload.message)}catch(error){status.classList.add('error');status.textContent='Stopped';output.textContent=error.payload?.output||[error.message,...(error.details||[])].join('\n');if(error.payload?.projectStore)state.projectStore=error.payload.projectStore;renderProjectList();notify(error.message,true)}finally{$$('[data-sync-run],[data-xml-run]').forEach(button=>button.disabled=false)}}

  function renderExchange(){const current=state.exchangeStore.current||state.portfolio.exchangeRate||{};$('[data-current-rate]').textContent=current.value?`NZ$${Number(current.value).toFixed(4)}`:'NZ$—';$('[data-current-rate-period]').textContent=current.period||'—';$('[data-current-rate-retrieved]').textContent=formatDate(current.retrieved);const history=$('[data-rate-history]');history.replaceChildren();(state.exchangeStore.history||[]).forEach((row,index)=>{const item=document.createElement('div');item.className='rate-history-row';const period=document.createElement('strong');period.textContent=row.period||'—';const rate=document.createElement('span');rate.textContent=`€1 = NZ$${Number(row.value||0).toFixed(4)}${index===0?' · Current':''}`;const retrieved=document.createElement('small');retrieved.textContent=`Retrieved ${formatDate(row.retrieved)}`;item.append(period,rate,retrieved);history.append(item)});if(!history.children.length){const empty=document.createElement('p');empty.textContent='No approved-rate history is available yet.';history.append(empty)}}
  $('[data-rate-form]').addEventListener('submit',async event=>{event.preventDefault();hideErrors('[data-rate-errors]');const period=event.currentTarget.elements.namedItem('period').value;const button=$('[data-rate-check]');button.disabled=true;button.textContent='Checking InforEuro…';try{const payload=await api(`/api/exchange-rate/check?period=${encodeURIComponent(period)}`);state.exchangeCandidate=payload.rate;$('[data-candidate-rate]').textContent=`NZ$${Number(payload.rate.value).toFixed(4)}`;$('[data-candidate-period]').textContent=payload.rate.period;$('[data-rate-candidate]').hidden=false;notify(payload.message)}catch(error){showErrors('[data-rate-errors]',error);$('[data-rate-candidate]').hidden=true;state.exchangeCandidate=null;notify(error.message,true)}finally{button.disabled=false;button.textContent='Check official rate'}});
  $('[data-rate-apply]').addEventListener('click',async()=>{if(!state.exchangeCandidate)return;const button=$('[data-rate-apply]');button.disabled=true;button.textContent='Applying…';hideErrors('[data-rate-errors]');try{const payload=await api(`/api/exchange-rate/apply?period=${encodeURIComponent(state.exchangeCandidate.period)}`,{method:'POST',body:JSON.stringify({})});state.exchangeStore=payload.exchangeStore;state.portfolio=payload.portfolio||state.portfolio;state.exchangeCandidate=null;$('[data-rate-candidate]').hidden=true;renderExchange();renderDashboard();notify(payload.message)}catch(error){showErrors('[data-rate-errors]',error);notify(error.message,true)}finally{button.disabled=false;button.textContent='Apply this rate to the website'}});

  const xmlFile=$('[data-xml-file]');
  xmlFile.addEventListener('change',()=>{$('[data-xml-file-name]').textContent=xmlFile.files[0]?.name||'Choose the complete XML archive'});
  $$('[data-xml-run]').forEach(button=>button.addEventListener('click',()=>runXml(button.dataset.xmlRun==='validate')));
  async function runXml(dryRun){const file=xmlFile.files[0];if(!file){notify('Choose the complete XML ZIP first.',true);return}const published=$('[data-xml-form] [name="date"]').value||state.today;const status=$('[data-xml-status]'),output=$('[data-xml-output]');status.className='report-status';status.textContent=dryRun?'Validating':'Updating';output.textContent='Processing the XML archive…';$$('[data-xml-run]').forEach(button=>button.disabled=true);try{const payload=await api(`/api/xml-update?date=${encodeURIComponent(published)}&dryRun=${dryRun}`,{method:'POST',body:file});status.classList.add('success');status.textContent=dryRun?'Valid':'Updated';output.textContent=payload.output||payload.message;state.portfolio=payload.portfolio||state.portfolio;renderDashboard();notify(payload.message)}catch(error){status.classList.add('error');status.textContent='Stopped';output.textContent=error.payload?.output||[error.message,...(error.details||[])].join('\n');notify(error.message,true)}finally{$$('[data-xml-run]').forEach(button=>button.disabled=false)}}

  $('[data-prepare]').addEventListener('click',async()=>{const card=$('.readiness-card');try{const payload=await api('/api/prepare',{method:'POST',body:JSON.stringify({})});card.classList.remove('error');$('[data-readiness-icon]').textContent='✓';$('[data-readiness-title]').textContent='Website files are ready';$('[data-readiness-copy]').textContent=payload.message;const result=$('[data-prepare-result]');result.hidden=false;const list=$('[data-prepared-files]');list.replaceChildren(...payload.files.map(file=>{const item=document.createElement('li');item.textContent=file;return item}));notify(payload.message)}catch(error){card.classList.add('error');$('[data-readiness-icon]').textContent='!';$('[data-readiness-title]').textContent='Some items need attention';$('[data-readiness-copy]').textContent=[error.message,...(error.details||[])].join(' ');notify(error.message,true)}});

  async function init(){try{const payload=await api('/api/state');Object.assign(state,{events:payload.events,countryStatus:payload.countryStatus,countryReference:payload.countryReference,portfolio:payload.portfolio,projectStore:payload.projectStore,exchangeStore:payload.exchangeStore,today:payload.today});$('[data-xml-form] [name="date"]').value=state.today;$('[data-sync-form] [name="date"]').value=state.today;$('[data-rate-form] [name="period"]').value=state.portfolio.exchangeRate?.period||state.today.slice(0,7);renderDashboard();renderContentList();renderCountries();renderProjectList();renderExchange();const requested=location.hash.slice(1);if($(`[data-view="${requested}"]`))switchView(requested)}catch(error){notify(`The Site Manager could not start: ${error.message}`,true)}}
  init();
})();
