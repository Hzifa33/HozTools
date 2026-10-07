/* An entry invitation is independent of the browser's native install event. */
(()=>{'use strict';
let deferredPrompt=null,toast=null,guide=null,busy=false,finished=false;
const KEY='hoz:install-dismiss',WEEK=7*24*60*60*1000;
const read=k=>{try{return localStorage.getItem(k)}catch{return null}};
const write=(k,v)=>{try{localStorage.setItem(k,String(v))}catch{}};
const text=(en,ar,es)=>({en,ar,es}[document.documentElement.lang]||en);
const installed=()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true||read('hoz:app-installed')==='1';
const snoozed=()=>{const at=Number(read(KEY));return Number.isFinite(at)&&at>0&&Date.now()-at<WEEK};
function hide(){if(toast)toast.hidden=true}
function dismiss(){write(KEY,Date.now());finished=true;hide()}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event});
window.addEventListener('appinstalled',()=>{write('hoz:app-installed','1');finished=true;deferredPrompt=null;hide();guide?.close()});
window.addEventListener('storage',e=>{if(e.key===KEY||e.key==='hoz:app-installed'){if(snoozed()||installed())hide()}});
function translate(){
 if(!toast)return;
 toast.querySelector('h2').textContent=text('Your tools, a tap away','أدواتك، بلمسة واحدة','Tus herramientas, a un toque');
 toast.querySelector('p').textContent=matchMedia('(max-width:600px)').matches?text('Free. No account.','مجاني، دون حساب.','Gratis, sin cuenta.'):text('Add HozTools to your device. Free, no account.','أضف HozTools إلى جهازك. مجانًا، دون حساب.','Añade HozTools a tu dispositivo. Gratis y sin cuenta.');
 toast.querySelector('.soft-install-action').textContent=text('Install app','تثبيت التطبيق','Instalar app');
 const close=toast.querySelector('.soft-install-dismiss');close.title=close.ariaLabel=text('Not now · remind me in 7 days','ليس الآن · ذكّرني بعد 7 أيام','Ahora no · recordar en 7 días');
 if(guide){guide.querySelector('h2').textContent=text('Keep HozTools close','اجعل أدواتك في متناولك','Ten HozTools a mano');guide.querySelector('button').textContent=text('Got it','فهمت','Entendido')}
}
function instructions(){
 const ua=navigator.userAgent,ios=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),android=/Android/.test(ua),safari=/Safari/.test(ua)&&!/Chrome|Chromium|Edg|OPR/.test(ua),firefox=/Firefox/.test(ua);
 if(ios)return [text('Install from your browser’s Share menu.','يمكنك التثبيت من قائمة المشاركة في المتصفح.','Instala desde el menú Compartir del navegador.'),[text('Tap Share, then Add to Home Screen.','اضغط مشاركة، ثم «إضافة إلى الشاشة الرئيسية».','Pulsa Compartir y Añadir a pantalla de inicio.'),text('Confirm Add. If the option is missing, open this page in Safari.','أكّد الإضافة. إذا لم يظهر الخيار، افتح هذه الصفحة في Safari.','Confirma Añadir. Si no aparece la opción, abre esta página en Safari.')]];
 if(android)return [text('Add the tools from your browser menu.','أضف الأدوات من قائمة المتصفح.','Añade las herramientas desde el menú del navegador.'),[text('Open the ⋮ menu in your browser.','افتح قائمة ⋮ في المتصفح.','Abre el menú ⋮ del navegador.'),text('Choose Install app or Add to Home screen, then confirm.','اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»، ثم أكّد.','Elige Instalar aplicación o Añadir a pantalla de inicio y confirma.')]];
 if(safari&&/Mac/.test(ua))return [text('On macOS Sonoma or later, Safari can add this site to the Dock.','في macOS Sonoma والأحدث، يمكنك إضافة الموقع إلى Dock من Safari.','En macOS Sonoma o posterior, Safari permite añadir este sitio al Dock.'),[text('Open File → Add to Dock in Safari.','افتح «ملف ← إضافة إلى Dock» في Safari.','Abre Archivo → Añadir al Dock en Safari.'),text('Confirm the name and choose Add.','أكّد الاسم واختر «إضافة».','Confirma el nombre y selecciona Añadir.')]];
 if(firefox)return [text('Use Chrome or Edge to install HozTools as an app on this computer.','افتح HozTools في Chrome أو Edge لتثبيته كتطبيق على هذا الكمبيوتر.','Abre HozTools en Chrome o Edge para instalarlo como app en este ordenador.'),[text('Open this same address in Chrome or Edge.','افتح العنوان نفسه في Chrome أو Edge.','Abre esta misma dirección en Chrome o Edge.'),text('Choose Install from the address bar or browser menu.','اختر «تثبيت» من شريط العنوان أو قائمة المتصفح.','Elige Instalar en la barra de direcciones o el menú.')]];
 return [text('Your browser controls installation. If available, you can also use its menu.','المتصفح يتحكم بإتاحة التثبيت. يمكنك استخدام قائمته عند توفر الخيار.','Tu navegador controla la instalación. Si está disponible, usa también su menú.'),[text('Look for the install icon in the address bar, or open the browser menu.','ابحث عن أيقونة التثبيت في شريط العنوان، أو افتح قائمة المتصفح.','Busca el icono de instalación en la barra de direcciones o abre el menú.'),text('Choose Install HozTools / Install this site as an app, then confirm.','اختر «تثبيت HozTools» أو «تثبيت هذا الموقع كتطبيق»، ثم أكّد.','Elige Instalar HozTools o Instalar este sitio como aplicación y confirma.')]];
}
function manual(){
 if(!guide){guide=document.createElement('dialog');guide.className='soft-install-guide';guide.ariaLabelledBy='softInstallGuideTitle';guide.setAttribute('aria-labelledby','softInstallGuideTitle');guide.innerHTML='<img src="/assets/app-icon-classic-clear-192.png" alt="" width="64" height="64"><h2 id="softInstallGuideTitle"></h2><p></p><ol></ol><button class="btn primary" type="button"></button>';document.body.append(guide);guide.querySelector('button').onclick=()=>guide.close();guide.addEventListener('close',()=>{dismiss();document.querySelector('main a,main button,main input')?.focus({preventScroll:true})});}
 translate();const [intro,steps]=instructions();guide.querySelector('p').textContent=intro;guide.querySelector('ol').replaceChildren(...steps.map(t=>{const li=document.createElement('li');li.textContent=t;return li}));hide();guide.showModal();
}
async function install(){
 if(busy)return;if(!deferredPrompt){manual();return}
 busy=true;const event=deferredPrompt;deferredPrompt=null;const button=toast.querySelector('.soft-install-action');button.disabled=true;
 try{const result=await event.prompt();const choice=event.userChoice?await event.userChoice:result;if(choice.outcome==='accepted'){finished=true;hide()}else dismiss()}
 catch{manual()}finally{busy=false;button.disabled=false}
}
function init(){
 if(document.body.dataset.pagePath!=='/')return;
 if(installed()||snoozed())return;
 toast=document.createElement('section');toast.className='soft-install';toast.setAttribute('aria-labelledby','softInstallTitle');toast.innerHTML='<img src="/assets/app-icon-classic-clear-192.png" alt="" width="48" height="48"><div><h2 id="softInstallTitle"></h2><p></p></div><button class="soft-install-action" type="button"></button><button class="soft-install-dismiss" type="button"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m18 6-12 12M6 6l12 12"/></svg></button>';
 toast.hidden=true;document.body.append(toast);translate();toast.querySelector('.soft-install-action').onclick=install;toast.querySelector('.soft-install-dismiss').onclick=dismiss;
 new MutationObserver(translate).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 requestAnimationFrame(()=>{if(!finished&&!installed()&&!snoozed())toast.hidden=false});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
