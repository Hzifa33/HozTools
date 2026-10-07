(()=>{'use strict';
const root=document.documentElement;
const word=(en,ar,es)=>({en,ar,es}[root.lang]||en);
function init(){
 if(document.body.dataset.pagePath==='/'){
  const assistant=document.querySelector('.neo-hozai-launcher');
  if(assistant)document.querySelector('.neo-header-actions')?.append(assistant);
  const header=document.querySelector('.neo-header'),dock=document.querySelector('.neo-mobile-dock');
  const measure=()=>{
   const headerHeight=header?.getBoundingClientRect().height||0;
   const dockRect=dock?.getBoundingClientRect();
   const dockSpace=dockRect?.height?dockRect.height+(parseFloat(getComputedStyle(dock).bottom)||0)+8:0;
   document.body.style.setProperty('--hero-header',`${Math.ceil(headerHeight)}px`);
   document.body.style.setProperty('--hero-dock',`${Math.ceil(dockSpace)}px`);
  };
  measure();window.addEventListener('resize',measure,{passive:true});
  if('ResizeObserver'in window){const observer=new ResizeObserver(measure);if(header)observer.observe(header);if(dock)observer.observe(dock)}
 }
 const icons=window.HozIcons||{};
 function sync(){
  const dark=root.classList.contains('dark');
  document.querySelectorAll('.neo-tools-entry').forEach(link=>{link.ariaLabel=link.title=word('Open tools','فتح الأدوات','Abrir herramientas')});
  document.querySelectorAll('img[data-brand-logo]').forEach(img=>{const src='/assets/logo-'+(dark?'dark':'light')+'.svg';if(img.getAttribute('src')!==src)img.src=src});
  const favicon=document.querySelector('link[rel=icon]');if(favicon)favicon.href='/assets/logo-'+(dark?'dark':'light')+'.svg';
  document.querySelectorAll('#themeBtn,#neo-theme-btn').forEach(button=>{const label=dark?word('Switch to light theme','تفعيل المظهر النهاري','Cambiar a tema claro'):word('Switch to dark theme','تفعيل المظهر الليلي','Cambiar a tema oscuro');button.ariaLabel=button.title=label;button.setAttribute('aria-pressed',String(dark));if(icons[dark?'Sun':'Moon'])button.innerHTML=icons[dark?'Sun':'Moon'];button.querySelectorAll('svg').forEach(svg=>svg.setAttribute('aria-hidden','true'))});
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta=>meta.content=dark?'#101d28':'#f4f8fa');
 }
 sync();new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['class','lang']});
 const lang=document.getElementById('neo-lang-btn'),menu=document.getElementById('neo-lang-menu');
 if(lang&&menu){const update=()=>{const open=menu.classList.contains('show');lang.setAttribute('aria-expanded',String(open));lang.title=word('Choose language','اختر اللغة','Elegir idioma');lang.setAttribute('aria-label',lang.title);menu.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.lang===root.lang)))};new MutationObserver(update).observe(menu,{attributes:true,attributeFilter:['class']});new MutationObserver(update).observe(root,{attributes:true,attributeFilter:['lang']});update();}
 document.querySelectorAll('a[aria-label] svg,button[aria-label] svg,.tool-icon svg,.neo-role-tag svg').forEach(svg=>svg.setAttribute('aria-hidden','true'));
 const motion=matchMedia('(prefers-reduced-motion: reduce)');if(motion.matches||!('IntersectionObserver'in window)||!Element.prototype.animate)return;
 const active=new Set();const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(!entry.isIntersecting)return;observer.unobserve(entry.target);if(motion.matches)return;const animation=entry.target.animate([{transform:'translateY(10px)'},{transform:'translateY(0)'}],{duration:440,easing:'cubic-bezier(.2,.7,.2,1)',fill:'none'});active.add(animation);animation.finished.then(()=>active.delete(animation)).catch(()=>active.delete(animation))})},{threshold:.08});
 document.querySelectorAll('.soft-hero,.tools-grid > .tool-card,.neo-section-header,.neo-exp-card,.neo-skill-card,.neo-contact-item,.soft-directory-note,.tool-help').forEach(el=>observer.observe(el));
 motion.addEventListener('change',()=>{if(motion.matches){observer.disconnect();active.forEach(animation=>animation.cancel());active.clear()}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
