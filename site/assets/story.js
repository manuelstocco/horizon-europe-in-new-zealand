(() => {
  const D = window.HE_DATA;
  const H = window.HE;
  const steps = [...document.querySelectorAll('[data-bubble-step]')];
  const bubbles = [...document.querySelectorAll('.bubble')];
  const stage = document.querySelector('.bubble-stage');
  const timeline = [...document.querySelectorAll('[data-timeline]')];
  const progress = document.querySelector('.timeline-line span');

  if (stage && H) {
    const clusterLayer = document.createElement('div');
    clusterLayer.className = 'story-cluster-layer';
    clusterLayer.innerHTML = '<p class="story-cluster-caption">Signed projects involving New Zealand</p><div data-story-cluster-pack></div>';
    stage.append(clusterLayer);
    H.renderClusterBubbles(clusterLayer.querySelector('[data-story-cluster-pack]'), D.projects);
  }

  const stepObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      steps.forEach(step => step.classList.toggle('active', step === entry.target));
      const index = Number(entry.target.dataset.bubbleStep);
      stage?.classList.toggle('show-clusters', index === 3);
      bubbles.forEach(bubble => {
        bubble.style.opacity = index === 0 || bubble.classList.contains('pillar-two') ? '1' : '.24';
      });
    });
  }, { rootMargin: '-38% 0px -38% 0px', threshold: 0 });
  steps.forEach(step => stepObserver.observe(step));

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
    const feature = window.HE_WORLD?.features?.find(item => item.properties?.code === 'NZ');
    if (!canvas || !feature) return;
    const context = canvas.getContext('2d');
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
    };
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
