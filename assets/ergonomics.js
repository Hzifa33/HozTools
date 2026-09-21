(function(){'use strict';
const H=window.HozTools, states=new WeakMap();
function range(input){
 if(states.has(input)||input.closest('.neo-dialog-layer'))return;
 input.id||='range-'+H.uid();
 const row=document.createElement('div');row.className='range-editor';
 const number=document.createElement('input');number.type='number';number.className='input range-number';number.id=input.id+'-number';
 input.before(row);row.append(input,number);states.set(input,number);
 function sync(){for(const key of ['min','max','step'])number[key]=input[key];number.value=input.value;number.disabled=input.disabled;const label=input.labels?.[0];if(label){label.id||=input.id+'-label';number.setAttribute('aria-labelledby',label.id)}else number.setAttribute('aria-label',input.getAttribute('aria-label')||H.tr('Value','القيمة','Valor'));}
 function commit(){if(number.value===''||!number.validity.valid){sync();return}input.value=number.value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));sync()}
 number.addEventListener('input',()=>{if(number.value!==''&&number.validity.valid){input.value=number.value;input.dispatchEvent(new Event('input',{bubbles:true}))}});
 number.addEventListener('change',commit);number.addEventListener('blur',commit);
 input.addEventListener('input',sync);input.addEventListener('change',sync);
 new MutationObserver(sync).observe(input,{attributes:true,attributeFilter:['min','max','step','disabled','value']});sync();
}
function init(){
 const main=document.querySelector('main');if(!main)return;
 const enhance=root=>{if(root.matches?.('input[type="range"]'))range(root);root.querySelectorAll?.('input[type="range"]').forEach(range)};
 enhance(main);new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)enhance(n)}))).observe(main,{childList:true,subtree:true});
 const tip=document.createElement('div');tip.className='control-tooltip';tip.id='hoz-control-tooltip';tip.role='tooltip';tip.hidden=true;document.body.append(tip);let owner;
 function hide(){if(owner){const ids=(owner.getAttribute('aria-describedby')||'').split(/\s+/).filter(x=>x&&x!==tip.id);if(ids.length)owner.setAttribute('aria-describedby',ids.join(' '));else owner.removeAttribute('aria-describedby')}owner=null;tip.hidden=true;}
 function show(e){const b=e.target.closest?.('button[aria-label]');if(!b||(b.textContent.trim()&&!b.classList.contains('icon-action')))return;hide();owner=b;tip.textContent=b.getAttribute('aria-label');tip.hidden=false;b.setAttribute('aria-describedby',[(b.getAttribute('aria-describedby')||''),tip.id].filter(Boolean).join(' '));const r=b.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(r.left,innerWidth-tip.offsetWidth-8))+'px';tip.style.top=Math.max(8,Math.min(r.bottom+8,innerHeight-tip.offsetHeight-8))+'px';}
 document.addEventListener('focusin',show);document.addEventListener('focusout',hide);document.addEventListener('pointerover',show);document.addEventListener('pointerout',e=>{if(owner&&!owner.contains(e.relatedTarget)&&!tip.contains(e.relatedTarget))hide()});tip.addEventListener('pointerleave',hide);document.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});addEventListener('scroll',hide,{capture:true,passive:true});document.addEventListener('hoz:language',hide);
 const trigger=document.getElementById('neo-lang-btn'),menu=document.getElementById('neo-lang-menu');
 if(trigger&&menu){trigger.setAttribute('aria-controls',menu.id);trigger.setAttribute('aria-haspopup','menu');trigger.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp'].includes(e.key))return;e.preventDefault();menu.classList.add('show');trigger.setAttribute('aria-expanded','true');const opts=[...menu.querySelectorAll('button')];opts[e.key==='ArrowUp'?opts.length-1:0]?.focus()});menu.addEventListener('keydown',e=>{const opts=[...menu.querySelectorAll('button')],i=opts.indexOf(document.activeElement);let n;if(e.key==='ArrowDown')n=(i+1)%opts.length;else if(e.key==='ArrowUp')n=(i-1+opts.length)%opts.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=opts.length-1;else if(e.key==='Tab'){menu.classList.remove('show');trigger.setAttribute('aria-expanded','false');return}else return;e.preventDefault();opts[n].focus()});}
}
document.addEventListener('DOMContentLoaded',init);
})();
