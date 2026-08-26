(() => {
  function mountNavigationDrawer() {
    const header = document.querySelector('.site-header');
    const nav = header?.querySelector('.primary-nav');
    if (!header || !nav || header.dataset.drawerReady === 'true') return;

    header.dataset.drawerReady = 'true';
    const currentFile = location.pathname.split('/').pop() || 'index.html';
    const navigationGroups = [
      { label:'Discover', pages:[
        ['index.html','The Story']
      ]},
      { label:'Explore the Portfolio', pages:[
        ['overview.html','Partnership Overview'],
        ['funding-flows.html','Funding & Country Flows']
      ]},
      { label:'Explore the Network', pages:[
        ['eu27-network.html','EU27 Collaboration Network'],
        ['projects.html','Project Explorer']
      ]},
      { label:'Resources', pages:[
        ['repository.html','Country Presentations'],
        ['methodology.html','Data & Methodology']
      ]}
    ];
    nav.innerHTML = navigationGroups.map(group => `<section class="site-nav-group"><h2>${group.label}</h2>${group.pages.map(([href,label]) => `<a href="${href}"${currentFile === href ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('')}</section>`).join('');
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
    drawer.innerHTML = '<div class="site-nav-drawer-head"><div><span>Explore</span><strong>Horizon Europe in New Zealand</strong></div><button class="site-nav-close" type="button" aria-label="Close menu">&times;</button></div>';
    nav.removeAttribute('aria-label');
    drawer.appendChild(nav);
    document.body.append(overlay, drawer);
    header.appendChild(menuButton);

    let previousFocus = null;
    let closeTimer = null;
    const setOpen = open => {
      window.clearTimeout(closeTimer);
      if (open) {
        previousFocus = document.activeElement;
        overlay.hidden = false;
        requestAnimationFrame(() => document.body.classList.add('site-menu-open'));
      } else {
        document.body.classList.remove('site-menu-open');
        closeTimer = window.setTimeout(() => { overlay.hidden = true; }, 260);
      }
      menuButton.setAttribute('aria-expanded', String(open));
      drawer.setAttribute('aria-hidden', String(!open));
      if (open) drawer.querySelector('.site-nav-close').focus();
      else if (previousFocus) previousFocus.focus();
    };

    menuButton.addEventListener('click', () => setOpen(true));
    drawer.querySelector('.site-nav-close').addEventListener('click', () => setOpen(false));
    overlay.addEventListener('click', () => setOpen(false));
    nav.addEventListener('click', event => { if (event.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.body.classList.contains('site-menu-open')) setOpen(false);
    });
  }

  mountNavigationDrawer();

  const D = window.HE_DATA;
  const EU27 = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','EL','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);
  const money = new Intl.NumberFormat('en-NZ', { style:'currency', currency:'EUR', notation:'compact', maximumFractionDigits:1 });
  const number = new Intl.NumberFormat('en-NZ', { maximumFractionDigits:0 });
  const dateLong = new Intl.DateTimeFormat('en-NZ', { day:'numeric', month:'long', year:'numeric' });
  const safeDate = value => value ? new Date(`${value}T00:00:00`) : null;
  const formatDate = value => safeDate(value) ? dateLong.format(safeDate(value)) : '—';
  const fmtMoney = value => money.format(Number(value || 0));
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
    const selected = new Set();
    element.classList.add('multi-select');
    element.innerHTML = `<button class="multi-trigger" type="button" aria-expanded="false"><span class="multi-label">${placeholder}</span><span class="count" hidden>0</span></button><div class="multi-menu">${searchable?`<div class="multi-search-wrap"><input class="multi-search" type="search" placeholder="${searchPlaceholder}" aria-label="${searchPlaceholder}"></div>`:''}${countryActions||clearAction?`<div class="multi-actions">${countryActions?'<button type="button" data-action="eu">Select EU27</button><button type="button" data-action="non-eu">Select non-EU</button>':''}<button type="button" data-action="clear">Clear all</button></div>`:''}<div class="multi-options"></div></div>`;
    const trigger = element.querySelector('.multi-trigger');
    const label = element.querySelector('.multi-label');
    const count = element.querySelector('.count');
    const list = element.querySelector('.multi-options');
    const search = element.querySelector('.multi-search');

    const render = (term='') => {
      const lower = term.trim().toLowerCase();
      list.innerHTML = options.filter(o => !lower || o.label.toLowerCase().includes(lower)).map(o => `<label class="multi-option"><input type="checkbox" value="${o.value}" ${selected.has(o.value)?'checked':''}><span>${o.label}</span></label>`).join('');
      const values = [...selected];
      label.textContent = values.length ? (values.length === 1 ? options.find(o => o.value === values[0])?.label : `${values.length} selected`) : placeholder;
      count.hidden = values.length === 0;
      count.textContent = values.length;
    };
    const notify = () => { render(search?.value || ''); onChange([...selected]); };
    trigger.addEventListener('click', () => {
      const open = element.classList.toggle('open');
      trigger.setAttribute('aria-expanded', String(open));
      if (open && search) requestAnimationFrame(() => search.focus());
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
      if (!element.contains(event.target)) { element.classList.remove('open'); trigger.setAttribute('aria-expanded','false'); }
    });
    render();
    return {
      get values() { return [...selected]; },
      set(values) { selected.clear(); values.forEach(v => selected.add(v)); notify(); },
      clear() { selected.clear(); notify(); },
    };
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
    element.innerHTML = rows.map(row => `<div class="bar-item"><span class="bar-value">${fmtNumber(row.value)}</span><span class="bar-column" style="height:${Math.max(4,row.value/max*140)}px;background:${typeof color==='function'?color(row):color}"></span><span class="bar-label">${row.label || row.key}</span></div>`).join('');
  }

  function renderHbars(element, rows, { label=v=>v.key, value=v=>v.value, color=()=> '#397fd8', formatter=fmtNumber, limit=8 }={}) {
    rows = rows.slice(0,limit);
    if (!rows.length) { element.innerHTML='<div class="chart-empty">No projects match the selection.</div>'; return; }
    const max = Math.max(...rows.map(value),1);
    element.className='hbars';
    element.innerHTML = rows.map(row => `<div class="hbar-row"><span class="hbar-label" title="${label(row)}">${label(row)}</span><span class="hbar-track"><i class="hbar-fill" style="width:${Math.max(2,value(row)/max*100)}%;--bar-color:${color(row)}"></i></span><span class="hbar-value">${formatter(value(row))}</span></div>`).join('');
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
    element.innerHTML = `<table class="project-table"><thead><tr><th>Project</th><th>Cluster</th><th>Funding scheme</th><th>Start</th><th>Partner countries</th><th>EU contribution</th></tr></thead><tbody>${projects.slice(0,limit).map(p => `<tr><td class="project-title-cell"><a href="projects.html#${p.id}">${p.acronym}</a><span>${p.title}</span></td><td>${clusterMap.get(p.clusterCode)?.short || p.cluster}</td><td>${p.scheme}</td><td>${formatDate(p.start)}</td><td>${partnerCount(p)}</td><td>${fmtMoney(p.ecContribution)}</td></tr>`).join('')}</tbody></table>${projects.length>limit?`<p class="panel-subtitle">Showing ${limit} of ${projects.length} projects. Open Project explorer for the complete list.</p>`:''}`;
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
    element.innerHTML=`<div class="cluster-pack-inner" style="width:${packed.width}px;height:${packed.height}px">${packed.nodes.map(node=>`<button class="cluster-profile-bubble" type="button" data-cluster="${node.cluster.code}" data-count="${node.count}" data-tooltip="${node.detail}" title="${node.detail}" aria-label="${node.detail}. Select to filter." style="--bubble-left:${node.left}px;--bubble-top:${node.top}px;--bubble-size:${node.size}px;--bubble-label-size:${node.labelSize}px;--bubble-count-size:${node.countSize}px;--bubble-padding:${node.padding}px;background:${node.cluster.color}"><strong>${node.cluster.short}</strong><span>${node.count}</span><small>${node.count===1?'project':'projects'}</small></button>`).join('')}</div>`;
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

  document.querySelectorAll('.primary-nav').forEach(nav => {
    const projectsLink = nav.querySelector('a[href="projects.html"]');
    if (!projectsLink) return;
    if (!nav.querySelector('a[href="eu27-network.html"]')) projectsLink.insertAdjacentHTML('beforebegin','<a href="eu27-network.html">EU27 network</a>');
    if (!nav.querySelector('a[href="repository.html"]')) projectsLink.insertAdjacentHTML('afterend','<a href="repository.html">Repository</a>');
  });

  window.HE = { D, EU27, clusterMap, countryMap, uniqueOptions, filterProjects, metrics, projectPartnerCodes, projectPartnerNames, mountMultiSelect, renderChips, setMetrics, groupCount, renderBars, renderHbars, renderRank, organisationRows, renderProjectTable, renderClusterBubbles, renderFlow, clusterColor, countryColor, schemeColor, formatDate, fmtMoney, fmtNumber, updateFooters };
})();
