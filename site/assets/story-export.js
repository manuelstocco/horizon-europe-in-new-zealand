(() => {
  const D = window.HE_DATA;
  const HE = window.HE;
  const WORLD = window.HE_WORLD;
  const COUNTRY_STATUS = window.HE_COUNTRY_STATUS;
  if (!D || !HE) return;

  const C = {
    navy:'16395F', navyDeep:'102B4C', blue:'397FD8', aqua:'8BC0EF', teal:'22A99A',
    pale:'EAF2F9', page:'F5F8FC', ink:'123357', muted:'68798D', white:'FFFFFF', line:'D8E4EF'
  };
  const fallbackUrl = 'https://manuelstocco.github.io/horizon-europe-in-new-zealand/';
  const hex = value => String(value || '').replace('#','').toUpperCase();
  const slideTitle = value => String(value || '').replace(/\.+\s*$/,'');
  const number = value => new Intl.NumberFormat('en-NZ',{maximumFractionDigits:0}).format(Number(value || 0));
  const storyUrl = () => typeof location !== 'undefined' && /^https?:$/.test(location.protocol)
    ? location.href.split(/[?#]/)[0] : fallbackUrl;
  const clusterByCode = new Map(D.clusters.map(cluster => [cluster.code, cluster]));
  const normaliseCountryCode = code => code === 'UK' ? 'GB' : code === 'EL' ? 'GR' : code;
  const EU27_CODES = new Set((COUNTRY_STATUS?.eu27 || [...HE.EU27]).map(normaliseCountryCode));
  const ASSOCIATED_CODES = new Set((COUNTRY_STATUS?.associated || []).map(normaliseCountryCode));
  const LMIC_CODES = new Set((COUNTRY_STATUS?.lowMiddleIncome || []).map(normaliseCountryCode));
  const OUTERMOST_REGIONS = COUNTRY_STATUS?.outermostRegions || [];
  const OVERSEAS_TERRITORIES = COUNTRY_STATUS?.overseasCountriesTerritories || [];
  const OCT_MAP_CODES = new Set(OVERSEAS_TERRITORIES.map(item => normaliseCountryCode(item.mapCode || item.code)).filter(Boolean));
  const LMIC_STATUS_CODES = new Set([...LMIC_CODES].filter(code => code !== 'NZ' && !EU27_CODES.has(code) && !ASSOCIATED_CODES.has(code)));
  const COUNTRY_STATUS_CHECKED = COUNTRY_STATUS?.metadata?.checked || '31 August 2026';
  const associationSourceUrl = COUNTRY_STATUS?.metadata?.source?.association || 'https://research-and-innovation.ec.europa.eu/strategy/strategy-research-and-innovation/europe-world/international-cooperation/association-horizon-europe_en';
  const eligibilitySourceUrl = COUNTRY_STATUS?.metadata?.source?.eligibility || 'https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/horizon/wp-call/2026-2027/wp-15-general-annexes_horizon-2026-2027_en.pdf';
  const countryName = code => D.countries.find(country => country.code === code)?.name || code;
  const projectOrgKey = org => `${org.countryCode}|${org.id || org.name}`;

  function groupProjects(values) {
    const counts = new Map();
    D.projects.forEach(project => [...new Set(values(project).filter(Boolean))].forEach(value => counts.set(value,(counts.get(value)||0)+1)));
    return [...counts].map(([key,value]) => ({key,value})).sort((a,b) => b.value-a.value || String(a.key).localeCompare(String(b.key)));
  }

  function snapshot() {
    const organisations = new Set();
    const nzOrganisations = new Set();
    const partnerCountries = new Set();
    const activeLinks = new Set();
    D.projects.forEach(project => {
      const uniqueOrgs = [...new Map(project.organisations.map(org => [projectOrgKey(org),org])).values()];
      const nz = uniqueOrgs.filter(org => org.countryCode === 'NZ');
      const partners = uniqueOrgs.filter(org => org.countryCode !== 'NZ');
      uniqueOrgs.forEach(org => organisations.add(projectOrgKey(org)));
      nz.forEach(org => nzOrganisations.add(projectOrgKey(org)));
      partners.forEach(org => partnerCountries.add(org.countryCode));
      nz.forEach(nzOrg => partners.forEach(partner => activeLinks.add(`${projectOrgKey(nzOrg)}>${projectOrgKey(partner)}|${project.clusterCode}`)));
    });
    const years = groupProjects(project => [project.start?.slice(0,4)]).sort((a,b) => String(a.key).localeCompare(String(b.key)));
    const clusters = groupProjects(project => [project.clusterCode]).filter(row => row.value > 0);
    const countries = groupProjects(project => (project.countryCodes || []).filter(code => code !== 'NZ'));
    const firstYear = years[0]?.key || '2024';
    const firstProjects = D.projects.filter(project => project.start?.startsWith(firstYear)).map(project => project.acronym);
    return {
      projects:D.projects.length,
      organisations:organisations.size,
      nzOrganisations:nzOrganisations.size,
      partnerCountries:partnerCountries.size,
      activeLinks:activeLinks.size,
      years,clusters,countries,firstYear,firstProjects,
      updated:HE.formatDate(D.metadata?.projectDataUpdated)
    };
  }

  function programmeMoney(eurValue) {
    const rate = HE.currentCurrency() === 'NZD' ? Number(HE.exchangeRate?.value || D.metadata?.exchangeRate?.value || 1) : 1;
    const prefix = HE.currentCurrency() === 'NZD' ? 'NZ$' : '€';
    return `${prefix}${new Intl.NumberFormat('en-NZ',{maximumFractionDigits:1}).format(eurValue * rate / 1e9)}bn`;
  }

  const timeline = data => [
    {date:'2009',title:'Building the foundations',body:'The EU and New Zealand sign a Science and Technology Cooperation Agreement.',url:'https://eur-lex.europa.eu/EN/legal-content/summary/scientific-and-technological-cooperation-between-the-eu-and-new-zealand.html'},
    {date:'Feb–June 2022',title:'A closer partnership',body:'Exploratory talks conclude and political momentum builds for association.',url:'https://euraxess.ec.europa.eu/worldwide/australia-nz/joint-media-release-occasion-meeting-between-european'},
    {date:'Dec 2022',title:'Negotiations concluded',body:'The partners complete negotiations on association to Horizon Europe.',url:'https://research-and-innovation.ec.europa.eu/news/all-research-and-innovation-news/eu-and-new-zealand-successfully-conclude-horizon-europe-association-negotiations-2022-12-20_en'},
    {date:'Feb 2023',title:'Early access begins',body:'Transitional arrangements open eligible Pillar II calls to New Zealand.',url:'https://research-and-innovation.ec.europa.eu/news/all-research-and-innovation-news/transitional-arrangements-new-zealand-participation-horizon-europe-2023-02-17_en'},
    {date:'9–13 July 2023',title:'Agreement and launch',body:'Association is signed in Brussels and Horizon Europe launches in Christchurch.',url:'https://research-and-innovation.ec.europa.eu/strategy/strategy-research-and-innovation/europe-world/international-cooperation/association-horizon-europe/new-zealand_en'},
    {date:data.firstYear,title:'Collaboration on the ground',body:`The first signed cohort begins${data.firstProjects.length ? `: ${data.firstProjects.slice(0,4).join(', ')}` : '.'}`,url:storyUrl()}
  ];

  function geometryPolygons(feature) {
    if (!feature?.geometry) return [];
    return feature.geometry.type === 'MultiPolygon' ? feature.geometry.coordinates : [feature.geometry.coordinates];
  }
  function geometryPoints(feature) { return geometryPolygons(feature).flat(2); }
  function featureBounds(feature) {
    const points = geometryPoints(feature);
    return {minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))};
  }
  function drawFeature(ctx,feature,box,bounds,fill,stroke,lineWidth=2) {
    const sx=box.w/(bounds.maxX-bounds.minX),sy=box.h/(bounds.maxY-bounds.minY),scale=Math.min(sx,sy);
    const mapW=(bounds.maxX-bounds.minX)*scale,mapH=(bounds.maxY-bounds.minY)*scale;
    const ox=box.x+(box.w-mapW)/2,oy=box.y+(box.h-mapH)/2;
    const project=([lon,lat])=>[ox+(lon-bounds.minX)*scale,oy+(bounds.maxY-lat)*scale];
    geometryPolygons(feature).forEach(polygon => polygon.forEach(ring => {
      ctx.beginPath();
      ring.forEach((point,index)=>{const [x,y]=project(point);index?ctx.lineTo(x,y):ctx.moveTo(x,y);});
      ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();
    }));
    return project;
  }
  function newCanvas(width,height) { const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas; }

  function renderNzPng() {
    const canvas=newCanvas(1100,1100),ctx=canvas.getContext('2d'),nz=WORLD?.features?.find(feature=>feature.properties?.code==='NZ');
    if(!nz)return null;
    const gradient=ctx.createRadialGradient(550,550,80,550,550,520);gradient.addColorStop(0,'rgba(77,157,223,.30)');gradient.addColorStop(1,'rgba(16,43,76,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,1100,1100);
    ctx.save();ctx.shadowColor='rgba(139,192,239,.38)';ctx.shadowBlur=60;
    const project=drawFeature(ctx,nz,{x:170,y:80,w:760,h:920},featureBounds(nz),'#8bc0ef','#d9efff',4);ctx.restore();
    [{lon:174.7633,lat:-36.8485},{lon:175.2793,lat:-37.7870},{lon:175.6111,lat:-40.3523},{lon:174.7762,lat:-41.2866},{lon:172.6362,lat:-43.5321},{lon:170.5028,lat:-45.8788}].forEach(city=>{const [x,y]=project([city.lon,city.lat]);ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fillStyle='#f4b84a';ctx.fill();ctx.strokeStyle='#102b4c';ctx.lineWidth=4;ctx.stroke();});
    return canvas.toDataURL('image/png');
  }

  function renderAssociationMapPng() {
    const canvas=newCanvas(1800,850),ctx=canvas.getContext('2d'),bounds={minX:-180,maxX:180,minY:-58,maxY:85},box={x:70,y:70,w:1660,h:680};
    ctx.fillStyle='#f5f8fc';ctx.fillRect(0,0,1800,850);
    ctx.save();ctx.beginPath();ctx.rect(box.x,box.y,box.w,box.h);ctx.clip();
    (WORLD?.features||[]).filter(feature=>feature.properties?.code!=='AQ').forEach(feature=>{
      const code=normaliseCountryCode(feature.properties?.code);
      const fill=code==='NZ'?'#e5a63b':EU27_CODES.has(code)?'#397fd8':ASSOCIATED_CODES.has(code)?'#22a99a':OCT_MAP_CODES.has(code)?'#79b8e8':LMIC_STATUS_CODES.has(code)?'#ef6b61':'#cbd4dc';
      drawFeature(ctx,feature,box,bounds,fill,'#ffffff',1.8);
    });
    const markerRows=[
      ...(COUNTRY_STATUS?.smallCountryMarkers||[]),
      ...(COUNTRY_STATUS?.pacificIslandCountries||[]),
      ...OUTERMOST_REGIONS.map(item=>({...item,status:'eu'})),
      ...OVERSEAS_TERRITORIES.map(item=>({...item,status:'oct'}))
    ];
    const sx=box.w/(bounds.maxX-bounds.minX),sy=box.h/(bounds.maxY-bounds.minY),scale=Math.min(sx,sy);
    const mapW=(bounds.maxX-bounds.minX)*scale,mapH=(bounds.maxY-bounds.minY)*scale;
    const ox=box.x+(box.w-mapW)/2,oy=box.y+(box.h-mapH)/2;
    const markerPoint=item=>[ox+(item.lon-bounds.minX)*scale,oy+(bounds.maxY-item.lat)*scale];
    const seenMarkers=new Set();
    markerRows.forEach(item=>{
      const code=normaliseCountryCode(item.code),key=`${code}|${item.lon}|${item.lat}`;
      if(seenMarkers.has(key))return;seenMarkers.add(key);
      const status=item.status||(
        code==='NZ'?'new-zealand':EU27_CODES.has(code)?'eu':ASSOCIATED_CODES.has(code)?'associated':
        OCT_MAP_CODES.has(code)?'oct':LMIC_STATUS_CODES.has(code)?'lmic':'other'
      );
      if(status==='other')return;
      const colour={
        'new-zealand':'#e5a63b',eu:'#397fd8',associated:'#22a99a',oct:'#79b8e8',lmic:'#ef6b61'
      }[status];
      const [x,y]=markerPoint(item);ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fillStyle=colour;ctx.fill();ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.stroke();
    });
    ctx.restore();
    return canvas.toDataURL('image/png');
  }

  function packCircles(rows,box) {
    const max=Math.max(...rows.map(row=>row.value),1),placed=[];
    rows.slice().sort((a,b)=>b.value-a.value).forEach((row,index)=>{
      const r=1.02*Math.sqrt(row.value/max),cx0=box.x+box.w/2,cy0=box.y+box.h/2;let chosen=null;
      for(let step=0;step<2200;step++){
        const angle=step*.43+index*.9,distance=.012*step,cx=cx0+Math.cos(angle)*distance,cy=cy0+Math.sin(angle)*distance;
        if(cx-r<box.x||cx+r>box.x+box.w||cy-r<box.y||cy+r>box.y+box.h)continue;
        if(placed.every(item=>Math.hypot(cx-item.cx,cy-item.cy)>=r+item.r+.04)){chosen={row,cx,cy,r};break;}
      }
      if(!chosen){const col=index%3,lineIndex=Math.floor(index/3);chosen={row,cx:box.x+(col+.5)*box.w/3,cy:box.y+(lineIndex+.5)*box.h/2,r:Math.min(r,.62)};}
      placed.push(chosen);
    });
    return placed;
  }

  function pptText(slide,text,x,y,w,h,options={}) {
    slide.addText(String(text),{x,y,w,h,fontFace:'Aptos',fontSize:options.fontSize||16,color:options.color||C.ink,bold:!!options.bold,margin:0,fit:'shrink',valign:options.valign||'mid',align:options.align||'left',breakLine:false,...options});
  }
  function pptHeader(pptx,slide,title,page) {
    slide.background={color:C.page};
    slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:13.333,h:.58,fill:{color:C.navy},line:{color:C.navy}});
    pptText(slide,'HORIZON EUROPE IN NEW ZEALAND',.48,.17,5.4,.22,{fontSize:11.5,bold:true,color:C.white});
    pptText(slide,String(page).padStart(2,'0'),12.2,.17,.6,.22,{fontSize:10,bold:true,color:C.aqua,align:'right'});
    if(title)pptText(slide,slideTitle(title),.52,.78,12.15,.58,{fontSize:30,bold:true});
  }
  function pptButton(slide,label,url,x,y,w) { slide.addText(label,{x,y,w,h:.28,fontFace:'Aptos',fontSize:8,bold:true,color:C.ink,align:'center',valign:'mid',margin:0,fill:{color:C.pale},line:{color:'BBD2E5',width:.7},hyperlink:{url},fit:'shrink'}); }
  function pptFooter(slide,data,{association=false}={}) {
    pptText(slide,association?`Source: European Commission · Country-status lists checked: ${COUNTRY_STATUS_CHECKED}`:`Source: CORDIS project records · Last update: ${data.updated}`,.48,7.12,8.8,.18,{fontSize:8.5,color:C.muted});
    pptButton(slide,'OPEN STORY',storyUrl(),10.95,7.03,1.75);
  }
  function pptMetric(pptx,slide,label,value,x,y,w,color=C.blue) {
    slide.addShape(pptx.ShapeType.roundRect,{x,y,w,h:.78,rectRadius:.06,fill:{color:C.white},line:{color:C.line,width:1}});
    slide.addShape(pptx.ShapeType.rect,{x,y,w:.07,h:.78,fill:{color},line:{color}});
    pptText(slide,label.toUpperCase(),x+.18,y+.10,w-.34,.18,{fontSize:8.2,bold:true,color:C.muted,charSpacing:.5});
    pptText(slide,value,x+.18,y+.31,w-.34,.34,{fontSize:20,bold:true});
  }

  function pptCover(pptx,slide,data,page) {
    slide.background={color:C.navyDeep};
    slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:13.333,h:.08,fill:{color:C.aqua},line:{color:C.aqua}});
    pptText(slide,'HORIZON EUROPE × AOTEAROA NEW ZEALAND',.72,.62,6.1,.3,{fontSize:12,bold:true,color:C.aqua,charSpacing:1.4});
    pptText(slide,'Association opened the door.\nCollaboration creates\nthe value.',.72,1.25,7.1,2.08,{fontSize:32,bold:true,color:C.white,breakLine:true,valign:'top'});
    pptText(slide,'Funding starts the work. Connections extend its value.',.74,3.58,5.9,.55,{fontSize:17,bold:true,color:'D9EFFF'});
    pptText(slide,'Pillar II associate country',.74,4.21,3.3,.3,{fontSize:12,bold:true,color:C.aqua});
    const image=renderNzPng();if(image)slide.addImage({data:image,x:8.0,y:.62,w:4.45,h:5.8,transparency:0});
    pptText(slide,'Aotearoa\nNew Zealand',9.05,5.7,3.3,.72,{fontSize:22,bold:true,color:C.white,align:'center'});
    pptText(slide,`Last update: ${data.updated}`,.72,6.93,3.5,.2,{fontSize:9,color:'A9BBCD'});
    pptButton(slide,'OPEN STORY',storyUrl(),10.3,6.86,1.9);
    pptText(slide,String(page).padStart(2,'0'),12.25,6.93,.45,.2,{fontSize:9,bold:true,color:C.aqua,align:'right'});
  }

  function pptPillars(pptx,slide,data,page) {
    pptHeader(pptx,slide,'Three pillars shape Horizon Europe',page);
    pptText(slide,'Pillar II is the programme’s collaborative core—and the part to which New Zealand is associated.',.55,1.35,12,.38,{fontSize:13,color:C.muted});
    const pillars=[
      {x:.62,w:2.7,color:'BCD8EF',label:'Pillar I',sub:'Excellent Science',value:programmeMoney(25e9),dark:false},
      {x:3.48,w:5.0,color:C.blue,label:'Pillar II',sub:'Global Challenges and European Industrial Competitiveness',value:programmeMoney(53.5e9),dark:true},
      {x:8.64,w:2.55,color:'B9DCCE',label:'Pillar III',sub:'Innovative Europe',value:programmeMoney(13.6e9),dark:false},
      {x:11.35,w:1.36,color:'D9E3EB',label:'Widening\nand ERA',sub:'',value:programmeMoney(3.4e9),dark:false}
    ];
    pillars.forEach(item=>{
      slide.addShape(pptx.ShapeType.roundRect,{x:item.x,y:2.05,w:item.w,h:2.7,rectRadius:.08,fill:{color:item.color},line:{color:C.white,width:1.4}});
      pptText(slide,item.label,item.x+.22,2.36,item.w-.44,.38,{fontSize:item.w<1.6?13:18,bold:true,color:item.dark?C.white:C.ink,align:'center'});
      if(item.sub)pptText(slide,item.sub,item.x+.28,2.93,item.w-.56,.7,{fontSize:item.dark?13:10.5,bold:item.dark,color:item.dark?'EAF4FC':C.muted,align:'center'});
      pptText(slide,item.value,item.x+.22,4.03,item.w-.44,.4,{fontSize:item.dark?20:item.w<1.6?11:15,bold:true,color:item.dark?C.white:C.ink,align:'center'});
    });
    slide.addShape(pptx.ShapeType.line,{x:5.98,y:4.78,w:0,h:.62,line:{color:C.blue,width:2}});
    slide.addShape(pptx.ShapeType.roundRect,{x:4.58,y:5.36,w:2.8,h:.82,rectRadius:.08,fill:{color:C.white},line:{color:C.blue,width:2}});
    pptText(slide,'NEW ZEALAND',4.82,5.49,2.32,.18,{fontSize:8.5,bold:true,color:C.blue,align:'center',charSpacing:1});
    pptText(slide,'Associated to Pillar II',4.78,5.71,2.4,.28,{fontSize:14,bold:true,color:C.ink,align:'center'});
    pptText(slide,`Original 2021–2027 allocation: ${programmeMoney(95.5e9)}`,.62,6.48,6,.3,{fontSize:11,bold:true,color:C.muted});
    pptFooter(slide,data);
  }

  function pptClusters(pptx,slide,data,page) {
    pptHeader(pptx,slide,'Six clusters organise the shared challenges',page);
    pptText(slide,'Within Pillar II, each cluster opens a different route into international research and innovation collaboration.',.55,1.35,12,.38,{fontSize:13,color:C.muted});
    const labels=['Health','Culture, creativity &\ninclusive society','Civil security\nfor society','Digital, industry\n& space','Climate, energy\n& mobility','Food, bioeconomy\n& environment'];
    D.clusters.forEach((cluster,index)=>{
      const col=index%2,row=Math.floor(index/2),x=.72+col*6.18,y=1.92+row*1.55,d=1.06;
      slide.addShape(pptx.ShapeType.ellipse,{x,y,w:d,h:d,fill:{color:C.white},line:{color:hex(cluster.color),width:6}});
      pptText(slide,String(index+1),x+.14,y+.2,d-.28,.52,{fontSize:24,bold:true,color:hex(cluster.color),align:'center'});
      pptText(slide,`CLUSTER ${index+1}`,x+1.34,y+.08,1.18,.18,{fontSize:8,bold:true,color:hex(cluster.color),charSpacing:.65});
      pptText(slide,labels[index],x+1.34,y+.31,4.42,.55,{fontSize:15,bold:true,color:C.ink,valign:'top'});
      slide.addShape(pptx.ShapeType.line,{x:x+1.34,y:y+.94,w:4.42,h:0,line:{color:'DCE7F0',width:1}});
    });
    pptFooter(slide,data);
  }

  function pptTimeline(pptx,slide,data,page) {
    pptHeader(pptx,slide,"New Zealand's path to Horizon Europe.",page);
    pptText(slide,'A relationship built over time, from formal cooperation to projects on the ground.',.55,1.34,12,.34,{fontSize:13,color:C.muted});
    const events=timeline(data),lineY=3.68,start=1.04,step=2.18;
    slide.addShape(pptx.ShapeType.line,{x:.75,y:lineY,w:11.78,h:0,line:{color:'9BC8E8',width:2.2}});
    events.forEach((event,index)=>{
      const x=start+index*step,above=index%2===0,cardY=above?1.86:4.17,dateY=above?3.18:3.79;
      slide.addShape(pptx.ShapeType.ellipse,{x:x-.08,y:lineY-.08,w:.16,h:.16,fill:{color:index===events.length-1?C.teal:C.blue},line:{color:C.white,width:1}});
      pptText(slide,event.date,x-.82,dateY,1.64,.34,{fontSize:13,bold:true,color:index===events.length-1?C.teal:C.blue,align:'center'});
      slide.addShape(pptx.ShapeType.roundRect,{x:x-.88,y:cardY,w:1.76,h:1.23,rectRadius:.05,fill:{color:C.white},line:{color:C.line,width:1}});
      pptText(slide,event.title,x-.72,cardY+.12,1.44,.34,{fontSize:10.5,bold:true,valign:'top',align:'center'});
      pptText(slide,event.body,x-.72,cardY+.47,1.44,.48,{fontSize:7.7,color:C.muted,valign:'top',align:'center'});
      pptText(slide,'OFFICIAL SOURCE',x-.67,cardY+1.02,1.34,.12,{fontSize:6.4,bold:true,color:C.blue,align:'center',hyperlink:{url:event.url}});
    });
    pptFooter(slide,data);
  }

  function pptPortfolio(pptx,slide,data,page) {
    pptHeader(pptx,slide,'Association becomes a growing portfolio.',page);
    const metrics=[['SIGNED PROJECTS',data.projects,C.blue],['NZ ORGANISATIONS',data.nzOrganisations,C.teal],['ORGANISATIONS',data.organisations,'8D67CE'],['PARTNER COUNTRIES',data.partnerCountries,'77A84B']];
    metrics.forEach((metric,index)=>pptMetric(pptx,slide,metric[0],number(metric[1]),.55+index*3.08,1.48,2.88,metric[2]));
    slide.addShape(pptx.ShapeType.roundRect,{x:.55,y:2.48,w:6.18,h:4.28,rectRadius:.08,fill:{color:C.white},line:{color:C.line,width:1}});
    pptText(slide,'Portfolio by cluster',.82,2.72,5.6,.34,{fontSize:18,bold:true});
    packCircles(data.clusters,{x:.83,y:3.18,w:5.62,h:3.2}).forEach(item=>{const d=item.r*2,cluster=clusterByCode.get(item.row.key);slide.addShape(pptx.ShapeType.ellipse,{x:item.cx-item.r,y:item.cy-item.r,w:d,h:d,fill:{color:hex(cluster?.color||C.blue)},line:{color:C.white,width:1}});pptText(slide,cluster?.short||item.row.key,item.cx-item.r+.08,item.cy-item.r+d*.25,d-.16,d*.28,{fontSize:Math.max(7,11*item.r),bold:true,color:C.white,align:'center'});pptText(slide,number(item.row.value),item.cx-item.r,item.cy-item.r+d*.56,d,d*.25,{fontSize:Math.max(10,17*item.r),bold:true,color:C.white,align:'center'});});
    slide.addShape(pptx.ShapeType.roundRect,{x:6.92,y:2.48,w:5.86,h:4.28,rectRadius:.08,fill:{color:C.white},line:{color:C.line,width:1}});
    pptText(slide,'Projects by starting year',7.2,2.72,5.3,.34,{fontSize:18,bold:true});
    if(data.years.length)slide.addChart(pptx.ChartType.bar,[{name:'Projects',labels:data.years.map(row=>row.key),values:data.years.map(row=>row.value)}],{x:7.25,y:3.18,w:5.05,h:3.05,barDir:'col',barGrouping:'clustered',chartColors:[C.blue,C.teal,'E5A63B','EC6C5F','8D67CE','77A84B'],showLegend:false,showTitle:false,showValue:true,dataLabelPosition:'outEnd',dataLabelColor:C.ink,dataLabelFontFace:'Aptos',dataLabelFontSize:12,dataLabelFontBold:true,catAxisLabelColor:C.ink,catAxisLabelFontFace:'Aptos',catAxisLabelFontSize:11,catAxisLineShow:false,catAxisMajorTickMark:'none',valAxisHidden:true,valGridLine:{style:'none'},chartArea:{fill:{color:C.white,transparency:100}},plotArea:{fill:{color:C.white,transparency:100}},layout:{x:.08,y:.05,w:.86,h:.84},lang:'en-NZ'});
    pptFooter(slide,data);
  }

  function pptAssociationMap(pptx,slide,data,page) {
    pptHeader(pptx,slide,'Horizon Europe connects Europe with partners worldwide.',page);
    slide.addShape(pptx.ShapeType.roundRect,{x:.55,y:1.48,w:9.0,h:5.3,rectRadius:.08,fill:{color:C.white},line:{color:C.line,width:1}});
    const map=renderAssociationMapPng();if(map)slide.addImage({data:map,x:.72,y:1.62,w:8.66,h:4.1});
    const legend=[
      ['EU27',C.blue],['Associated countries',C.teal],['Low- or middle-income','EF6B61'],
      ['Overseas countries and territories','79B8E8'],['New Zealand','E5A63B'],['Other countries','CBD4DC']
    ];
    legend.forEach((item,index)=>{const col=index%3,row=Math.floor(index/3),x=.92+col*2.82,y=5.91+row*.35;slide.addShape(pptx.ShapeType.rect,{x,y,w:.18,h:.18,fill:{color:item[1]},line:{color:item[1]}});pptText(slide,item[0],x+.26,y-.05,2.48,.28,{fontSize:7.8,bold:true,color:C.ink});});
    pptMetric(pptx,slide,'EU MEMBER STATES',number(EU27_CODES.size),9.82,1.48,2.96,C.blue);
    pptMetric(pptx,slide,'ASSOCIATED COUNTRIES (NZ INCLUDED)',number(ASSOCIATED_CODES.size),9.82,2.38,2.96,C.teal);
    pptMetric(pptx,slide,'LOW- AND MIDDLE-INCOME',number(LMIC_STATUS_CODES.size),9.82,3.28,2.96,'EF6B61');
    pptMetric(pptx,slide,'OVERSEAS COUNTRIES/TERRITORIES',number(OVERSEAS_TERRITORIES.length),9.82,4.18,2.96,'79B8E8');
    pptButton(slide,'ASSOCIATION LIST',associationSourceUrl,9.84,5.27,2.5);
    pptButton(slide,'ELIGIBILITY LIST',eligibilitySourceUrl,9.84,5.67,2.5);
    pptFooter(slide,data,{association:true});
  }

  async function exportPptx() {
    const Pptx=window.PptxGenJS;if(!Pptx)throw new Error('PowerPoint generator is unavailable.');
    const data=snapshot(),pptx=new Pptx();pptx.layout='LAYOUT_WIDE';pptx.author='Horizon Europe in New Zealand';pptx.company='Horizon Europe in New Zealand';pptx.subject='New Zealand association to Horizon Europe';pptx.title='Horizon Europe in New Zealand — Story';pptx.lang='en-NZ';pptx.theme={headFontFace:'Aptos Display',bodyFontFace:'Aptos',lang:'en-NZ'};
    [pptCover,pptPillars,pptClusters,pptTimeline,pptPortfolio,pptAssociationMap].forEach((draw,index)=>draw(pptx,pptx.addSlide(),data,index+1));
    await pptx.writeFile({fileName:'horizon-europe-in-new-zealand-story.pptx'});
  }

  function decodedFont(base64) { const binary=atob(base64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes; }
  function pngBytes(dataUrl) { return decodedFont(dataUrl.split(',')[1]); }

  async function exportPdf() {
    const lib=window.PDFLib;if(!lib)throw new Error('PDF generator is unavailable.');
    const {PDFDocument,StandardFonts,rgb,PDFName,PDFString}=lib,doc=await PDFDocument.create(),data=snapshot(),W=960,H=540;
    doc.setTitle('Horizon Europe in New Zealand — Story');doc.setAuthor('Horizon Europe in New Zealand');doc.setSubject('New Zealand association to Horizon Europe');
    let regular,bold;
    if(window.fontkit&&window.HE_FONT_DATA?.interRegular&&window.HE_FONT_DATA?.interBold){doc.registerFontkit(window.fontkit);regular=await doc.embedFont(decodedFont(window.HE_FONT_DATA.interRegular),{subset:true});bold=await doc.embedFont(decodedFont(window.HE_FONT_DATA.interBold),{subset:true});}
    else{regular=await doc.embedFont(StandardFonts.Helvetica);bold=await doc.embedFont(StandardFonts.HelveticaBold);}
    const col=value=>{const raw=hex(value);return rgb(parseInt(raw.slice(0,2),16)/255,parseInt(raw.slice(2,4),16)/255,parseInt(raw.slice(4,6),16)/255);};
    const y=(top,height=0)=>H-top-height;
    const rect=(page,x,top,w,h,fill,stroke=fill)=>page.drawRectangle({x,y:y(top,h),width:w,height:h,color:col(fill),borderColor:col(stroke),borderWidth:1});
    const circle=(page,cx,top,r,fill,stroke=fill)=>page.drawCircle({x:cx,y:H-top,size:r,color:col(fill),borderColor:col(stroke),borderWidth:1});
    const wrap=(font,value,size,maxWidth,maxLines=5)=>{const words=String(value).split(/\s+/),lines=[];let line='';words.forEach(word=>{const next=line?`${line} ${word}`:word;if(font.widthOfTextAtSize(next,size)<=maxWidth)line=next;else{if(line)lines.push(line);line=word;}});if(line)lines.push(line);if(lines.length>maxLines){lines.length=maxLines;let last=lines[maxLines-1];while(last&&font.widthOfTextAtSize(`${last}…`,size)>maxWidth)last=last.slice(0,-1);lines[maxLines-1]=`${last}…`;}return lines;};
    const text=(page,value,x,top,size=12,color=C.ink,font=regular,maxWidth=880,maxLines=5,align='left')=>{const lines=wrap(font,value,size,maxWidth,maxLines);lines.forEach((line,index)=>{const width=font.widthOfTextAtSize(line,size),xx=align==='center'?x+(maxWidth-width)/2:align==='right'?x+maxWidth-width:x;page.drawText(line,{x:xx,y:y(top+index*size*1.22,size),size,font,color:col(color)});});return lines.length*size*1.22;};
    const fit=(page,value,x,top,size,color,font,maxWidth,minSize=6,align='left')=>{let actual=size;while(actual>minSize&&font.widthOfTextAtSize(String(value),actual)>maxWidth)actual-=.5;return text(page,value,x,top,actual,color,font,maxWidth,1,align);};
    const addLink=(page,url,x,top,w,h)=>{const annotation=doc.context.register(doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[x,y(top,h),x+w,y(top,h)+h],Border:[0,0,0],A:{Type:'Action',S:'URI',URI:PDFString.of(url)}}));if(typeof page.node.addAnnot==='function')page.node.addAnnot(annotation);else page.node.set(PDFName.of('Annots'),doc.context.obj([annotation]));};
    const button=(page,label,url,x,top,w)=>{rect(page,x,top,w,19,C.pale,'BBD2E5');fit(page,label,x+7,top+5,7.5,C.ink,bold,w-14,6.5,'center');addLink(page,url,x,top,w,19);};
    const header=(page,title,num)=>{rect(page,0,0,W,42,C.navy);text(page,'HORIZON EUROPE IN NEW ZEALAND',36,13,9,C.white,bold,400,1);text(page,String(num).padStart(2,'0'),900,13,8,C.aqua,bold,24,1,'right');if(title)text(page,slideTitle(title),38,58,25,C.ink,bold,884,2);};
    const footer=(page,{association=false}={})=>{text(page,association?`Source: European Commission · Country-status lists checked: ${COUNTRY_STATUS_CHECKED}`:`Source: CORDIS project records · Last update: ${data.updated}`,38,518,7.5,C.muted,regular,650,1);button(page,'OPEN STORY',storyUrl(),796,507,126);};
    const metric=(page,label,value,x,top,w,color)=>{rect(page,x,top,w,56,C.white,C.line);rect(page,x,top,5,56,color);text(page,label.toUpperCase(),x+14,top+8,7,C.muted,bold,w-28,1);fit(page,value,x+14,top+25,17,C.ink,bold,w-28,11);};

    {
      const page=doc.addPage([W,H]);rect(page,0,0,W,H,C.navyDeep);rect(page,0,0,W,6,C.aqua);text(page,'HORIZON EUROPE × AOTEAROA NEW ZEALAND',52,43,10,C.aqua,bold,440,1);text(page,'Association opened the door.',52,93,30,C.white,bold,500,2);text(page,'Collaboration creates the value.',52,158,30,C.white,bold,500,2);text(page,'Funding starts the work. Connections extend its value.',52,260,14,'D9EFFF',bold,470,2);text(page,'Pillar II associate country',52,316,10,C.aqua,bold,260,1);const image=renderNzPng();if(image){const png=await doc.embedPng(pngBytes(image));page.drawImage(png,{x:590,y:68,width:305,height:410});}text(page,'Aotearoa New Zealand',620,452,16,C.white,bold,250,1,'center');text(page,`Last update: ${data.updated}`,52,505,8,'A9BBCD',regular,250,1);button(page,'OPEN STORY',storyUrl(),756,495,128);text(page,'01',900,505,8,C.aqua,bold,22,1,'right');
    }
    {
      const page=doc.addPage([W,H]);rect(page,0,0,W,H,C.page);header(page,'Three pillars shape Horizon Europe',2);text(page,'Pillar II is the programme’s collaborative core—and the part to which New Zealand is associated.',38,104,10.5,C.muted,regular,880,2);
      const pillars=[{x:45,w:195,color:'BCD8EF',label:'Pillar I',sub:'Excellent Science',value:programmeMoney(25e9),dark:false},{x:250,w:360,color:C.blue,label:'Pillar II',sub:'Global Challenges and European Industrial Competitiveness',value:programmeMoney(53.5e9),dark:true},{x:620,w:180,color:'B9DCCE',label:'Pillar III',sub:'Innovative Europe',value:programmeMoney(13.6e9),dark:false},{x:810,w:105,color:'D9E3EB',label:'Widening and ERA',sub:'',value:programmeMoney(3.4e9),dark:false}];
      pillars.forEach(item=>{rect(page,item.x,152,item.w,190,item.color,C.white);text(page,item.label,item.x+12,175,item.w<120?10:14,item.dark?C.white:C.ink,bold,item.w-24,2,'center');if(item.sub)text(page,item.sub,item.x+15,222,item.dark?11:8.5,item.dark?'EAF4FC':C.muted,item.dark?bold:regular,item.w-30,3,'center');text(page,item.value,item.x+12,300,item.dark?16:item.w<120?9:12,item.dark?C.white:C.ink,bold,item.w-24,1,'center');});
      page.drawLine({start:{x:430,y:y(342)},end:{x:430,y:y(385)},thickness:2,color:col(C.blue)});rect(page,335,385,190,55,C.white,C.blue);text(page,'NEW ZEALAND',350,395,7,C.blue,bold,160,1,'center');text(page,'Associated to Pillar II',350,414,11,C.ink,bold,160,1,'center');text(page,`Original 2021–2027 allocation: ${programmeMoney(95.5e9)}`,45,474,9,C.muted,bold,400,1);footer(page);
    }
    {
      const page=doc.addPage([W,H]);rect(page,0,0,W,H,C.page);header(page,'Six clusters organise the shared challenges',3);text(page,'Within Pillar II, each cluster opens a different route into international research and innovation collaboration.',38,104,10.5,C.muted,regular,880,2);const labels=['Health','Culture, creativity and inclusive society','Civil security for society','Digital, industry and space','Climate, energy and mobility','Food, bioeconomy and environment'];D.clusters.forEach((cluster,index)=>{const colIndex=index%2,rowIndex=Math.floor(index/2),cx=88+colIndex*455,top=170+rowIndex*112,colour=hex(cluster.color);page.drawCircle({x:cx,y:y(top),size:38,color:col(C.white),borderColor:col(colour),borderWidth:5});text(page,String(index+1),cx-24,top-15,18,colour,bold,48,1,'center');text(page,`CLUSTER ${index+1}`,cx+58,top-25,6.5,colour,bold,320,1);text(page,labels[index],cx+58,top-6,11.5,C.ink,bold,320,2);page.drawLine({start:{x:cx+58,y:y(top+33)},end:{x:cx+382,y:y(top+33)},thickness:1,color:col('DCE7F0')});});footer(page);
    }
    {
      const page=doc.addPage([W,H]);rect(page,0,0,W,H,C.page);header(page,"New Zealand's path to Horizon Europe.",4);text(page,'A relationship built over time, from formal cooperation to projects on the ground.',38,104,10.5,C.muted,regular,880,1);const events=timeline(data),lineTop=278;page.drawLine({start:{x:54,y:y(lineTop)},end:{x:906,y:y(lineTop)},thickness:2,color:col('9BC8E8')});events.forEach((event,index)=>{const cx=74+index*162,above=index%2===0,cardTop=above?143:314,dateTop=above?244:286;circle(page,cx,lineTop,6,index===events.length-1?C.teal:C.blue,C.white);rect(page,cx-66,cardTop,132,91,C.white,C.line);text(page,event.title,cx-57,cardTop+8,8.2,C.ink,bold,114,2,'center');text(page,event.body,cx-57,cardTop+33,6.2,C.muted,regular,114,4,'center');text(page,'OFFICIAL SOURCE',cx-50,cardTop+75,5.4,C.blue,bold,100,1,'center');addLink(page,event.url,cx-50,cardTop+72,100,14);text(page,event.date,cx-66,dateTop,9,index===events.length-1?C.teal:C.blue,bold,132,2,'center');});footer(page);
    }
    {
      const page=doc.addPage([W,H]);rect(page,0,0,W,H,C.page);header(page,'Association becomes a growing portfolio.',5);const metrics=[['SIGNED PROJECTS',data.projects,C.blue],['NZ ORGANISATIONS',data.nzOrganisations,C.teal],['ORGANISATIONS',data.organisations,'8D67CE'],['PARTNER COUNTRIES',data.partnerCountries,'77A84B']];metrics.forEach((item,index)=>metric(page,item[0],number(item[1]),38+index*222,104,207,item[2]));rect(page,38,174,438,314,C.white,C.line);text(page,'Portfolio by cluster',56,190,14,C.ink,bold,400,1);packCircles(data.clusters,{x:1.0,y:3.05,w:5.1,h:3.2}).forEach(item=>{const scale=72,cx=38+(item.cx-.55)*scale,top=174+(item.cy-2.48)*scale,r=item.r*scale*.83,cluster=clusterByCode.get(item.row.key);circle(page,cx,top,r,hex(cluster?.color||C.blue),C.white);text(page,cluster?.short||item.row.key,cx-r*.78,top-r*.27,Math.max(5.8,7.8*item.r),C.white,bold,r*1.56,3,'center');text(page,number(item.row.value),cx-r*.45,top+r*.2,Math.max(7,11*item.r),C.white,bold,r*.9,1,'center');});rect(page,490,174,432,314,C.white,C.line);text(page,'Projects by starting year',508,190,14,C.ink,bold,390,1);if(data.years.length){const max=Math.max(...data.years.map(row=>row.value),1),plot={x:530,top:235,w:350,h:190},slot=plot.w/data.years.length;data.years.forEach((row,index)=>{const h=plot.h*row.value/max,w=Math.min(48,slot*.58),x=plot.x+index*slot+(slot-w)/2,top=plot.top+plot.h-h;rect(page,x,top,w,h,[C.blue,C.teal,'E5A63B','EC6C5F'][index%4]);text(page,number(row.value),x-8,Math.max(216,top-14),8,C.ink,bold,w+16,1,'center');text(page,row.key,plot.x+index*slot,plot.top+plot.h+14,8,C.ink,regular,slot,1,'center');});}footer(page);
    }
    {
      const page=doc.addPage([W,H]);rect(page,0,0,W,H,C.page);header(page,'Horizon Europe connects Europe with partners worldwide.',6);rect(page,38,104,650,384,C.white,C.line);const image=renderAssociationMapPng();if(image){const png=await doc.embedPng(pngBytes(image));page.drawImage(png,{x:50,y:y(116,294),width:626,height:294});}const legend=[['EU27',C.blue],['Associated countries',C.teal],['Low- or middle-income','EF6B61'],['Overseas countries and territories','79B8E8'],['New Zealand','E5A63B'],['Other countries','CBD4DC']];legend.forEach((item,index)=>{const colIndex=index%3,rowIndex=Math.floor(index/3),x=58+colIndex*205,top=420+rowIndex*24;rect(page,x,top,11,11,item[1]);text(page,item[0],x+17,top,6.6,C.ink,bold,178,1);});metric(page,'EU MEMBER STATES',number(EU27_CODES.size),705,104,217,C.blue);metric(page,'ASSOCIATED COUNTRIES (NZ INCLUDED)',number(ASSOCIATED_CODES.size),705,172,217,C.teal);metric(page,'LOW- AND MIDDLE-INCOME',number(LMIC_STATUS_CODES.size),705,240,217,'EF6B61');metric(page,'OVERSEAS COUNTRIES/TERRITORIES',number(OVERSEAS_TERRITORIES.length),705,308,217,'79B8E8');button(page,'ASSOCIATION LIST',associationSourceUrl,707,392,165);button(page,'ELIGIBILITY LIST',eligibilitySourceUrl,707,421,165);footer(page,{association:true});
    }
    const bytes=await doc.save(),blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='horizon-europe-in-new-zealand-story.pdf';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  window.HE_STORY_EXPORT_API={exportPptx,exportPdf,snapshot};
  const menu=document.querySelector('[data-story-download]'),status=document.querySelector('[data-story-export-status]');if(!menu)return;
  const close=()=>menu.removeAttribute('open');
  document.addEventListener('click',event=>{if(menu.open&&!menu.contains(event.target))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){close();menu.querySelector('summary')?.focus();}});
  menu.querySelectorAll('[data-story-export]').forEach(button=>button.addEventListener('click',async()=>{const format=button.dataset.storyExport,buttons=[...menu.querySelectorAll('[data-story-export]')];buttons.forEach(item=>item.disabled=true);status.textContent=`Preparing ${format==='pptx'?'PowerPoint':'PDF'}…`;try{format==='pptx'?await exportPptx():await exportPdf();status.textContent='Download ready.';setTimeout(close,450);}catch(error){console.error(error);status.textContent='The export could not be created in this browser.';}finally{buttons.forEach(item=>item.disabled=false);}}));
})();
