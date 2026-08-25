(() => {
  const D=window.HE_DATA;
  const HE=window.HE;
  const EU27=HE.EU27;
  const navy='102B4C',blue='397FD8',pale='EAF1F7',ink='173A5E',muted='6C8295',white='FFFFFF',line='D8E3EE';
  const hex=value=>String(value||'').replace('#','').toUpperCase();
  const money=value=>new Intl.NumberFormat('en-NZ',{style:'currency',currency:'EUR',notation:'compact',maximumFractionDigits:1}).format(Number(value||0));
  const number=value=>new Intl.NumberFormat('en-NZ',{maximumFractionDigits:0}).format(Number(value||0));
  const countryName=code=>D.countries.find(country=>country.code===code)?.name||code;
  const clusterName=code=>D.clusters.find(cluster=>cluster.code===code)?.short||code;
  const schemeName=code=>D.projects.find(project=>project.schemeCode===code)?.scheme||code;
  const clusterColor=code=>hex(HE.clusterColor(code));
  const countryColor=code=>hex(HE.countryColor(code));
  const group=(projects,values)=>{
    const counts=new Map();
    projects.forEach(project=>[...new Set(values(project).filter(Boolean))].forEach(value=>counts.set(value,(counts.get(value)||0)+1)));
    return [...counts].map(([key,value])=>({key,value})).sort((a,b)=>b.value-a.value||String(a.key).localeCompare(String(b.key)));
  };
  const snapshot=()=>window.HE_PARTNERSHIP_EXPORT_STATE||{projects:D.projects,filters:{clusters:[],countries:[],schemes:[]},updated:D.updated||'22 August 2026'};
  const selectionLabel=state=>{
    const clusters=(state.filters.clusters||[]).map(clusterName);
    const countries=(state.filters.countries||[]).map(countryName);
    const schemes=(state.filters.schemes||[]).map(schemeName);
    if(!clusters.length&&!countries.length&&!schemes.length)return 'Full signed portfolio';
    return [clusters.length?`Clusters: ${clusters.join(', ')}`:'',countries.length?`Partner countries: ${countries.join(', ')}`:'',schemes.length?`Funding schemes: ${schemes.join(', ')}`:''].filter(Boolean).join('  |  ');
  };
  const exportData=state=>{
    const projects=state.projects;
    const nzOrgs=new Set(),partnerOrgs=new Set(),partnerCountries=new Set();
    let projectValue=0,nzFunding=0;
    projects.forEach(project=>{
      projectValue+=Number(project.ecContribution||0);
      project.organisations.forEach(org=>{
        if(org.countryCode==='NZ'){nzOrgs.add(org.id||org.name);nzFunding+=Number(org.contribution||0);}
        else{partnerOrgs.add(`${org.countryCode}|${org.id||org.name}`);partnerCountries.add(org.countryCode);}
      });
    });
    return {
      projects,
      metrics:[
        ['Projects',number(projects.length),'Distinct signed projects'],
        ['NZ organisations',number(nzOrgs.size),'Participating organisations'],
        ['Partner countries',number(partnerCountries.size),'EU and non-EU countries'],
        ['Project value',money(projectValue),'EU contribution to selected projects'],
        ['Allocated to NZ',money(nzFunding),'EU contribution to NZ participants']
      ],
      years:group(projects,project=>[project.start?.slice(0,4)]).sort((a,b)=>String(a.key).localeCompare(String(b.key))),
      clusters:group(projects,project=>[project.clusterCode]),
      eu:group(projects,project=>(project.countryCodes||[]).filter(code=>code!=='NZ'&&EU27.has(code))).slice(0,10),
      nonEu:group(projects,project=>(project.countryCodes||[]).filter(code=>code!=='NZ'&&!EU27.has(code))).slice(0,10)
    };
  };

  function pptText(slide,text,x,y,w,h,options={}){
    slide.addText(String(text),{x,y,w,h,fontFace:'Aptos',fontSize:options.fontSize||16,color:options.color||ink,bold:!!options.bold,margin:0,breakLine:false,fit:'shrink',valign:options.valign||'mid',align:options.align||'left',...options});
  }
  function pptHeader(pptx,slide,title,subtitle,page){
    slide.background={color:'F4F7FA'};
    slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:13.333,h:.34,fill:{color:navy},line:{color:navy}});
    pptText(slide,'HORIZON EUROPE IN NEW ZEALAND',.55,.48,5.5,.28,{fontSize:11,bold:true,color:blue,charSpacing:1.2});
    pptText(slide,title,.55,.83,11.9,.56,{fontSize:28,bold:true,color:ink});
    pptText(slide,subtitle,.55,1.38,11.9,.32,{fontSize:11,color:muted});
    pptText(slide,String(page),12.25,.55,.5,.24,{fontSize:10,bold:true,color:muted,align:'right'});
  }
  function pptFooter(slide,state){
    pptText(slide,`Last update: ${state.updated||'22 August 2026'}`,.55,7.12,4,.18,{fontSize:8,color:muted});
    pptText(slide,selectionLabel(state),4.1,7.09,8.65,.24,{fontSize:8,color:muted,align:'right'});
  }
  function pptBars(pptx,slide,rows,{x,y,w,h,label,color,maxRows=10}){
    const shown=rows.slice(0,maxRows),max=Math.max(...shown.map(row=>row.value),1),gap=.12,rowH=(h-gap*Math.max(shown.length-1,0))/Math.max(shown.length,1);
    if(!shown.length){pptText(slide,'No data in the current selection.',x,y,w,h,{fontSize:13,color:muted,align:'center'});return;}
    shown.forEach((row,index)=>{
      const yy=y+index*(rowH+gap),labelW=w*.38,barX=x+labelW,barW=w-labelW-.45;
      pptText(slide,label(row),x,yy,labelW-.12,rowH,{fontSize:10,bold:true,color:ink});
      slide.addShape(pptx.ShapeType.roundRect,{x:barX,y:yy+rowH*.25,w:barW,h:rowH*.5,rectRadius:.05,fill:{color:'DFE8F1'},line:{color:'DFE8F1'}});
      slide.addShape(pptx.ShapeType.roundRect,{x:barX,y:yy+rowH*.25,w:Math.max(.08,barW*row.value/max),h:rowH*.5,rectRadius:.05,fill:{color:color(row)},line:{color:color(row)}});
      pptText(slide,number(row.value),x+w-.4,yy,.4,rowH,{fontSize:10,bold:true,color:ink,align:'right'});
    });
  }
  async function exportPptx(state){
    const Pptx=window.PptxGenJS;
    if(!Pptx)throw new Error('PowerPoint generator is unavailable.');
    const data=exportData(state),pptx=new Pptx();
    pptx.layout='LAYOUT_WIDE';pptx.author='Horizon Europe in New Zealand';pptx.subject=selectionLabel(state);pptx.title='Partnership Overview';pptx.company='Horizon Europe in New Zealand';pptx.lang='en-NZ';pptx.theme={headFontFace:'Aptos Display',bodyFontFace:'Aptos',lang:'en-NZ'};

    let slide=pptx.addSlide();pptHeader(pptx,slide,'Partnership overview',selectionLabel(state),1);
    const cardW=2.38,gap=.16,start=.55;
    data.metrics.forEach((metric,index)=>{
      const x=start+index*(cardW+gap);
      slide.addShape(pptx.ShapeType.roundRect,{x,y:2.12,w:cardW,h:2.62,rectRadius:.1,fill:{color:white},line:{color:line,width:1}});
      pptText(slide,metric[0].toUpperCase(),x+.18,2.35,cardW-.36,.34,{fontSize:10,bold:true,color:muted,charSpacing:.9});
      pptText(slide,metric[1],x+.18,2.82,cardW-.36,.66,{fontSize:28,bold:true,color:index===4?blue:ink});
      pptText(slide,metric[2],x+.18,3.67,cardW-.36,.56,{fontSize:10,color:muted,valign:'top'});
    });
    slide.addShape(pptx.ShapeType.roundRect,{x:.55,y:5.08,w:12.23,h:1.34,rectRadius:.08,fill:{color:pale},line:{color:'CADAE9'}});
    pptText(slide,`${number(data.projects.length)} selected projects`,.85,5.38,3.2,.36,{fontSize:20,bold:true,color:blue});
    pptText(slide,'The figures, charts and country rankings in this export reflect the filters active when the file was generated.',4.0,5.28,8.2,.62,{fontSize:13,color:ink});
    pptFooter(slide,state);

    slide=pptx.addSlide();pptHeader(pptx,slide,'Portfolio composition','Projects by starting year and thematic cluster',2);
    slide.addShape(pptx.ShapeType.roundRect,{x:.55,y:1.95,w:5.25,h:4.75,rectRadius:.08,fill:{color:white},line:{color:line}});
    pptText(slide,'PROJECTS BY STARTING YEAR',.82,2.17,4.7,.28,{fontSize:12,bold:true,color:ink,charSpacing:.7});
    pptBars(pptx,slide,data.years,{x:.82,y:2.7,w:4.65,h:3.45,label:row=>row.key,color:()=>blue,maxRows:8});
    slide.addShape(pptx.ShapeType.roundRect,{x:6.02,y:1.95,w:6.76,h:4.75,rectRadius:.08,fill:{color:white},line:{color:line}});
    pptText(slide,'CLUSTER MIX',6.3,2.17,6.1,.28,{fontSize:12,bold:true,color:ink,charSpacing:.7});
    pptBars(pptx,slide,data.clusters,{x:6.3,y:2.7,w:6.05,h:3.45,label:row=>clusterName(row.key),color:row=>clusterColor(row.key),maxRows:6});
    slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:13.333,h:.34,fill:{color:navy},line:{color:navy}});
    pptText(slide,'HORIZON EUROPE IN NEW ZEALAND',.55,.48,5.5,.28,{fontSize:11,bold:true,color:blue,charSpacing:1.2});
    pptFooter(slide,state);

    slide=pptx.addSlide();pptHeader(pptx,slide,'Leading partner countries','Distinct project-country connections, highest values first',3);
    slide.addShape(pptx.ShapeType.roundRect,{x:.55,y:1.95,w:6.03,h:4.88,rectRadius:.08,fill:{color:white},line:{color:line}});
    pptText(slide,'EU27 PARTNERS',.82,2.17,5.45,.28,{fontSize:12,bold:true,color:ink,charSpacing:.7});
    pptBars(pptx,slide,data.eu,{x:.82,y:2.62,w:5.45,h:3.86,label:row=>countryName(row.key),color:row=>countryColor(row.key),maxRows:10});
    slide.addShape(pptx.ShapeType.roundRect,{x:6.78,y:1.95,w:6,h:4.88,rectRadius:.08,fill:{color:white},line:{color:line}});
    pptText(slide,'NON-EU PARTNERS',7.05,2.17,5.4,.28,{fontSize:12,bold:true,color:ink,charSpacing:.7});
    pptBars(pptx,slide,data.nonEu,{x:7.05,y:2.62,w:5.4,h:3.86,label:row=>countryName(row.key),color:row=>countryColor(row.key),maxRows:10});
    pptFooter(slide,state);

    await pptx.writeFile({fileName:'horizon-europe-new-zealand-filtered-partnership-overview.pptx'});
  }

  function pdfY(pageHeight,top,height=0){return pageHeight-top-height;}
  async function exportPdf(state){
    const lib=window.PDFLib;
    if(!lib)throw new Error('PDF generator is unavailable.');
    const {PDFDocument,StandardFonts,rgb}=lib,data=exportData(state),doc=await PDFDocument.create();
    doc.setTitle('Horizon Europe in New Zealand - Partnership Overview');doc.setAuthor('Horizon Europe in New Zealand');doc.setSubject(selectionLabel(state));
    const regular=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold),W=960,H=540;
    const col=value=>{const raw=hex(value);return rgb(parseInt(raw.slice(0,2),16)/255,parseInt(raw.slice(2,4),16)/255,parseInt(raw.slice(4,6),16)/255);};
    const text=(page,value,x,top,size=12,color=ink,font=regular,maxWidth)=>page.drawText(String(value),{x,y:pdfY(H,top,size),size,font,color:col(color),maxWidth,lineHeight:size*1.2});
    const rect=(page,x,top,w,h,fill,stroke=fill)=>page.drawRectangle({x,y:pdfY(H,top,h),width:w,height:h,color:col(fill),borderColor:col(stroke),borderWidth:1});
    const header=(page,title,subtitle,num)=>{rect(page,0,0,W,24,navy);text(page,'HORIZON EUROPE IN NEW ZEALAND',40,38,9,blue,bold);text(page,title,40,62,27,ink,bold);text(page,subtitle,40,100,10,muted,regular,840);text(page,num,905,42,9,muted,bold);};
    const footer=(page)=>{text(page,`Last update: ${state.updated||'22 August 2026'}`,40,519,7,muted);text(page,selectionLabel(state),520,519,7,muted,regular,400);};
    const bars=(page,rows,x,top,w,h,label,color,maxRows=10)=>{const shown=rows.slice(0,maxRows),max=Math.max(...shown.map(row=>row.value),1),gap=7,rowH=(h-gap*Math.max(shown.length-1,0))/Math.max(shown.length,1);if(!shown.length){text(page,'No data in the current selection.',x,top+h/2,11,muted);return;}shown.forEach((row,index)=>{const yy=top+index*(rowH+gap),labelW=w*.38,barX=x+labelW,barW=w-labelW-28;text(page,label(row),x,yy+rowH*.18,8.5,ink,bold,labelW-8);rect(page,barX,yy+rowH*.28,barW,rowH*.44,'DFE8F1');rect(page,barX,yy+rowH*.28,Math.max(5,barW*row.value/max),rowH*.44,color(row));text(page,number(row.value),x+w-22,yy+rowH*.16,8.5,ink,bold,22);});};

    let page=doc.addPage([W,H]);rect(page,0,0,W,H,'F4F7FA');header(page,'Partnership overview',selectionLabel(state),1);
    const cardW=166,gap=10;
    data.metrics.forEach((metric,index)=>{const x=40+index*(cardW+gap);rect(page,x,152,cardW,185,white,line);text(page,metric[0].toUpperCase(),x+14,170,8,muted,bold,cardW-28);text(page,metric[1],x+14,210,23,index===4?blue:ink,bold,cardW-28);text(page,metric[2],x+14,267,8.5,muted,regular,cardW-28);});
    rect(page,40,363,880,93,pale,'CADAE9');text(page,`${number(data.projects.length)} selected projects`,60,385,18,blue,bold);text(page,'The figures, charts and country rankings in this export reflect the filters active when the file was generated.',300,382,11,ink,regular,570);footer(page);

    page=doc.addPage([W,H]);rect(page,0,0,W,H,'F4F7FA');header(page,'Portfolio composition','Projects by starting year and thematic cluster',2);
    rect(page,40,140,380,330,white,line);text(page,'PROJECTS BY STARTING YEAR',60,158,10,ink,bold);bars(page,data.years,60,196,340,230,row=>row.key,()=>blue,8);
    rect(page,438,140,482,330,white,line);text(page,'CLUSTER MIX',458,158,10,ink,bold);bars(page,data.clusters,458,196,442,230,row=>clusterName(row.key),row=>clusterColor(row.key),6);footer(page);

    page=doc.addPage([W,H]);rect(page,0,0,W,H,'F4F7FA');header(page,'Leading partner countries','Distinct project-country connections, highest values first',3);
    rect(page,40,140,430,340,white,line);text(page,'EU27 PARTNERS',60,158,10,ink,bold);bars(page,data.eu,60,194,390,250,row=>countryName(row.key),row=>countryColor(row.key),10);
    rect(page,490,140,430,340,white,line);text(page,'NON-EU PARTNERS',510,158,10,ink,bold);bars(page,data.nonEu,510,194,390,250,row=>countryName(row.key),row=>countryColor(row.key),10);footer(page);

    const bytes=await doc.save();
    const blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='horizon-europe-new-zealand-filtered-partnership-overview.pdf';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  window.HE_PARTNERSHIP_EXPORT_API={exportPptx,exportPdf,exportData};
  const menu=document.querySelector('.page-download'),status=document.querySelector('[data-export-status]');
  if(!menu)return;
  const close=()=>menu.removeAttribute('open');
  document.addEventListener('click',event=>{if(menu.open&&!menu.contains(event.target))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){close();menu.querySelector('summary').focus();}});
  menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',close));
  menu.querySelectorAll('[data-export-filtered]').forEach(button=>button.addEventListener('click',async()=>{
    const format=button.dataset.exportFiltered;
    const buttons=[...menu.querySelectorAll('[data-export-filtered]')];
    buttons.forEach(item=>item.disabled=true);status.textContent=`Preparing ${format==='pptx'?'PowerPoint':'PDF'}…`;
    try{format==='pptx'?await exportPptx(snapshot()):await exportPdf(snapshot());status.textContent='Download ready.';setTimeout(close,450);}
    catch(error){console.error(error);status.textContent='The export could not be created in this browser.';}
    finally{buttons.forEach(item=>item.disabled=false);}
  }));
})();
