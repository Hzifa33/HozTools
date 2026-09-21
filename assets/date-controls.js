(function(){'use strict';const H=window.HozTools,t=H.tr,$=H.$;const seen=new WeakSet();let active=null;
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
function enhance(input){
 if(seen.has(input))return;seen.add(input);input.id||='date-'+H.uid();
 const kind=input.type,hasDate=kind!=='time',hasTime=kind!=='date',row=document.createElement('div');row.className='site-date-field';
 const editor=document.createElement('input');editor.type='text';editor.className='input';editor.dir='ltr';editor.id=input.id+'-editor';editor.autocomplete='off';editor.spellcheck=false;
 editor.placeholder=kind==='date'?'YYYY-MM-DD':kind==='time'?'HH:MM':'YYYY-MM-DDTHH:MM';
 const button=document.createElement('button');button.className='btn site-date-trigger';button.type='button';button.innerHTML=hasDate?'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
 const error=document.createElement('small');error.id=editor.id+'-error';error.className='site-field-error';error.hidden=true;editor.setAttribute('aria-describedby',error.id);
 input.hidden=true;input.after(row);row.append(editor,button,error);
 function sync(){editor.value=input.value;editor.disabled=button.disabled=input.disabled;const label=document.querySelector(`label[for="${CSS.escape(input.id)}"]`)||input.closest('.field')?.querySelector('label');if(label){label.id||=input.id+'-label';editor.setAttribute('aria-labelledby',label.id)}button.setAttribute('aria-label',t('Choose date / time','اختيار التاريخ / الوقت','Elegir fecha / hora'));}
 function commit(){const raw=H.digits(editor.value.trim());input.value=raw;const valid=(!raw||!!input.value)&&input.validity.valid;editor.setAttribute('aria-invalid',String(!valid));error.hidden=valid;if(!valid)error.textContent=t('Use the displayed format and a valid date/time.','استخدم الصيغة الموضحة وتاريخًا أو وقتًا صحيحًا.','Usa el formato indicado y una fecha u hora válida.');input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));if(!valid)editor.value=raw;}
 editor.addEventListener('change',commit);input.addEventListener('input',sync);input.addEventListener('change',sync);input.addEventListener('invalid',e=>{e.preventDefault();editor.focus()});
 new MutationObserver(sync).observe(input,{attributes:true,attributeFilter:['disabled','min','max','value']});input.form?.addEventListener('reset',()=>queueMicrotask(sync));document.addEventListener('hoz:language',()=>{if(input.isConnected)sync()});
 button.onclick=()=>{
  active?.();const overlay=document.createElement('dialog');overlay.className='site-calendar';overlay.setAttribute('aria-label',button.getAttribute('aria-label'));
  const now=new Date(),parsed=input.value&&hasDate?new Date(input.value.slice(0,10)+'T12:00:00'):now;let selected=isNaN(parsed)?now:parsed,month=selected.getMonth(),year=selected.getFullYear();
  const header=document.createElement('header'),heading=document.createElement('strong'),close=document.createElement('button');close.type='button';close.className='btn ghost';close.innerHTML=H.icon('X');close.setAttribute('aria-label',t('Close','إغلاق','Cerrar'));heading.textContent=button.getAttribute('aria-label');header.append(heading,close);overlay.append(header);
  const nav=document.createElement('div');nav.className='calendar-nav';const prev=document.createElement('button'),next=document.createElement('button'),yearLabel=document.createElement('label'),yearInput=document.createElement('input'),monthLabel=document.createElement('strong');
  prev.type=next.type='button';prev.className=next.className='btn ghost';prev.innerHTML=H.icon('ArrowLeft');next.innerHTML=H.icon('ArrowRight');prev.setAttribute('aria-label',t('Previous month','الشهر السابق','Mes anterior'));next.setAttribute('aria-label',t('Next month','الشهر التالي','Mes siguiente'));
  yearInput.type='number';yearInput.className='input';yearInput.min='1';yearInput.max='9999';yearInput.value=year;yearLabel.textContent=t('Year','السنة','Año');yearLabel.append(yearInput);nav.append(prev,monthLabel,next);const days=document.createElement('div');days.className='calendar-days';days.dir='ltr';
  if(hasDate)overlay.append(yearLabel,nav,days);
  let hour,minute;
  if(hasTime){const time=document.createElement('div');time.className='calendar-time';const source=(kind==='time'?input.value:input.value.split('T')[1])||'12:00';[hour,minute]=[0,1].map((i)=>{const label=document.createElement('label');label.textContent=i?t('Minute','الدقيقة','Minuto'):t('Hour','الساعة','Hora');const field=document.createElement('input');field.type='number';field.className='input';field.min='0';field.max=i?'59':'23';field.step='1';field.value=+(source.split(':')[i]||0);label.append(field);time.append(label);return field});overlay.append(time)}
  const foot=document.createElement('footer'),clear=document.createElement('button'),apply=document.createElement('button');clear.type=apply.type='button';clear.className='btn ghost';apply.className='btn primary';clear.textContent=t('Clear','مسح','Borrar');apply.textContent=t('Apply','تطبيق','Aplicar');foot.append(clear,apply);overlay.append(foot);
  function finish(){if(!overlay.isConnected)return;overlay.close();overlay.remove();active=null;button.focus()}
  active=finish;close.onclick=finish;overlay.addEventListener('cancel',e=>{e.preventDefault();finish()});overlay.addEventListener('click',e=>{if(e.target===overlay){const r=overlay.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)finish()}});
  function draw(focusDay){
   yearInput.value=year;monthLabel.textContent=new Intl.DateTimeFormat(H.lang(),{month:'long'}).format(new Date(year,month,15));days.replaceChildren();
   for(let i=0;i<7;i++){const label=document.createElement('span');label.textContent=new Intl.DateTimeFormat(H.lang(),{weekday:'narrow'}).format(new Date(2024,0,7+i));label.setAttribute('aria-hidden','true');days.append(label)}
   const first=new Date(0);first.setFullYear(year,month,1);first.setHours(12,0,0,0);for(let i=0;i<first.getDay();i++)days.append(document.createElement('span'));
   const end=new Date(first);end.setMonth(month+1,0);
   for(let n=1;n<=end.getDate();n++){
    const date=new Date(first);date.setDate(n);const value=iso(date),b=document.createElement('button');b.type='button';b.textContent=n;b.dataset.date=value;b.setAttribute('aria-label',new Intl.DateTimeFormat(H.lang(),{dateStyle:'full'}).format(date));b.setAttribute('aria-pressed',String(value===iso(selected)));b.disabled=!!((input.min&&value<input.min.slice(0,10))||(input.max&&value>input.max.slice(0,10)));b.onclick=()=>{selected=date;draw(value)};
    b.onkeydown=e=>{const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];if(!delta)return;e.preventDefault();const d=new Date(date);d.setDate(d.getDate()+delta);if(d.getFullYear()<1||d.getFullYear()>9999)return;year=d.getFullYear();month=d.getMonth();draw(iso(d))};days.append(b);
   }
   if(focusDay)days.querySelector(`[data-date="${focusDay}"]:not(:disabled)`)?.focus();
  }
  prev.onclick=()=>{if(year===1&&month===0)return;if(--month<0){month=11;year--}draw()};next.onclick=()=>{if(year===9999&&month===11)return;if(++month>11){month=0;year++}draw()};yearInput.onchange=()=>{if(yearInput.value&&yearInput.validity.valid){year=+yearInput.value;draw()}else yearInput.value=year};
  clear.onclick=()=>{editor.value='';commit();finish()};apply.onclick=()=>{if(hasTime&&(!hour.value||!minute.value||!hour.reportValidity()||!minute.reportValidity()))return;editor.value=(hasDate?iso(selected):'')+(hasDate&&hasTime?'T':'')+(hasTime?pad(+hour.value)+':'+pad(+minute.value):'');commit();if(editor.getAttribute('aria-invalid')!=='true')finish()};
  document.body.append(overlay);if(hasDate)draw();overlay.showModal();
 };
 sync();
}
document.addEventListener('DOMContentLoaded',()=>{const main=document.querySelector('main');if(!main)return;const scan=root=>{if(root.matches?.('input[type=date],input[type=time],input[type=datetime-local]'))enhance(root);root.querySelectorAll?.('input[type=date],input[type=time],input[type=datetime-local]').forEach(enhance)};scan(main);new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)scan(n)}))).observe(main,{childList:true,subtree:true});document.addEventListener('hoz:language',()=>active?.())});
})();
