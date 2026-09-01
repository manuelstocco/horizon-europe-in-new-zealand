(() => {
  const D = window.HE_DATA;
  const H = window.HE;
  const steps = [...document.querySelectorAll('[data-bubble-step]')];
  const stage = document.querySelector('.bubble-stage');
  const timeline = [...document.querySelectorAll('[data-timeline]')];
  const progress = document.querySelector('.timeline-line span');

  // Download and decode the three decorative milestones immediately so they
  // are already present when the reader reaches the timeline.
  timeline.forEach(item => {
    const image = item.querySelector('.timeline-year-scene img');
    if (image?.decode) image.decode().catch(() => {});
  });

  if (stage && H) {
    const clusterLayer = document.createElement('div');
    clusterLayer.className = 'story-cluster-layer';
    clusterLayer.innerHTML = '<p class="story-cluster-caption">Signed projects involving New Zealand</p><div data-story-cluster-pack></div>';
    stage.append(clusterLayer);
    const activeClusterCodes=[...new Set(D.projects.map(project=>project.clusterCode))];
    const renderStoryClusters=()=>H.renderClusterBubbles(clusterLayer.querySelector('[data-story-cluster-pack]'), D.projects, ()=>{}, activeClusterCodes, {maxSize:285,emptySize:72,packAspect:1,fit:true});
    renderStoryClusters();
    window.addEventListener('he:currency-change',renderStoryClusters);
  }

  let activeBubbleIndex=-1,bubbleFrame=0;
  const updateBubbleStep=()=>{
    bubbleFrame=0;if(!steps.length)return;
    const focusY=window.innerHeight*.48;
    const nearest=steps.reduce((best,step)=>{
      const rect=step.getBoundingClientRect(),distance=Math.abs(rect.top+rect.height*.5-focusY);
      return !best||distance<best.distance?{step,distance}:best;
    },null);
    const index=Number(nearest.step.dataset.bubbleStep);if(index===activeBubbleIndex)return;activeBubbleIndex=index;
    steps.forEach(step=>step.classList.toggle('active',step===nearest.step));
    if(stage)stage.dataset.stageStep=String(index);
    stage?.classList.toggle('show-clusters',index===3);
  };
  const queueBubbleUpdate=()=>{if(!bubbleFrame)bubbleFrame=requestAnimationFrame(updateBubbleStep)};
  document.addEventListener('scroll',queueBubbleUpdate,{passive:true});window.addEventListener('resize',queueBubbleUpdate);updateBubbleStep();

  const timelineObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.target.classList.toggle('active', entry.isIntersecting));
  }, { rootMargin: '-30% 0px -30% 0px', threshold: .05 });
  timeline.forEach(item => timelineObserver.observe(item));

  const updateProgress = () => {
    if (!progress) return;
    const section = document.querySelector('.timeline');
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (window.innerHeight * .55 - rect.top) / Math.max(1, rect.height)));
    progress.style.height = `${pct * 100}%`;
  };
  document.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  function drawNewZealand() {
    const canvas = document.querySelector('[data-hero-nz-map]');
    const shell = canvas?.closest('.hero-nz-map');
    const tooltip = shell?.querySelector('[data-hero-city-tooltip]');
    const feature = window.HE_WORLD?.features?.find(item => item.properties?.code === 'NZ');
    if (!canvas || !feature) return;
    const context = canvas.getContext('2d');
    const cities = [
      {name:'Auckland',lon:174.7633,lat:-36.8485},
      {name:'Hamilton',lon:175.2793,lat:-37.7870},
      {name:'Palmerston North',lon:175.6111,lat:-40.3523},
      {name:'Wellington',lon:174.7762,lat:-41.2866},
      {name:'Christchurch',lon:172.6362,lat:-43.5321},
      {name:'Dunedin',lon:170.5028,lat:-45.8788}
    ];
    let hoveredCity=null,projectPoint=null;
    const polygons = feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [feature.geometry.coordinates];
    const points = polygons.flat(2);
    const longitudes = points.map(point => point[0]);
    const latitudes = points.map(point => point[1]);
    const bounds = { minX: Math.min(...longitudes), maxX: Math.max(...longitudes), minY: Math.min(...latitudes), maxY: Math.max(...latitudes) };

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      const pad = Math.min(rect.width, rect.height) * .12;
      const scale = Math.min((rect.width - pad * 2) / (bounds.maxX - bounds.minX), (rect.height - pad * 2) / (bounds.maxY - bounds.minY));
      const mapWidth = (bounds.maxX - bounds.minX) * scale;
      const mapHeight = (bounds.maxY - bounds.minY) * scale;
      const offsetX = (rect.width - mapWidth) / 2;
      const offsetY = (rect.height - mapHeight) / 2;
      const project = ([lon, lat]) => [offsetX + (lon - bounds.minX) * scale, offsetY + (bounds.maxY - lat) * scale];

      context.save();
      context.shadowColor = 'rgba(119,221,210,.32)';
      context.shadowBlur = 28;
      polygons.forEach(polygon => polygon.forEach(ring => {
        context.beginPath();
        ring.forEach((point, index) => {
          const [x, y] = project(point);
          if (index) context.lineTo(x, y); else context.moveTo(x, y);
        });
        context.closePath();
        context.fillStyle = 'rgba(119,221,210,.9)';
        context.fill();
        context.lineWidth = 1.4;
        context.strokeStyle = 'rgba(255,255,255,.72)';
        context.stroke();
      }));
      context.restore();
      cities.forEach(city=>{
        const [x,y]=project([city.lon,city.lat]),active=hoveredCity===city;
        context.beginPath();context.arc(x,y,active?7:4.5,0,Math.PI*2);context.fillStyle=active?'#f4b84a':'#d9efff';context.fill();
        context.lineWidth=active?3:2;context.strokeStyle=active?'rgba(244,184,74,.4)':'rgba(16,43,76,.9)';context.stroke();
        if(active){context.beginPath();context.arc(x,y,12,0,Math.PI*2);context.strokeStyle='rgba(244,184,74,.34)';context.lineWidth=2;context.stroke();}
      });
      projectPoint=project;
    };
    const showCity=(city,x,y)=>{
      hoveredCity=city;render();
      if(!tooltip)return;
      tooltip.classList.toggle('show',Boolean(city));
      tooltip.setAttribute('aria-hidden',String(!city));
      if(city){tooltip.style.left=`${x}px`;tooltip.style.top=`${y}px`;tooltip.textContent=city.name;}
    };
    canvas.addEventListener('pointermove',event=>{
      if(!projectPoint)return;
      const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;
      const nearest=cities.map(city=>{const [cx,cy]=projectPoint([city.lon,city.lat]);return{city,cx,cy,distance:Math.hypot(x-cx,y-cy)};}).sort((a,b)=>a.distance-b.distance)[0];
      if(nearest&&nearest.distance<20){canvas.style.cursor='pointer';if(nearest.city!==hoveredCity)showCity(nearest.city,nearest.cx,nearest.cy);}
      else{canvas.style.cursor='default';if(hoveredCity)showCity(null,0,0);}
    });
    canvas.addEventListener('pointerleave',()=>showCity(null,0,0));
    new ResizeObserver(render).observe(canvas);
    render();
  }
  drawNewZealand();

  const projects = D.projects;
  const organisationKeys = new Set();
  const partnerCountries = new Set();
  const activeLinks = new Set();
  projects.forEach(project => {
    const organisations = [...new Map(project.organisations.map(org => [`${org.countryCode}|${org.name}`, org])).values()];
    organisations.forEach(org => organisationKeys.add(`${org.countryCode}|${org.name}`));
    const nz = organisations.filter(org => org.countryCode === 'NZ');
    const partners = organisations.filter(org => org.countryCode !== 'NZ');
    partners.forEach(org => partnerCountries.add(org.countryCode));
    nz.forEach(nzOrg => partners.forEach(partner => activeLinks.add(`${nzOrg.countryCode}|${nzOrg.name}→${partner.countryCode}|${partner.name}|${project.clusterCode}`)));
  });
  const stats = document.querySelector('[data-story-stats]');
  if (stats) stats.innerHTML = [
    [projects.length, 'signed projects'],
    [organisationKeys.size, 'participating organisations'],
    [activeLinks.size, 'active organisation links'],
    [partnerCountries.size, 'partner countries'],
  ].map(([value, label]) => `<article class="story-stat"><strong>${value}</strong><span>${label}</span></article>`).join('');
})();
