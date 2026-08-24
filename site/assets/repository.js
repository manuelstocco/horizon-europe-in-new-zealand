(function(){
  'use strict';
  const source=window.HE_REPOSITORY||{items:[]};
  const items=Array.isArray(source.items)?source.items:[];
  const grid=document.querySelector('[data-repository-grid]');
  const count=document.querySelector('[data-repository-count]');
  const search=document.getElementById('repository-search');
  const country=document.getElementById('repository-country');
  const format=document.getElementById('repository-format');
  if(!grid||!count||!search||!country||!format)return;

  const escapeHtml=value=>String(value??'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
  const flag=code=>String(code||'').toUpperCase().replace(/./g,char=>String.fromCodePoint(127397+char.charCodeAt(0)));
  const displayDate=value=>{
    if(!value)return 'Date not specified';
    const parsed=new Date(`${value}T12:00:00`);
    return Number.isNaN(parsed.getTime())?value:new Intl.DateTimeFormat('en-NZ',{day:'numeric',month:'long',year:'numeric'}).format(parsed);
  };
  const fileSize=bytes=>{
    const value=Number(bytes)||0;
    if(!value)return '';
    if(value<1024*1024)return `${Math.round(value/1024)} KB`;
    return `${(value/(1024*1024)).toFixed(1)} MB`;
  };
  const addOptions=(select,values)=>{
    [...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b)).forEach(value=>{
      const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option);
    });
  };
  addOptions(country,items.map(item=>item.country));
  addOptions(format,items.map(item=>item.format));

  function render(){
    const term=search.value.trim().toLowerCase();
    const visible=items.filter(item=>{
      const haystack=[item.country,item.title,item.description,item.language,item.version].join(' ').toLowerCase();
      return (!term||haystack.includes(term))&&(!country.value||item.country===country.value)&&(!format.value||item.format===format.value);
    }).sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured))||String(a.country).localeCompare(String(b.country)));
    count.textContent=visible.length;
    if(!visible.length){grid.innerHTML='<div class="repository-empty"><strong>No materials match these filters.</strong><br>Try a different country or search term.</div>';return;}
    grid.innerHTML=visible.map(item=>`<article class="repository-card">
      <div class="repository-card-head"><div class="repository-country"><span class="repository-flag" aria-hidden="true">${escapeHtml(flag(item.countryCode))}</span><span>${escapeHtml(item.country)}</span></div><span class="repository-format">${escapeHtml(item.format)}</span></div>
      <h2>${escapeHtml(item.title)}</h2>
      <p class="repository-card-description">${escapeHtml(item.description)}</p>
      <div class="repository-meta"><span>${escapeHtml(item.language)}</span><span>${escapeHtml(item.version)}</span><span>Updated ${escapeHtml(displayDate(item.updated))}</span></div>
      <div class="repository-actions"><span class="repository-file-size">${escapeHtml(fileSize(item.sizeBytes))}</span><a class="repository-download" href="${escapeHtml(item.file)}" download>Download ${escapeHtml(item.format)}</a></div>
    </article>`).join('');
  }
  [search,country,format].forEach(control=>control.addEventListener(control===search?'input':'change',render));
  render();
})();
