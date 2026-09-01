(() => {
  function mountNavigationDrawer() {
    const header = document.querySelector('.site-header');
    const nav = header?.querySelector('.primary-nav');
    if (!header || !nav || header.dataset.drawerReady === 'true') return;

    header.dataset.drawerReady = 'true';
    const currentFile = location.pathname.split('/').pop() || 'index.html';
    const navigationGroups = [
      { label:'Discover', pages:[
        ['index.html','The Story',[]]
      ]},
      { label:'Explore', pages:[
        ['overview.html','Partnership',['funding-flows.html']],
        ['country-profile.html','Countries & Connections',['compare.html','eu27-network.html']],
        ['projects.html','Projects & Results',['results.html']]
      ]},
      { label:'Stay current', pages:[
        ['updates.html','Updates & Events',[]]
      ]},
      { label:'Resources', pages:[
        ['repository.html','Resource Library',['methodology.html']]
      ]}
    ];
    nav.innerHTML = navigationGroups.map(group => `<section class="site-nav-group"><h2>${group.label}</h2>${group.pages.map(([href,label,related]) => { const active=currentFile===href||related.includes(currentFile); return `<a href="${href}"${active?' class="active" aria-current="page"':''}>${label}</a>`; }).join('')}</section>`).join('');
    const activeLink = nav.querySelector('a.active');
    const menuButton = document.createElement('button');
    menuButton.className = 'site-menu-button';
    menuButton.type = 'button';
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-controls', 'site-navigation-drawer');
    menuButton.innerHTML = '<span class="site-menu-icon" aria-hidden="true"><i></i><i></i><i></i></span><span>Explore</span>';

    const overlay = document.createElement('div');
    overlay.className = 'site-nav-overlay';
    overlay.hidden = true;

    const drawer = document.createElement('aside');
    drawer.className = 'site-nav-drawer';
    drawer.id = 'site-navigation-drawer';
    drawer.setAttribute('aria-label', 'Main navigation');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.inert = true;
    drawer.innerHTML = '<div class="site-nav-drawer-head"><div><span>Explore</span><strong>Horizon Europe in New Zealand</strong></div><button class="site-nav-close" type="button" aria-label="Close menu">&times;</button></div>';
    nav.removeAttribute('aria-label');
    drawer.appendChild(nav);
    document.body.append(overlay, drawer);
    const headerActions = document.createElement('div');
    headerActions.className = 'site-header-actions';
    headerActions.appendChild(menuButton);
    header.appendChild(headerActions);

    let previousFocus = null;
    let closeTimer = null;
    const setOpen = open => {
      window.clearTimeout(closeTimer);
      if (open) {
        previousFocus = document.activeElement;
        overlay.hidden = false;
        document.body.classList.add('site-menu-open');
      } else {
        document.body.classList.remove('site-menu-open');
        closeTimer = window.setTimeout(() => { overlay.hidden = true; }, 260);
      }
      menuButton.setAttribute('aria-expanded', String(open));
      drawer.setAttribute('aria-hidden', String(!open));
      drawer.inert = !open;
      if (open) drawer.querySelector('.site-nav-close').focus();
      else if (previousFocus) previousFocus.focus();
    };

    menuButton.addEventListener('click', () => setOpen(true));
    drawer.querySelector('.site-nav-close').addEventListener('click', () => setOpen(false));
    overlay.addEventListener('click', () => setOpen(false));
    nav.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.body.classList.contains('site-menu-open')) setOpen(false);
      if (event.key === 'Tab' && document.body.classList.contains('site-menu-open')) {
        const focusable = [...drawer.querySelectorAll('a[href],button:not([disabled])')];
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
  }

  function mountAccessibilityShell() {
    const main = document.querySelector('main');
    if (main && !main.id) main.id = 'main-content';
    if (main && !document.querySelector('.skip-link')) {
      const skip = document.createElement('a');
      skip.className = 'skip-link';
      skip.href = `#${main.id}`;
      skip.textContent = 'Skip to main content';
      document.body.prepend(skip);
    }
    if (!document.querySelector('[data-global-status]')) {
      const status = document.createElement('div');
      status.className = 'sr-only';
      status.dataset.globalStatus = '';
      status.setAttribute('role','status');
      status.setAttribute('aria-live','polite');
      document.body.appendChild(status);
    }
    const prepareScrollableRegions = () => document.querySelectorAll('.organisation-table-wrap,.leading-country-scroll,.table-scroll,.flow-shell,.flow-wrap').forEach(region => {
      if (!region.hasAttribute('tabindex')) region.tabIndex = 0;
      if (!region.hasAttribute('aria-label')) region.setAttribute('aria-label','Scrollable data region');
    });
    prepareScrollableRegions();
    requestAnimationFrame(prepareScrollableRegions);
    new MutationObserver(prepareScrollableRegions).observe(main || document.body,{childList:true,subtree:true});
  }

  const D = window.HE_DATA;
  const EU27 = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','EL','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);
  const number = new Intl.NumberFormat('en-NZ', { maximumFractionDigits:0 });
  const dateLong = new Intl.DateTimeFormat('en-NZ', { day:'numeric', month:'long', year:'numeric' });
  const safeDate = value => value ? new Date(`${value}T00:00:00`) : null;
  const formatDate = value => safeDate(value) ? dateLong.format(safeDate(value)) : '—';
  const exchangeRate = D.metadata?.exchangeRate || {};
  const nzdRate = Number(exchangeRate.value || 0);
  let activeCurrency = 'EUR';
  try {
    const saved = localStorage.getItem('he-display-currency');
    if (saved === 'NZD' && nzdRate > 0) activeCurrency = 'NZD';
  } catch (error) {
    // Local files may restrict storage; the switch still works for the current page.
  }
  const convertedMoney = value => Number(value || 0) * (activeCurrency === 'NZD' ? nzdRate : 1);
  const currencyPrefix = () => activeCurrency === 'NZD' ? 'NZ$' : '€';
  const fmtMoney = value => `${currencyPrefix()}${new Intl.NumberFormat('en-NZ',{notation:'compact',maximumFractionDigits:1}).format(convertedMoney(value))}`;
  const fmtExactMoney = value => `${currencyPrefix()}${new Intl.NumberFormat('en-NZ',{maximumFractionDigits:0}).format(convertedMoney(value))}`;
  const fmtNumber = value => number.format(Number(value || 0));
  const clusterMap = new Map(D.clusters.map(c => [c.code, c]));
  const countryMap = new Map(D.countries.map(c => [c.code, c.name]));
  const palette = ['#397fd8','#8d67ce','#22a99a','#e5a63b','#ec6c5f','#77a84b','#c0649c','#4e9bb8','#c07a4e'];
  const schemePalette = new Map([
    ['HORIZON-RIA','#8d67ce'],
    ['HORIZON-IA','#397fd8'],
    ['HORIZON-JU-RIA','#ec6c5f'],
    ['HORIZON-COFUND','#77a84b'],
    ['HORIZON-CSA','#e5a63b']
  ]);

  function hashColor(key) {
    let hash = 0;
    for (const char of String(key || '')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    return palette[Math.abs(hash) % palette.length];
  }
  function clusterColor(code) { return clusterMap.get(code)?.color || '#708398'; }
  const eu27CountryPalette = new Map([
    ['AT','#397fd8'],['BE','#8d67ce'],['BG','#22a99a'],['HR','#e5a63b'],['CY','#ec6c5f'],
    ['CZ','#77a84b'],['DK','#c0649c'],['EE','#4e9bb8'],['FI','#c07a4e'],['FR','#2e5aac'],
    ['DE','#d8433e'],['EL','#008c76'],['GR','#008c76'],['HU','#b88a00'],['IE','#6f4fb3'],
    ['IT','#e07b39'],['LV','#4e8a3a'],['LT','#a83e78'],['LU','#24758f'],['MT','#9a5435'],
    ['NL','#d62f6a'],['PL','#5e7fd0'],['PT','#f08a76'],['RO','#39b9a5'],['SK','#ebc05a'],
    ['SI','#9f7dda'],['ES','#8fb963'],['SE','#d77daf']
  ]);
  function countryColor(code) { return eu27CountryPalette.get(code) || hashColor(`country-${code}`); }
  function schemeColor(code) { return schemePalette.get(code) || hashColor(`scheme-${code}`); }
  function projectPartnerCodes(project) { return project.countryCodes.filter(code => code !== 'NZ'); }
  function projectPartnerNames(project) { return project.countries.filter(name => name !== 'New Zealand'); }

  function updateStaticCurrencyValues() {
    document.querySelectorAll('[data-eur-amount]').forEach(element => {
      const value = Number(element.dataset.eurAmount || 0);
      if (element.dataset.moneyDisplay === 'billions') {
        const converted = convertedMoney(value) / 1e9;
        element.textContent = `${currencyPrefix()}${converted.toFixed(1)}bn`;
      } else {
        element.textContent = fmtMoney(value);
      }
    });
    const periodElement = document.querySelector('[data-exchange-period]');
    if (periodElement && exchangeRate.period) {
      const [year,month] = exchangeRate.period.split('-').map(Number);
      periodElement.textContent = new Intl.DateTimeFormat('en-NZ',{month:'long',year:'numeric'}).format(new Date(year,month-1,1));
    }
    const rateElement = document.querySelector('[data-exchange-rate]');
    if (rateElement && nzdRate > 0) rateElement.textContent = `EUR 1 = NZD ${nzdRate.toFixed(4)}`;
  }

  function mountCurrencySwitch() {
    const actions = document.querySelector('.site-header-actions');
    if (!actions || document.querySelector('.currency-switch')) return;
    const control = document.createElement('div');
    control.className = 'currency-switch';
    control.setAttribute('role','group');
    control.setAttribute('aria-label','Display currency');
    control.innerHTML = '<button type="button" data-currency="EUR">EUR</button><button type="button" data-currency="NZD">NZD</button>';
    const buttons = [...control.querySelectorAll('button')];
    const sync = () => buttons.forEach(button => {
      const selected = button.dataset.currency === activeCurrency;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
    if (!(nzdRate > 0)) {
      const nzd = control.querySelector('[data-currency="NZD"]');
      nzd.disabled = true;
      nzd.title = 'NZD conversion is unavailable until an official exchange rate is stored.';
    }
    control.addEventListener('click',event => {
      const button = event.target.closest('[data-currency]');
      if (!button || button.disabled || button.dataset.currency === activeCurrency) return;
      activeCurrency = button.dataset.currency;
      try { localStorage.setItem('he-display-currency',activeCurrency); } catch (error) {}
      document.documentElement.dataset.currency = activeCurrency.toLowerCase();
      sync();
      updateStaticCurrencyValues();
      window.dispatchEvent(new CustomEvent('he:currency-change',{detail:{currency:activeCurrency,rate:nzdRate}}));
    });
    actions.prepend(control);
    document.documentElement.dataset.currency = activeCurrency.toLowerCase();
    sync();
    updateStaticCurrencyValues();
  }

  mountAccessibilityShell();
  mountNavigationDrawer();
  mountCurrencySwitch();
  mountShareView();

  function filterProjects({ countries=[], clusters=[], schemes=[], search='' } = {}) {
    const countrySet = new Set(countries);
    const clusterSet = new Set(clusters);
    const schemeSet = new Set(schemes);
    const term = search.trim().toLowerCase();
    return D.projects.filter(project => {
      if (countrySet.size && !projectPartnerCodes(project).some(code => countrySet.has(code))) return false;
      if (clusterSet.size && !clusterSet.has(project.clusterCode)) return false;
      if (schemeSet.size && !schemeSet.has(project.schemeCode)) return false;
      if (term && !`${project.acronym} ${project.title} ${project.teaser}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }

  function metrics(projects) {
    const nzOrgs = new Set();
    const partnerOrgs = new Set();
    const partnerCountries = new Set();
    let nzFunding = 0;
    let projectValue = 0;
    projects.forEach(project => {
      projectValue += project.ecContribution || 0;
      project.organisations.forEach(org => {
        if (org.countryCode === 'NZ') {
          nzOrgs.add(org.name);
          nzFunding += org.contribution || 0;
        } else {
          partnerCountries.add(org.countryCode);
          partnerOrgs.add(`${org.countryCode}|${org.name}`);
        }
      });
    });
    return { projects:projects.length, nzOrgs:nzOrgs.size, partnerOrgs:partnerOrgs.size, partnerCountries:partnerCountries.size, projectValue, nzFunding };
  }

  function uniqueOptions(kind) {
    if (kind === 'countries') return D.countries.filter(c => c.code !== 'NZ').map(c => ({ value:c.code, label:c.name, eu:EU27.has(c.code) }));
    if (kind === 'clusters') return D.clusters.map(c => ({ value:c.code, label:c.name }));
    if (kind === 'schemes') {
      const seen = new Map();
      D.projects.forEach(p => seen.set(p.schemeCode, p.scheme));
      return [...seen].map(([value,label]) => ({ value,label })).sort((a,b) => a.label.localeCompare(b.label));
    }
    return [];
  }

  function mountMultiSelect(element, { options, placeholder='All', searchable=false, searchPlaceholder='Search…', countryActions=false, clearAction=false, onChange=()=>{} }) {
    if (!element) return { values:[], set(){}, clear(){} };
    const selected = new Set();
    const menuId = `multi-menu-${Math.random().toString(36).slice(2,9)}`;
    element.classList.add('multi-select');
    element.innerHTML = `<button class="multi-trigger" type="button" aria-expanded="false" aria-controls="${menuId}"><span class="multi-label">${placeholder}</span><span class="count" hidden>0</span></button><div class="multi-menu" id="${menuId}" hidden>${searchable?`<div class="multi-search-wrap"><input class="multi-search" type="search" placeholder="${searchPlaceholder}" aria-label="${searchPlaceholder}"></div>`:''}${countryActions||clearAction?`<div class="multi-actions">${countryActions?'<button type="button" data-action="eu">Select EU27</button><button type="button" data-action="non-eu">Select non-EU</button>':''}<button type="button" data-action="clear">Reset</button></div>`:''}<div class="multi-options" role="group" aria-label="${placeholder}"></div></div>`;
    const trigger = element.querySelector('.multi-trigger');
    const fieldLabel = element.closest('.filter-field')?.querySelector('label')?.textContent?.trim();
    trigger.setAttribute('aria-label', fieldLabel ? `${fieldLabel}: ${placeholder}` : placeholder);
    const label = element.querySelector('.multi-label');
    const count = element.querySelector('.count');
    const list = element.querySelector('.multi-options');
    const search = element.querySelector('.multi-search');
    const menu = element.querySelector('.multi-menu');
    const setMenuOpen = open => {
      element.classList.toggle('open', open);
      trigger.setAttribute('aria-expanded', String(open));
      menu.hidden = !open;
      if (open && search) requestAnimationFrame(() => search.focus());
    };

    const render = (term='') => {
      const lower = term.trim().toLowerCase();
      list.innerHTML = options.filter(o => !lower || o.label.toLowerCase().includes(lower)).map(o => `<label class="multi-option"><input type="checkbox" value="${o.value}" ${selected.has(o.value)?'checked':''}><span>${o.label}</span></label>`).join('');
      const values = [...selected];
      label.textContent = values.length ? (values.length === 1 ? options.find(o => o.value === values[0])?.label : `${values.length} selected`) : placeholder;
      trigger.setAttribute('aria-label', `${fieldLabel || placeholder}: ${label.textContent}`);
      count.hidden = values.length === 0;
      count.textContent = values.length;
    };
    const notify = () => { render(search?.value || ''); onChange([...selected]); };
    trigger.addEventListener('click', () => {
      setMenuOpen(!element.classList.contains('open'));
    });
    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); setMenuOpen(true); (search || list.querySelector('input'))?.focus(); }
      if (event.key === 'Escape') setMenuOpen(false);
    });
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); setMenuOpen(false); trigger.focus(); }
    });
    list.addEventListener('change', event => {
      const input = event.target.closest('input[type="checkbox"]');
      if (!input) return;
      input.checked ? selected.add(input.value) : selected.delete(input.value);
      notify();
    });
    search?.addEventListener('input', () => render(search.value));
    element.querySelector('.multi-actions')?.addEventListener('click', event => {
      const action = event.target.dataset.action;
      if (!action) return;
      selected.clear();
      if (action === 'eu') options.filter(o => o.eu).forEach(o => selected.add(o.value));
      if (action === 'non-eu') options.filter(o => !o.eu).forEach(o => selected.add(o.value));
      notify();
    });
    document.addEventListener('click', event => {
      if (!element.contains(event.target)) setMenuOpen(false);
    });
    render();
    return {
      get values() { return [...selected]; },
      set(values) { selected.clear(); values.forEach(v => selected.add(v)); notify(); },
      clear() { selected.clear(); notify(); },
    };
  }

  async function copyCurrentView(button, message='View link copied') {
    const url = location.href;
    try { await navigator.clipboard.writeText(url); }
    catch (error) {
      const input = document.createElement('textarea'); input.value = url; input.style.position='fixed'; input.style.opacity='0';
      document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove();
    }
    if (button) {
      const originalTooltip = button.dataset.tooltip || 'Share this view';
      const originalLabel = button.getAttribute('aria-label') || 'Share this view';
      button.dataset.tooltip = 'Link copied';
      button.setAttribute('aria-label','Link copied');
      button.classList.add('copied');
      window.setTimeout(() => {
        button.dataset.tooltip = originalTooltip;
        button.setAttribute('aria-label',originalLabel);
        button.classList.remove('copied');
      }, 1600);
    }
    const status = document.querySelector('[data-global-status]'); if (status) status.textContent = message;
  }

  function decorateShareButton(button) {
    if (!button || button.dataset.shareDecorated === 'true') return button;
    button.dataset.shareDecorated = 'true';
    button.classList.add('share-view-button');
    button.dataset.tooltip = 'Share this view';
    button.setAttribute('aria-label','Share this view');
    button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="6" r="2.5"></circle><circle cx="18" cy="18" r="2.5"></circle><path d="m8.2 10.9 7.6-3.8M8.2 13.1l7.6 3.8"></path></svg>';
    return button;
  }

  function mountShareView() {
    document.querySelectorAll('[data-share-view],[data-map-share]').forEach(decorateShareButton);
    if (document.querySelector('[data-share-view]')) return;
    if (!['overview','funding-flows','projects','eu27-network','country-profile','compare','results'].includes(document.body.dataset.page)) return;
    const target = document.querySelector('.page-hero-actions,.overview-hero-actions');
    if (!target) return;
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.shareView = '';
    decorateShareButton(button);
    if (!['country-profile','compare','results'].includes(document.body.dataset.page)) button.addEventListener('click', () => copyCurrentView(button));
    target.prepend(button);
  }

  function renderChips(element, items, empty='All projects') {
    if (!element) return;
    element.innerHTML = items.length ? items.map(item => `<span class="selection-chip">${item}</span>`).join('') : `<span class="selection-chip">${empty}</span>`;
  }

  function setMetrics(container, values) {
    const items = [
      ['Distinct projects', fmtNumber(values.projects), 'Each project is counted once'],
      ['NZ organisations', fmtNumber(values.nzOrgs), 'Distinct participating organisations'],
      ['Partner countries', fmtNumber(values.partnerCountries), 'Countries connected to New Zealand'],
      ['Project value', fmtMoney(values.projectValue), 'Maximum EU contribution to selected projects'],
      ['Allocated to NZ', fmtMoney(values.nzFunding), 'Net EU contribution to New Zealand participants'],
    ];
    container.innerHTML = items.map(([label,value,note]) => `<article class="metric-card"><span class="metric-label">${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
  }

  function groupCount(projects, getter, { pairPerCountry=false }={}) {
    const map = new Map();
    projects.forEach(project => {
      const values = [].concat(getter(project) || []);
      [...new Set(values)].forEach(value => {
        if (!value) return;
        map.set(value, (map.get(value) || 0) + 1);
      });
    });
    return [...map].map(([key,value]) => ({key,value})).sort((a,b) => b.value-a.value || a.key.localeCompare(b.key));
  }

  function renderBars(element, rows, { color='#397fd8' }={}) {
    if (!rows.length) { element.innerHTML='<div class="chart-empty">No projects match the selection.</div>'; return; }
    const max = Math.max(...rows.map(r => r.value),1);
    element.className='bar-chart';
    element.setAttribute('role','list');
    element.innerHTML = rows.map(row => `<div class="bar-item" role="listitem" aria-label="${row.label || row.key}: ${fmtNumber(row.value)} projects"><span class="bar-value">${fmtNumber(row.value)}</span><span class="bar-column" aria-hidden="true" style="height:${Math.max(4,row.value/max*140)}px;background:${typeof color==='function'?color(row):color}"></span><span class="bar-label">${row.label || row.key}</span></div>`).join('');
  }

  function renderHbars(element, rows, { label=v=>v.key, value=v=>v.value, color=()=> '#397fd8', formatter=fmtNumber, limit=8 }={}) {
    rows = rows.slice(0,limit);
    if (!rows.length) { element.innerHTML='<div class="chart-empty">No projects match the selection.</div>'; return; }
    const max = Math.max(...rows.map(value),1);
    element.className='hbars';
    element.setAttribute('role','list');
    element.innerHTML = rows.map(row => `<div class="hbar-row" role="listitem" aria-label="${label(row)}: ${formatter(value(row))}"><span class="hbar-label" title="${label(row)}">${label(row)}</span><span class="hbar-track" aria-hidden="true"><i class="hbar-fill" style="width:${Math.max(2,value(row)/max*100)}%;--bar-color:${color(row)}"></i></span><span class="hbar-value">${formatter(value(row))}</span></div>`).join('');
  }

  function renderRank(element, rows, { label=r=>r.key, value=r=>r.value, formatter=fmtNumber, limit=8 }={}) {
    rows = rows.slice(0,limit);
    element.className='rank-list';
    element.innerHTML = rows.length ? rows.map((row,index) => `<div class="rank-row"><span class="rank-number">${String(index+1).padStart(2,'0')}</span><span class="rank-title" title="${label(row)}">${label(row)}</span><span class="rank-value">${formatter(value(row))}</span></div>`).join('') : '<div class="chart-empty">No results.</div>';
  }

  function organisationRows(projects, countryCode=null) {
    const map = new Map();
    projects.forEach(project => project.organisations.forEach(org => {
      if (countryCode && org.countryCode !== countryCode) return;
      const key = `${org.countryCode}|${org.name}`;
      const row = map.get(key) || { key, name:org.name, country:org.country, cities:new Set(), roles:new Set(), projects:new Set(), funding:0 };
      if (org.city) row.cities.add(org.city);
      if (org.role) row.roles.add(org.role);
      row.projects.add(project.id); row.funding += org.contribution || 0; map.set(key,row);
    }));
    return [...map.values()].map(row => ({...row,city:[...row.cities].sort().join(', '),roles:[...row.roles].sort(),projectCount:row.projects.size})).sort((a,b)=>b.projectCount-a.projectCount || b.funding-a.funding);
  }

  function renderProjectTable(element, projects, limit=12, { countryCodes=null }={}) {
    const allowed=countryCodes?(countryCodes instanceof Set?countryCodes:new Set(countryCodes)):null;
    const partnerCount=project=>allowed?projectPartnerCodes(project).filter(code=>allowed.has(code)).length:projectPartnerNames(project).length;
    element.innerHTML = `<table class="project-table"><thead><tr><th scope="col">Project</th><th scope="col">Cluster</th><th scope="col">Funding scheme</th><th scope="col">Start</th><th scope="col">Partner countries</th><th scope="col">EU contribution</th></tr></thead><tbody>${projects.slice(0,limit).map(p => `<tr><td class="project-title-cell"><a href="projects.html#${p.id}">${p.acronym}</a><span>${p.title}</span></td><td>${clusterMap.get(p.clusterCode)?.short || p.cluster}</td><td>${p.scheme}</td><td>${formatDate(p.start)}</td><td>${partnerCount(p)}</td><td>${fmtMoney(p.ecContribution)}</td></tr>`).join('')}</tbody></table>${projects.length>limit?`<p class="panel-subtitle">Showing ${limit} of ${projects.length} projects. Open Project explorer for the complete list.</p>`:''}`;
  }

  function packBubbleNodes(nodes, gap=4, targetAspect=null) {
    const placed=[];
    [...nodes].sort((a,b)=>b.size-a.size||a.order-b.order).forEach((node,index)=>{
      const radius=node.size/2;
      if(!placed.length){placed.push({...node,radius,x:0,y:0});return;}
      const phase=index*137.508*Math.PI/180;
      const reach=placed.reduce((max,item)=>Math.max(max,Math.hypot(item.x,item.y)+item.radius),0)+radius+gap+24;
      let choice=null;
      for(let distance=0;distance<=reach&&!choice;distance+=2){
        const candidates=[];
        for(let step=0;step<120;step+=1){
          const angle=phase+step*Math.PI*2/120;
          const x=Math.cos(angle)*distance,y=Math.sin(angle)*distance;
          const clear=placed.every(item=>Math.hypot(x-item.x,y-item.y)>=radius+item.radius+gap-.25);
          if(!clear)continue;
          const trial=[...placed,{radius,x,y}];
          const minX=Math.min(...trial.map(item=>item.x-item.radius)),maxX=Math.max(...trial.map(item=>item.x+item.radius));
          const minY=Math.min(...trial.map(item=>item.y-item.radius)),maxY=Math.max(...trial.map(item=>item.y+item.radius));
          const width=maxX-minX,height=maxY-minY,area=width*height;
          const aspectPenalty=targetAspect?area*Math.abs(Math.log((width/height)/targetAspect))*.72:0;
          const axisPenalty=targetAspect?Math.abs(x)*.16:Math.abs(y)*.2;
          candidates.push({x,y,score:area+aspectPenalty+axisPenalty});
        }
        if(candidates.length)choice=candidates.sort((a,b)=>a.score-b.score)[0];
      }
      if(!choice){
        const right=Math.max(...placed.map(item=>item.x+item.radius));
        choice={x:right+radius+gap,y:0};
      }
      placed.push({...node,radius,x:choice.x,y:choice.y});
    });
    const padding=12;
    const minX=Math.min(...placed.map(item=>item.x-item.radius)),maxX=Math.max(...placed.map(item=>item.x+item.radius));
    const minY=Math.min(...placed.map(item=>item.y-item.radius)),maxY=Math.max(...placed.map(item=>item.y+item.radius));
    return {
      width:Math.ceil(maxX-minX+padding*2),
      height:Math.ceil(maxY-minY+padding*2),
      nodes:placed.map(item=>({...item,left:Math.round(item.x-item.radius-minX+padding),top:Math.round(item.y-item.radius-minY+padding)}))
    };
  }

  function renderClusterBubbles(element, projects, onSelect=()=>{}, visibleClusterCodes=[], {maxSize=214,emptySize=72,packAspect=null,fit=false}={}) {
    const counts = new Map(groupCount(projects,p=>p.clusterCode).map(r=>[r.key,r.value]));
    const funding = new Map();
    projects.forEach(project=>{
      const allocated=project.organisations.filter(org=>org.countryCode==='NZ').reduce((sum,org)=>sum+(org.contribution||0),0);
      funding.set(project.clusterCode,(funding.get(project.clusterCode)||0)+allocated);
    });
    const visible=new Set(visibleClusterCodes||[]);
    const clusters=visible.size?D.clusters.filter(cluster=>visible.has(cluster.code)):D.clusters;
    const maxCount=Math.max(1,...clusters.map(cluster=>counts.get(cluster.code)||0));
    element.className='cluster-bubbles';
    const bubbleData=clusters.map((cluster,order)=>{
      const count=counts.get(cluster.code)||0;
      const size=count?Math.round(maxSize*Math.sqrt(count/maxCount)):emptySize;
      const labelSize=size<100?8.5:size<130?10.5:size<210?13:16;
      const countSize=size<100?16:size<130?20:size<210?24:31;
      const padding=size<100?6:size<130?10:size<210?16:22;
      const detail=`${cluster.name} · ${count} distinct ${count===1?'project':'projects'} · ${fmtMoney(funding.get(cluster.code)||0)} allocated to New Zealand`.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
      return {cluster,count,size,labelSize,countSize,padding,detail,order};
    });
    const packed=packBubbleNodes(bubbleData,4,packAspect);
    element.innerHTML=`<div class="cluster-pack-inner" style="width:${packed.width}px;height:${packed.height}px">${packed.nodes.map(node=>`<button class="cluster-profile-bubble" type="button" data-cluster="${node.cluster.code}" data-count="${node.count}" data-tooltip="${node.detail}" title="${node.detail}" aria-label="${node.detail}. Select to filter." style="--bubble-left:${node.left}px;--bubble-top:${node.top}px;--bubble-size:${node.size}px;--bubble-label-size:${node.labelSize}px;--bubble-count-size:${node.countSize}px;--bubble-padding:${node.padding}px;--cluster-colour:${node.cluster.color}"><strong>${node.cluster.short}</strong><span>${node.count}</span><small>${node.count===1?'project':'projects'}</small></button>`).join('')}</div>`;
    element._clusterPackObserver?.disconnect();
    if(fit&&typeof ResizeObserver!=='undefined'){
      const inner=element.querySelector('.cluster-pack-inner'),buttons=[...inner.querySelectorAll('.cluster-profile-bubble')];
      const fitPack=()=>{
        const styles=getComputedStyle(element),horizontal=parseFloat(styles.paddingLeft)+parseFloat(styles.paddingRight),vertical=parseFloat(styles.paddingTop)+parseFloat(styles.paddingBottom);
        const scale=Math.min(1,(element.clientWidth-horizontal)/packed.width,(element.clientHeight-vertical)/packed.height);
        const safeScale=Math.max(.1,scale*.96);
        inner.style.width=`${Math.ceil(packed.width*safeScale)}px`;inner.style.height=`${Math.ceil(packed.height*safeScale)}px`;inner.style.transform='none';
        buttons.forEach((button,index)=>{const node=packed.nodes[index];button.style.setProperty('--bubble-left',`${node.left*safeScale}px`);button.style.setProperty('--bubble-top',`${node.top*safeScale}px`);button.style.setProperty('--bubble-size',`${node.size*safeScale}px`);button.style.setProperty('--bubble-label-size',`${node.labelSize*safeScale}px`);button.style.setProperty('--bubble-count-size',`${node.countSize*safeScale}px`);button.style.setProperty('--bubble-padding',`${node.padding*safeScale}px`);});
      };
      fitPack(); element._clusterPackObserver=new ResizeObserver(fitPack); element._clusterPackObserver.observe(element);
    }
    element.onclick = event => { const button=event.target.closest('[data-cluster]'); if(button) onSelect(button.dataset.cluster); };
  }

  function flowRows(projects, levels, { countryCodes=null }={}) {
    const allowed=countryCodes?(countryCodes instanceof Set?countryCodes:new Set(countryCodes)):null;
    const linkMaps = levels.slice(0,-1).map(() => new Map());
    projects.forEach(project => {
      const countries = projectPartnerCodes(project).filter(code=>!allowed||allowed.has(code));
      countries.forEach(code => {
        const values = levels.map(level => level === 'cluster' ? project.clusterCode : level === 'scheme' ? project.schemeCode : code);
        for (let i=0;i<values.length-1;i++) {
          const key=`${values[i]}→${values[i+1]}`;
          const pairKey=`${project.id}|${code}`;
          const row=linkMaps[i].get(key)||{source:values[i],target:values[i+1],pairs:new Set()};
          row.pairs.add(pairKey); linkMaps[i].set(key,row);
        }
      });
    });
    return linkMaps.flatMap((map,layer)=>[...map.values()].map(row=>({source:row.source,target:row.target,value:row.pairs.size,layer})));
  }

  function nodeLabel(id, level) {
    if (level === 'cluster') return clusterMap.get(id)?.short || id;
    if (level === 'country') return countryMap.get(id) || id;
    const project = D.projects.find(p => p.schemeCode === id); return project?.scheme || id;
  }
  function nodeColor(id, level) { return level==='cluster'?clusterColor(id):level==='country'?countryColor(id):schemeColor(id); }

  function renderFlow(element, projects, levels=['cluster','scheme','country'], options={}) {
    const links = flowRows(projects, levels, options);
    if (!links.length) { element.innerHTML='<div class="chart-empty">No flows match the selection.</div>'; return; }
    const width=1180, height=Math.max(620, Math.min(980, new Set(links.flatMap(l=>[l.source,l.target])).size*21));
    const nodeWidth=17, pad=10, side=54, columnGap=(width-side*2-nodeWidth)/(levels.length-1);
    const columns = levels.map((level,index) => {
      const ids = new Set(); links.forEach(l => { if(l.layer===index) ids.add(l.source); if(l.layer===index-1) ids.add(l.target); });
      const nodes=[...ids].map(id=>({id,level,index,value:Math.max(links.filter(l=>l.source===id&&l.layer===index).reduce((s,l)=>s+l.value,0),links.filter(l=>l.target===id&&l.layer===index-1).reduce((s,l)=>s+l.value,0))})).sort((a,b)=>b.value-a.value);
      return nodes;
    });
    const flowScale=Math.max(.1,Math.min(...columns.map(nodes=>(height-pad*(nodes.length-1)-60)/Math.max(1,nodes.reduce((sum,node)=>sum+node.value,0)))));
    columns.forEach((nodes,index)=>{
      const contentHeight=nodes.reduce((sum,node)=>sum+node.value*flowScale,0)+pad*Math.max(0,nodes.length-1);
      let y=Math.max(30,(height-contentHeight)/2);
      nodes.forEach(node=>{node.x=side+index*columnGap;node.y=y;node.h=node.value*flowScale;node.scale=flowScale;y+=node.h+pad;});
    });
    const nodes=columns.flat(); const nodeIndex=new Map(nodes.map(n=>[`${n.index}|${n.id}`,n]));
    const outOffset=new Map(), inOffset=new Map();
    const pathHtml=links.sort((a,b)=>b.value-a.value).map(link=>{
      const s=nodeIndex.get(`${link.layer}|${link.source}`), t=nodeIndex.get(`${link.layer+1}|${link.target}`);
      const thickness=link.value*flowScale;
      const sk=`${s.index}|${s.id}`,tk=`${t.index}|${t.id}`; const sy=s.y+(outOffset.get(sk)||0)+thickness/2,ty=t.y+(inOffset.get(tk)||0)+thickness/2; outOffset.set(sk,(outOffset.get(sk)||0)+thickness);inOffset.set(tk,(inOffset.get(tk)||0)+thickness);
      const x1=s.x+nodeWidth,x2=t.x,c1=x1+(x2-x1)*.48,c2=x1+(x2-x1)*.52;
      return `<path class="flow-link" d="M${x1},${sy} C${c1},${sy} ${c2},${ty} ${x2},${ty}" stroke="${nodeColor(s.id,s.level)}" stroke-width="${thickness}"><title>${nodeLabel(s.id,s.level)} → ${nodeLabel(t.id,t.level)}: ${link.value} distinct project–country pairs</title></path>`;
    }).join('');
    const countryValueRight=Boolean(options.countryValueRight);
    const nodeHtml=nodes.map(n=>{
      const finalColumn=n.index===levels.length-1;
      const labelX=n.x+(finalColumn?-7:nodeWidth+7), textY=n.y+Math.min(n.h/2,14);
      const valueX=countryValueRight&&finalColumn?n.x+nodeWidth+7:labelX;
      const valueY=countryValueRight&&finalColumn?textY:textY+12;
      const valueAnchor=countryValueRight&&finalColumn?'start':finalColumn?'end':'start';
      return `<g class="flow-node"><rect x="${n.x}" y="${n.y}" width="${nodeWidth}" height="${n.h}" fill="${nodeColor(n.id,n.level)}"><title>${nodeLabel(n.id,n.level)}: ${n.value}</title></rect><text x="${labelX}" y="${textY}" text-anchor="${finalColumn?'end':'start'}">${nodeLabel(n.id,n.level)}</text><text class="node-value" x="${valueX}" y="${valueY}" text-anchor="${valueAnchor}">${n.value}</text></g>`;
    }).join('');
    element.innerHTML=`<svg class="flow-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Flow of distinct project-country pairs"><g>${pathHtml}</g><g>${nodeHtml}</g></svg>`;
  }

  function updateFooters() {
    document.querySelectorAll('[data-project-updated]').forEach(el => el.textContent=formatDate(D.metadata.projectDataUpdated));
    document.querySelectorAll('[data-ncp-updated]').forEach(el => el.textContent=formatDate(D.metadata.ncpDataVerified));
  }
  updateFooters();

  window.HE = { D, EU27, clusterMap, countryMap, uniqueOptions, filterProjects, metrics, projectPartnerCodes, projectPartnerNames, mountMultiSelect, renderChips, setMetrics, groupCount, renderBars, renderHbars, renderRank, organisationRows, renderProjectTable, renderClusterBubbles, renderFlow, clusterColor, countryColor, schemeColor, formatDate, fmtMoney, fmtExactMoney, fmtNumber, currentCurrency:()=>activeCurrency, exchangeRate, updateFooters, copyCurrentView, decorateShareButton };
})();
