(function(){
  'use strict';
  const H=window.HozTools,$=H.$,$$=H.$$,t=H.tr;
  const selectStates=new WeakMap();let openSelect=null;
  const associatedLabel=control=>document.querySelector(`label[for="${CSS.escape(control.id)}"]`)||control.closest('.field')?.querySelector('label');
  const optionLabel=option=>option.dataset[H.lang()]||option.label||option.textContent.trim();
  const optionDisabled=option=>option.disabled||option.parentElement?.disabled;
  function closeMenu(focus=false){
    if(!openSelect)return;const {button,menu}=openSelect;openSelect=null;
    button.setAttribute('aria-expanded','false');button.removeAttribute('aria-controls');menu.remove();if(focus&&button.isConnected)button.focus();
  }
  function placeMenu(){
    if(!openSelect)return;const {button,menu}=openSelect;
    if(!button.isConnected){closeMenu();return}
    const r=button.getBoundingClientRect(),width=Math.min(Math.max(r.width,240),innerWidth-24),below=innerHeight-r.bottom-12,above=r.top-12,up=below<200&&above>below;
    menu.style.width=width+'px';menu.style.left=Math.max(12,Math.min(r.left,innerWidth-width-12))+'px';
    menu.style.maxHeight=Math.max(80,Math.min(360,up?above:below))+'px';menu.style.top=up?'auto':Math.max(12,r.bottom+6)+'px';menu.style.bottom=up?Math.max(12,innerHeight-r.top+6)+'px':'auto';
  }
  function openMenu(select,button,last=false){
    closeMenu();if(select.disabled)return;
    const menu=document.createElement('div');menu.className='neo-menu site-listbox';menu.id=select.id+'-options';menu.role='listbox';menu.setAttribute('aria-label',associatedLabel(select)?.textContent.trim()||t('Choose an option','اختر خيارًا','Elige una opción'));
    if(select.multiple)menu.setAttribute('aria-multiselectable','true');
    const options=[...select.options];let items=[],buffer='',stamp=0;
    function choose(index){
      const option=options[index];if(optionDisabled(option))return;
      if(select.multiple)option.selected=!option.selected;else select.selectedIndex=index;
      select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));
      if(!select.multiple)closeMenu(true);else items.forEach((el,i)=>el.setAttribute('aria-selected',String(options[i].selected)));
    }
    options.forEach((option,i)=>{
      const item=document.createElement('div');item.className='neo-option';item.role='option';item.tabIndex=-1;
      item.setAttribute('aria-selected',String(option.selected));item.setAttribute('aria-disabled',String(!!optionDisabled(option)));
      const mark=document.createElement('span');mark.className='neo-option-mark';mark.setAttribute('aria-hidden','true');mark.innerHTML=H.icon('Check');
      const label=document.createElement('span');const group=option.parentElement?.tagName==='OPTGROUP'?option.parentElement.label+' · ':'';label.textContent=group+optionLabel(option);item.append(mark,label);item.addEventListener('click',()=>choose(i));menu.append(item);items.push(item);
    });
    openSelect={select,button,menu};document.body.append(menu);button.setAttribute('aria-expanded','true');button.setAttribute('aria-controls',menu.id);placeMenu();
    function focus(item){items.forEach(el=>el.tabIndex=el===item?0:-1);item?.focus({preventScroll:true});item?.scrollIntoView?.({block:'nearest'})}
    const enabled=items.filter(el=>el.getAttribute('aria-disabled')!=='true');focus(last?enabled.at(-1):(enabled.find(el=>el.getAttribute('aria-selected')==='true')||enabled[0]));
    if(!enabled.length){menu.tabIndex=-1;menu.focus()}
    menu.addEventListener('keydown',e=>{
      const i=enabled.indexOf(document.activeElement);let target;
      if(e.key==='ArrowDown')target=enabled[(i+1)%enabled.length];else if(e.key==='ArrowUp')target=enabled[(i-1+enabled.length)%enabled.length];else if(e.key==='Home')target=enabled[0];else if(e.key==='End')target=enabled.at(-1);
      else if(e.key==='Enter'||e.key===' '){e.preventDefault();const n=items.indexOf(document.activeElement);if(n>=0)choose(n);return}
      else if(e.key==='Tab'){closeMenu(true);return}
      else if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){const now=Date.now();buffer=now-stamp>700?e.key:buffer+e.key;stamp=now;const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();target=[...enabled.slice(i+1),...enabled.slice(0,i+1)].find(el=>norm(el.textContent).startsWith(norm(buffer)))}else return;
      if(target){e.preventDefault();focus(target)}
    });
  }
  function syncSelect(select){
    const state=selectStates.get(select);if(!state)return;
    const {root,button}=state,options=[...select.options];
    const segmented=options.length>1&&options.length<=4&&!select.multiple&&!select.required&&!select.querySelector('optgroup');
    select.hidden=true;root.hidden=!segmented;button.hidden=segmented;
    root.dataset.count=String(options.length);
    const label=associatedLabel(select);if(label){label.id||=select.id+'-label';root.setAttribute('aria-labelledby',label.id);button.setAttribute('aria-labelledby',label.id+' '+state.value.id)}
    button.disabled=select.disabled;button.setAttribute('aria-required',String(select.required));
    const value=options.filter(o=>o.selected).map(optionLabel).join(' · ')||t('Choose an option','اختر خيارًا','Elige una opción');if(state.value.textContent!==value)state.value.textContent=value;
    if(openSelect?.select===select){if(select.disabled||segmented||options.length!==state.options.length||options.some((o,i)=>o!==state.options[i]))closeMenu();else [...openSelect.menu.children].forEach((el,i)=>{el.setAttribute('aria-selected',String(options[i].selected));el.setAttribute('aria-disabled',String(!!optionDisabled(options[i])))})}
    if(!segmented){state.options=options;return}
    if(root.children.length!==options.length||options.some((o,i)=>o!==state.options[i])){
      root.replaceChildren();
      options.forEach((option,index)=>{
        const item=document.createElement('label');item.className='segment-option';
        const radio=document.createElement('input');radio.type='radio';radio.name=state.name;
        const text=document.createElement('span');item.append(radio,text);root.append(item);
        radio.addEventListener('change',()=>{if(!radio.checked)return;select.selectedIndex=index;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));syncSelect(select)});
      });
    }
    state.options=options;
    [...root.children].forEach((item,i)=>{const radio=item.firstElementChild,text=item.lastElementChild,label=optionLabel(options[i]);radio.checked=options[i].selected;radio.disabled=select.disabled||optionDisabled(options[i]);if(text.textContent!==label)text.textContent=label});
  }
  function enhanceSelect(select){
    if(selectStates.has(select))return;select.id||='select-'+H.uid();
    const root=document.createElement('div');root.className='segment-picker';root.setAttribute('role','group');select.after(root);
    const button=document.createElement('button');button.type='button';button.id=select.id+'-control';button.className='neo-select-button';button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');
    const value=document.createElement('span');value.className='neo-select-value';value.id=button.id+'-value';
    const chevron=document.createElement('span');chevron.className='neo-select-chevron';chevron.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>';button.append(value,chevron);root.after(button);
    selectStates.set(select,{root,button,value,options:[],name:'segment-'+H.uid()});
    button.onclick=()=>openSelect?.select===select?closeMenu(true):openMenu(select,button);
    button.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();openMenu(select,button,e.key==='ArrowUp')}};
    select.addEventListener('input',()=>syncSelect(select));select.addEventListener('change',()=>syncSelect(select));
    select.addEventListener('invalid',e=>{e.preventDefault();button.focus();H.toast(t('Choose an option','اختر خيارًا','Elige una opción'),'error')});
    new MutationObserver(()=>syncSelect(select)).observe(select,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['disabled','selected','label','value','required','multiple']});
    select.form?.addEventListener('reset',()=>queueMicrotask(()=>syncSelect(select)));syncSelect(select);
  }
  document.addEventListener('pointerdown',e=>{if(openSelect&&!openSelect.menu.contains(e.target)&&!openSelect.button.contains(e.target))closeMenu()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openSelect){e.preventDefault();closeMenu(true)}});
  document.addEventListener('hoz:language',()=>closeMenu());
  addEventListener('resize',placeMenu,{passive:true});addEventListener('scroll',placeMenu,{passive:true,capture:true});
  function fileName(input){return input.files?.length?(input.files.length===1?input.files[0].name:t(`${input.files.length} files selected`,`تم اختيار ${input.files.length} ملفات`,`${input.files.length} archivos seleccionados`)):t('No file selected','لم يُختر ملف','Ningún archivo seleccionado')}
  function syncFile(input){const root=input.closest('.neo-file');if(root)$('.neo-file-name',root).textContent=fileName(input)}
  function enhanceFile(input){
    if(input.hasAttribute('data-native-file'))return;
    if(input.closest('.dropzone')){input.classList.add('neo-native-file');return}
    if(input.closest('.neo-file'))return;
    const root=document.createElement('div');root.className='neo-file';const button=document.createElement('button');button.type='button';button.className='neo-file-button';button.innerHTML=H.icon('Image')+`<span>${t('Choose file','اختر ملفًا','Elegir archivo')}</span>`;
    const name=document.createElement('span');name.className='neo-file-name';name.textContent=fileName(input);input.before(root);root.append(input,button,name);input.classList.add('neo-native-control');input.tabIndex=-1;
    const label=associatedLabel(input);if(label){label.htmlFor=button.id=(input.id||H.uid())+'-file-control'}
    button.onclick=e=>{e.stopPropagation();input.click()};input.addEventListener('change',()=>syncFile(input));
  }
  function hexToRgb(hex){const m=/^#([\da-f]{6})$/i.exec(hex);return m?[parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4),16)]:null}
  function rgbToHex(r,g,b){return'#'+[r,g,b].map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('').toUpperCase()}
  function rgbToHsv(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d)h=mx===r?60*((g-b)/d%6):mx===g?60*((b-r)/d+2):60*((r-g)/d+4);return[(h+360)%360,mx?d/mx:0,mx]}
  function hsvToRgb(h,s,v){const c=v*s,x=c*(1-Math.abs(h/60%2-1)),m=v-c;let a=[c,x,0];if(h<60)a=[c,x,0];else if(h<120)a=[x,c,0];else if(h<180)a=[0,c,x];else if(h<240)a=[0,x,c];else if(h<300)a=[x,0,c];else a=[c,0,x];return a.map(n=>(n+m)*255)}
  function syncColor(input){const root=input.closest('.neo-color');if(!root)return;const hex=input.value.toUpperCase();$('.neo-color-swatch',root).style.background=hex;$('.neo-color-value',root).textContent=hex}
  function openColor(input,button){
    closeMenu();let [h,s,v]=rgbToHsv(...hexToRgb(input.value));let pending=input.value.toUpperCase();
    const overlay=document.createElement('dialog');overlay.className='neo-dialog-layer';overlay.innerHTML=`<section class="neo-color-dialog" role="dialog" aria-modal="true"><header><div><small>${t('Color palette','لوحة الألوان','Paleta de colores')}</small><h2>${t('Choose a color','اختر لونًا','Elige un color')}</h2></div><button type="button" class="neo-dialog-x" aria-label="${t('Close','إغلاق','Cerrar')}">${H.icon('X')}</button></header><div class="neo-color-preview"><span></span><strong>${pending}</strong></div><canvas class="neo-sv" width="520" height="260" aria-label="${t('Saturation and brightness','التشبع والإضاءة','Saturación y brillo')}"></canvas><div class="neo-hue-row"><span>H</span><input class="neo-hue" aria-label="${t('Hue','درجة اللون','Tono')}" type="range" min="0" max="359" value="${Math.round(h)}"><span>${Math.round(h)}°</span></div><div class="neo-presets"></div><label class="neo-hex-label"><span>${t('HEX value','قيمة HEX','Valor HEX')}</span><input class="neo-hex" value="${pending}" maxlength="7" inputmode="text"></label><footer><button type="button" class="btn ghost neo-cancel">${t('Cancel','إلغاء','Cancelar')}</button><button type="button" class="btn primary neo-apply">${t('Apply color','تطبيق اللون','Aplicar color')}</button></footer></section>`;
    document.body.append(overlay);overlay.showModal();overlay.addEventListener('cancel',e=>{e.preventDefault();close(false)});document.body.classList.add('neo-modal-open');const dialog=$('.neo-color-dialog',overlay),canvas=$('.neo-sv',overlay),ctx=canvas.getContext('2d'),preview=$('.neo-color-preview span',overlay),code=$('.neo-color-preview strong',overlay),hex=$('.neo-hex',overlay),hue=$('.neo-hue',overlay),degree=$('.neo-hue-row span:last-child',overlay);
    const presets=['#111827','#FFFFFF','#FFE500','#00D9C0','#7C5CFC','#32D5FF','#FF6B6B','#FF7AC6','#22C55E','#F97316','#2563EB','#9333EA'];
    $('.neo-presets',overlay).innerHTML=presets.map(c=>`<button type="button" data-color="${c}" style="--swatch:${c}" aria-label="${c}"></button>`).join('');
    function draw(){const base=hsvToRgb(h,1,1),g=ctx.createLinearGradient(0,0,canvas.width,0);g.addColorStop(0,'#fff');g.addColorStop(1,rgbToHex(...base));ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);const dark=ctx.createLinearGradient(0,0,0,canvas.height);dark.addColorStop(0,'transparent');dark.addColorStop(1,'#000');ctx.fillStyle=dark;ctx.fillRect(0,0,canvas.width,canvas.height);const x=s*canvas.width,y=(1-v)*canvas.height;ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.fillStyle=pending;ctx.fill();ctx.lineWidth=4;ctx.strokeStyle='#fff';ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle='#111827';ctx.stroke()}
    function update(){pending=rgbToHex(...hsvToRgb(h,s,v));preview.style.background=pending;code.textContent=hex.value=pending;degree.textContent=Math.round(h)+'°';draw()}
    function choose(c){const rgb=hexToRgb(c);if(!rgb)return;[h,s,v]=rgbToHsv(...rgb);hue.value=Math.round(h);update()}
    function point(e){const r=canvas.getBoundingClientRect();s=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));v=1-Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));update()}
    let drag=false;canvas.onpointerdown=e=>{drag=true;canvas.setPointerCapture(e.pointerId);point(e)};canvas.onpointermove=e=>{if(drag)point(e)};canvas.onpointerup=canvas.onpointercancel=()=>drag=false;hue.oninput=()=>{h=+hue.value;update()};hex.oninput=()=>{const c=hex.value.startsWith('#')?hex.value:'#'+hex.value;if(hexToRgb(c))choose(c)};$$('[data-color]',overlay).forEach(b=>b.onclick=()=>choose(b.dataset.color));
    function close(apply){if(apply){input.value=pending;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));syncColor(input)}overlay.close();overlay.remove();document.body.classList.remove('neo-modal-open');button.focus()}
    $('.neo-dialog-x',overlay).onclick=$('.neo-cancel',overlay).onclick=()=>close(false);$('.neo-apply',overlay).onclick=()=>close(true);overlay.onpointerdown=e=>{if(e.target===overlay)close(false)};overlay.onkeydown=e=>{if(e.key==='Escape')close(false);if(e.key==='Tab'){const all=$$('button:not(:disabled),input:not(:disabled)',dialog),first=all[0],last=all[all.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){e.preventDefault();last.focus()}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialog)){e.preventDefault();first.focus()}}};update();dialog.tabIndex=-1;dialog.setAttribute('aria-label',t('Choose a color','اختر لونًا','Elige un color'));dialog.focus();
  }
  function enhanceColor(input){
    if(input.closest('.neo-color'))return;const root=document.createElement('div');root.className='neo-color';const button=document.createElement('button');button.type='button';button.className='neo-color-button';button.id=(input.id||H.uid())+'-color-control';button.innerHTML=`<span class="neo-color-swatch"></span><span class="neo-color-copy"><small>${t('Choose color','اختر اللون','Elegir color')}</small><strong class="neo-color-value"></strong></span><span class="neo-color-edit">${t('Edit','تعديل','Editar')}</span>`;input.before(root);root.append(input,button);input.classList.add('neo-native-control');input.tabIndex=-1;const label=associatedLabel(input);if(label)label.htmlFor=button.id;button.onclick=()=>openColor(input,button);input.addEventListener('input',()=>syncColor(input));syncColor(input);
  }
  function enhanceAll(scope=document){
    $$('.field',scope).forEach(field=>{const label=$('label',field),control=$('input,textarea,select',field);if(label&&control&&!label.htmlFor){control.id||='field-'+H.uid();label.htmlFor=control.id}});
    $$('select',scope).forEach(enhanceSelect);$$('input[type="file"]',scope).forEach(enhanceFile);$$('input[type="color"]',scope).forEach(enhanceColor)
  }
  document.addEventListener('hoz:language',()=>{$$('select').forEach(syncSelect);$$('.neo-file .neo-native-control').forEach(syncFile);$$('.neo-file-button span').forEach(el=>el.textContent=t('Choose file','اختر ملفًا','Elegir archivo'));$$('.neo-color-copy small').forEach(el=>el.textContent=t('Choose color','اختر اللون','Elegir color'));$$('.neo-color-edit').forEach(el=>el.textContent=t('Edit','تعديل','Editar'))});
  document.addEventListener('DOMContentLoaded',()=>{enhanceAll();new MutationObserver(mutations=>{for(const m of mutations){if(m.target.tagName==='SELECT'||m.target.tagName==='OPTION'){const s=m.target.tagName==='SELECT'?m.target:m.target.closest('select');if(s)syncSelect(s)}for(const node of m.addedNodes){if(node.nodeType!==1)continue;if(node.matches?.('select,input[type="file"],input[type="color"]'))enhanceAll(node.parentElement);else enhanceAll(node)}}}).observe(document.querySelector('main'),{childList:true,subtree:true,characterData:true})});
})();
