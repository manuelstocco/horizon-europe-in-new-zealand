(() => {
  const H=window.HE,D=H.D;
  const C={navy:'16395F',ink:'123357',muted:'68798D',blue:'397FD8',aqua:'22A99A',gold:'E5A63B',purple:'8D67CE',coral:'EC6C5F',green:'77A84B',pale:'EAF2F9',paper:'F5F8FC',white:'FFFFFF',line:'D8E4EF'};
  const palette=[C.blue,C.purple,C.aqua,C.gold,C.coral,C.green,'4E9BB8','C0649C'];
  const roleLabels={coordinator:'Coordinator',participant:'Participant',associatedPartner:'Associated partner',thirdParty:'Third party'};
  const hex=value=>String(value||'').replace('#','').toUpperCase();
  const cleanTitle=value=>String(value||'').replace(/\.+\s*$/,'');
  const number=value=>new Intl.NumberFormat('en-NZ',{maximumFractionDigits:0}).format(Number(value||0));
  const money=value=>H.fmtMoney(Number(value||0));
  const slug=value=>String(value||'country').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const snapshot=()=>window.HE_COUNTRY_PROFILE_EXPORT_STATE;
  const projectKey=project=>project.id||project.acronym;
  const countryProfileUrl=state=>{
    if(/^https?:$/.test(location.protocol))return location.href;
    const params=new URLSearchParams();params.set('country',state.country.code);
    [['clusters',state.filters.clusters],['schemes',state.filters.schemes],['roles',state.filters.roles],['types',state.filters.types]].forEach(([name,values])=>{if(values?.length)params.set(name,values.join(','));});
    if(state.filters.sme)params.set('sme',state.filters.sme);if(state.filters.search)params.set('search',state.filters.search);
    return `https://manuelstocco.github.io/horizon-europe-in-new-zealand/country-profile.html?${params}`;
  };
  const scopeLabel=state=>state.labels?.length?state.labels.join(' · '):'All projects and organisations for this country';
  const grouped=(items,key,label,color)=>{
    const rows=new Map();items.forEach(item=>{const value=key(item);if(!value)return;const row=rows.get(value)||{key:value,label:label(item,value),value:0,color:color(item,value)};row.value+=1;rows.set(value,row);});
    return [...rows.values()].sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label));
  };
  const exportData=state=>{
    const projects=[...state.projects];
    const clusters=grouped(projects,p=>p.clusterCode,(p,key)=>H.clusterMap.get(key)?.short||p.cluster||key,(p,key)=>hex(H.clusterColor(key)));
    const schemes=grouped(projects,p=>p.schemeCode,p=>p.scheme,(p,key)=>hex(H.schemeColor(key)));
    const types=new Map(),roles=new Map();
    state.organisations.forEach(org=>{
      const type=types.get(org.typeCode)||{key:org.typeCode,label:org.type,value:0,color:palette[types.size%palette.length]};type.value+=1;types.set(org.typeCode,type);
      [...org.roles].forEach(role=>{if(!roles.has(role))roles.set(role,new Set());roles.get(role).add(org.key);});
    });
    const roleRows=[...roles].map(([key,keys],index)=>({key,label:roleLabels[key]||key,value:keys.size,color:palette[index%palette.length]})).sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label));
    const projectRows=projects.sort((a,b)=>(a.start||'').localeCompare(b.start||'')||String(a.acronym).localeCompare(String(b.acronym))).map(project=>{
      const local=project.organisations.filter(org=>org.countryCode===state.country.code),nz=project.organisations.filter(org=>org.countryCode==='NZ');
      return {project,local,nz,allocation:local.reduce((sum,org)=>sum+Number(org.contribution||0),0)};
    });
    return {...state,projects,clusters,schemes,types:[...types.values()].sort((a,b)=>b.value-a.value||a.label.localeCompare(b.label)),roles:roleRows,projectRows};
  };

  function pptText(slide,value,x,y,w,h,options={}){slide.addText(String(value??''),{x,y,w,h,fontFace:'Aptos',fontSize:options.fontSize||15,color:options.color||C.ink,bold:!!options.bold,margin:0,fit:'shrink',valign:options.valign||'mid',align:options.align||'left',breakLine:false,...options});}
  function pptHeader(pptx,slide,title,state,page){
    slide.background={color:C.paper};slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:13.333,h:.72,fill:{color:C.navy},line:{color:C.navy}});
    pptText(slide,'HORIZON EUROPE IN NEW ZEALAND',.55,.2,5.4,.28,{fontSize:13,bold:true,color:C.white});
    pptText(slide,`${state.country.name.toUpperCase()} × NEW ZEALAND`,7,.2,5.75,.28,{fontSize:11,bold:true,color:'8AC8F5',align:'right'});
    pptText(slide,cleanTitle(title),.55,.91,12.15,.58,{fontSize:30,bold:true});pptText(slide,String(page).padStart(2,'0'),12.2,7.08,.55,.2,{fontSize:9,bold:true,color:C.muted,align:'right'});
  }
  function pptButton(slide,label,url,x,y,w){slide.addText(label,{x,y,w,h:.29,fontFace:'Aptos',fontSize:8,bold:true,color:C.ink,align:'center',valign:'mid',margin:0,fill:{color:C.pale},line:{color:'BBD2E5',width:.8},hyperlink:{url},fit:'shrink'});}
  function pptFooter(slide,state,{site=false}={}){pptText(slide,`Last update: ${state.updated}`,.55,7.08,3,.2,{fontSize:9,color:C.muted});pptText(slide,scopeLabel(state),3.35,7.06,site?5.8:8.55,.24,{fontSize:8.5,color:C.muted,align:'right'});if(site)pptButton(slide,'OPEN COUNTRY PROFILE',countryProfileUrl(state),9.45,7.01,2.5);}
  function pptPanel(pptx,slide,x,y,w,h,title){slide.addShape(pptx.ShapeType.roundRect,{x,y,w,h,rectRadius:.08,fill:{color:C.white},line:{color:C.line,width:1}});pptText(slide,title,x+.25,y+.16,w-.5,.35,{fontSize:18,bold:true});}
  function pptChart(pptx,slide,rows,x,y,w,h,title){
    if(!rows.length){pptText(slide,'No data in the selected profile',x,y,w,h,{fontSize:13,color:C.muted,align:'center'});return;}
    slide.addChart(pptx.ChartType.bar,[{name:title,labels:rows.map(row=>row.label),values:rows.map(row=>row.value)}],{x,y,w,h,objectName:`Editable chart - ${title}`,altText:`${title}. Values can be edited through PowerPoint's Edit Data command.`,barDir:'bar',barGrouping:'clustered',barGapWidthPct:58,chartColors:rows.map(row=>hex(row.color)),showLegend:false,showTitle:false,showValue:true,dataLabelPosition:'outEnd',dataLabelColor:C.ink,dataLabelFontFace:'Aptos',dataLabelFontSize:11,dataLabelFontBold:true,catAxisOrientation:'maxMin',catAxisLabelColor:C.ink,catAxisLabelFontFace:'Aptos',catAxisLabelFontSize:10.5,catAxisLineShow:false,catAxisMajorTickMark:'none',catGridLine:{style:'none'},valAxisHidden:true,valAxisLabelPos:'none',valAxisLineShow:false,valAxisMajorTickMark:'none',valGridLine:{style:'none'},chartArea:{fill:{color:C.white,transparency:100}},plotArea:{fill:{color:C.white,transparency:100}},layout:{x:.34,y:.03,w:.6,h:.91},lang:'en-NZ'});
  }
  function pptOverview(pptx,slide,data,page){
    pptHeader(pptx,slide,`${data.country.name} and New Zealand`,data,page);
    pptText(slide,`${number(data.metrics.projects)} signed ${data.metrics.projects===1?'project':'projects'} connect ${data.country.name} and New Zealand`,.55,1.55,12.2,.34,{fontSize:15,color:C.muted});
    slide.addShape(pptx.ShapeType.roundRect,{x:.55,y:1.98,w:12.23,h:.42,rectRadius:.08,fill:{color:C.pale},line:{color:'CFE3F4'}});pptText(slide,`${data.country.status} · ${scopeLabel(data)}`,.78,2.08,11.75,.2,{fontSize:9.5,bold:true,color:'2366A9'});
    const cards=[['Projects',number(data.metrics.projects),'Distinct signed grants'],[`${data.country.name} organisations`,number(data.metrics.organisations),'Distinct participating organisations'],['Allocated to country',money(data.metrics.allocation),'Recorded net EU contribution'],['NZ organisations connected',number(data.metrics.nzOrganisations),'Distinct New Zealand organisations'],['Active NZ–country links',number(data.metrics.links),'Organisation pairs counted once per cluster'],['Clusters',number(data.metrics.clusters),'Pillar II clusters represented'],['Coordinated projects',number(data.metrics.coordinated),`Coordinated by ${data.country.name}`],['Participating project value',money(data.metrics.projectValue),'Maximum EU contribution']];
    const w=2.91,h=1.56,g=.19;cards.forEach((card,index)=>{const col=index%4,row=Math.floor(index/4),x=.55+col*(w+g),y=2.68+row*1.78;slide.addShape(pptx.ShapeType.roundRect,{x,y,w,h,rectRadius:.07,fill:{color:C.white},line:{color:C.line}});slide.addShape(pptx.ShapeType.rect,{x,y,w:.07,h,fill:{color:palette[index%palette.length]},line:{color:palette[index%palette.length]}});pptText(slide,card[0].toUpperCase(),x+.22,y+.14,w-.4,.3,{fontSize:9,bold:true,color:C.muted,charSpacing:.35});pptText(slide,card[1],x+.22,y+.45,w-.4,.5,{fontSize:24,bold:true});pptText(slide,card[2],x+.22,y+1.08,w-.4,.27,{fontSize:9,color:C.muted});});
    pptFooter(slide,data,{site:true});
  }
  function pptComposition(pptx,slide,data,page,title,left,right){pptHeader(pptx,slide,title,data,page);pptPanel(pptx,slide,.55,1.72,5.96,5.12,left.title);pptChart(pptx,slide,left.rows,.78,2.32,5.47,4.13,left.title);pptPanel(pptx,slide,6.73,1.72,6.05,5.12,right.title);pptChart(pptx,slide,right.rows,6.96,2.32,5.56,4.13,right.title);pptFooter(slide,data);}
  const joinNames=(items,limit=3)=>{const names=items.map(org=>org.short||org.name);return names.length>limit?`${names.slice(0,limit).join(', ')} +${names.length-limit}`:names.join(', ');};
  function pptProjects(pptx,slide,data,rows,page,pageIndex,pageCount){
    pptHeader(pptx,slide,`Projects connecting ${data.country.name} and New Zealand`,data,page);pptText(slide,`${rows.length?`${pageIndex+1} of ${pageCount}`:'No projects'} · ${number(data.projectRows.length)} projects in the selected profile`,.55,1.52,12,.26,{fontSize:10.5,color:C.muted});
    const columns=[{label:'PROJECT',x:.58,w:3.05},{label:'CLUSTER / FUNDING SCHEME',x:3.82,w:2.55},{label:`${data.country.name.toUpperCase()} ORGANISATIONS`,x:6.55,w:2.95},{label:'NEW ZEALAND ORGANISATIONS',x:9.7,w:2.98}];columns.forEach(col=>pptText(slide,col.label,col.x,1.9,col.w,.22,{fontSize:8,bold:true,color:C.muted,charSpacing:.45}));
    const rowH=.72;rows.forEach((row,index)=>{const y=2.18+index*.76,project=row.project,shade=index%2?C.paper:C.white;slide.addShape(pptx.ShapeType.roundRect,{x:.55,y,w:12.23,h:rowH,rectRadius:.03,fill:{color:shade},line:{color:C.line,width:.45}});slide.addShape(pptx.ShapeType.rect,{x:.55,y,w:.055,h:rowH,fill:{color:hex(H.clusterColor(project.clusterCode))},line:{color:hex(H.clusterColor(project.clusterCode))}});pptText(slide,project.acronym,.72,y+.08,2.86,.24,{fontSize:11,bold:true});pptText(slide,`Grant ${project.id}`,.72,y+.36,2.86,.18,{fontSize:8.5,color:C.muted});pptText(slide,H.clusterMap.get(project.clusterCode)?.short||project.cluster,3.82,y+.08,2.45,.23,{fontSize:9.5,bold:true});pptText(slide,project.scheme,3.82,y+.36,2.45,.18,{fontSize:8,color:C.muted});pptText(slide,joinNames(row.local),6.55,y+.08,2.85,.43,{fontSize:8.5,bold:true});pptText(slide,row.allocation?money(row.allocation):'Allocation not reported',6.55,y+.5,2.85,.14,{fontSize:7.5,color:C.muted});pptText(slide,joinNames(row.nz),9.7,y+.08,2.86,.5,{fontSize:8.5,bold:true});});pptFooter(slide,data);
  }
  async function exportPptx(state){
    const Pptx=window.PptxGenJS;if(!Pptx)throw new Error('PowerPoint generator is unavailable');const data=exportData(state),pptx=new Pptx();pptx.layout='LAYOUT_WIDE';pptx.author='Horizon Europe in New Zealand';pptx.subject=`${data.country.name} country profile`;pptx.title=`${data.country.name} and New Zealand`;pptx.company='Horizon Europe in New Zealand';pptx.lang='en-NZ';pptx.theme={headFontFace:'Aptos Display',bodyFontFace:'Aptos',lang:'en-NZ'};
    let page=1;let slide=pptx.addSlide();pptOverview(pptx,slide,data,page++);slide=pptx.addSlide();pptComposition(pptx,slide,data,page++,'Portfolio composition',{title:'Cluster profile',rows:data.clusters},{title:'Funding schemes',rows:data.schemes});slide=pptx.addSlide();pptComposition(pptx,slide,data,page++,'Organisations and participation',{title:'Organisation types',rows:data.types},{title:'Participation roles',rows:data.roles});
    const chunks=[];for(let i=0;i<data.projectRows.length;i+=6)chunks.push(data.projectRows.slice(i,i+6));if(!chunks.length)chunks.push([]);chunks.forEach((rows,index)=>{const projectSlide=pptx.addSlide();pptProjects(pptx,projectSlide,data,rows,page++,index,chunks.length);});
    await pptx.writeFile({fileName:`horizon-europe-${slug(data.country.name)}-country-profile.pptx`});
  }

  async function exportPdf(state){
    const lib=window.PDFLib;if(!lib)throw new Error('PDF generator is unavailable');const {PDFDocument,StandardFonts,rgb,PDFName,PDFString}=lib,data=exportData(state),doc=await PDFDocument.create();doc.setTitle(`${data.country.name} and New Zealand`);doc.setAuthor('Horizon Europe in New Zealand');const regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),W=960,PH=540;
    const col=value=>{const raw=hex(value);return rgb(parseInt(raw.slice(0,2),16)/255,parseInt(raw.slice(2,4),16)/255,parseInt(raw.slice(4,6),16)/255);},py=(top,height=0)=>PH-top-height;
    const rect=(page,x,top,w,h,fill,stroke=fill)=>page.drawRectangle({x,y:py(top,h),width:w,height:h,color:col(fill),borderColor:col(stroke),borderWidth:.8});
    const text=(page,value,x,top,size=10,color=C.ink,font=regular,maxWidth)=>page.drawText(String(value??''),{x,y:py(top,size),size,color:col(color),font,maxWidth,lineHeight:size*1.18});
    const fit=(page,value,x,top,size,color,font,maxWidth,min=6)=>{const raw=String(value??''),actual=Math.max(min,Math.min(size,size*maxWidth/Math.max(1,font.widthOfTextAtSize(raw,size))));text(page,raw,x,top,actual,color,font,maxWidth);};
    const addLink=(page,url,x,top,w,h)=>{const annotation=doc.context.register(doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[x,py(top,h),x+w,py(top,h)+h],Border:[0,0,0],A:{Type:'Action',S:'URI',URI:PDFString.of(url)}}));if(typeof page.node.addAnnot==='function')page.node.addAnnot(annotation);else page.node.set(PDFName.of('Annots'),doc.context.obj([annotation]));};
    const header=(page,title,num)=>{rect(page,0,0,W,52,C.navy);text(page,'HORIZON EUROPE IN NEW ZEALAND',40,17,10,C.white,bold);fit(page,`${data.country.name.toUpperCase()} × NEW ZEALAND`,520,17,9,'8AC8F5',bold,400,7);fit(page,cleanTitle(title),40,70,27,C.ink,bold,880,19);text(page,String(num).padStart(2,'0'),902,518,8,C.muted,bold);};
    const footer=(page,site=false)=>{text(page,`Last update: ${data.updated}`,40,518,8,C.muted);fit(page,scopeLabel(data),330,518,8,C.muted,regular,site?330:550,6);if(site){rect(page,700,506,190,21,C.pale,'BBD2E5');fit(page,'OPEN COUNTRY PROFILE',710,513,7.5,C.ink,bold,170,6);addLink(page,countryProfileUrl(data),700,506,190,21);}};
    const newPage=(title,num)=>{const page=doc.addPage([W,PH]);rect(page,0,0,W,PH,C.paper);header(page,title,num);return page;};
    let num=1,page=newPage(`${data.country.name} and New Zealand`,num++);fit(page,`${number(data.metrics.projects)} signed ${data.metrics.projects===1?'project':'projects'} connect ${data.country.name} and New Zealand`,40,112,12,C.muted,regular,880,9);rect(page,40,139,880,27,C.pale,'CFE3F4');fit(page,`${data.country.status} · ${scopeLabel(data)}`,55,147,9,'2366A9',bold,850,7);
    const cards=[['Projects',number(data.metrics.projects)],['Country organisations',number(data.metrics.organisations)],['Allocated to country',money(data.metrics.allocation)],['NZ organisations',number(data.metrics.nzOrganisations)],['Active links',number(data.metrics.links)],['Clusters',number(data.metrics.clusters)],['Coordinated projects',number(data.metrics.coordinated)],['Project value',money(data.metrics.projectValue)]];cards.forEach((card,index)=>{const x=40+(index%4)*222,top=184+Math.floor(index/4)*126;rect(page,x,top,205,104,C.white,C.line);rect(page,x,top,5,104,palette[index%palette.length]);fit(page,card[0].toUpperCase(),x+15,top+14,8,C.muted,bold,175,6);fit(page,card[1],x+15,top+42,22,C.ink,bold,175,14);});footer(page,true);
    const pdfBars=(page,rows,x,top,w,h)=>{const shown=rows.slice(0,9),max=Math.max(1,...shown.map(row=>row.value)),gap=6,rowH=(h-gap*Math.max(0,shown.length-1))/Math.max(1,shown.length);shown.forEach((row,index)=>{const y=top+index*(rowH+gap);fit(page,row.label,x,y+rowH*.13,8.7,C.ink,regular,w*.43-7,6);rect(page,x+w*.43,y+rowH*.21,Math.max(4,w*.48*row.value/max),rowH*.58,row.color);fit(page,number(row.value),x+w-24,y+rowH*.14,8.8,C.ink,bold,22,6);});};
    const composition=(title,left,right)=>{const p=newPage(title,num++);[[left,40],[right,490]].forEach(([chart,x])=>{rect(p,x,137,430,344,C.white,C.line);fit(p,chart.title,x+18,154,15,C.ink,bold,394,10);pdfBars(p,chart.rows,x+18,203,394,236);});footer(p);};composition('Portfolio composition',{title:'Cluster profile',rows:data.clusters},{title:'Funding schemes',rows:data.schemes});composition('Organisations and participation',{title:'Organisation types',rows:data.types},{title:'Participation roles',rows:data.roles});
    const chunks=[];for(let i=0;i<data.projectRows.length;i+=6)chunks.push(data.projectRows.slice(i,i+6));if(!chunks.length)chunks.push([]);chunks.forEach((rows,index)=>{const p=newPage(`Projects connecting ${data.country.name} and New Zealand`,num++);text(p,`${index+1} of ${chunks.length} · ${number(data.projectRows.length)} projects in the selected profile`,40,112,9,C.muted);const cols=[[40,230,'PROJECT'],[280,190,'CLUSTER / SCHEME'],[480,215,`${data.country.name.toUpperCase()} ORGANISATIONS`],[705,215,'NEW ZEALAND ORGANISATIONS']];cols.forEach(([x,w,label])=>fit(p,label,x,143,7,C.muted,bold,w,5.8));rows.forEach((row,rowIndex)=>{const top=164+rowIndex*53,project=row.project;rect(p,40,top,880,47,rowIndex%2?C.paper:C.white,C.line);rect(p,40,top,4,47,hex(H.clusterColor(project.clusterCode)));fit(p,project.acronym,50,top+7,9.5,C.ink,bold,215,7);fit(p,`Grant ${project.id}`,50,top+25,7,C.muted,regular,215,5.5);fit(p,H.clusterMap.get(project.clusterCode)?.short||project.cluster,280,top+7,8,C.ink,bold,185,6);fit(p,project.scheme,280,top+25,6.5,C.muted,regular,185,5);fit(p,joinNames(row.local),480,top+7,7.5,C.ink,bold,210,5.5);fit(p,row.allocation?money(row.allocation):'Allocation not reported',480,top+26,6.2,C.muted,regular,210,5);fit(p,joinNames(row.nz),705,top+7,7.5,C.ink,bold,210,5.5);});footer(p);});
    const bytes=await doc.save(),blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`horizon-europe-${slug(data.country.name)}-country-profile.pdf`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  window.HE_COUNTRY_EXPORT_API={exportPptx,exportPdf,exportData};
  const menu=document.querySelector('[data-country-download]'),status=document.querySelector('[data-country-export-status]');if(!menu)return;
  const update=()=>{menu.hidden=!snapshot();if(menu.hidden)menu.removeAttribute('open');};window.addEventListener('he:country-profile-export-ready',update);update();
  document.addEventListener('click',event=>{if(menu.open&&!menu.contains(event.target))menu.removeAttribute('open');});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){menu.removeAttribute('open');menu.querySelector('summary').focus();}});
  menu.querySelectorAll('[data-country-export]').forEach(button=>button.addEventListener('click',async()=>{const format=button.dataset.countryExport,buttons=[...menu.querySelectorAll('[data-country-export]')],state=snapshot();if(!state)return;buttons.forEach(item=>item.disabled=true);status.textContent=`Preparing ${format==='pptx'?'PowerPoint':'PDF'}…`;try{format==='pptx'?await exportPptx(state):await exportPdf(state);status.textContent='Download ready';setTimeout(()=>menu.removeAttribute('open'),450);}catch(error){console.error(error);status.textContent='The export could not be created in this browser';}finally{buttons.forEach(item=>item.disabled=false);}}));
})();
