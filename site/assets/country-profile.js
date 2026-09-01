(() => {
  const H = window.HE;
  const D = H.D;
  const STATUS = window.HE_COUNTRY_STATUS || {};
  const roleLabels = { coordinator:'Coordinator', participant:'Participant', associatedPartner:'Associated partner', thirdParty:'Third party' };
  const roleColours = { coordinator:'#397fd8', participant:'#8d67ce', associatedPartner:'#22a99a', thirdParty:'#e5a63b' };
  const orgKey = org => org.id || `${org.countryCode}|${org.name}`;
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const params = new URLSearchParams(location.search);
  const validCountries = D.countries.filter(country => country.code !== 'NZ' && D.projects.some(project => project.countryCodes.includes(country.code))).sort((a,b) => a.name.localeCompare(b.name));
  const countryCounts = new Map(validCountries.map(country => [country.code,D.projects.filter(project => project.countryCodes.includes(country.code)).length]));
  const defaultCountry = [...validCountries].sort((a,b) => (countryCounts.get(b.code) || 0) - (countryCounts.get(a.code) || 0) || a.name.localeCompare(b.name))[0]?.code || '';
  const parseList = name => (params.get(name) || '').split(',').filter(Boolean);
  const state = {
    country: validCountries.some(country => country.code === params.get('country')) ? params.get('country') : defaultCountry,
    clusters: parseList('clusters'), schemes: parseList('schemes'), roles: parseList('roles'), types: parseList('types'),
    sme: ['sme','non-sme'].includes(params.get('sme')) ? params.get('sme') : '', search: params.get('search') || '',
    clusterMeasure: params.get('measure') === 'allocation' ? 'allocation' : 'projects', sort:'contribution', direction:'desc'
  };
  let controlsReady = false;

  function country() { return validCountries.find(item => item.code === state.country) || {code:state.country,name:state.country}; }
  function statusCode(code) { return code === 'UK' ? 'GB' : code === 'EL' ? 'GR' : code; }
  function statusLabel(code) {
    const value = statusCode(code), eu = new Set(STATUS.eu27 || []), associated = new Set(STATUS.associated || []), lmic = new Set(STATUS.lowMiddleIncome || []);
    if (eu.has(value)) return 'EU Member State';
    if (associated.has(value)) return 'Associated country';
    if (lmic.has(value)) return 'Low- or middle-income country';
    return 'Other partner country';
  }
  function flag(code) {
    const value = statusCode(code);
    return /^[A-Z]{2}$/.test(value) ? String.fromCodePoint(...[...value].map(char => 127397 + char.charCodeAt(0))) : '';
  }
  function syncUrl() {
    const next = new URLSearchParams();
    if (state.country) next.set('country',state.country);
    [['clusters',state.clusters],['schemes',state.schemes],['roles',state.roles],['types',state.types]].forEach(([name,values]) => { if (values.length) next.set(name,values.join(',')); });
    if (state.sme) next.set('sme',state.sme);
    if (state.search) next.set('search',state.search);
    if (state.clusterMeasure !== 'projects') next.set('measure',state.clusterMeasure);
    history.replaceState(null,'',`${location.pathname}?${next}`);
  }
  function countryOrganisations(project) { return project.organisations.filter(org => org.countryCode === state.country); }
  function matchesOrganisation(org) {
    if (state.roles.length && !state.roles.includes(org.role)) return false;
    if (state.types.length && !state.types.includes(org.organisationTypeCode || 'NR')) return false;
    if (state.sme === 'sme' && !org.sme) return false;
    if (state.sme === 'non-sme' && org.sme) return false;
    return true;
  }
  function activeOrganisationFilter() { return state.roles.length || state.types.length || state.sme; }
  function selectedScope() {
    const search = state.search.trim().toLowerCase();
    return D.projects.filter(project => {
      if (!project.countryCodes.includes(state.country)) return false;
      if (state.clusters.length && !state.clusters.includes(project.clusterCode)) return false;
      if (state.schemes.length && !state.schemes.includes(project.schemeCode)) return false;
      if (search && !`${project.acronym} ${project.title} ${project.id}`.toLowerCase().includes(search)) return false;
      if (activeOrganisationFilter() && !countryOrganisations(project).some(matchesOrganisation)) return false;
      return true;
    });
  }
  function scopedCountryOrganisations(project) {
    const organisations = countryOrganisations(project);
    return activeOrganisationFilter() ? organisations.filter(matchesOrganisation) : organisations;
  }
  function aggregateOrganisations(projects) {
    const rows = new Map();
    projects.forEach(project => scopedCountryOrganisations(project).forEach(org => {
      const key = orgKey(org);
      if (!rows.has(key)) rows.set(key,{key,name:org.name,short:org.short,city:org.city || 'Not reported',typeCode:org.organisationTypeCode || 'NR',type:org.organisationType || 'Not reported',sme:Boolean(org.sme),roles:new Set(),projects:new Set(),clusters:new Set(),contribution:0});
      const row = rows.get(key); row.roles.add(org.role); row.projects.add(project.id); row.clusters.add(project.clusterCode); row.contribution += Number(org.contribution || 0); row.sme ||= Boolean(org.sme);
    }));
    return [...rows.values()];
  }
  function profileMetrics(projects, organisations) {
    const nz = new Set(), links = new Set(); let allocation = 0, coordinated = 0;
    projects.forEach(project => {
      const local = scopedCountryOrganisations(project), nzOrgs = project.organisations.filter(org => org.countryCode === 'NZ');
      if (local.some(org => org.coordinator)) coordinated += 1;
      local.forEach(org => { allocation += Number(org.contribution || 0); nzOrgs.forEach(partner => links.add(`${project.clusterCode}|${orgKey(org)}|${orgKey(partner)}`)); });
      nzOrgs.forEach(org => nz.add(orgKey(org)));
    });
    return {projects:projects.length,organisations:organisations.length,coordinated,smes:organisations.filter(org => org.sme).length,allocation,projectValue:projects.reduce((sum,project) => sum + Number(project.ecContribution || 0),0),nzOrganisations:nz.size,links:links.size,clusters:new Set(projects.map(project => project.clusterCode)).size};
  }
  function selectedLabels() {
    const labels = [];
    if (state.clusters.length) labels.push(...state.clusters.map(code => H.clusterMap.get(code)?.short || code));
    if (state.schemes.length) labels.push(...state.schemes.map(code => D.projects.find(project => project.schemeCode === code)?.scheme || code));
    if (state.roles.length) labels.push(...state.roles.map(role => roleLabels[role] || role));
    if (state.types.length) labels.push(...state.types.map(code => D.projects.flatMap(project => project.organisations).find(org => (org.organisationTypeCode || 'NR') === code)?.organisationType || 'Not reported'));
    if (state.sme) labels.push(state.sme === 'sme' ? 'SMEs only' : 'Non-SMEs only');
    if (state.search) labels.push(`Project search: ${state.search}`);
    return labels;
  }
  function renderIdentity() {
    const item = country();
    document.querySelector('[data-country-title]').textContent = `${item.name} × New Zealand.`;
    document.querySelector('[data-country-intro]').textContent = `A precise view of ${item.name}'s organisations, projects, funding and research connections with New Zealand.`;
    const badge = document.querySelector('[data-country-code]'); badge.textContent = `${flag(item.code)} ${statusCode(item.code)}`.trim(); badge.setAttribute('aria-label',`${item.name}, country code ${statusCode(item.code)}`);
    document.querySelector('[data-country-status]').textContent = statusLabel(item.code);
    document.querySelector('[data-organisation-heading]').textContent = `${item.name} organisations`;
    document.title = `${item.name} Country Profile · Horizon Europe in New Zealand`;
  }
  function renderMetrics(metrics) {
    const items = [
      ['Projects',H.fmtNumber(metrics.projects),'Distinct grants in the selected scope'],['Organisations',H.fmtNumber(metrics.organisations),`Distinct ${country().name} organisations`],['Coordinated projects',H.fmtNumber(metrics.coordinated),'Projects coordinated by a selected country organisation'],['SMEs',H.fmtNumber(metrics.smes),'CORDIS SME flag'],
      ['Allocated to country',H.fmtMoney(metrics.allocation),'Recorded net EU contribution to selected country organisations'],['Participating project value',H.fmtMoney(metrics.projectValue),'Maximum EU contribution to the selected projects'],['NZ organisations connected',H.fmtNumber(metrics.nzOrganisations),'Distinct New Zealand organisations'],['Active NZ–country links',H.fmtNumber(metrics.links),'Distinct organisation pairs counted once per cluster']
    ];
    document.querySelector('[data-profile-metrics]').innerHTML = items.map(([label,value,note]) => `<article class="metric-card"><span class="metric-label">${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`).join('');
  }
  function renderInsight(metrics) {
    const name = country().name;
    const text = metrics.projects ? `${name} participates in ${H.fmtNumber(metrics.projects)} selected ${metrics.projects === 1 ? 'project' : 'projects'} through ${H.fmtNumber(metrics.organisations)} ${metrics.organisations === 1 ? 'organisation' : 'organisations'}. Together, they connect with ${H.fmtNumber(metrics.nzOrganisations)} New Zealand ${metrics.nzOrganisations === 1 ? 'organisation' : 'organisations'} across ${H.fmtNumber(metrics.clusters)} ${metrics.clusters === 1 ? 'cluster' : 'clusters'}.` : `No projects match the active filters for ${name}.`;
    document.querySelector('[data-profile-insight]').innerHTML = `<span>Current profile</span><p>${esc(text)}</p>`;
  }
  function renderTypeCards(organisations) {
    const counts = new Map(); organisations.forEach(org => counts.set(org.typeCode,{label:org.type,count:(counts.get(org.typeCode)?.count || 0) + 1}));
    const root = document.querySelector('[data-type-cards]');
    root.innerHTML = counts.size ? [...counts].sort((a,b) => b[1].count-a[1].count || a[1].label.localeCompare(b[1].label)).map(([code,row],index) => `<article style="--type-colour:${['#397fd8','#8d67ce','#22a99a','#e5a63b','#ec6c5f'][index%5]}"><span>${esc(code)}</span><strong>${H.fmtNumber(row.count)}</strong><p>${esc(row.label)}</p></article>`).join('') : '<p class="chart-empty">No organisations match these filters.</p>';
  }
  function renderClusterChart(projects) {
    const values = D.clusters.map(cluster => {
      const matching = projects.filter(project => project.clusterCode === cluster.code);
      const value = state.clusterMeasure === 'projects' ? matching.length : matching.reduce((sum,project) => sum + scopedCountryOrganisations(project).reduce((total,org) => total + Number(org.contribution || 0),0),0);
      return {cluster,value};
    }).filter(row => row.value > 0);
    const max = Math.max(1,...values.map(row => row.value));
    document.querySelector('[data-cluster-subtitle]').textContent = state.clusterMeasure === 'projects' ? 'Distinct projects by Pillar II cluster.' : `Recorded net EU contribution to ${country().name} organisations by cluster.`;
    document.querySelector('[data-cluster-chart]').innerHTML = values.length ? values.map(({cluster,value}) => `<div class="country-chart-row"><span>${esc(cluster.short)}</span><span class="country-chart-track"><i style="width:${Math.max(3,value/max*100)}%;background:${H.clusterColor(cluster.code)}"></i></span><strong>${state.clusterMeasure === 'projects' ? H.fmtNumber(value) : H.fmtMoney(value)}</strong></div>`).join('') : '<p class="chart-empty">No cluster data in this scope.</p>';
  }
  function renderSchemeChart(projects) {
    const counts = new Map(); projects.forEach(project => counts.set(project.schemeCode,{label:project.scheme,count:(counts.get(project.schemeCode)?.count || 0) + 1}));
    const values = [...counts].sort((a,b) => b[1].count-a[1].count); const max = Math.max(1,...values.map(row => row[1].count));
    document.querySelector('[data-scheme-chart]').innerHTML = values.length ? values.map(([code,row]) => `<div class="country-chart-row compact"><span>${esc(row.label)}</span><span class="country-chart-track"><i style="width:${Math.max(4,row.count/max*100)}%;background:${H.schemeColor(code)}"></i></span><strong>${H.fmtNumber(row.count)}</strong></div>`).join('') : '<p class="chart-empty">No funding scheme data in this scope.</p>';
  }
  function renderRoleChart(projects) {
    const roles = new Map(); projects.forEach(project => scopedCountryOrganisations(project).forEach(org => { if (!roles.has(org.role)) roles.set(org.role,new Set()); roles.get(org.role).add(orgKey(org)); }));
    const values = [...roles].map(([role,keys]) => ({role,count:keys.size})).sort((a,b) => b.count-a.count); const max = Math.max(1,...values.map(row => row.count));
    document.querySelector('[data-role-chart]').innerHTML = values.length ? values.map(row => `<div class="country-chart-row compact"><span>${esc(roleLabels[row.role] || row.role)}</span><span class="country-chart-track"><i style="width:${Math.max(4,row.count/max*100)}%;background:${roleColours[row.role] || '#397fd8'}"></i></span><strong>${H.fmtNumber(row.count)}</strong></div>`).join('') : '<p class="chart-empty">No participation roles in this scope.</p>';
  }
  function sortedOrganisations(organisations) {
    const rows = [...organisations], factor = state.direction === 'asc' ? 1 : -1;
    return rows.sort((a,b) => {
      if (state.sort === 'name') return factor * a.name.localeCompare(b.name);
      if (state.sort === 'projects') return factor * (a.projects.size-b.projects.size) || a.name.localeCompare(b.name);
      if (state.sort === 'type') return factor * a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
      return factor * (a.contribution-b.contribution) || a.name.localeCompare(b.name);
    });
  }
  function renderOrganisationTable(organisations) {
    const rows = sortedOrganisations(organisations), arrows = key => state.sort === key ? (state.direction === 'asc' ? ' ↑' : ' ↓') : '';
    document.querySelector('[data-organisation-count]').textContent = `${H.fmtNumber(rows.length)} ${rows.length === 1 ? 'organisation' : 'organisations'}`;
    const root = document.querySelector('[data-organisation-table]');
    if (!rows.length) { root.innerHTML = '<p class="chart-empty">No organisations match these filters.</p>'; return; }
    root.innerHTML = `<table class="country-profile-table"><caption class="sr-only">${esc(country().name)} organisations in the selected scope</caption><thead><tr><th scope="col"><button data-sort="name">Organisation${arrows('name')}</button></th><th scope="col"><button data-sort="type">Organisation type${arrows('type')}</button></th><th scope="col">Role</th><th scope="col"><button data-sort="projects">Projects${arrows('projects')}</button></th><th scope="col">Clusters</th><th scope="col"><button data-sort="contribution">Recorded EU contribution${arrows('contribution')}</button></th></tr></thead><tbody>${rows.map(row => `<tr><th scope="row"><strong>${esc(row.name)}</strong><small>${esc(row.city)}${row.sme?' · SME':''}</small></th><td><span class="organisation-type-code">${esc(row.typeCode)}</span>${esc(row.type)}</td><td>${esc([...row.roles].map(role => roleLabels[role] || role).sort().join(', '))}</td><td>${H.fmtNumber(row.projects.size)}</td><td>${esc([...row.clusters].map(code => H.clusterMap.get(code)?.short || code).sort().join(', '))}</td><td class="organisation-funding ${row.contribution ? '' : 'unfunded'}">${row.contribution ? H.fmtExactMoney(row.contribution) : '€0 / not reported'}</td></tr>`).join('')}</tbody></table>`;
    root.querySelectorAll('[data-sort]').forEach(button => button.addEventListener('click',() => { const key = button.dataset.sort; if (state.sort === key) state.direction = state.direction === 'asc' ? 'desc' : 'asc'; else { state.sort = key; state.direction = key === 'name' || key === 'type' ? 'asc' : 'desc'; } renderOrganisationTable(organisations); }));
  }
  function renderProjectTable(projects) {
    const root = document.querySelector('[data-country-project-table]'); document.querySelector('[data-project-result-count]').textContent = `${H.fmtNumber(projects.length)} ${projects.length === 1 ? 'project' : 'projects'}`;
    if (!projects.length) { root.innerHTML = '<p class="chart-empty">No projects match these filters.</p>'; return; }
    const rows = [...projects].sort((a,b) => (a.start || '').localeCompare(b.start || '') || a.acronym.localeCompare(b.acronym));
    root.innerHTML = `<table class="country-profile-table country-project-table"><caption class="sr-only">Projects connecting ${esc(country().name)} and New Zealand</caption><thead><tr><th scope="col">Project</th><th scope="col">Cluster</th><th scope="col">Funding scheme</th><th scope="col">Country role</th><th scope="col">Country organisations</th><th scope="col">Country allocation</th><th scope="col">NZ organisations</th></tr></thead><tbody>${rows.map(project => { const local = scopedCountryOrganisations(project), nz = project.organisations.filter(org => org.countryCode === 'NZ'), allocation = local.reduce((sum,org) => sum + Number(org.contribution || 0),0); return `<tr><th scope="row"><a href="projects.html?countries=${encodeURIComponent(state.country)}#${encodeURIComponent(project.id)}"><strong>${esc(project.acronym)}</strong><small>${esc(project.title)}</small></a></th><td><span class="cluster-dot" style="background:${H.clusterColor(project.clusterCode)}"></span>${esc(H.clusterMap.get(project.clusterCode)?.short || project.cluster)}</td><td>${esc(project.scheme)}</td><td>${esc([...new Set(local.map(org => roleLabels[org.role] || org.role))].join(', '))}</td><td>${H.fmtNumber(local.length)}</td><td class="organisation-funding ${allocation ? '' : 'unfunded'}">${allocation ? H.fmtExactMoney(allocation) : '€0 / not reported'}</td><td>${esc(nz.map(org => org.short || org.name).join(', '))}</td></tr>`; }).join('')}</tbody></table>`;
  }
  function renderSelection() {
    const labels = selectedLabels(); document.querySelector('[data-selection-summary]').innerHTML = labels.length ? labels.map(label => `<span class="selection-chip">${esc(label)}</span>`).join('') : '<span class="selection-chip">All projects and organisations for this country</span>';
  }
  function render() {
    if (!state.country) return;
    syncUrl(); renderIdentity(); renderSelection();
    const projects = selectedScope(), organisations = aggregateOrganisations(projects), metrics = profileMetrics(projects,organisations);
    renderInsight(metrics); renderMetrics(metrics); renderTypeCards(organisations); renderClusterChart(projects); renderSchemeChart(projects); renderRoleChart(projects); renderOrganisationTable(organisations); renderProjectTable(projects);
  }
  function setupControls() {
    document.querySelector('[data-project-count]').textContent = H.fmtNumber(D.projects.length);
    const select = document.querySelector('[data-country-select]'); validCountries.forEach(item => { const count=countryCounts.get(item.code); select.append(new Option(`${item.name} · ${count} ${count === 1 ? 'project' : 'projects'}`,item.code)); }); select.value = state.country;
    const allOrganisations = D.projects.flatMap(project => project.organisations);
    const roleOptions = [...new Set(allOrganisations.map(org => org.role))].map(value => ({value,label:roleLabels[value] || value})).sort((a,b) => a.label.localeCompare(b.label));
    const typeMap = new Map(); allOrganisations.forEach(org => typeMap.set(org.organisationTypeCode || 'NR',org.organisationType || 'Not reported'));
    const typeOptions = [...typeMap].map(([value,label]) => ({value,label})).sort((a,b) => a.label.localeCompare(b.label));
    const bind = (selector,key,options,placeholder) => H.mountMultiSelect(document.querySelector(selector),{options,placeholder,searchable:true,clearAction:true,onChange:values => { state[key]=values; if (controlsReady) render(); }});
    const controls = {
      clusters:bind('[data-filter="clusters"]','clusters',H.uniqueOptions('clusters'),'All clusters'),
      schemes:bind('[data-filter="schemes"]','schemes',H.uniqueOptions('schemes'),'All funding schemes'),
      roles:bind('[data-filter="roles"]','roles',roleOptions,'All roles'),
      types:bind('[data-filter="types"]','types',typeOptions,'All organisation types')
    };
    controls.clusters.set(state.clusters); controls.schemes.set(state.schemes); controls.roles.set(state.roles); controls.types.set(state.types);
    document.querySelector('[data-filter-sme]').value = state.sme; document.querySelector('[data-filter-search]').value = state.search;
    select.addEventListener('change',event => { state.country=event.target.value; render(); });
    document.querySelector('[data-filter-sme]').addEventListener('change',event => { state.sme=event.target.value; render(); });
    document.querySelector('[data-filter-search]').addEventListener('input',event => { state.search=event.target.value.trim(); render(); });
    document.querySelector('[data-clear-filters]').addEventListener('click',() => { Object.values(controls).forEach(control => control.clear()); state.sme='';state.search='';document.querySelector('[data-filter-sme]').value='';document.querySelector('[data-filter-search]').value='';render(); });
    document.querySelectorAll('[data-cluster-measure]').forEach(button => { const active = button.dataset.clusterMeasure === state.clusterMeasure; button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active)); button.addEventListener('click',() => { state.clusterMeasure=button.dataset.clusterMeasure; document.querySelectorAll('[data-cluster-measure]').forEach(item => { const selected=item===button;item.classList.toggle('active',selected);item.setAttribute('aria-pressed',String(selected)); }); render(); }); });
    document.querySelector('[data-share-view]').addEventListener('click',async event => { syncUrl(); await H.copyCurrentView(event.currentTarget,'Country profile link copied'); document.querySelector('[data-toast]').textContent='Country profile link copied'; document.querySelector('[data-toast]').classList.add('show'); setTimeout(() => document.querySelector('[data-toast]').classList.remove('show'),1600); });
    controlsReady = true;
  }
  setupControls(); render();
  window.addEventListener('he:currency-change',render);
})();
