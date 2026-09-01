(() => {
  const D=window.HE_DATA,HE=window.HE;
  if(!D||!HE)return;
  const navy='16395F',ink='123357',muted='68798D',white='FFFFFF',canvas='F5F8FC',line='D8E4EF',pale='EAF2F9',aqua='8AC8F5';
  const projectExplorerFallback='https://manuelstocco.github.io/horizon-europe-in-new-zealand/projects.html';
  const exportFont='Inter';
  const metricColours=['397FD8','22A99A','8D67CE','77A84B'];
  const yearColours=['397FD8','22A99A','E5A63B','EC6C5F','8D67CE','77A84B'];
  const resultRecords=new Map((window.HE_PROJECT_RESULTS?.projects||[]).map(record=>[String(record.projectId),record]));
  const projectStageLabel=project=>({signed:'Signed',ongoing:'Ongoing',outputs:'Outputs available',completed:'Completed'}[resultRecords.get(String(project.id))?.stage]||project.status||'Status not reported');
  const hex=value=>String(value||'').replace('#','').toUpperCase();
  const number=value=>new Intl.NumberFormat('en-NZ',{maximumFractionDigits:0}).format(Number(value||0));
  const money=value=>Number(value)>0?HE.fmtMoney(value):'Not reported';
  const countryName=code=>D.countries.find(country=>country.code===code)?.name||({EL:'Greece',UK:'United Kingdom'}[code]||code);
  const clusterName=code=>D.clusters.find(cluster=>cluster.code===code)?.short||code;
  const schemeName=code=>D.projects.find(project=>project.schemeCode===code)?.scheme||code;
  const schemeDisplayName=code=>({
    'HORIZON-RIA':'Research & Innovation Actions',
    'HORIZON-IA':'Innovation Actions',
    'HORIZON-COFUND':'Programme Co-fund Actions',
    'HORIZON-JU-RIA':'Joint Undertaking R&I Actions',
    'HORIZON-CSA':'Coordination & Support Actions'
  }[code]||schemeName(code));
  const roleName=role=>({coordinator:'Coordinator',participant:'Participant',thirdParty:'Third party',associatedPartner:'Associated partner'}[role]||String(role||'Participant').replace(/([A-Z])/g,' $1').replace(/^./,char=>char.toUpperCase()));
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  const truncate=(value,max=520)=>{const text=clean(value);if(text.length<=max)return text;const cut=text.slice(0,max-1),last=cut.lastIndexOf(' ');return `${cut.slice(0,last>max*.72?last:max-1).trim()}…`;};
  const normaliseProjectTitle=(value,acronym='')=>{
    const text=clean(value);if(!text)return text;
    const prefix=acronym&&text.toUpperCase().startsWith(`${String(acronym).toUpperCase()}:`)?text.slice(0,String(acronym).length+1):'';
    const body=prefix?text.slice(prefix.length).trim():text;
    const letters=[...body].filter(char=>/[A-Za-z]/.test(char));
    const upper=letters.filter(char=>char===char.toUpperCase()).length;
    if(!letters.length||upper/letters.length<.72)return body;
    let revised=body.toLocaleLowerCase('en-NZ').replace(/(^|[.!?]\s+|:\s+)([a-z])/g,(match,start,char)=>`${start}${char.toUpperCase()}`);
    const protectedTerms=new Map([
      ['eu','EU'],['nz','NZ'],['ai','AI'],['genai','GenAI'],['ict','ICT'],['sme','SME'],['co2','CO2'],['dna','DNA'],['rna','RNA'],['r&i','R&I'],['covid-19','COVID-19']
    ]);
    protectedTerms.forEach((replacement,term)=>{revised=revised.replace(new RegExp(`\\b${term.replace(/[&-]/g,'\\$&')}\\b`,'gi'),replacement);});
    return revised;
  };
  const safeName=value=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'export';
  const projectExplorerUrl=()=>typeof location!=='undefined'&&/^https?:$/.test(location.protocol)?location.href.split(/[?#]/)[0]:projectExplorerFallback;
  const cordisUrl=project=>`https://cordis.europa.eu/project/id/${encodeURIComponent(project.id)}`;
  const currentState=()=>window.HE_PROJECT_EXPORT_STATE||{projects:D.projects,selectedProject:D.projects[0]||null,filters:{countries:[],clusters:[],schemes:[]},search:'',updated:HE.formatDate(D.metadata.projectDataUpdated)};
  const unique=(rows,key)=>{const seen=new Set();return rows.filter(row=>{const value=key(row);if(seen.has(value))return false;seen.add(value);return true;});};
  const group=(projects,values)=>{
    const counts=new Map();
    projects.forEach(project=>[...new Set(values(project).filter(Boolean))].forEach(value=>counts.set(value,(counts.get(value)||0)+1)));
    return [...counts].map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value||String(a.key).localeCompare(String(b.key)));
  };
  const scopeLabel=state=>{
    const filters=state.filters||{},parts=[];
    if(filters.clusters?.length)parts.push(`${filters.clusters.length===1?'Cluster':'Clusters'}: ${filters.clusters.map(clusterName).join(', ')}`);
    if(filters.countries?.length)parts.push(`${filters.countries.length===1?'Partner country':'Partner countries'}: ${filters.countries.map(countryName).join(', ')}`);
    if(filters.schemes?.length)parts.push(`${filters.schemes.length===1?'Funding scheme':'Funding schemes'}: ${filters.schemes.map(schemeDisplayName).join(', ')}`);
    if(state.search?.trim())parts.push(`Search: ${state.search.trim()}`);
    return parts.length?parts.join('  ·  '):'Full signed portfolio';
  };
  const projectCountries=project=>project.countryParticipation||[...new Set(project.organisations.map(org=>org.countryCode))].map(code=>({code,organisations:project.organisations.filter(org=>org.countryCode===code).length}));
  const orgKey=org=>`${org.countryCode}|${org.id||org.name}`;
  const organisationMeta=org=>[roleName(org.role),org.city||'Head-office city not reported',Number(org.contribution)>0?`${HE.fmtMoney(org.contribution)} recorded allocation`:'No allocation reported'].join(' · ');

  function summaryData(projects,state){
    const allOrgs=new Set(),nzOrgs=new Set(),partnerCountries=new Set();let projectValue=0,nzFunding=0;
    projects.forEach(project=>{
      projectValue+=Number(project.ecContribution||0);
      project.organisations.forEach(org=>{allOrgs.add(orgKey(org));if(org.countryCode==='NZ'){nzOrgs.add(orgKey(org));nzFunding+=Number(org.contribution||0);}else partnerCountries.add(org.countryCode);});
    });
    const filters=state.filters||{};
    const countryValues=filters.countries?.length
      ? project=>(project.countryCodes||[]).filter(code=>filters.countries.includes(code))
      : project=>(project.countryCodes||[]).filter(code=>code!=='NZ');
    const candidates=[
      {id:'clusters',title:'Cluster mix',rows:group(projects,project=>[project.clusterCode]),label:row=>clusterName(row.key),color:row=>hex(HE.clusterColor(row.key)),orientation:'bar',maxRows:6},
      {id:'countries',title:filters.countries?.length?'Selected partner countries':'Partner-country connections',rows:group(projects,countryValues),label:row=>countryName(row.key),color:row=>hex(HE.countryColor(row.key)),orientation:'bar',maxRows:10},
      {id:'schemes',title:'Funding schemes',rows:group(projects,project=>[project.schemeCode]),label:row=>schemeDisplayName(row.key),color:row=>hex(HE.schemeColor(row.key)),orientation:'bar',maxRows:7},
      {id:'years',title:'Projects by starting year',rows:group(projects,project=>[project.start?.slice(0,4)]).sort((a,b)=>String(a.key).localeCompare(String(b.key))),label:row=>row.key,color:(row,index)=>yearColours[index%yearColours.length],orientation:'column',maxRows:8}
    ];
    const charts=candidates.filter(chart=>chart.rows.length>1).slice(0,2);
    return {
      projects,charts,metrics:[
        ['Projects',number(projects.length),'Distinct signed projects'],
        ['Project value',money(projectValue),'Maximum EU contribution'],
        ['Allocated to NZ',money(nzFunding),'Recorded NZ allocation'],
        ['NZ organisations',number(nzOrgs.size),'Distinct New Zealand organisations']
      ],
      projectNames:projects.map(project=>project.acronym),partnerCountries:partnerCountries.size,organisationCount:allOrgs.size,
      accentColours:D.clusters.filter(cluster=>projects.some(project=>project.clusterCode===cluster.code)).map(cluster=>hex(cluster.color))
    };
  }

  function projectData(project,state){
    const coordinator=project.coordinator||project.organisations.find(org=>org.coordinator)||null;
    const nz=unique(project.organisations.filter(org=>org.countryCode==='NZ'&&orgKey(org)!==orgKey(coordinator||{})),orgKey);
    const selectedCodes=(state.filters?.countries||[]).filter(code=>code!=='NZ');
    const selected=unique(project.organisations.filter(org=>selectedCodes.includes(org.countryCode)&&orgKey(org)!==orgKey(coordinator||{})&&org.countryCode!=='NZ'),orgKey)
      .sort((a,b)=>countryName(a.countryCode).localeCompare(countryName(b.countryCode))||(a.short||a.name).localeCompare(b.short||b.name));
    const previewCapacity=Math.max(0,3-nz.length);
    const preview=selected.slice(0,previewCapacity),remaining=selected.slice(previewCapacity);
    const remainingByCountry=new Map();
    remaining.forEach(org=>{if(!remainingByCountry.has(org.countryCode))remainingByCountry.set(org.countryCode,[]);remainingByCountry.get(org.countryCode).push(org);});
    const nzFunding=project.organisations.filter(org=>org.countryCode==='NZ').reduce((sum,org)=>sum+Number(org.contribution||0),0);
    return {project,coordinator,nz,selected,preview,remainingByCountry,nzFunding,countries:projectCountries(project)};
  }

  function projectTitle(projects,state){
    const filters=state.filters||{},country=filters.countries?.length===1?countryName(filters.countries[0]):'',cluster=filters.clusters?.length===1?clusterName(filters.clusters[0]):'',scheme=filters.schemes?.length===1?schemeDisplayName(filters.schemes[0]):'';
    if(country&&cluster)return `${country} collaboration in ${cluster}`;
    if(country&&scheme)return `${country} collaboration through ${scheme}`;
    if(cluster&&scheme)return `${cluster}: ${scheme}`;
    if(country)return `${country} collaboration across ${number(projects.length)} projects`;
    if(cluster)return `${cluster} connects ${number(projects.length)} projects`;
    if(scheme)return `${scheme} across ${number(projects.length)} projects`;
    return `${number(projects.length)} projects connect New Zealand internationally`;
  }

  function buildPlan(scope='filtered',source=currentState()){
    const projects=scope==='current'?(source.selectedProject?[source.selectedProject]:[]):[...(source.projects||[])];
    const slides=[];
    if(projects.length>1)slides.push({type:'summary',data:summaryData(projects,source),title:projectTitle(projects,source)});
    projects.forEach(project=>{
      const data=projectData(project,source);slides.push({type:'project',data});
      data.remainingByCountry.forEach((orgs,code)=>{for(let index=0;index<orgs.length;index+=18)slides.push({type:'organisations',project,countryCode:code,organisations:orgs.slice(index,index+18),part:Math.floor(index/18)+1,total:Math.ceil(orgs.length/18)});});
    });
    return {scope,state:source,projects,slides,updated:source.updated||HE.formatDate(D.metadata.projectDataUpdated),label:scopeLabel(source)};
  }

  function pptText(slide,value,x,y,w,h,options={}){
    slide.addText(String(value??''),{x,y,w,h,fontFace:exportFont,fontSize:options.fontSize||16,color:options.color||ink,bold:!!options.bold,margin:0,fit:'shrink',valign:options.valign||'mid',align:options.align||'left',breakLine:false,...options});
  }
  function pptAccentLine(pptx,slide,accent){
    const colours=(Array.isArray(accent)?accent:[accent]).filter(Boolean);
    const active=colours.length?colours:[aqua],segment=13.333/active.length;
    active.forEach((colour,index)=>slide.addShape(pptx.ShapeType.rect,{x:index*segment,y:.66,w:index===active.length-1?13.333-index*segment:segment,h:.07,fill:{color:colour},line:{color:colour}}));
  }
  function pptHeader(pptx,slide,title,subtitle,page,accent){
    slide.background={color:canvas};
    slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:13.333,h:.66,fill:{color:navy},line:{color:navy}});
    pptAccentLine(pptx,slide,accent);
    pptText(slide,'HORIZON EUROPE IN NEW ZEALAND',.55,.18,5.9,.26,{fontSize:13,bold:true,color:white});
    pptText(slide,String(page).padStart(2,'0'),12.25,.18,.5,.24,{fontSize:11,bold:true,color:aqua,align:'right'});
    const safeTitle=truncate(title,78),titleSize=safeTitle.length>62?25:safeTitle.length>48?28:safeTitle.length>36?31:35;
    pptText(slide,safeTitle,.55,.9,12.15,.4,{fontSize:titleSize,bold:true,color:ink,fit:'shrink'});
    if(subtitle){const safeSubtitle=truncate(subtitle,118),subtitleSize=safeSubtitle.length>94?11.5:safeSubtitle.length>72?12.5:14;pptText(slide,safeSubtitle,.55,1.38,12.15,.25,{fontSize:subtitleSize,color:muted,fit:'shrink'});}
  }
  function pptButton(pptx,slide,label,url,x,y,w){
    slide.addText(label,{x,y,w,h:.29,fontFace:exportFont,fontSize:8.5,bold:true,color:ink,align:'center',valign:'mid',margin:0,fill:{color:pale},line:{color:'BBD2E5',width:.8},rectRadius:.04,hyperlink:{url},fit:'shrink'});
  }
  function pptFooter(pptx,slide,plan,project,{site=false,cordis=false}={}){
    pptText(slide,`Source: CORDIS project records · Last update: ${plan.updated}`,.55,7.12,5.95,.18,{fontSize:9.2,color:muted});
    if(project)pptText(slide,`Grant ${project.id}`,6.6,7.12,1.75,.18,{fontSize:9.2,bold:true,color:muted,align:'right'});
    if(site&&cordis){pptButton(pptx,slide,'OPEN PROJECT EXPLORER',projectExplorerUrl(),8.55,7.02,2.03);pptButton(pptx,slide,'VIEW ON CORDIS',cordisUrl(project),10.72,7.02,2.06);}
    else if(site)pptButton(pptx,slide,'OPEN PROJECT EXPLORER',projectExplorerUrl(),10.42,7.02,2.36);
    else if(cordis)pptButton(pptx,slide,'VIEW ON CORDIS',cordisUrl(project),10.72,7.02,2.06);
  }
  function addNotes(slide,project){
    const source=project?cordisUrl(project):'https://cordis.europa.eu/';
    slide.addNotes(`[Sources]\n- CORDIS project records: ${source}\n- Project Explorer: ${projectExplorerUrl()}`);
  }
  function pptPanel(pptx,slide,x,y,w,h,title){
    slide.addShape(pptx.ShapeType.roundRect,{x,y,w,h,rectRadius:.08,fill:{color:white},line:{color:line,width:1}});
    pptText(slide,title,x+.24,y+.16,w-.48,.3,{fontSize:18,bold:true,color:ink});
  }
  function pptMetric(pptx,slide,metric,index,x,y,w,h){
    const colour=metricColours[index%metricColours.length];
    slide.addShape(pptx.ShapeType.roundRect,{x,y,w,h,rectRadius:.06,fill:{color:white},line:{color:line,width:1}});
    slide.addShape(pptx.ShapeType.rect,{x,y,w:.07,h,fill:{color:colour},line:{color:colour}});
    pptText(slide,metric[0].toUpperCase(),x+.2,y+.11,w-.35,.18,{fontSize:9.5,bold:true,color:muted,charSpacing:.5});
    pptText(slide,metric[1],x+.2,y+.31,w-.35,.31,{fontSize:20,bold:true,color:ink});
    pptText(slide,metric[2],x+.2,y+.65,w-.35,.17,{fontSize:10.5,color:muted});
  }
  function pptChart(pptx,slide,chart,x,y,w,h){
    const rows=chart.rows.slice(0,chart.maxRows||10),column=chart.orientation==='column';
    if(!rows.length)return;
    slide.addChart(pptx.ChartType.bar,[{name:chart.title,labels:rows.map(chart.label),values:rows.map(row=>Number(row.value||0))}],{
      x,y,w,h,objectName:`Editable chart - ${chart.title}`,altText:`${chart.title}. Values can be edited with PowerPoint's Edit Data command.`,
      barDir:column?'col':'bar',barGrouping:'clustered',barGapWidthPct:column?55:64,chartColors:rows.map(chart.color),showLegend:false,showTitle:false,showValue:true,showLabel:false,dataLabelPosition:'outEnd',dataLabelColor:ink,dataLabelFontFace:exportFont,dataLabelFontSize:12,dataLabelFontBold:true,dataLabelFormatCode:'0',catAxisOrientation:column?'minMax':'maxMin',catAxisLabelColor:ink,catAxisLabelFontFace:exportFont,catAxisLabelFontSize:column?12:11,catAxisLineShow:false,catAxisMajorTickMark:'none',catAxisMinorTickMark:'none',catGridLine:{style:'none'},valAxisHidden:true,valAxisLabelPos:'none',valAxisLineShow:false,valAxisMajorTickMark:'none',valAxisMinorTickMark:'none',valAxisMinVal:0,valGridLine:{style:'none'},chartArea:{fill:{color:white,transparency:100}},plotArea:{fill:{color:white,transparency:100}},layout:column?{x:.08,y:.04,w:.87,h:.84}:{x:.31,y:.03,w:.64,h:.91},lang:'en-NZ'
    });
  }
  function pptSummary(pptx,slide,item,plan,page){
    const {data}=item;pptHeader(pptx,slide,item.title,plan.label,page,data.accentColours);
    const gap=.13,w=(12.23-gap*3)/4;data.metrics.forEach((metric,index)=>pptMetric(pptx,slide,metric,index,.55+index*(w+gap),1.88,w,.92));
    if(data.charts.length){
      const count=data.charts.length,chartW=count===1?12.23:5.98,xs=count===1?[.55]:[.55,6.8];
      data.charts.forEach((chart,index)=>{pptPanel(pptx,slide,xs[index],3.02,chartW,3.8,chart.title);pptChart(pptx,slide,chart,xs[index]+.22,3.55,chartW-.44,2.95);});
    }else{
      pptPanel(pptx,slide,.55,3.02,12.23,3.8,'Projects in the selected scope');
      const names=data.projectNames.slice(0,16),columns=names.length>8?2:1,perColumn=Math.ceil(names.length/columns);
      names.forEach((name,index)=>{const column=Math.floor(index/perColumn),row=index%perColumn;pptText(slide,`${String(index+1).padStart(2,'0')}  ${name}`,.88+column*5.9,3.65+row*.36,5.35,.25,{fontSize:15,bold:true,color:ink});});
    }
    pptFooter(pptx,slide,plan,null,{site:page===1});addNotes(slide);
  }
  function pptOrgRow(slide,org,x,y,w,compact=false){
    const label=truncate(org.short||org.name,compact?50:58),size=label.length>(compact?38:46)?(compact?10.5:10.8):(compact?12.5:15);
    pptText(slide,label,x,y,w,.21,{fontSize:size,bold:true,color:ink});
    pptText(slide,organisationMeta(org),x,y+.22,w,.19,{fontSize:compact?9.5:11.5,color:muted});
  }
  function pptProject(pptx,slide,item,plan,page){
    const d=item.data,p=d.project,accent=hex(HE.clusterColor(p.clusterCode)),nzAll=d.nz,coordinatorNz=d.coordinator?.countryCode==='NZ',footprintInRight=!d.preview.length&&nzAll.length<=2;
    pptHeader(pptx,slide,p.acronym,truncate(normaliseProjectTitle(p.title,p.acronym),118),page,accent);
    pptText(slide,`${clusterName(p.clusterCode)}  ·  ${schemeDisplayName(p.schemeCode)}  ·  ${projectStageLabel(p)}`,.55,1.7,12.2,.22,{fontSize:12.3,bold:true,color:accent,fit:'shrink'});
    const metrics=[['Maximum EU contribution',money(p.ecContribution)],['Timeline',p.duration?`${number(p.duration)} months`:'Not reported'],['Consortium',`${number(p.organisationCount||p.organisations.length)} organisations`],['NZ participation',money(d.nzFunding)]];
    const gap=.12,w=(12.23-gap*3)/4;metrics.forEach((metric,index)=>{
      const x=.55+index*(w+gap);slide.addShape(pptx.ShapeType.roundRect,{x,y:2.02,w,h:.72,rectRadius:.05,fill:{color:white},line:{color:line}});pptText(slide,metric[0].toUpperCase(),x+.16,2.11,w-.32,.16,{fontSize:9.2,bold:true,color:muted,charSpacing:.35});pptText(slide,metric[1],x+.16,2.32,w-.32,.26,{fontSize:18,bold:true,color:ink});
    });
    pptPanel(pptx,slide,.55,2.92,7.25,3.93,'Project focus');
    pptText(slide,truncate(p.focus||p.teaser||'No project objective is available in the source record.',300),.82,3.45,6.7,1.35,{fontSize:15.5,color:'354B5E',valign:'top',breakLine:true,fit:'shrink'});
    pptText(slide,'PROGRAMME CONTEXT',.82,5.04,2.2,.2,{fontSize:11,bold:true,color:accent,charSpacing:.55});
    pptText(slide,`Call  ${p.callCode||'Not reported'}`,.82,5.32,6.65,.2,{fontSize:12.5,color:ink,fit:'shrink'});
    pptText(slide,`Topic  ${truncate(p.topic||p.topicCode||'Not reported',120)}`,.82,5.58,6.65,.43,{fontSize:12.1,color:ink,breakLine:true,valign:'top',fit:'shrink'});
    pptText(slide,`Dates  ${HE.formatDate(p.start)} – ${HE.formatDate(p.end)}`,.82,6.08,6.65,.2,{fontSize:12.5,color:ink,fit:'shrink'});
    const footprint=d.countries.slice().sort((a,b)=>b.organisations-a.organisations).slice(0,10).map(row=>`${countryName(row.code)} ${row.organisations}`).join('  ·  ');
    if(!footprintInRight)pptText(slide,`Consortium footprint  ${footprint}`,.82,6.42,6.65,.18,{fontSize:9.8,color:muted,fit:'shrink'});
    pptPanel(pptx,slide,8.02,2.92,4.76,3.93,'Key organisations');
    let y=3.45;
    pptText(slide,'COORDINATOR',8.28,y,4.2,.18,{fontSize:10.5,bold:true,color:accent,charSpacing:.55});y+=.25;
    if(d.coordinator){pptOrgRow(slide,d.coordinator,8.28,y,4.2,true);y+=.55;}else{pptText(slide,'Not reported',8.28,y,4.2,.22,{fontSize:13,color:muted});y+=.4;}
    if(nzAll.length||!coordinatorNz){pptText(slide,'NEW ZEALAND ORGANISATIONS',8.28,y,4.2,.18,{fontSize:10.5,bold:true,color:accent,charSpacing:.45});y+=.25;nzAll.forEach(org=>{pptOrgRow(slide,org,8.28,y,4.2,true);y+=.5;});if(!nzAll.length){pptText(slide,'No New Zealand organisation reported.',8.28,y,4.2,.22,{fontSize:12.5,color:muted});y+=.38;}}
    if(d.preview.length){
      const names=[...new Set(d.preview.map(org=>countryName(org.countryCode)))].join(', ');pptText(slide,`${names.toUpperCase()} ORGANISATIONS`,8.28,y,4.2,.18,{fontSize:10.5,bold:true,color:accent,charSpacing:.42});y+=.25;
      d.preview.forEach(org=>{pptOrgRow(slide,org,8.28,y,4.2,true);y+=.5;});
    }
    if(footprintInRight){pptText(slide,'CONSORTIUM FOOTPRINT',8.28,y,4.2,.18,{fontSize:10.5,bold:true,color:accent,charSpacing:.45});y+=.25;pptText(slide,`${number(p.organisationCount||p.organisations.length)} organisations across ${number(p.countryCount||d.countries.length)} countries`,8.28,y,4.15,.24,{fontSize:14,bold:true,color:ink});pptText(slide,truncate(footprint,125),8.28,y+.28,4.15,.48,{fontSize:10.5,color:muted,valign:'top'});}
    pptFooter(pptx,slide,plan,p,{site:page===1,cordis:true});addNotes(slide,p);
  }
  function pptOrganisations(pptx,slide,item,plan,page){
    const p=item.project,accent=hex(HE.clusterColor(p.clusterCode)),suffix=item.total>1?` · ${item.part} of ${item.total}`:'',small=item.organisations.length<=7;
    pptHeader(pptx,slide,`${p.acronym} — ${countryName(item.countryCode)} organisations`,`Grant ${p.id} · Recorded roles and allocations${suffix}`,page,accent);
    if(small){
      const total=item.organisations.reduce((sum,org)=>sum+Number(org.contribution||0),0),roles=[...new Set(item.organisations.map(org=>roleName(org.role)))].join(', ');
      slide.addShape(pptx.ShapeType.roundRect,{x:.55,y:2.02,w:3.15,h:4.45,rectRadius:.08,fill:{color:white},line:{color:line}});
      pptText(slide,number(item.organisations.length),.82,2.42,2.6,.72,{fontSize:48,bold:true,color:accent});pptText(slide,`${countryName(item.countryCode)} ${item.organisations.length===1?'organisation':'organisations'} in this project`,.82,3.18,2.55,.58,{fontSize:18,bold:true,color:ink,valign:'top'});
      pptText(slide,'RECORDED ALLOCATION',.82,4.1,2.45,.18,{fontSize:10.5,bold:true,color:muted,charSpacing:.45});pptText(slide,money(total),.82,4.36,2.55,.38,{fontSize:24,bold:true,color:ink});
      pptText(slide,'ROLES',.82,5.05,2.45,.18,{fontSize:10.5,bold:true,color:muted,charSpacing:.45});pptText(slide,roles,.82,5.3,2.5,.55,{fontSize:15,color:ink,valign:'top'});
      const start=2.18+Math.max(0,(3.85-item.organisations.length*.61)/2);
      item.organisations.forEach((org,index)=>{const x=4.05,y=start+index*.61;slide.addShape(pptx.ShapeType.line,{x,y:y+.5,w:8.05,h:0,line:{color:line,width:1}});pptOrgRow(slide,org,x,y,7.95,false);});
    }else{
      const perColumn=9,rowH=.51;
      item.organisations.forEach((org,index)=>{const column=Math.floor(index/perColumn),row=index%perColumn,x=.65+column*6.15,y=2.02+row*rowH;slide.addShape(pptx.ShapeType.line,{x,y:y+.48,w:5.75,h:0,line:{color:line,width:1}});pptOrgRow(slide,org,x,y,5.6,false);});
    }
    pptFooter(pptx,slide,plan,p,{site:page===1,cordis:true});addNotes(slide,p);
  }
  function createPptx(plan){
    const Pptx=window.PptxGenJS;if(!Pptx)throw new Error('PowerPoint generator is unavailable.');
    const pptx=new Pptx();pptx.layout='LAYOUT_WIDE';pptx.author='Horizon Europe in New Zealand';pptx.company='Horizon Europe in New Zealand';pptx.subject=plan.label;pptx.title=plan.projects.length===1?`${plan.projects[0].acronym} project focus`:'Horizon Europe in New Zealand project selection';pptx.lang='en-NZ';pptx.theme={headFontFace:exportFont,bodyFontFace:exportFont,lang:'en-NZ'};
    plan.slides.forEach((item,index)=>{const slide=pptx.addSlide();if(item.type==='summary')pptSummary(pptx,slide,item,plan,index+1);else if(item.type==='project')pptProject(pptx,slide,item,plan,index+1);else pptOrganisations(pptx,slide,item,plan,index+1);});
    return pptx;
  }
  const fileBase=plan=>plan.projects.length===1?`horizon-europe-${safeName(plan.projects[0].acronym)}-project-focus`:`horizon-europe-nz-${number(plan.projects.length).replace(/\D/g,'')}-project-selection`;
  async function exportPptx(scope='filtered',state=currentState(),fileName){const plan=buildPlan(scope,state),pptx=createPptx(plan);await pptx.writeFile({fileName:fileName||`${fileBase(plan)}.pptx`});return plan;}

  function pdfTop(H,top,height=0){return H-top-height;}
  function decodedFont(value){
    const binary=atob(value),bytes=new Uint8Array(binary.length);for(let index=0;index<binary.length;index+=1)bytes[index]=binary.charCodeAt(index);return bytes;
  }
  async function createPdfBytes(plan){
    const lib=window.PDFLib;if(!lib)throw new Error('PDF generator is unavailable.');
    const {PDFDocument,StandardFonts,rgb,PDFName,PDFString}=lib,doc=await PDFDocument.create();
    let regular,bold;
    if(window.fontkit&&window.HE_FONT_DATA?.interRegular&&window.HE_FONT_DATA?.interBold){doc.registerFontkit(window.fontkit);regular=await doc.embedFont(decodedFont(window.HE_FONT_DATA.interRegular),{subset:true});bold=await doc.embedFont(decodedFont(window.HE_FONT_DATA.interBold),{subset:true});}
    else{regular=await doc.embedFont(StandardFonts.Helvetica);bold=await doc.embedFont(StandardFonts.HelveticaBold);}
    const W=960,H=540;
    doc.setTitle(plan.projects.length===1?`${plan.projects[0].acronym} project focus`:'Horizon Europe in New Zealand project selection');doc.setAuthor('Horizon Europe in New Zealand');doc.setSubject(plan.label);
    const colour=value=>{const raw=hex(value);return rgb(parseInt(raw.slice(0,2),16)/255,parseInt(raw.slice(2,4),16)/255,parseInt(raw.slice(4,6),16)/255);};
    const rect=(page,x,top,w,h,fill,stroke=fill)=>page.drawRectangle({x,y:pdfTop(H,top,h),width:w,height:h,color:colour(fill),borderColor:colour(stroke),borderWidth:1});
    const text=(page,value,x,top,size=12,color=ink,font=regular,maxWidth,lineHeight=size*1.2)=>page.drawText(String(value??''),{x,y:pdfTop(H,top,size),size,font,color:colour(color),maxWidth,lineHeight});
    const fit=(page,value,x,top,size,color,font,maxWidth,min=7)=>{const raw=String(value??''),width=font.widthOfTextAtSize(raw,size),actual=Math.max(min,Math.min(size,size*maxWidth/Math.max(width,1)));text(page,raw,x,top,actual,color,font,maxWidth);};
    const accentLine=(page,accent)=>{const colours=(Array.isArray(accent)?accent:[accent]).filter(Boolean),active=colours.length?colours:[aqua],segment=W/active.length;active.forEach((value,index)=>rect(page,index*segment,48,index===active.length-1?W-index*segment:segment,5,value));};
    const header=(page,title,subtitle,num,accent)=>{
      rect(page,0,0,W,48,navy);accentLine(page,accent);text(page,'HORIZON EUROPE IN NEW ZEALAND',40,16,10,white,bold);text(page,String(num).padStart(2,'0'),900,16,9,aqua,bold);
      const safeTitle=truncate(title,78),titleSize=safeTitle.length>62?21:safeTitle.length>48?23.5:safeTitle.length>36?25.5:27;
      fit(page,safeTitle,40,66,titleSize,ink,bold,880,18.5);
      if(subtitle){const safeSubtitle=truncate(subtitle,118),subtitleSize=safeSubtitle.length>94?9:safeSubtitle.length>72?10:11.5;fit(page,safeSubtitle,40,103,subtitleSize,muted,regular,880,8.2);}
    };
    const addLink=(page,url,x,top,w,h)=>{
      const annotation=doc.context.register(doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[x,pdfTop(H,top,h),x+w,pdfTop(H,top,h)+h],Border:[0,0,0],A:{Type:'Action',S:'URI',URI:PDFString.of(url)}}));
      if(typeof page.node.addAnnot==='function')page.node.addAnnot(annotation);
      else page.node.set(PDFName.of('Annots'),doc.context.obj([annotation]));
    };
    const pdfButton=(page,label,url,x,top,w)=>{rect(page,x,top,w,20,pale,'BBD2E5');fit(page,label,x+7,top+6,7.5,ink,bold,w-14,6.5);addLink(page,url,x,top,w,20);};
    const footer=(page,project,{site=false,cordis=false}={})=>{
      text(page,`Source: CORDIS project records · Last update: ${plan.updated}`,40,517,8,muted);
      if(project)fit(page,`Grant ${project.id}`,470,517,8,muted,bold,125,7);
      if(site&&cordis){pdfButton(page,'OPEN PROJECT EXPLORER',projectExplorerUrl(),615,507,145);pdfButton(page,'VIEW ON CORDIS',cordisUrl(project),770,507,150);}
      else if(site)pdfButton(page,'OPEN PROJECT EXPLORER',projectExplorerUrl(),760,507,160);
      else if(cordis)pdfButton(page,'VIEW ON CORDIS',cordisUrl(project),770,507,150);
    };
    const panel=(page,x,top,w,h,title)=>{rect(page,x,top,w,h,white,line);text(page,title,x+16,top+13,13,ink,bold);};
    const bars=(page,chart,x,top,w,h)=>{const rows=chart.rows.slice(0,chart.maxRows||10),gap=5,rowH=(h-gap*Math.max(rows.length-1,0))/Math.max(rows.length,1),max=Math.max(...rows.map(row=>row.value),1),labelW=w*.33;rows.forEach((row,index)=>{const yy=top+index*(rowH+gap),barX=x+labelW,barW=w-labelW-30;fit(page,chart.label(row),x,yy+rowH*.18,9.5,ink,regular,labelW-8,7);rect(page,barX,yy+rowH*.22,Math.max(4,barW*row.value/max),rowH*.56,chart.color(row,index));text(page,number(row.value),x+w-23,yy+rowH*.18,9.5,ink,bold);});};
    const columns=(page,chart,x,top,w,h)=>{const rows=chart.rows.slice(0,chart.maxRows||8),max=Math.max(...rows.map(row=>row.value),1),plotH=h-35,slot=w/rows.length,columnW=Math.min(52,slot*.58);rows.forEach((row,index)=>{const height=Math.max(4,plotH*row.value/max),xx=x+index*slot+(slot-columnW)/2,yy=top+plotH-height;rect(page,xx,yy,columnW,height,chart.color(row,index));fit(page,number(row.value),xx-5,Math.max(top,yy-13),9,ink,bold,columnW+10,7);fit(page,chart.label(row),x+index*slot,top+plotH+10,8.5,ink,regular,slot,7);});};
    const orgRow=(page,org,x,top,w,compact=false)=>{fit(page,truncate(org.short||org.name,compact?50:58),x,top,compact?9.5:11.5,ink,bold,w,compact?7:7.5);fit(page,organisationMeta(org),x,top+17,compact?7.2:8.5,muted,regular,w,6.5);};
    plan.slides.forEach((item,index)=>{
      const page=doc.addPage([W,H]);rect(page,0,0,W,H,canvas);
      if(item.type==='summary'){
        const data=item.data;header(page,item.title,plan.label,index+1,data.accentColours);const gap=10,w=(880-gap*3)/4;data.metrics.forEach((metric,metricIndex)=>{const x=40+metricIndex*(w+gap),colour=metricColours[metricIndex];rect(page,x,135,w,67,white,line);rect(page,x,135,5,67,colour);text(page,metric[0].toUpperCase(),x+14,144,7.5,muted,bold);fit(page,metric[1],x+14,162,17.5,ink,bold,w-28,12);fit(page,metric[2],x+14,188,7.5,muted,regular,w-28,6.5);});
        if(data.charts.length){const chartW=data.charts.length===1?880:430,xs=data.charts.length===1?[40]:[40,490];data.charts.forEach((chart,chartIndex)=>{panel(page,xs[chartIndex],220,chartW,270,chart.title);(chart.orientation==='column'?columns:bars)(page,chart,xs[chartIndex]+18,258,chartW-36,205);});}
        else{panel(page,40,220,880,270,'Projects in the selected scope');data.projectNames.slice(0,16).forEach((name,nameIndex)=>{const column=Math.floor(nameIndex/8),row=nameIndex%8;text(page,`${String(nameIndex+1).padStart(2,'0')}  ${name}`,66+column*420,270+row*25,11,ink,bold);});}
        footer(page,null,{site:index===0});
      }else if(item.type==='project'){
        const d=item.data,p=d.project,accent=hex(HE.clusterColor(p.clusterCode)),nzAll=d.nz,coordinatorNz=d.coordinator?.countryCode==='NZ',footprintInRight=!d.preview.length&&nzAll.length<=2;
        header(page,p.acronym,truncate(normaliseProjectTitle(p.title,p.acronym),118),index+1,accent);fit(page,`${clusterName(p.clusterCode)} · ${schemeDisplayName(p.schemeCode)} · ${projectStageLabel(p)}`,40,125,10,accent,bold,880,7.8);
        const metrics=[['Maximum EU contribution',money(p.ecContribution)],['Timeline',p.duration?`${number(p.duration)} months`:'Not reported'],['Consortium',`${number(p.organisationCount||p.organisations.length)} organisations`],['NZ participation',money(d.nzFunding)]],gap=9,w=(880-gap*3)/4;metrics.forEach((metric,metricIndex)=>{const x=40+metricIndex*(w+gap);rect(page,x,146,w,53,white,line);text(page,metric[0].toUpperCase(),x+11,154,6.8,muted,bold);fit(page,metric[1],x+11,171,13.5,ink,bold,w-22,9.5);});
        panel(page,40,214,520,277,'Project focus');text(page,truncate(p.focus||p.teaser||'No project objective is available in the source record.',300),58,249,11.2,'354B5E',regular,484,14.5);text(page,'PROGRAMME CONTEXT',58,365,8.5,accent,bold);fit(page,`Call  ${p.callCode||'Not reported'}`,58,385,9.2,ink,regular,484,7.5);text(page,`Topic  ${truncate(p.topic||p.topicCode||'Not reported',120)}`,58,402,8.8,ink,regular,484,11.5);fit(page,`Dates  ${HE.formatDate(p.start)} – ${HE.formatDate(p.end)}`,58,441,9.2,ink,regular,484,7.5);const footprint=d.countries.slice().sort((a,b)=>b.organisations-a.organisations).slice(0,10).map(row=>`${countryName(row.code)} ${row.organisations}`).join(' · ');if(!footprintInRight)fit(page,`Consortium footprint  ${footprint}`,58,463,7.2,muted,regular,484,6.2);
        panel(page,575,214,345,277,'Key organisations');let y=249;text(page,'COORDINATOR',593,y,7.8,accent,bold);y+=18;if(d.coordinator){orgRow(page,d.coordinator,593,y,309,true);y+=39;}else{fit(page,'Not reported',593,y,10,muted,regular,309,8);y+=28;}if(nzAll.length||!coordinatorNz){text(page,'NEW ZEALAND ORGANISATIONS',593,y,7.8,accent,bold);y+=18;nzAll.forEach(org=>{orgRow(page,org,593,y,309,true);y+=36;});if(!nzAll.length){fit(page,'No New Zealand organisation reported.',593,y,9.5,muted,regular,309,7.5);y+=26;}}if(d.preview.length){text(page,[...new Set(d.preview.map(org=>countryName(org.countryCode)))].join(', ').toUpperCase()+' ORGANISATIONS',593,y,7.8,accent,bold);y+=18;d.preview.forEach(org=>{orgRow(page,org,593,y,309,true);y+=36;});}if(footprintInRight){text(page,'CONSORTIUM FOOTPRINT',593,y,7.8,accent,bold);y+=18;fit(page,`${number(p.organisationCount||p.organisations.length)} organisations across ${number(p.countryCount||d.countries.length)} countries`,593,y,10.5,ink,bold,309,8);fit(page,truncate(footprint,125),593,y+20,7.5,muted,regular,309,6.5);}footer(page,p,{site:index===0,cordis:true});
      }else{
        const p=item.project,accent=hex(HE.clusterColor(p.clusterCode)),suffix=item.total>1?` · ${item.part} of ${item.total}`:'',small=item.organisations.length<=7;header(page,`${p.acronym} — ${countryName(item.countryCode)} organisations`,`Grant ${p.id} · Recorded roles and allocations${suffix}`,index+1,accent);
        if(small){const total=item.organisations.reduce((sum,org)=>sum+Number(org.contribution||0),0),roles=[...new Set(item.organisations.map(org=>roleName(org.role)))].join(', '),start=160+Math.max(0,(285-item.organisations.length*45)/2);panel(page,40,145,235,325,'Country participation');fit(page,number(item.organisations.length),58,190,40,accent,bold,180,28);text(page,`${countryName(item.countryCode)} ${item.organisations.length===1?'organisation':'organisations'} in this project`,58,235,14,ink,bold,180,18);text(page,'RECORDED ALLOCATION',58,310,8,muted,bold);fit(page,money(total),58,330,19,ink,bold,180,13);text(page,'ROLES',58,385,8,muted,bold);text(page,roles,58,405,11,ink,regular,180,14);item.organisations.forEach((org,orgIndex)=>{const x=310,top=start+orgIndex*45;orgRow(page,org,x,top,600,false);rect(page,x,top+36,600,1,line,line);});}
        else item.organisations.forEach((org,orgIndex)=>{const column=Math.floor(orgIndex/9),row=orgIndex%9,x=48+column*445,top=145+row*37;orgRow(page,org,x,top,410,false);rect(page,x,top+31,410,1,line,line);});footer(page,p,{site:index===0,cordis:true});
      }
    });
    return doc.save();
  }
  function downloadBytes(bytes,name,type){const blob=new Blob([bytes],{type}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1600);}
  async function exportPdf(scope='filtered',state=currentState(),fileName){const plan=buildPlan(scope,state),bytes=await createPdfBytes(plan);downloadBytes(bytes,fileName||`${fileBase(plan)}.pdf`,'application/pdf');return plan;}

  window.HE_PROJECT_EXPORT_API={buildPlan,createPptx,createPdfBytes,exportPptx,exportPdf};
  if(typeof document==='undefined')return;
  const menu=document.querySelector('[data-project-download]'),status=document.querySelector('[data-project-export-status]');if(!menu)return;
  const scopeButtons=[...menu.querySelectorAll('[data-project-export-scope-choice]')];
  let activeScope='current';
  const setScope=scope=>{
    activeScope=scope;
    scopeButtons.forEach(button=>{const active=button.dataset.projectExportScopeChoice===scope;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    status.textContent='';
  };
  const close=()=>menu.removeAttribute('open');
  document.addEventListener('click',event=>{if(menu.open&&!menu.contains(event.target))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){close();menu.querySelector('summary')?.focus();}});
  scopeButtons.forEach(button=>button.addEventListener('click',()=>setScope(button.dataset.projectExportScopeChoice)));
  window.addEventListener('he:project-export-ready',()=>{
    const state=currentState(),filteredButton=scopeButtons.find(button=>button.dataset.projectExportScopeChoice==='filtered');
    if(filteredButton)filteredButton.disabled=!state.projects.length;
    if(activeScope==='filtered'&&!state.projects.length)setScope('current');
  });
  menu.querySelectorAll('[data-project-export-format]').forEach(button=>button.addEventListener('click',async()=>{
    const format=button.dataset.projectExportFormat,scope=activeScope,buttons=[...menu.querySelectorAll('[data-project-export-format]')],state=currentState(),count=scope==='current'?Number(Boolean(state.selectedProject)):state.projects.length;
    if(!count){status.textContent='No projects are available in the current selection.';return;}
    buttons.forEach(item=>item.disabled=true);status.textContent=`Preparing ${format==='pptx'?'PowerPoint':'PDF'}…`;
    try{if(format==='pptx')await exportPptx(scope,state);else await exportPdf(scope,state);status.textContent='Download ready.';setTimeout(close,450);}
    catch(error){console.error(error);status.textContent='The export could not be created in this browser.';}
    finally{buttons.forEach(item=>item.disabled=false);}
  }));
})();
