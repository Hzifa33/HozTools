(function(){'use strict';
const H=window.HozTools,$=H.$,t=H.tr,button=$('#wordPdfBtn');let file=null,enginePromise=null,localPromise=null,closePreview=null,version=0;
const localHost=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
async function localEngine(){
 if(!localHost)return null;
 if(!localPromise)localPromise=fetch('/api/word-engine',{cache:'no-store',signal:AbortSignal.timeout(1800)}).then(r=>r.ok?r.json():null).then(info=>info?.engine==='libreoffice'&&info.token?info:null).catch(()=>null);
 return localPromise;
}
function loadEngine(){
 if(window.docx?.renderAsync)return Promise.resolve();
 if(!enginePromise)enginePromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/assets/vendor/docx-preview-0.3.7.min.js';let timer=setTimeout(()=>{script.remove();reject(Error(t('Could not load the Word preview engine.','تعذر تحميل محرك معاينة Word.','No se pudo cargar el motor de Word.')))},12000);script.onload=()=>{clearTimeout(timer);window.docx?.renderAsync?resolve():reject(Error('Word preview engine unavailable'))};script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error(t('Could not load the Word preview engine.','تعذر تحميل محرك معاينة Word.','No se pudo cargar el motor de Word.')))};document.head.append(script)}).catch(e=>{enginePromise=null;throw e});return enginePromise;
}
function outputName(source){const custom=String($('#wordOutputName')?.value||'').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\.pdf$/i,'').slice(0,80);return (custom||H.basename(source.name))+'.pdf'}
async function preview(source,serial){
 await loadEngine();if(serial!==version)throw Error(t('The selected file changed. Try again.','تغير الملف المختار؛ أعد المحاولة.','El archivo ha cambiado. Inténtalo de nuevo.'));
 closePreview?.();const dialog=document.createElement('dialog');dialog.className='word-preview-dialog';dialog.setAttribute('aria-label',t('Word print preview','معاينة طباعة Word','Vista previa de Word'));
 const head=document.createElement('header'),title=document.createElement('strong'),close=document.createElement('button');title.textContent=source.name;close.type='button';close.className='btn ghost';close.innerHTML=H.icon('X');close.setAttribute('aria-label',t('Close','إغلاق','Cerrar'));head.append(title,close);
 const note=document.createElement('p');note.textContent=t('Review every page. Choose Save as PDF in the print dialog; turn off browser headers and footers. Complex layouts may differ from Word.','راجع الصفحات ثم اختر حفظ بصيغة PDF في نافذة الطباعة، وأوقف رؤوس وتذييلات المتصفح. قد تختلف التنسيقات المعقدة عن Word.','Revisa las páginas. Elige Guardar como PDF y desactiva los encabezados del navegador. Los diseños complejos pueden diferir de Word.');
 const frame=document.createElement('iframe');frame.title=t('Document pages','صفحات المستند','Páginas del documento');frame.setAttribute('sandbox','allow-same-origin allow-modals');
 const print=document.createElement('button');print.type='button';print.className='btn primary';print.innerHTML=H.icon('Printer')+'<span>'+t('Save as PDF / Print','حفظ PDF / طباعة','Guardar PDF / Imprimir')+'</span>';print.disabled=true;dialog.append(head,note,frame,print);document.body.append(dialog);dialog.showModal();
 function finish(){if(!dialog.isConnected)return;dialog.close();dialog.remove();closePreview=null;button?.focus()}
 closePreview=finish;close.onclick=finish;dialog.addEventListener('cancel',e=>{e.preventDefault();finish()});
 try{
 const loaded=new Promise(resolve=>frame.onload=resolve);
 frame.srcdoc='<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data: blob:; font-src data: blob:; style-src \'unsafe-inline\'"><style>html,body{margin:0;background:#e8e8e8;color:#000}section.docx{box-shadow:none!important}@media print{html,body{background:#fff!important}.docx-wrapper{padding:0!important;background:none!important}section.docx{margin:0!important;box-shadow:none!important;break-after:page}section.docx:last-child{break-after:auto}}</style></head><body></body></html>';
 await loaded;if(!dialog.isConnected)return;const doc=frame.contentDocument;doc.title=outputName(source).replace(/\.pdf$/i,'');
 await window.docx.renderAsync(await source.arrayBuffer(),doc.body,doc.head,{inWrapper:true,hideWrapperOnPrint:true,breakPages:true,ignoreLastRenderedPageBreak:false,ignoreWidth:false,ignoreHeight:false,ignoreFonts:false,renderHeaders:true,renderFooters:true,renderFootnotes:true,renderEndnotes:true,renderAltChunks:false,useBase64URL:true});
 await doc.fonts?.ready;
 await Promise.all([...doc.images].map(img=>img.decode?.().catch(()=>{})||Promise.resolve()));
 const page=doc.querySelector('section.docx');if(page){const style=doc.createElement('style');const width=page.style.width,height=page.style.minHeight||page.style.height;if(/^[\d.]+pt$/.test(width)&&/^[\d.]+pt$/.test(height))style.textContent='@page{size:'+width+' '+height+';margin:0}';else style.textContent='@page{margin:0}';doc.head.append(style)}
 if(serial!==version){finish();return}print.disabled=false;print.onclick=()=>{frame.contentWindow.focus();frame.contentWindow.print()};
 }catch(e){finish();throw e}
}
async function convert(){
 if(!file)throw Error(t('Choose a DOCX document first.','اختر مستند DOCX أولًا.','Elige primero un documento DOCX.'));
 const source=file,serial=version,mode=$('#wordMode')?.value||'preview';
 if(mode==='local'){
  const engine=await localEngine();if(!engine)throw Error(t('Start the included local server with LibreOffice installed, then reload this page.','شغّل الخادم المحلي المرفق بعد تثبيت LibreOffice، ثم أعد تحميل الصفحة.','Inicia el servidor local incluido con LibreOffice instalado y recarga la página.'));
  const response=await fetch('/api/word-pdf',{method:'POST',headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','X-Hoz-Local':engine.token},body:source,signal:AbortSignal.timeout(100000)});
  if(!response.ok){const info=await response.json().catch(()=>({}));throw Error(info.error||t('Conversion failed.','تعذر التحويل.','Error de conversión.'))}
  const blob=await response.blob();if(blob.type.split(';')[0]!=='application/pdf')throw Error('Invalid PDF response');
  if(serial!==version)throw Error(t('The file changed. Convert the new selection.','تغير الملف؛ حوّل الملف المختار الجديد.','El archivo ha cambiado. Convierte la nueva selección.'));H.download(blob,outputName(source));
 }else await preview(source,serial);
}
function setFile(chosen){version++;closePreview?.();const valid=!!chosen&&/\.docx$/i.test(chosen.name)&&chosen.size<=25*1024*1024;if(!valid){file=null;if(button)button.disabled=true;H.toast(t('Choose a DOCX file below 25 MB.','اختر ملف DOCX دون 25 ميجابايت.','Elige un DOCX menor de 25 MB.'),'error');return false}file=chosen;if(button)button.disabled=false;return true}
function clearFile(){version++;file=null;closePreview?.();if(button)button.disabled=true}
if(button)button.onclick=()=>H.busy(button,convert).finally(()=>{button.disabled=!file});
window.HozWordPdf={setFile,clearFile,convert,preload:loadEngine,getFile:()=>file};
document.addEventListener('DOMContentLoaded',async()=>{const mode=$('#wordMode'),notice=$('#wordModeStatus');if(!mode)return;let userChose=false;mode.addEventListener('change',()=>{userChose=true});const local=await localEngine();if(local&&!userChose){mode.value='local';mode.dispatchEvent(new Event('change',{bubbles:true}))}const update=()=>{if(notice)notice.textContent=local?t('LibreOffice is ready on this computer. Files stay on your device.','LibreOffice جاهز على هذا الكمبيوتر. الملفات تبقى على جهازك.','LibreOffice está listo en este equipo. Los archivos no salen del dispositivo.'):t('Browser preview is available here. For LibreOffice conversion, run the included local server on a computer.','معاينة المتصفح متاحة هنا. لتحويل LibreOffice شغّل الخادم المحلي المرفق على كمبيوتر.','La vista previa funciona aquí. Para convertir con LibreOffice, inicia el servidor local en un ordenador.')};update();document.addEventListener('hoz:language',update)});
})();
