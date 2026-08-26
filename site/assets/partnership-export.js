(() => {
  const D=window.HE_DATA;
  const HE=window.HE;
  const EU27=HE.EU27;
  const navy='16395F',blue='397FD8',pale='EAF2F9',ink='123357',muted='68798D',white='FFFFFF',line='D8E4EF';
  const chartPalette=['397FD8','EC6C5F','22A99A','E5A63B','8D67CE','77A84B','C0649C','4E9BB8','C07A4E','5A8F7B','CA5F70','6D83CC'];
  const countryExportPalette=['397FD8','EC6C5F','22A99A','E5A63B','8D67CE','77A84B','C0649C','4E9BB8','C07A4E','D62F6A','2E5AAC','E07B39','008C76','B88A00','6F4FB3','4E8A3A','A83E78','24758F','9A5435','D8433E'];
  const yearPalette=['397FD8','22A99A','E5A63B','EC6C5F'];
  const metricPalette=['397FD8','22A99A','8D67CE','77A84B','E5A63B','EC6C5F'];
  const hex=value=>String(value||'').replace('#','').toUpperCase();
  const money=value=>new Intl.NumberFormat('en-NZ',{style:'currency',currency:'EUR',notation:'compact',maximumFractionDigits:1}).format(Number(value||0));
  const number=value=>new Intl.NumberFormat('en-NZ',{maximumFractionDigits:0}).format(Number(value||0));
  const countryName=code=>D.countries.find(country=>country.code===code)?.name||code;
  const clusterName=code=>D.clusters.find(cluster=>cluster.code===code)?.short||code;
  const schemeName=code=>D.projects.find(project=>project.schemeCode===code)?.scheme||code;
  const clusterColor=code=>hex(HE.clusterColor(code));
  const schemeColor=code=>hex(HE.schemeColor(code));
  const group=(projects,values)=>{
    const counts=new Map();
    projects.forEach(project=>[...new Set(values(project).filter(Boolean))].forEach(value=>counts.set(value,(counts.get(value)||0)+1)));
    return [...counts].map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value||String(a.key).localeCompare(String(b.key)));
  };
  const dataUpdated=()=>HE.formatDate(D.metadata.projectDataUpdated);
  const snapshot=()=>window.HE_PARTNERSHIP_EXPORT_STATE||{projects:D.projects,filters:{clusters:[],countries:[],schemes:[]},updated:dataUpdated()};
  const selectionLabel=state=>{
    const clusters=(state.filters.clusters||[]).map(clusterName);
    const countries=(state.filters.countries||[]).map(countryName);
    const schemes=(state.filters.schemes||[]).map(schemeName);
    if(!clusters.length&&!countries.length&&!schemes.length)return 'Full signed portfolio';
    return [clusters.length?`Clusters: ${clusters.join(', ')}`:'',countries.length?`Partner countries: ${countries.join(', ')}`:'',schemes.length?`Funding schemes: ${schemes.join(', ')}`:''].filter(Boolean).join('  |  ');
  };
  const exportData=state=>{
    const projects=state.projects;
    const nzOrgs=new Set(),allOrgs=new Set(),partnerCountries=new Set();
    let projectValue=0,nzFunding=0;
    projects.forEach(project=>{
      projectValue+=Number(project.ecContribution||0);
      project.organisations.forEach(org=>{
        const key=`${org.countryCode}|${org.id||org.name}`;allOrgs.add(key);
        if(org.countryCode==='NZ'){nzOrgs.add(key);nzFunding+=Number(org.contribution||0);}
        else partnerCountries.add(org.countryCode);
      });
    });
    const selectedCountry=(state.filters.countries||[]).length===1?state.filters.countries[0]:null;
    const organisationMap=new Map();
    if(selectedCountry){
      projects.forEach(project=>project.organisations.filter(org=>org.countryCode===selectedCountry&&Number(org.contribution||0)>0).forEach(org=>{
        const key=org.id||org.name;
        if(!organisationMap.has(key))organisationMap.set(key,{key,label:org.short||org.name,projects:new Set(),funding:0});
        const row=organisationMap.get(key);row.projects.add(project.id);row.funding+=Number(org.contribution||0);
      }));
    }
    const organisations=[...organisationMap.values()].map(row=>({key:row.key,label:row.label,value:row.projects.size,funding:row.funding})).sort((a,b)=>b.value-a.value||b.funding-a.funding||a.label.localeCompare(b.label)).slice(0,8);
    return {
      projects,
      selectedCountry,
      metrics:[
        ['Projects',number(projects.length),'Distinct signed projects'],
        ['Partner countries',number(partnerCountries.size),'Countries connected to New Zealand'],
        ['Organisations',number(allOrgs.size),'Distinct consortium organisations'],
        ['NZ organisations',number(nzOrgs.size),'Distinct participating organisations'],
        ['Project value',money(projectValue),'Maximum EU contribution'],
        ['Allocated to NZ',money(nzFunding),'Net EU contribution to NZ entities']
      ],
      years:group(projects,project=>[project.start?.slice(0,4)]).sort((a,b)=>String(a.key).localeCompare(String(b.key))),
      clusters:group(projects,project=>[project.clusterCode]),
      schemes:group(projects,project=>[project.schemeCode]),
      eu:group(projects,project=>(project.countryCodes||[]).filter(code=>code!=='NZ'&&EU27.has(code))).slice(0,10),
      nonEu:group(projects,project=>(project.countryCodes||[]).filter(code=>code!=='NZ'&&!EU27.has(code))).slice(0,10),
      organisations
    };
  };

  const chartDefinitions=(data,state)=>{
    const years={id:'years',orientation:'column',title:'Projects by starting year',subtitle:'Distinct signed projects in the selected scope.',rows:data.years,label:row=>row.key,color:(row,index)=>yearPalette[index%yearPalette.length],maxRows:8};
    const clusters={id:'clusters',title:'Cluster mix',subtitle:'Only clusters with active projects are shown.',rows:data.clusters,label:row=>clusterName(row.key),color:row=>clusterColor(row.key),maxRows:6};
    const schemes={id:'schemes',title:'Funding schemes',subtitle:'Full Horizon Europe Type of Action names.',rows:data.schemes,label:row=>schemeName(row.key),color:row=>schemeColor(row.key),maxRows:8};
    const organisations={id:'organisations',title:`Leading ${countryName(data.selectedCountry)} organisations`,subtitle:'Ranked by distinct projects in the selected scope.',rows:data.organisations,label:row=>row.label,color:(row,index)=>chartPalette[index%chartPalette.length],maxRows:8};
    const eu={id:'eu',title:'Leading EU27 partners',subtitle:'Distinct project-country connections.',rows:data.eu,label:row=>countryName(row.key),color:(row,index)=>countryExportPalette[index],maxRows:10};
    const nonEu={id:'non-eu',title:'Leading non-EU partners',subtitle:'New Zealand is excluded from the ranking.',rows:data.nonEu,label:row=>countryName(row.key),color:(row,index)=>countryExportPalette[index+10],maxRows:10};
    return {years,clusters,schemes,organisations,eu,nonEu};
  };
  const buildSections=(data,state)=>{
    const charts=chartDefinitions(data,state),sections=[];
    const filters=state.filters||{},singleCountry=data.selectedCountry,singleCluster=(filters.clusters||[]).length===1,singleScheme=(filters.schemes||[]).length===1;
    let summaryTitle=`${number(data.projects.length)} signed projects match the selected portfolio.`;
    if(!filters.clusters?.length&&!filters.countries?.length&&!filters.schemes?.length)summaryTitle=`New Zealand is connected through ${number(data.projects.length)} signed projects.`;
    else if(singleCountry)summaryTitle=`${countryName(singleCountry)} is present in ${number(data.projects.length)} signed projects with New Zealand.`;
    else if(singleCluster)summaryTitle=`${clusterName(filters.clusters[0])} accounts for ${number(data.projects.length)} signed projects.`;
    else if(singleScheme)summaryTitle=`${schemeName(filters.schemes[0])} shapes ${number(data.projects.length)} signed projects.`;
    sections.push({type:'summary',title:summaryTitle,subtitle:selectionLabel(state)});

    const core=[];
    if(data.years.length>1)core.push(charts.years);
    if(data.clusters.length>1)core.push(charts.clusters);
    const schemeUseful=data.schemes.length>1;
    let schemeUsed=false;
    if(core.length<2&&schemeUseful){core.push(charts.schemes);schemeUsed=true;}
    if(core.length){
      let title='The selected portfolio changes across time and themes.';
      if(singleCountry)title=`${countryName(singleCountry)} collaboration spans the selected portfolio.`;
      else if(singleCluster)title='The selected cluster shifts across time and action types.';
      else if(data.years.length>1&&data.years[data.years.length-1].value>data.years[0].value)title='Project starts accelerate as the portfolio broadens.';
      sections.push({type:'charts',title,subtitle:'Only comparisons with at least two active categories are retained.',charts:core.slice(0,2)});
    }

    if(singleCountry&&data.organisations.length){
      const context=[charts.organisations];
      if(schemeUseful&&!schemeUsed){context.push(charts.schemes);schemeUsed=true;}
      sections.push({type:'charts',title:`Repeated participation reveals ${countryName(singleCountry)}'s portfolio anchors.`,subtitle:'The country ranking is replaced by information that remains useful for the selected country.',charts:context});
    }else if(schemeUseful&&!schemeUsed){
      sections.push({type:'charts',title:'Funding schemes shape how collaboration is delivered.',subtitle:'The distribution remains visible because more than one scheme is active.',charts:[charts.schemes]});
      schemeUsed=true;
    }

    if(!singleCountry&&data.eu.length+data.nonEu.length>=2){
      const geography=[];if(data.eu.length)geography.push(charts.eu);if(data.nonEu.length)geography.push(charts.nonEu);
      sections.push({type:'charts',title:'Partner networks span Europe and beyond.',subtitle:'Country rankings remain because the active scope contains multiple partner countries.',charts:geography});
    }
    return sections;
  };

  function pptText(slide,text,x,y,w,h,options={}){
    slide.addText(String(text),{x,y,w,h,fontFace:'Aptos',fontSize:options.fontSize||16,color:options.color||ink,bold:!!options.bold,margin:0,breakLine:false,fit:'shrink',valign:options.valign||'mid',align:options.align||'left',...options});
  }
  function pptHeader(pptx,slide,title,subtitle,page,scope){
    slide.background={color:'F5F8FC'};
    slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:13.333,h:.72,fill:{color:navy},line:{color:navy}});
    pptText(slide,'HORIZON EUROPE IN NEW ZEALAND',.55,.2,5.7,.28,{fontSize:13,bold:true,color:white});
    pptText(slide,scope.toUpperCase(),7.2,.2,5.55,.28,{fontSize:11,bold:true,color:'8AC8F5',align:'right'});
    pptText(slide,title,.55,.9,12.1,.62,{fontSize:31,bold:true,color:ink});
    pptText(slide,subtitle,.55,1.51,12.1,.3,{fontSize:12.5,color:muted});
    pptText(slide,String(page).padStart(2,'0'),12.2,7.09,.55,.2,{fontSize:9,bold:true,color:muted,align:'right'});
  }
  function pptFooter(slide,state){
    pptText(slide,`Last update: ${state.updated||dataUpdated()}`,.55,7.09,4,.2,{fontSize:9,color:muted});
    pptText(slide,selectionLabel(state),4.1,7.06,7.95,.26,{fontSize:9,color:muted,align:'right'});
  }
  function pptPanel(pptx,slide,x,y,w,h,title,subtitle){
    slide.addShape(pptx.ShapeType.roundRect,{x,y,w,h,rectRadius:.08,fill:{color:white},line:{color:line,width:1}});
    pptText(slide,title,x+.28,y+.19,w-.56,.34,{fontSize:18,bold:true,color:ink});
    pptText(slide,subtitle,x+.28,y+.58,w-.56,.27,{fontSize:10.5,color:muted});
  }
  function pptChartLabel(chart,row){
    const value=String(chart.label(row));
    if(chart.id==='schemes')return ({
      'Research and Innovation Actions':'Research & Innovation Actions',
      'Programme Co-fund Actions':'Programme Co-fund Actions',
      'Joint Undertaking Research and Innovation Actions':'Joint Undertaking R&I Actions',
      'Coordination and Support Actions':'Coordination & Support Actions'
    })[value]||value;
    const limit=chart.id==='organisations'?22:chart.id==='schemes'?28:32;
    if(value.length<=limit)return value;
    const lines=[];let current='';
    value.split(/\s+/).forEach(word=>{
      if(!current){current=word;return;}
      if(`${current} ${word}`.length<=limit)current+=` ${word}`;
      else{lines.push(current);current=word;}
    });
    if(current)lines.push(current);
    return lines.join('\n');
  }
  function pptNativeChart(pptx,slide,chart,x,y,w,h){
    const shown=chart.rows.slice(0,chart.maxRows||10);
    if(!shown.length){pptText(slide,'No data in the current selection.',x,y,w,h,{fontSize:14,color:muted,align:'center'});return;}
    const column=chart.orientation==='column';
    slide.addChart(pptx.ChartType.bar,[{
      name:chart.title,
      labels:shown.map(row=>pptChartLabel(chart,row)),
      values:shown.map(row=>Number(row.value||0))
    }],{
      x,y,w,h,
      objectName:`Editable chart - ${chart.title}`,
      altText:`${chart.title}. Values can be edited through PowerPoint's Edit Data command.`,
      barDir:column?'col':'bar',
      barGrouping:'clustered',
      barGapWidthPct:column?55:62,
      chartColors:shown.map((row,index)=>hex(chart.color(row,index))),
      showLegend:false,
      showTitle:false,
      showValue:true,
      showLabel:false,
      dataLabelPosition:'outEnd',
      dataLabelColor:ink,
      dataLabelFontFace:'Aptos',
      dataLabelFontSize:12,
      dataLabelFontBold:true,
      dataLabelFormatCode:'0',
      catAxisOrientation:column?'minMax':'maxMin',
      catAxisLabelColor:ink,
      catAxisLabelFontFace:'Aptos',
      catAxisLabelFontSize:column?12.5:(chart.id==='organisations'||chart.id==='schemes'?10.5:11.5),
      catAxisLineShow:false,
      catAxisMajorTickMark:'none',
      catAxisMinorTickMark:'none',
      catGridLine:{style:'none'},
      valAxisHidden:true,
      valAxisLabelPos:'none',
      valAxisLineShow:false,
      valAxisMajorTickMark:'none',
      valAxisMinorTickMark:'none',
      valAxisMinVal:0,
      valGridLine:{style:'none'},
      chartArea:{fill:{color:white,transparency:100}},
      plotArea:{fill:{color:white,transparency:100}},
      layout:column?{x:.08,y:.04,w:.87,h:.84}:(chart.id==='organisations'||chart.id==='schemes'?{x:.47,y:.03,w:.46,h:.91}:{x:.36,y:.03,w:.57,h:.91}),
      lang:'en-NZ'
    });
  }
  function pptSummary(pptx,slide,data,state,section,page){
    pptHeader(pptx,slide,section.title,'A filter-aware snapshot of the active portfolio.',page,selectionLabel(state));
    slide.addShape(pptx.ShapeType.roundRect,{x:.55,y:1.82,w:12.23,h:.38,rectRadius:.08,fill:{color:'E7F2FC'},line:{color:'CFE3F4'}});
    pptText(slide,selectionLabel(state),.76,1.91,11.8,.18,{fontSize:9,bold:true,color:'2366A9'});
    const cardW=3.97,cardH=1.55,gap=.16;
    data.metrics.forEach((metric,index)=>{
      const col=index%3,row=Math.floor(index/3),x=.55+col*(cardW+gap),y=2.43+row*1.78;
      slide.addShape(pptx.ShapeType.roundRect,{x,y,w:cardW,h:cardH,rectRadius:.08,fill:{color:white},line:{color:line,width:1}});
      slide.addShape(pptx.ShapeType.roundRect,{x,y,w:.08,h:cardH,rectRadius:.03,fill:{color:metricPalette[index]},line:{color:metricPalette[index]}});
      pptText(slide,metric[0].toUpperCase(),x+.28,y+.16,cardW-.5,.28,{fontSize:10.5,bold:true,color:muted,charSpacing:.6});
      pptText(slide,metric[1],x+.28,y+.48,cardW-.5,.55,{fontSize:27,bold:true,color:ink});
      pptText(slide,metric[2],x+.28,y+1.11,cardW-.5,.29,{fontSize:10.5,color:muted});
    });
    pptFooter(slide,state);
  }
  function pptCharts(pptx,slide,section,state,page){
    pptHeader(pptx,slide,section.title,section.subtitle,page,selectionLabel(state));
    const defs=section.charts;
    if(defs.length===1){
      const chart=defs[0],longLabels=chart.id==='organisations'||chart.id==='schemes';pptPanel(pptx,slide,.55,1.95,12.23,4.92,chart.title,chart.subtitle);
      pptNativeChart(pptx,slide,chart,longLabels?1.27:.83,2.72,longLabels?11.26:11.7,3.82);
    }else{
      const widths=[5.95,6.05],xs=[.55,6.73];
      defs.slice(0,2).forEach((chart,index)=>{const longLabels=chart.id==='organisations'||chart.id==='schemes';pptPanel(pptx,slide,xs[index],1.95,widths[index],4.92,chart.title,chart.subtitle);pptNativeChart(pptx,slide,chart,xs[index]+(longLabels?.72:.2),2.72,widths[index]-(longLabels?.92:.4),3.82);});
    }
    pptFooter(slide,state);
  }
  async function exportPptx(state){
    const Pptx=window.PptxGenJS;if(!Pptx)throw new Error('PowerPoint generator is unavailable.');
    const data=exportData(state),sections=buildSections(data,state),pptx=new Pptx();
    pptx.layout='LAYOUT_WIDE';pptx.author='Horizon Europe in New Zealand';pptx.subject=selectionLabel(state);pptx.title='Partnership Overview';pptx.company='Horizon Europe in New Zealand';pptx.lang='en-NZ';pptx.theme={headFontFace:'Aptos Display',bodyFontFace:'Aptos',lang:'en-NZ'};
    sections.forEach((section,index)=>{const slide=pptx.addSlide();section.type==='summary'?pptSummary(pptx,slide,data,state,section,index+1):pptCharts(pptx,slide,section,state,index+1);});
    await pptx.writeFile({fileName:'horizon-europe-new-zealand-filtered-partnership-overview.pptx'});
  }

  function pdfY(pageHeight,top,height=0){return pageHeight-top-height;}
  async function exportPdf(state){
    const lib=window.PDFLib;if(!lib)throw new Error('PDF generator is unavailable.');
    const {PDFDocument,StandardFonts,rgb}=lib,data=exportData(state),sections=buildSections(data,state),doc=await PDFDocument.create();
    doc.setTitle('Horizon Europe in New Zealand - Partnership Overview');doc.setAuthor('Horizon Europe in New Zealand');doc.setSubject(selectionLabel(state));
    const regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),W=960,H=540;
    const col=value=>{const raw=hex(value);return rgb(parseInt(raw.slice(0,2),16)/255,parseInt(raw.slice(2,4),16)/255,parseInt(raw.slice(4,6),16)/255);};
    const text=(page,value,x,top,size=12,color=ink,font=regular,maxWidth)=>page.drawText(String(value),{x,y:pdfY(H,top,size),size,font,color:col(color),maxWidth,lineHeight:size*1.2});
    const fitText=(page,value,x,top,size,color,font,maxWidth,minSize=6.5)=>{const raw=String(value),width=font.widthOfTextAtSize(raw,size),actual=Math.max(minSize,Math.min(size,size*maxWidth/Math.max(width,1)));text(page,raw,x,top,actual,color,font,maxWidth);};
    const rect=(page,x,top,w,h,fill,stroke=fill)=>page.drawRectangle({x,y:pdfY(H,top,h),width:w,height:h,color:col(fill),borderColor:col(stroke),borderWidth:1});
    const header=(page,section,num)=>{rect(page,0,0,W,52,navy);text(page,'HORIZON EUROPE IN NEW ZEALAND',40,17,10,white,bold);fitText(page,selectionLabel(state).toUpperCase(),520,17,9,'8AC8F5',bold,400,7);fitText(page,section.title,40,70,28,ink,bold,880,20);text(page,section.type==='summary'?'A filter-aware snapshot of the active portfolio.':section.subtitle,40,112,11,muted,regular,870);text(page,String(num).padStart(2,'0'),903,518,8,muted,bold);};
    const footer=page=>{text(page,`Last update: ${state.updated||dataUpdated()}`,40,518,8,muted);fitText(page,selectionLabel(state),470,518,8,muted,regular,410,6.5);};
    const panel=(page,x,top,w,h,title,subtitle)=>{rect(page,x,top,w,h,white,line);text(page,title,x+18,top+17,15,ink,bold);fitText(page,subtitle,x+18,top+45,9.5,muted,regular,w-36,7);};
    const bars=(page,rows,x,top,w,h,label,color,maxRows=10)=>{const shown=rows.slice(0,maxRows),gap=6,rowH=(h-gap*Math.max(shown.length-1,0))/Math.max(shown.length,1);if(!shown.length){text(page,'No data in the current selection.',x,top+h/2,11,muted);return;}const max=Math.max(...shown.map(row=>row.value),1);shown.forEach((row,index)=>{const yy=top+index*(rowH+gap),labelW=w*.4,barX=x+labelW,barW=w-labelW-28;fitText(page,label(row),x,yy+rowH*.14,9.5,ink,regular,labelW-8,6.8);rect(page,barX,yy+rowH*.2,Math.max(4,barW*row.value/max),rowH*.6,hex(color(row,index)));text(page,number(row.value),x+w-22,yy+rowH*.13,9.5,ink,bold,22);});};
    const columns=(page,rows,x,top,w,h,label,color,maxRows=8)=>{const shown=rows.slice(0,maxRows);if(!shown.length){text(page,'No data in the current selection.',x,top+h/2,11,muted);return;}const max=Math.max(...shown.map(row=>row.value),1),plotTop=top+10,plotH=h-50,slot=w/shown.length,columnW=Math.min(72,slot*.58);shown.forEach((row,index)=>{const columnH=Math.max(4,plotH*row.value/max),columnX=x+index*slot+(slot-columnW)/2,columnTop=plotTop+plotH-columnH;rect(page,columnX,columnTop,columnW,columnH,hex(color(row,index)));fitText(page,number(row.value),columnX-10,Math.max(top,columnTop-15),10,ink,bold,columnW+20,8);fitText(page,label(row),x+index*slot,plotTop+plotH+12,10,ink,regular,slot,8);});};
    const pdfChart=(page,chart,x,top,w,h)=>chart.orientation==='column'?columns(page,chart.rows,x,top,w,h,chart.label,chart.color,chart.maxRows):bars(page,chart.rows,x,top,w,h,chart.label,chart.color,chart.maxRows);
    sections.forEach((section,index)=>{
      const page=doc.addPage([W,H]);rect(page,0,0,W,H,'F5F8FC');header(page,section,index+1);
      if(section.type==='summary'){
        rect(page,40,133,880,28,'E7F2FC','CFE3F4');fitText(page,selectionLabel(state),55,141,9.5,'2366A9',bold,845,7.5);
        const cardW=282,cardH=112,gap=17;
        data.metrics.forEach((metric,metricIndex)=>{const column=metricIndex%3,row=Math.floor(metricIndex/3),x=40+column*(cardW+gap),top=179+row*132;rect(page,x,top,cardW,cardH,white,line);rect(page,x,top,6,cardH,metricPalette[metricIndex]);text(page,metric[0].toUpperCase(),x+18,top+16,9,muted,bold);fitText(page,metric[1],x+18,top+42,24,ink,bold,cardW-36,16);fitText(page,metric[2],x+18,top+85,9,muted,regular,cardW-36,7);});
      }else if(section.charts.length===1){
        const chart=section.charts[0];panel(page,40,140,880,340,chart.title,chart.subtitle);pdfChart(page,chart,62,202,836,240);
      }else{
        const widths=[430,430],xs=[40,490];section.charts.slice(0,2).forEach((chart,chartIndex)=>{panel(page,xs[chartIndex],140,widths[chartIndex],340,chart.title,chart.subtitle);pdfChart(page,chart,xs[chartIndex]+20,202,widths[chartIndex]-40,240);});
      }
      footer(page);
    });
    const bytes=await doc.save(),blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='horizon-europe-new-zealand-filtered-partnership-overview.pdf';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  window.HE_PARTNERSHIP_EXPORT_API={exportPptx,exportPdf,exportData,buildSections};
  const menu=document.querySelector('.page-download'),status=document.querySelector('[data-export-status]');
  if(!menu)return;
  const close=()=>menu.removeAttribute('open');
  document.addEventListener('click',event=>{if(menu.open&&!menu.contains(event.target))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){close();menu.querySelector('summary').focus();}});
  menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',close));
  menu.querySelectorAll('[data-export-filtered]').forEach(button=>button.addEventListener('click',async()=>{
    const format=button.dataset.exportFiltered,buttons=[...menu.querySelectorAll('[data-export-filtered]')];
    buttons.forEach(item=>item.disabled=true);status.textContent=`Preparing ${format==='pptx'?'PowerPoint':'PDF'}...`;
    try{format==='pptx'?await exportPptx(snapshot()):await exportPdf(snapshot());status.textContent='Download ready.';setTimeout(close,450);}
    catch(error){console.error(error);status.textContent='The export could not be created in this browser.';}
    finally{buttons.forEach(item=>item.disabled=false);}
  }));
})();
