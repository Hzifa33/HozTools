/* Shared localization, accessible controls and studio export sheet. */
(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const words=(en,ar,es)=>({en,ar,es}[document.documentElement.lang]||en);
const basePath=()=>document.body.dataset.pagePath||'/';
const localized=(path,lang)=>lang==='en'?path:`/${lang}${path}`;
function language(){
 const lang=document.documentElement.lang;
 $$('[data-en]').forEach(el=>{if(el.dataset[lang]!=null&&el.getAttribute('aria-busy')!=='true'&&el.textContent!==el.dataset[lang])el.textContent=el.dataset[lang]});
 $$('[data-en-label]').forEach(el=>el.setAttribute('aria-label',el.dataset[lang+'Label']||el.dataset.enLabel));
 const url=localized(basePath(),lang);if(location.pathname!==url)history.replaceState(null,'',url+location.search+location.hash);
 const manifest=$('link[rel=manifest]');if(manifest)manifest.href=localized('/manifest.webmanifest',lang);
 const canonical=$('link[rel=canonical]');if(canonical)canonical.href='https://tools.hzifa33.com'+url;
 $$('meta[data-en-content]').forEach(el=>el.content=el.dataset[lang+'Content']||el.dataset.enContent);
 if(document.body.dataset[lang+'Title'])document.title=document.body.dataset[lang+'Title'];
 const og=$('meta[property="og:url"]');if(og)og.content='https://tools.hzifa33.com'+url;
 $$('a[href]').forEach(a=>{const raw=a.getAttribute('href');if(raw.startsWith('#')||a.hasAttribute('download')||a.hasAttribute('hreflang'))return;let u;try{u=new URL(raw,location.href)}catch{return}if(u.origin!==location.origin)return;let p=u.pathname.replace(/^\/(ar|es)(?=\/|$)/,'');if((p==='/'||p.startsWith('/'))&&!/\.[a-z0-9]+$/i.test(p)){a.href=localized(p,lang)+u.search+u.hash}});
 const btn=$('#neo-lang-btn');if(btn){btn.setAttribute('aria-label',words('Choose language','اختر اللغة','Elegir idioma'));btn.setAttribute('aria-controls','neo-lang-menu')}
 $$('button.neo-lang-option').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.lang===lang)));
 const theme=$('#neo-theme-btn');if(theme)theme.setAttribute('aria-label',document.documentElement.classList.contains('dark')?words('Light theme','المظهر النهاري','Tema claro'):words('Dark theme','المظهر الليلي','Tema oscuro'));
}
function init(){
 if('serviceWorker' in navigator&&isSecureContext)navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{});
 language();document.addEventListener('hoz:language',language);
 // The portfolio runtime updates lang directly. Observe only this attribute.
 new MutationObserver(language).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 const menu=$('#neo-lang-menu'),button=$('#neo-lang-btn');
 button?.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();menu?.classList.add('show');button.setAttribute('aria-expanded','true');$('button',menu)?.focus()}});
 menu?.addEventListener('keydown',e=>{const options=$$('button',menu);let i=options.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();i=e.key==='Home'?0:e.key==='End'?options.length-1:(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;options[i]?.focus()}if(e.key==='Escape'){menu.classList.remove('show');button?.setAttribute('aria-expanded','false');button?.focus()}});
 // Associate dynamically generated form fields with their visible labels.
 function labels(){ $$('.field,.field-c').forEach(f=>{const label=$('label',f),input=$('input[id],select[id],textarea[id]',f);if(label&&input&&!label.htmlFor)label.htmlFor=input.id}) }
 labels();const main=$('main');if(main)new MutationObserver(labels).observe(main,{childList:true,subtree:true});
 if(document.body.classList.contains('image-tool'))initStudio();
}
function initStudio(){
 const H=window.HozTools;
 $('.sh-center')?.prepend($('.sh-history-group'));
 const dialog=document.createElement('dialog');dialog.className='soft-dialog';dialog.setAttribute('aria-labelledby','exportTitle');
 dialog.innerHTML=`<h2 id="exportTitle"></h2><p id="exportNote"></p><div class="fields"><div class="field"><label for="exportFormat"></label><select class="select" id="exportFormat"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></div><div class="field"><label for="exportQuality"></label><input class="input" type="number" id="exportQuality" min="10" max="100" step="1"></div><div class="fields two"><div class="field"><label for="exportWidth"></label><input class="input" type="number" id="exportWidth" min="1" max="16384" step="1"></div><div class="field"><label for="exportHeight"></label><input class="input" type="number" id="exportHeight" min="1" max="16384" step="1"></div></div><label class="check"><input id="exportLock" type="checkbox" checked><span id="exportLockLabel"></span></label><div class="field"><label for="exportTarget"></label><input class="input" id="exportTarget" type="number" min="0" max="100000" step="1" placeholder="0"></div></div><p id="exportSize" role="status"></p><div class="actions"><button type="button" class="btn ghost" id="exportClose"></button><button type="button" class="btn primary" id="exportDownload"></button></div>`;
 document.body.append(dialog);let returnFocus,aspect=1;
 const pairs={exportFormat:'format',exportQuality:'quality',exportWidth:'width',exportHeight:'height',exportTarget:'targetKb'};
 function translate(){
  $('#exportTitle').textContent=words('Make it yours.','صورتك جاهزة.','Hazla tuya.');$('#exportNote').textContent=words('Choose your format and size. Your original file stays unchanged.','اختر الصيغة والأبعاد. يبقى ملفك الأصلي دون تغيير.','Elige formato y tamaño. Tu archivo original se conserva.');
  const labels={exportFormat:words('File format','صيغة الملف','Formato'),exportQuality:words('Quality · 10–100%','الجودة · 10–100٪','Calidad · 10–100%'),exportWidth:words('Width · px','العرض · بكسل','Ancho · px'),exportHeight:words('Height · px','الارتفاع · بكسل','Alto · px'),exportTarget:words('Target size · KB (0 = automatic)','الحجم المستهدف · كيلوبايت (0 = تلقائي)','Tamaño objetivo · KB (0 = automático)')};
  Object.entries(labels).forEach(([id,text])=>$(`label[for=${id}]`,dialog).textContent=text);
  $('#exportLockLabel').textContent=words('Keep proportions','الحفاظ على النسبة','Mantener proporciones');$('#exportClose').textContent=words('Back to editing','العودة للتحرير','Volver a editar');$('#exportDownload').textContent=words('Download image','تنزيل الصورة','Descargar imagen');
 }
 function sync(id){const source=$('#'+pairs[id]);source.value=$('#'+id).value;source.dispatchEvent(new Event('input',{bubbles:true}));}
 Object.keys(pairs).forEach(id=>$('#'+id).addEventListener('input',()=>{
  if($('#exportLock').checked&&(id==='exportWidth'||id==='exportHeight')){const other=id==='exportWidth'?'exportHeight':'exportWidth';$('#'+other).value=Math.max(1,Math.round(id==='exportWidth'?Number($('#'+id).value)/aspect:Number($('#'+id).value)*aspect));}
  $('#lockRatio').checked=$('#exportLock').checked;sync(id);$('#exportQuality').disabled=$('#exportFormat').value==='image/png';
 }));
 const estimate=$('#estimate');if(estimate)new MutationObserver(()=>{$('#exportSize').textContent=estimate.textContent}).observe(estimate,{childList:true,subtree:true,characterData:true});
 function close(){dialog.close();returnFocus?.focus()}
 $('#exportClose').onclick=close;dialog.addEventListener('close',()=>returnFocus?.focus());dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});
 $('#quickExportBtn').onclick=()=>{translate();returnFocus=document.activeElement;Object.entries(pairs).forEach(([to,from])=>$('#'+to).value=$('#'+from).value);aspect=Number($('#width').value)/Number($('#height').value);$('#exportLock').checked=$('#lockRatio').checked;$('#exportQuality').disabled=$('#format').value==='image/png';$('#exportSize').textContent=estimate?.textContent||'';dialog.showModal()};
 $('#exportDownload').onclick=()=>H.busy($('#exportDownload'),async()=>{for(const el of $$('input[type=number]',dialog)){if(!el.checkValidity()||(!el.value&&el.id!=='exportTarget'))throw Error(H.common[H.lang()].error)}await window.HozImageExport();close()});
 document.addEventListener('hoz:language',translate);
 // A collapsible mobile options sheet lets the image keep more screen space.
 const title=$('#mobileToolTitle');if(title){const toggle=document.createElement('button');toggle.type='button';toggle.className='soft-sheet-toggle';toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-controls','mobileOptions');title.replaceWith(toggle);toggle.append(title);const shelves=$('.mobile-shelves-wrap');shelves.id='mobileOptions';toggle.onclick=()=>{const hidden=!shelves.hidden;shelves.hidden=hidden;toggle.setAttribute('aria-expanded',String(!hidden));window.dispatchEvent(new Event('resize'))};$$('.m-dock-btn').forEach(b=>b.addEventListener('click',()=>{shelves.hidden=false;toggle.setAttribute('aria-expanded','true');window.dispatchEvent(new Event('resize'))}));}
 // Mobile access to effect intensity and exact crop coordinates.
 function mirror(sourceId,shelf,titleText){const source=$('#'+sourceId);if(!source)return;const label=document.createElement('label'),input=source.cloneNode();input.id='soft-'+sourceId;input.removeAttribute('style');input.className=source.type==='range'?'m-range':'m-input';label.className='soft-mobile-field';const span=document.createElement('span');span.textContent=titleText;label.append(span,input);$(shelf)?.append(label);document.addEventListener('hoz:image-state',()=>input.value=source.value);document.addEventListener('hoz:language',()=>{if(sourceId==='effectStrength')span.textContent=words('Intensity','الشدة','Intensidad')});input.addEventListener('input',()=>{source.value=input.value;source.dispatchEvent(new Event('input',{bubbles:true}))});source.addEventListener('input',()=>input.value=source.value);input.disabled=source.disabled;new MutationObserver(()=>input.disabled=source.disabled).observe(source,{attributes:true,attributeFilter:['disabled']});}
 mirror('effectStrength','[data-m-shelf=privacy]',words('Intensity','الشدة','Intensidad'));
 const cropShelf=$('[data-m-shelf=crop]');const cropDetails=document.createElement('details');cropDetails.className='soft-crop-details';const summary=document.createElement('summary');summary.textContent=words('Exact crop coordinates','أبعاد القص الدقيقة','Coordenadas de recorte');document.addEventListener('hoz:language',()=>summary.textContent=words('Exact crop coordinates','أبعاد القص الدقيقة','Coordenadas de recorte'));cropDetails.addEventListener('toggle',()=>document.dispatchEvent(new Event('hoz:image-state')));cropDetails.append(summary);const grid=document.createElement('div');grid.id='softCropFields';cropDetails.append(grid);cropShelf.append(cropDetails);['cropX','cropY','cropW','cropH'].forEach((id,i)=>mirror(id,'#softCropFields',['X','Y','W','H'][i]));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
