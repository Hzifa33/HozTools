(function(){
  'use strict';
  const H=window.HozTools,$=H.$,$$=H.$$;
  let files=[],pdfFiles=[],imageFiles=[],wordFiles=[],primary=null,wordPrimary=null,pageCount=0,fields=[];
  let rendererPromise=null,engineState='ready';
  const previewUrls=new WeakMap();
  const t=(en,ar,es)=>({en,ar,es}[H.lang()]);
  const ready=()=>!!window.PDFLib;
  const isPdf=f=>f?.type==='application/pdf'||/\.pdf$/i.test(f?.name||'');
  const isImage=f=>['image/jpeg','image/png'].includes(f?.type)||/\.(jpe?g|png)$/i.test(f?.name||'');
  const isWord=f=>f?.type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'||/\.docx$/i.test(f?.name||'');
  const cleanName=s=>String(s||'').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\.pdf$/i,'').slice(0,80);
  const outName=(id,fallback)=>`${cleanName($('#'+id)?.value)||fallback}.pdf`;
  function hexRgb(hex){const v=String(hex||'#000000').replace('#','').padEnd(6,'0').slice(0,6);return PDFLib.rgb(parseInt(v.slice(0,2),16)/255,parseInt(v.slice(2,4),16)/255,parseInt(v.slice(4,6),16)/255)}
  function setEngineStatus(state=engineState){
    engineState=state;
    const el=$('#libStatus');if(!el)return;
    const map={
      ready:['Engine ready','المحرك جاهز','Motor listo'],
      unavailable:['Engine unavailable','المحرك غير متاح','Motor no disponible']
    }[state]||['Engine ready','المحرك جاهز','Motor listo'];
    el.dataset.en=map[0];el.dataset.ar=map[1];el.dataset.es=map[2];
    el.textContent=map[{en:0,ar:1,es:2}[H.lang()]??0];
  }
  function buttons(){
    const on=ready()&&pdfFiles.length>0;
    ['mergeBtn','splitBtn','extractBtn','deleteBtn','reorderBtn','rotateBtn','watermarkBtn','numberBtn','cleanBtn','jpgBtn'].forEach(id=>{const b=$('#'+id);if(b)b.disabled=!on});
    if($('#imagesPdfBtn'))$('#imagesPdfBtn').disabled=!(ready()&&imageFiles.length);
    if($('#clearFiles'))$('#clearFiles').disabled=!files.length;
    if($('#fillFormBtn'))$('#fillFormBtn').disabled=!(on&&fields.length);
  }
  function selectTask(value){
    const sel=$('#pdfTask');if(!sel||sel.value===value&&document.querySelector(`[data-task="${value}"]:not([hidden])`))return;
    sel.value=value;sel.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function syncWordPrimary(file,select=false){
    wordPrimary=file||null;
    if(wordPrimary)window.HozWordPdf?.setFile(wordPrimary,true);else window.HozWordPdf?.clearFile();
    if(select&&wordPrimary)selectTask('word');
  }
  function imageUrl(file){
    let url=previewUrls.get(file);
    if(!url){url=URL.createObjectURL(file);previewUrls.set(file,url)}
    return url;
  }
  function revokePreview(file){const url=previewUrls.get(file);if(url){URL.revokeObjectURL(url);previewUrls.delete?.(file)}}
  function typeLabel(file){return isPdf(file)?'PDF':isWord(file)?'DOCX':'IMG'}
  function renderFiles(){
    $('#fileList').innerHTML=files.map((f,i)=>{
      const kind=typeLabel(f),lead=isImage(f)?`<img class="file-thumb" src="${imageUrl(f)}" alt="" aria-hidden="true">`:`<span class="file-badge" data-kind="${kind}">${kind}</span>`;
      return `<div class="file-item" data-kind="${kind}">${lead}<div class="grow"><strong class="truncate" title="${H.esc(f.name)}">${H.esc(f.name)}</strong><small>${H.bytes(f.size)}</small></div><button class="btn small ghost" data-remove="${i}" aria-label="${t('Remove','إزالة','Eliminar')}">×</button></div>`;
    }).join('');
    $$('[data-remove]').forEach(b=>b.onclick=()=>removeFile(+b.dataset.remove));
  }
  function renderSimpleInfo(){
    if(primary)return;
    const rows=[];
    if(imageFiles.length)rows.push([t('Images','الصور','Imágenes'),imageFiles.length]);
    if(wordFiles.length)rows.push([t('Word files','ملفات Word','Archivos Word'),wordFiles.length]);
    $('#pdfInfo').innerHTML=rows.map(([a,b])=>`<div class="metric"><small>${a}</small><strong>${b}</strong></div>`).join('');
  }
  async function removeFile(index){
    const f=files[index];if(!f)return;
    if(isImage(f))revokePreview(f);
    files.splice(index,1);pdfFiles=pdfFiles.filter(x=>x!==f);imageFiles=imageFiles.filter(x=>x!==f);wordFiles=wordFiles.filter(x=>x!==f);
    if(f===wordPrimary)syncWordPrimary(wordFiles[0]||null,false);
    primary=pdfFiles[0]||null;pageCount=0;fields=[];renderFiles();renderFields();
    if(primary)await inspect();else renderSimpleInfo();
    if(!pdfFiles.length&&imageFiles.length&&!wordFiles.length)selectTask('images');
    else if(!pdfFiles.length&&!imageFiles.length&&wordFiles.length){syncWordPrimary(wordPrimary||wordFiles[0],true)}
    buttons();
  }
  async function add(incoming){
    let newestWord=null,accepted=0;
    for(const f of [...incoming]){
      if(files.length>=100||files.reduce((sum,x)=>sum+x.size,0)+f.size>200*1024*1024){H.toast(t('Use up to 100 files and 200 MB per batch.','استخدم حتى 100 ملف و200 ميجابايت لكل دفعة.','Usa hasta 100 archivos y 200 MB por lote.'),'error');break}
      if(files.includes(f))continue;
      if(f.size>60*1024*1024){H.toast(t('File must be below 60 MB.','يجب أن يكون الملف دون 60 ميجابايت.','El archivo debe ser menor de 60 MB.'),'error');continue}
      if(isWord(f)&&f.size>25*1024*1024){H.toast(t('Word documents must be below 25 MB.','يجب أن يكون ملف Word دون 25 ميجابايت.','El documento Word debe ser menor de 25 MB.'),'error');continue}
      if(isPdf(f))pdfFiles.push(f);
      else if(isImage(f))imageFiles.push(f);
      else if(isWord(f)){wordFiles.push(f);newestWord=f}
      else{H.toast(t('Unsupported file type.','نوع الملف غير مدعوم.','Tipo de archivo no compatible.'),'error');continue}
      files.push(f);accepted++;
    }
    if(!accepted)return;
    primary=pdfFiles[0]||null;renderFiles();
    if(primary)await inspect();else renderSimpleInfo();
    if(newestWord){syncWordPrimary(newestWord,true)}
    else if(imageFiles.length&&imageFiles.length===files.length)selectTask('images');
    else if(pdfFiles.length===files.length&&['images','word'].includes($('#pdfTask')?.value))selectTask('merge');
    buttons();
  }
  async function inspect(){
    if(!primary||!ready())return;
    try{
      const doc=await PDFLib.PDFDocument.load(await primary.arrayBuffer(),{updateMetadata:false});pageCount=doc.getPageCount();
      $('#pdfInfo').innerHTML=`<div class="metric"><small>${t('PDF pages','صفحات PDF','Páginas PDF')}</small><strong>${pageCount}</strong></div><div class="metric"><small>${t('Selected PDFs','ملفات PDF المحددة','PDF seleccionados')}</small><strong>${pdfFiles.length}</strong></div><div class="metric"><small>${t('Title','العنوان','Título')}</small><strong class="truncate">${H.esc(doc.getTitle()||'—')}</strong></div><div class="metric"><small>${t('Author','المؤلف','Autor')}</small><strong class="truncate">${H.esc(doc.getAuthor()||'—')}</strong></div>`;
      fields=[];
      try{doc.getForm().getFields().forEach(f=>fields.push({name:f.getName(),type:['PDFTextField','PDFCheckBox','PDFDropdown','PDFOptionList','PDFRadioGroup'].find(k=>f instanceof PDFLib[k])||'unsupported',value:f.getText?.()||f.getSelected?.()||'',checked:f.isChecked?.()||false,options:f.getOptions?.()||[]}))}catch{}
      renderFields();
    }catch(e){pageCount=0;fields=[];$('#pdfInfo').replaceChildren();renderFields();console.error(e);H.toast(t('This PDF could not be opened. It may be damaged or password protected.','تعذر فتح الملف؛ قد يكون تالفًا أو محميًا بكلمة مرور.','No se pudo abrir el PDF. Puede estar dañado o protegido.'),'error')}
  }
  function renderFields(){
    if(!fields.length){$('#formFields').textContent=t('No fillable fields.','لا توجد حقول قابلة للتعبئة.','No hay campos rellenables.');return}
    $('#formFields').innerHTML=fields.map((f,i)=>`<div class="field"><label for="pdf-field-${i}">${H.esc(f.name)}</label>`+(f.type==='PDFCheckBox'?`<input id="pdf-field-${i}" type="checkbox" ${f.checked?'checked':''}>`:f.options.length?`<select id="pdf-field-${i}" class="select">${f.options.map(v=>`<option value="${H.esc(v)}" ${String(f.value)===v?'selected':''}>${H.esc(v)}</option>`).join('')}</select>`:`<input id="pdf-field-${i}" class="input" value="${H.esc(f.value)}" ${f.type==='unsupported'?'disabled':''}>`)+'</div>').join('')
  }
  async function loadDoc(file=primary){return PDFLib.PDFDocument.load(await file.arrayBuffer(),{updateMetadata:false})}
  async function save(doc,name){H.download(new Blob([await doc.save()],{type:'application/pdf'}),name)}
  async function merge(){const out=await PDFLib.PDFDocument.create();for(const f of pdfFiles){const src=await loadDoc(f),pages=await out.copyPages(src,src.getPageIndices());pages.forEach(p=>out.addPage(p))}await save(out,outName('mergeName','merged'))}
  async function split(){const src=await loadDoc(),zip=new JSZip(),max=src.getPageCount(),requested=H.ranges($('#splitPages')?.value||'',max),ids=requested.length?requested:src.getPageIndices(),prefix=cleanName($('#splitPrefix')?.value)||'page';for(const i of ids){const out=await PDFLib.PDFDocument.create();out.addPage((await out.copyPages(src,[i]))[0]);zip.file(`${prefix}-${String(i+1).padStart(3,'0')}.pdf`,await out.save())}H.download(await zip.generateAsync({type:'blob'}),`${prefix}-pages.zip`)}
  async function extract(del=false,reorder=false){const src=await loadDoc(),max=src.getPageCount(),seq=H.ranges(reorder?$('#order').value:$('#pages').value,max,reorder);if(!seq.length)return H.toast(t('Enter valid page numbers','أدخل أرقام صفحات صحيحة','Introduce páginas válidas'),'error');let keep=reorder?seq:del?src.getPageIndices().filter(i=>!seq.includes(i)):seq;if(!keep.length)throw Error(t('Keep at least one page.','احتفظ بصفحة واحدة على الأقل.','Conserva al menos una página.'));const out=await PDFLib.PDFDocument.create(),pages=await out.copyPages(src,keep);pages.forEach(p=>out.addPage(p));const name=reorder?outName('reorderName',`${H.basename(primary.name)}-reordered`):outName(del?'deleteName':'extractName',del?'pages-deleted':'extracted');await save(out,name)}
  async function rotate(){const doc=await loadDoc(),ids=H.ranges($('#rotatePages').value,doc.getPageCount()),angle=+$('#angle').value;(ids.length?ids:doc.getPageIndices()).forEach(i=>{const p=doc.getPage(i);p.setRotation(PDFLib.degrees((p.getRotation().angle+angle)%360))});await save(doc,outName('rotateName',`${H.basename(primary.name)}-rotated`))}
  async function watermark(){
    const text=$('#watermark').value.trim(),size=+$('#fontSize').value;
    if(!text||size<8||size>160)throw Error(H.common[H.lang()].error);
    await document.fonts.ready;
    const doc=await loadDoc(),weight=+($('#watermarkWeight')?.value||700),angle=(+($('#watermarkRotation')?.value||0))*Math.PI/180,color=$('#watermarkColor')?.value||'#666666',position=$('#watermarkPos')?.value||'center',opacity=+$('#opacity').value/100;
    const base=document.createElement('canvas'),measure=base.getContext('2d');measure.font=`${weight} ${size*2}px HozArabic,HozLatin,Arial,sans-serif`;const textW=Math.ceil(measure.measureText(text).width)+36,textH=Math.ceil(size*3.2),cos=Math.abs(Math.cos(angle)),sin=Math.abs(Math.sin(angle));base.width=Math.max(2,Math.ceil(textW*cos+textH*sin));base.height=Math.max(2,Math.ceil(textW*sin+textH*cos));const cx=base.getContext('2d');cx.translate(base.width/2,base.height/2);cx.rotate(angle);cx.font=`${weight} ${size*2}px HozArabic,HozLatin,Arial,sans-serif`;cx.fillStyle=color;cx.textAlign='center';cx.textBaseline='middle';cx.direction=H.lang()==='ar'?'rtl':'ltr';cx.fillText(text,0,0);
    const png=await doc.embedPng(await(await new Promise(r=>base.toBlob(r,'image/png'))).arrayBuffer()),naturalW=base.width/2,naturalH=base.height/2,range=H.ranges($('#watermarkPages')?.value||'',doc.getPageCount()),ids=new Set(range.length?range:doc.getPageIndices());
    doc.getPages().forEach((p,i)=>{if(!ids.has(i))return;const pw=p.getWidth(),ph=p.getHeight(),scale=Math.min(1,pw*.82/naturalW,ph*.45/naturalH),w=naturalW*scale,h=naturalH*scale,margin=28;const draw=(x,y)=>p.drawImage(png,{x,y,width:w,height:h,opacity});if(position==='tile'){const sx=Math.max(w*1.35,120),sy=Math.max(h*1.65,90);for(let y=margin-h/2;y<ph;y+=sy)for(let x=margin-w/2;x<pw;x+=sx)draw(x,y);return}let x=(pw-w)/2,y=(ph-h)/2;if(position.includes('left'))x=margin;if(position.includes('right'))x=pw-w-margin;if(position.startsWith('top'))y=ph-h-margin;if(position.startsWith('bottom'))y=margin;draw(x,y)});
    await save(doc,outName('watermarkName','watermarked'))
  }
  async function numberPages(){
    const doc=await loadDoc(),start=+$('#numberStart').value||1,pos=$('#numberPos').value,size=Math.max(6,Math.min(72,+($('#numberSize')?.value||11))),color=$('#numberColor')?.value||'#444444',prefix=$('#numberPrefix')?.value||'',suffix=$('#numberSuffix')?.value||'',range=H.ranges($('#numberPagesRange')?.value||'',doc.getPageCount()),ids=range.length?range:doc.getPageIndices();let n=start;
    await document.fonts.ready;
    for(const i of ids){const p=doc.getPage(i),text=`${prefix}${n++}${suffix}`,c=document.createElement('canvas'),cx=c.getContext('2d');cx.font=`700 ${size*2}px HozArabic,HozLatin,Arial,sans-serif`;c.width=Math.ceil(cx.measureText(text).width)+18;c.height=Math.ceil(size*3);cx.font=`700 ${size*2}px HozArabic,HozLatin,Arial,sans-serif`;cx.fillStyle=color;cx.textAlign='center';cx.textBaseline='middle';cx.direction=/[\u0590-\u08ff]/.test(text)?'rtl':'ltr';cx.fillText(text,c.width/2,c.height/2);const img=await doc.embedPng(await(await new Promise(r=>c.toBlob(r,'image/png'))).arrayBuffer()),w=c.width/2,h=c.height/2,{width:pw,height:ph}=p.getSize(),margin=20;let x=(pw-w)/2,y=margin;if(pos.includes('left'))x=28;if(pos.includes('right'))x=pw-w-28;if(pos.startsWith('top'))y=ph-h-margin;p.drawImage(img,{x,y,width:w,height:h})}
    await save(doc,outName('numberName',`${H.basename(primary.name)}-numbered`))
  }
  async function clean(){const doc=await loadDoc(),info=doc.context.lookup(doc.context.trailerInfo.Info);if(info?.keys)for(const k of info.keys())info.delete(k);doc.catalog.delete(PDFLib.PDFName.of('Metadata'));await save(doc,outName('cleanName','clean'))}
  async function imagesPdf(){
    const doc=await PDFLib.PDFDocument.create(),items=[];for(const f of imageFiles){const bytes=await f.arrayBuffer(),img=f.type==='image/png'||/\.png$/i.test(f.name)?await doc.embedPng(bytes):await doc.embedJpg(bytes),dim=img.scale(1);items.push({f,img,width:dim.width,height:dim.height})}
    if(!items.length)return;
    const mode=$('#imagePageMode')?.value||'own',fit=$('#imageFit')?.value||'contain',margin=Math.max(0,+($('#imageMargin')?.value||0)),bg=hexRgb($('#imageBg')?.value||'#ffffff'),upscale=$('#imageUpscale')?.checked!==false;let common=null;
    if(mode==='first')common=[items[0].width+margin*2,items[0].height+margin*2];
    if(mode==='largest')common=[Math.max(...items.map(x=>x.width))+margin*2,Math.max(...items.map(x=>x.height))+margin*2];
    if(mode==='a4')common=[595.28,841.89];if(mode==='a4-landscape')common=[841.89,595.28];
    for(const item of items){let pw,ph;if(mode==='own'){pw=item.width+margin*2;ph=item.height+margin*2}else [pw,ph]=common;const page=doc.addPage([pw,ph]);page.drawRectangle({x:0,y:0,width:pw,height:ph,color:bg});const aw=Math.max(1,pw-margin*2),ah=Math.max(1,ph-margin*2);let w=item.width,h=item.height;if(mode!=='own'){if(fit==='stretch'&&upscale){w=aw;h=ah}else{let scale=fit==='cover'?Math.max(aw/item.width,ah/item.height):Math.min(aw/item.width,ah/item.height);if(!upscale)scale=Math.min(1,scale);w=item.width*scale;h=item.height*scale}}const x=(pw-w)/2,y=(ph-h)/2;page.drawImage(item.img,{x,y,width:w,height:h})}
    await save(doc,outName('imagesName','images'))
  }
  async function getRenderer(){
    if(window.pdfjsLib)return window.pdfjsLib;
    if(!rendererPromise)rendererPromise=import('../assets/vendor/pdf.mjs').then(engine=>{engine.GlobalWorkerOptions.workerSrc=new URL('../assets/vendor/pdf.worker.mjs',location.href).href;window.pdfjsLib=engine;return engine}).catch(e=>{rendererPromise=null;throw e});
    return rendererPromise;
  }
  async function jpg(){
    const renderer=await getRenderer(),pdf=await renderer.getDocument({data:new Uint8Array(await primary.arrayBuffer()),isEvalSupported:false,cMapUrl:new URL('../assets/vendor/cmaps/',location.href).href,cMapPacked:true,standardFontDataUrl:new URL('../assets/vendor/standard_fonts/',location.href).href,wasmUrl:new URL('../assets/vendor/wasm/',location.href).href,iccUrl:new URL('../assets/vendor/iccs/',location.href).href}).promise,zip=new JSZip(),range=H.ranges($('#jpgPages')?.value||'',pageCount||99999),selected=range.length?new Set(range.map(i=>i+1)):null,quality=Math.max(.55,Math.min(1,+($('#jpgQuality')?.value||90)/100)),format=$('#jpgFormat')?.value||'jpeg',prefix=cleanName($('#jpgPrefix')?.value)||'page',zipName=cleanName($('#jpgZipName')?.value)||'pdf-images',mime=format==='png'?'image/png':'image/jpeg',ext=format==='png'?'png':'jpg';
    try{let count=0;for(let i=1;i<=pdf.numPages;i++){if(selected&&!selected.has(i))continue;const p=await pdf.getPage(i),v=p.getViewport({scale:+$('#jpgScale').value});if(v.width*v.height>24e6)throw Error(t('Choose a lower image scale.','اختر دقة صور أقل.','Elige una escala menor.'));const c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);const gc=c.getContext('2d',{alpha:false});gc.fillStyle='#fff';gc.fillRect(0,0,c.width,c.height);await p.render({canvasContext:gc,viewport:v}).promise;const blob=await new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('Image export failed')),mime,format==='png'?undefined:quality));zip.file(`${prefix}-${String(i).padStart(3,'0')}.${ext}`,await blob.arrayBuffer());count++;p.cleanup();c.width=1;c.height=1}if(!count)throw Error(t('No pages matched the selected range.','لا توجد صفحات مطابقة للنطاق المحدد.','Ninguna página coincide con el rango.'));H.download(await zip.generateAsync({type:'blob'}),`${zipName}.zip`)}finally{await pdf.destroy()}
  }
  async function fill(){const doc=await loadDoc(),form=doc.getForm();for(const [i,f]of fields.entries()){if(f.type==='unsupported')continue;const el=$('#pdf-field-'+i),field=form.getField(f.name);if(f.type==='PDFCheckBox')el.checked?field.check():field.uncheck();else if(f.type==='PDFTextField'){if(/[^\x00-\xff]/.test(el.value))throw Error(t('PDF form text currently supports Latin characters. Arabic watermarks are supported.','حقول PDF تدعم حاليًا الأحرف اللاتينية؛ العلامات المائية تدعم العربية.','Los campos PDF admiten caracteres latinos; las marcas de agua admiten árabe.'));field.setText(el.value)}else field.select(el.value)}form.updateFieldAppearances();if($('#flattenForm')?.checked)form.flatten();await save(doc,outName('formsName','filled'))}
  const syncJpgQuality=()=>{const q=$('#jpgQuality');if(q){q.disabled=$('#jpgFormat')?.value==='png';q.closest('.field')?.classList.toggle('is-disabled',q.disabled)}};
  $('#jpgFormat')?.addEventListener('change',syncJpgQuality);syncJpgQuality();
  const syncOpacityLabel=()=>{const o=$('#opacity'),l=$('#opacityLabel');if(o&&l)l.textContent=`${o.value}%`};
  $('#opacity')?.addEventListener('input',syncOpacityLabel);syncOpacityLabel();
  H.enhanceDrop($('#pdfDrop'),add);
  $('#clearFiles').onclick=()=>{imageFiles.forEach(revokePreview);files=[];pdfFiles=[];imageFiles=[];wordFiles=[];primary=null;wordPrimary=null;pageCount=0;fields=[];window.HozWordPdf?.clearFile();renderFiles();renderFields();$('#pdfInfo').innerHTML='';buttons()};
  [['mergeBtn',merge],['splitBtn',split],['extractBtn',()=>extract()],['deleteBtn',()=>extract(true)],['reorderBtn',()=>extract(false,true)],['rotateBtn',rotate],['watermarkBtn',watermark],['numberBtn',numberPages],['cleanBtn',clean],['imagesPdfBtn',imagesPdf],['jpgBtn',jpg],['fillFormBtn',fill]].forEach(([id,fn])=>$('#'+id).onclick=async()=>{await H.busy($('#'+id),fn);buttons()});
  document.addEventListener('hoz:language',()=>{setEngineStatus();renderFiles();if(primary)inspect();else renderSimpleInfo()});
  setEngineStatus(ready()?'ready':'unavailable');
  buttons();
})();
