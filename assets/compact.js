(function(){'use strict';document.addEventListener('DOMContentLoaded',()=>{
 const H=HozTools,$=H.$,$$=H.$$;
 const options=$('#lower')?.closest('.fields');
 if(options)options.className='password-options';
 document.addEventListener('hoz:language',()=>requestAnimationFrame(restoreNav));
 const nav=$('.quick-tools');
 function restoreNav(){if(!nav)return;try{const raw=sessionStorage.getItem('hoz:nav:'+H.lang());if(raw!==null)nav.scrollLeft=Number(raw)}catch{}const active=$('[aria-current="page"]',nav);if(!active)return;const box=nav.getBoundingClientRect(),rect=active.getBoundingClientRect();if(rect.left<box.left+5||rect.right>box.right-5)nav.scrollLeft+=rect.left-box.left-(box.width-rect.width)/2}
 if(nav){nav.addEventListener('scroll',()=>{try{sessionStorage.setItem('hoz:nav:'+H.lang(),String(nav.scrollLeft))}catch{}},{passive:true});nav.addEventListener('click',()=>{try{sessionStorage.setItem('hoz:nav:'+H.lang(),String(nav.scrollLeft))}catch{}});requestAnimationFrame(restoreNav);window.addEventListener('pageshow',()=>requestAnimationFrame(restoreNav))}
});})();
