(() => {
  const D = window.HE_DATA;
  const steps = [...document.querySelectorAll('[data-bubble-step]')];
  const bubbles = [...document.querySelectorAll('.bubble')];
  const stage = document.querySelector('.bubble-stage');
  const timeline = [...document.querySelectorAll('[data-timeline]')];
  const progress = document.querySelector('.timeline-line span');
  const clusterLayer = document.createElement('div');
  clusterLayer.className = 'cluster-bubble-layer';
  const counts = new Map(D.clusters.map(cluster => [cluster.code, D.projects.filter(project => project.clusterCode === cluster.code).length]));
  const maxCount = Math.max(...counts.values(), 1);
  const positions = [[3,3],[31,0],[64,4],[5,52],[39,50],[70,52]];
  clusterLayer.innerHTML = D.clusters.map((cluster,index) => {
    const count=counts.get(cluster.code)||0, size=88+count/maxCount*76, [left,top]=positions[index];
    return `<div class="story-cluster-bubble" style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;background:${cluster.color}"><span>${cluster.short}</span><strong>${count}</strong></div>`;
  }).join('');
  stage.append(clusterLayer);
  const stepObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      steps.forEach(step => step.classList.toggle('active', step === entry.target));
      const index = Number(entry.target.dataset.bubbleStep);
      stage.classList.toggle('show-clusters', index === 3);
      bubbles.forEach(b => b.style.opacity = index === 0 || b.classList.contains('pillar-two') ? '1' : '.24');
    });
  }, { rootMargin: '-38% 0px -38% 0px', threshold: 0 });
  steps.forEach(step => stepObserver.observe(step));

  const timelineObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.target.classList.toggle('active', entry.isIntersecting));
  }, { rootMargin: '-25% 0px -25% 0px', threshold: .05 });
  timeline.forEach(item => timelineObserver.observe(item));

  const updateProgress = () => {
    if (!progress) return;
    const section = document.querySelector('.timeline');
    const rect = section.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (window.innerHeight * .55 - rect.top) / Math.max(1, rect.height)));
    progress.style.height = `${pct * 100}%`;
  };
  document.addEventListener('scroll', updateProgress, { passive: true });
  updateProgress();

  const projects=D.projects;
  const partnerCountries=new Set(projects.flatMap(p=>p.countryCodes.filter(code=>code!=='NZ')));
  const nzOrganisations=new Set(projects.flatMap(p=>p.organisations.filter(o=>o.countryCode==='NZ').map(o=>o.name)));
  const cutoff=D.metadata.projectDataUpdated;
  const started=projects.filter(p=>p.start<=cutoff).length;
  document.querySelector('[data-story-stats]').innerHTML = [
    [projects.length,'signed projects'],
    [started,'projects already under way'],
    [nzOrganisations.size,'New Zealand organisations'],
    [partnerCountries.size,'partner countries'],
  ].map(([value,label])=>`<article class="story-stat"><strong>${value}</strong><span>${label}</span></article>`).join('');
})();
