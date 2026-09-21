(function(){
  'use strict';
  const H=window.HozTools,$=H.$,$$=H.$$;
  let original=null,sourceName='image',ratio=1,undo=null,selecting=false,effectBase=null,activeEffect=null,effectSelection=null,effectRaf=0,effectHistory=[];
  const canvas=$('#canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
  let selectionUI={show(){},hide(){},refresh(){},afterCanvasChange(){}};
  let liveUI={refresh(){},announce(){}};
  let loadVersion=0;
  function t(en,ar,es){return {en,ar,es}[H.lang()]}
  function clamp(n,min,max){return Math.min(max,Math.max(min,n))}
  function setEnabled(on){
    $$('#editor button, aside button').forEach(b=>{
      if(!b.hasAttribute('data-tab')&&!['themeBtn','changeImage','undoImage','undoEffect'].includes(b.id))b.disabled=!on;
    });
    $('#resetBtn').disabled=!on;
  }
  function snapshot(){
    undo=document.createElement('canvas');
    undo.width=canvas.width;undo.height=canvas.height;
    undo.getContext('2d').drawImage(canvas,0,0);
    if($('#undoImage'))$('#undoImage').disabled=false;
  }
  function canvasCopy(source=canvas){
    const copy=document.createElement('canvas');
    copy.width=source.width;copy.height=source.height;
    copy.getContext('2d').drawImage(source,0,0);
    return copy;
  }
  function updateUndoEffectState(){const b=$('#undoEffect'),count=$('#effectLayerCount');if(b)b.disabled=!effectHistory.length;if(count){count.textContent=effectHistory.length;count.hidden=!effectHistory.length}}
  function stopLiveEffect(){
    effectBase=null;activeEffect=null;effectSelection=null;
    if(effectRaf){cancelAnimationFrame(effectRaf);effectRaf=0}
  }
  function clearEffectState(resetHistory=true){
    stopLiveEffect();
    if(resetHistory)effectHistory=[];
    updateUndoEffectState();
  }
  function drawImage(img){
    canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
    ctx.drawImage(img,0,0);
    clearEffectState();
    ratio=canvas.width/canvas.height;
    syncDims();syncCrop();renderMeta();extractPalette();setEnabled(true);
    $('#dropzone').classList.add('hidden');$('#editor').classList.remove('hidden');
    $('#status').textContent=`${canvas.width}×${canvas.height}`;
    selectionUI.afterCanvasChange();
    liveUI.refresh('ready');
    estimate();
  }
  function load(files){
    const version=++loadVersion;
    const file=files[0];
    if(!file||!file.type.startsWith('image/'))return H.toast(t('Choose a supported image','اختر صورة مدعومة','Elige una imagen compatible'),'error');
    if(file.size>30*1024*1024)return H.toast(t('Choose an image below 30 MB.','اختر صورة دون 30 ميجابايت.','Elige una imagen menor de 30 MB.'),'error');
    const img=new Image();
    img.onload=()=>{
      if(version!==loadVersion){URL.revokeObjectURL(img.src);return}
      if(img.width*img.height>24e6){URL.revokeObjectURL(img.src);return H.toast(t('Choose an image below 24 megapixels.','اختر صورة دون 24 ميجابكسل.','Elige una imagen inferior a 24 megapíxeles.'),'error')}
      sourceName=H.basename(file.name);original={file,img};undo=null;
      if($('#undoImage'))$('#undoImage').disabled=true;
      drawImage(img);URL.revokeObjectURL(img.src);
    };
    img.onerror=()=>{URL.revokeObjectURL(img.src);H.toast(t('Could not read this image','تعذر قراءة الصورة','No se pudo leer la imagen'),'error')};
    img.src=URL.createObjectURL(file);
  }
  function syncDims(){$('#width').value=canvas.width;$('#height').value=canvas.height}
  function syncCrop(){$('#cropX').value=0;$('#cropY').value=0;$('#cropW').value=canvas.width;$('#cropH').value=canvas.height}
  function selection(){
    if(!canvas.width||!canvas.height)return{x:0,y:0,w:1,h:1};
    const rawX=Math.round(+$('#cropX').value||0),rawY=Math.round(+$('#cropY').value||0);
    const x=clamp(rawX,0,Math.max(0,canvas.width-1)),y=clamp(rawY,0,Math.max(0,canvas.height-1));
    const rawW=Math.round(+$('#cropW').value||canvas.width),rawH=Math.round(+$('#cropH').value||canvas.height);
    const w=clamp(rawW,1,Math.max(1,canvas.width-x)),h=clamp(rawH,1,Math.max(1,canvas.height-y));
    return{x,y,w,h};
  }
  function renderMeta(){
    const f=original?.file;
    const ext=(H.ext(f?.name||'')||f?.type?.split('/')[1]||'image').toUpperCase().replace('JPEG','JPG');
    const data=[
      [t('Original size','الحجم الأصلي','Tamaño original'),f?H.bytes(f.size):'—'],
      [t('Current dimensions','الأبعاد الحالية','Dimensiones actuales'),`${canvas.width} × ${canvas.height}`],
      [t('Format','الصيغة','Formato'),ext]
    ];
    $('#metadata').innerHTML=data.map(([a,b])=>`<div class="metric"><small>${a}</small><strong title="${String(b).replaceAll('"','&quot;')}">${H.esc(b)}</strong></div>`).join('');
  }
  function extractPalette(){
    const tmp=document.createElement('canvas'),s=70;tmp.width=s;tmp.height=s;
    tmp.getContext('2d').drawImage(canvas,0,0,s,s);
    const d=tmp.getContext('2d').getImageData(0,0,s,s).data,bins=new Map();
    for(let i=0;i<d.length;i+=16){
      if(d[i+3]<180)continue;
      const r=Math.round(d[i]/32)*32,g=Math.round(d[i+1]/32)*32,b=Math.round(d[i+2]/32)*32,key=`${Math.min(r,255)},${Math.min(g,255)},${Math.min(b,255)}`;
      bins.set(key,(bins.get(key)||0)+1);
    }
    const colors=[...bins].sort((a,b)=>b[1]-a[1]).slice(0,6).map(x=>x[0]);
    $('#palette').innerHTML=colors.map(c=>{const hex='#'+c.split(',').map(n=>(+n).toString(16).padStart(2,'0')).join('');return`<button class="swatch" style="background:${hex}" title="${hex}" data-color="${hex}"><span>${hex}</span></button>`}).join('');
    $$('.swatch').forEach(b=>b.onclick=()=>H.copy(b.dataset.color.toUpperCase(),'color'));
  }
  function replaceWith(next,action){
    snapshot();
    clearEffectState();
    canvas.width=next.width;canvas.height=next.height;ctx.drawImage(next,0,0);
    ratio=canvas.width/canvas.height;
    syncDims();syncCrop();renderMeta();extractPalette();
    $('#status').textContent=`${canvas.width}×${canvas.height}`;
    selectionUI.afterCanvasChange();
    liveUI.announce(action||'updated');
    estimate();
  }
  function resizeTo(w,h){
    if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1||w*h>24e6||w>16384||h>16384){H.toast(t('Use positive dimensions below 24 megapixels (maximum side: 16384).','استخدم أبعادًا موجبة دون 24 ميجابكسل (أقصى ضلع: 16384).','Usa dimensiones positivas inferiores a 24 megapíxeles (lado máximo: 16384).'),'error');return}
    const temp=document.createElement('canvas');temp.width=Math.max(1,Math.round(w));temp.height=Math.max(1,Math.round(h));
    temp.getContext('2d').drawImage(canvas,0,0,temp.width,temp.height);replaceWith(temp,'resize');
  }
  function transform(type){
    const temp=document.createElement('canvas'),rot=type.startsWith('rotate');
    temp.width=rot?canvas.height:canvas.width;temp.height=rot?canvas.width:canvas.height;
    const c=temp.getContext('2d');c.translate(temp.width/2,temp.height/2);
    if(type==='rotate-left')c.rotate(-Math.PI/2);
    if(type==='rotate-right')c.rotate(Math.PI/2);
    if(type==='flip-x')c.scale(-1,1);
    if(type==='flip-y')c.scale(1,-1);
    c.drawImage(canvas,-canvas.width/2,-canvas.height/2);
    replaceWith(temp,type.startsWith('rotate')?'rotate':'flip');
  }
  function crop(){
    const s=selection();if(s.w<1||s.h<1)return;
    const temp=document.createElement('canvas');temp.width=s.w;temp.height=s.h;
    temp.getContext('2d').drawImage(canvas,s.x,s.y,s.w,s.h,0,0,s.w,s.h);
    replaceWith(temp,'crop');
    selectionUI.hide();
  }
  function drawFeatherMask(maskCtx,w,h,feather){
    maskCtx.clearRect(0,0,w,h);
    feather=Math.max(0,Math.min(Math.round(feather||0),Math.floor(Math.min(w,h)/2)));
    if(feather<1){maskCtx.fillStyle='#fff';maskCtx.fillRect(0,0,w,h);return}
    const innerW=Math.max(0,w-feather*2),innerH=Math.max(0,h-feather*2);
    maskCtx.fillStyle='#fff';
    if(innerW>0&&innerH>0)maskCtx.fillRect(feather,feather,innerW,innerH);
    if(innerH>0){
      let g=maskCtx.createLinearGradient(0,0,feather,0);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(255,255,255,1)');maskCtx.fillStyle=g;maskCtx.fillRect(0,feather,feather,innerH);
      g=maskCtx.createLinearGradient(w-feather,0,w,0);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');maskCtx.fillStyle=g;maskCtx.fillRect(w-feather,feather,feather,innerH);
    }
    if(innerW>0){
      let g=maskCtx.createLinearGradient(0,0,0,feather);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(255,255,255,1)');maskCtx.fillStyle=g;maskCtx.fillRect(feather,0,innerW,feather);
      g=maskCtx.createLinearGradient(0,h-feather,0,h);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');maskCtx.fillStyle=g;maskCtx.fillRect(feather,h-feather,innerW,feather);
    }
    const corners=[[feather,feather,0,0],[w-feather,feather,w-feather,0],[feather,h-feather,0,h-feather],[w-feather,h-feather,w-feather,h-feather]];
    corners.forEach(([cx,cy,x,y])=>{const g=maskCtx.createRadialGradient(cx,cy,0,cx,cy,feather);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');maskCtx.fillStyle=g;maskCtx.fillRect(x,y,feather,feather)});
  }
  function compositeRectPatch(region,x,y,feather){
    if(!region.width||!region.height)return;
    feather=Math.max(0,Math.min(feather,Math.floor(Math.min(region.width,region.height)/2)));
    if(feather<1){ctx.drawImage(region,x,y);return}
    const masked=document.createElement('canvas');masked.width=region.width;masked.height=region.height;
    const mx=masked.getContext('2d');mx.drawImage(region,0,0);mx.globalCompositeOperation='destination-in';drawFeatherMask(mx,masked.width,masked.height,feather);mx.globalCompositeOperation='source-over';ctx.drawImage(masked,x,y);
  }
  function fallbackBlurRegion(base,s,strength){
    const region=document.createElement('canvas');region.width=s.w;region.height=s.h;
    const rx=region.getContext('2d');
    const factor=Math.max(.06,Math.min(.72,1/(1+strength*.16)));
    const tiny=document.createElement('canvas');tiny.width=Math.max(1,Math.round(s.w*factor));tiny.height=Math.max(1,Math.round(s.h*factor));
    const tx=tiny.getContext('2d');tx.imageSmoothingEnabled=true;tx.imageSmoothingQuality='high';tx.drawImage(base,s.x,s.y,s.w,s.h,0,0,tiny.width,tiny.height);
    rx.imageSmoothingEnabled=true;rx.imageSmoothingQuality='high';rx.drawImage(tiny,0,0,tiny.width,tiny.height,0,0,s.w,s.h);
    return region;
  }
  function pixelateRectRegion(base,s,strength){
    const box=canvas.getBoundingClientRect();
    const scaleX=canvas.width/Math.max(1,box.width),scaleY=canvas.height/Math.max(1,box.height);
    const sourceScale=Math.max(1,scaleX,scaleY);
    const block=Math.max(2,Math.min(180,Math.round(strength*sourceScale)));
    const tiny=document.createElement('canvas');
    tiny.width=Math.max(1,Math.ceil(s.w/block));
    tiny.height=Math.max(1,Math.ceil(s.h/block));
    const tx=tiny.getContext('2d',{alpha:true});
    tx.imageSmoothingEnabled=true;
    tx.imageSmoothingQuality='low';
    tx.drawImage(base,s.x,s.y,s.w,s.h,0,0,tiny.width,tiny.height);
    const region=document.createElement('canvas');
    region.width=s.w;region.height=s.h;
    const rx=region.getContext('2d',{alpha:true});
    rx.imageSmoothingEnabled=false;
    rx.clearRect(0,0,s.w,s.h);
    rx.drawImage(tiny,0,0,tiny.width,tiny.height,0,0,s.w,s.h);
    return region;
  }
  function renderEffect(kind,announce=true){
    if(!effectBase||!effectSelection)return false;
    const s=effectSelection,strength=Math.max(1,+$('#effectStrength').value||1),feather=Math.max(0,+($('#featherStrength')?.value||0));
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(effectBase,0,0);
    if(kind==='pixel'){
      const region=pixelateRectRegion(effectBase,s,strength);
      ctx.save();
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(region,s.x,s.y);
      ctx.restore();
    }else{
      let applied=false;
      try{
        if('filter' in ctx){
          ctx.save();
          ctx.beginPath();ctx.rect(s.x,s.y,s.w,s.h);ctx.clip();
          ctx.filter=`blur(${strength}px)`;
          const accepted=ctx.filter&&ctx.filter!=='none';
          if(accepted){ctx.drawImage(effectBase,0,0);applied=true}
          ctx.filter='none';
          ctx.restore();
        }
      }catch(e){
        try{ctx.restore()}catch{}
        ctx.filter='none';
      }
      if(!applied){
        const region=fallbackBlurRegion(effectBase,s,strength);
        compositeRectPatch(region,s.x,s.y,Math.min(feather,Math.floor(Math.min(s.w,s.h)/2)));
      }
    }
    if(announce)liveUI.announce(kind==='pixel'?'pixel':'blur');else liveUI.refresh(kind==='pixel'?'pixel':'blur');
    estimate();
    return true;
  }
  function effect(kind){
    const base=canvasCopy(),sel=selection();
    effectBase=base;effectSelection={...sel};activeEffect=kind;
    try{
      const applied=renderEffect(kind,true);
      if(!applied)throw Error(t('The effect could not be applied.','تعذر تطبيق التأثير.','No se pudo aplicar el efecto.'));
      effectHistory.push(base);
      const historyLimit=Math.max(1,Math.min(8,Math.floor(96*1024*1024/(canvas.width*canvas.height*4))));
      while(effectHistory.length>historyLimit)effectHistory.shift();
      updateUndoEffectState();
    }catch(err){
      canvas.width=base.width;canvas.height=base.height;ctx.drawImage(base,0,0);
      stopLiveEffect();updateUndoEffectState();
      throw err;
    }
  }
  function undoLastEffect(){
    const prev=effectHistory.pop();
    if(!prev)return;
    canvas.width=prev.width;canvas.height=prev.height;ctx.drawImage(prev,0,0);
    stopLiveEffect();updateUndoEffectState();
    undo=null;if($('#undoImage'))$('#undoImage').disabled=true;
    ratio=canvas.width/canvas.height;syncDims();renderMeta();extractPalette();selectionUI.show();selectionUI.refresh();liveUI.announce('undo');estimate();
  }
  function queueEffectPreview(){
    if(!activeEffect||!effectBase)return;
    if(effectRaf)cancelAnimationFrame(effectRaf);
    effectRaf=requestAnimationFrame(()=>{effectRaf=0;renderEffect(activeEffect,false)});
  }
  function blobFor(type,quality,cnv=canvas){return new Promise((res,rej)=>cnv.toBlob(b=>b?res(b):rej(Error(H.common[H.lang()].error)),type,quality))}
  async function outputBlob(){
    let w=Number($('#width').value),h=Number($('#height').value),temp=canvas;
    if(!Number.isSafeInteger(w)||!Number.isSafeInteger(h)||w<1||h<1||w>16384||h>16384||w*h>24e6)throw Error(t('Check export dimensions.','راجع أبعاد التصدير.','Revisa las dimensiones.'));
    if(w!==canvas.width||h!==canvas.height){temp=document.createElement('canvas');temp.width=w;temp.height=h;temp.getContext('2d').imageSmoothingQuality='high';temp.getContext('2d').drawImage(canvas,0,0,w,h)}
    const type=$('#format').value;
    if(type==='image/jpeg'){
      const white=document.createElement('canvas');white.width=w;white.height=h;const x=white.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(temp,0,0);temp=white;
    }
    let q=+$('#quality').value/100,blob=await blobFor(type,q,temp),target=(+$('#targetKb').value||0)*1024;
    if(target&&type!=='image/png'&&blob.size>target){
      let low=.05,high=q,best=await blobFor(type,low,temp),bestQ=low;
      for(let i=0;i<7;i++){const mid=(low+high)/2,candidate=await blobFor(type,mid,temp);if(candidate.size<=target){best=candidate;bestQ=mid;low=mid}else high=mid}
      blob=best;q=bestQ;
    }
    return{blob,type,w,h,q};
  }
  let estimateTimer,estimateVersion=0;
  function estimate(){
    clearTimeout(estimateTimer);const version=++estimateVersion;
    estimateTimer=setTimeout(async()=>{
      if(!canvas.width)return;
      try{
        const{blob,w,h,q}=await outputBlob();if(version!==estimateVersion)return;
        const target=+$('#targetKb').value*1024,warning=target&&blob.size>target?t('Target not reached. Reduce dimensions or choose WebP.','لم يتحقق الحجم المطلوب. قلّل الأبعاد أو اختر WebP.','Reduce las dimensiones o elige WebP para alcanzar el tamaño.'):'';
        $('#estimate').innerHTML=`<strong class="big">${H.bytes(blob.size)}</strong><span class="muted">${w} × ${h} · ${Math.round(q*100)}%</span>${warning?'<p class="notice warn">'+warning+'</p>':''}`;
      }catch(e){if(version===estimateVersion)$('#estimate').textContent=e.message}
    },220);
  }
  async function exportImage(clean=false){const{blob}=await outputBlob(),extension=blob.type==='image/jpeg'?'jpg':blob.type.split('/')[1];H.download(blob,`${sourceName}-${clean?'clean':'edited'}.${extension}`)}
  function presetSelection(){
    const val=$('#preset').value;
    if(!val){selectionUI.hide();return}
    const[a,b]=val.split(':').map(Number),target=a/b;let w=canvas.width,h=Math.round(w/target);
    if(h>canvas.height){h=canvas.height;w=Math.round(h*target)}
    $('#cropW').value=w;$('#cropH').value=h;$('#cropX').value=Math.round((canvas.width-w)/2);$('#cropY').value=Math.round((canvas.height-h)/2);
    selectionUI.show();selectionUI.refresh();liveUI.announce('selection');
  }
  function applyPresetCrop(){
    if(!$('#preset').value)return;
    crop();
    H.toast(t('Social crop applied.','تم تطبيق قص مقاسات التواصل.','Recorte social aplicado.'));
  }
  async function favicon(){
    const size=+$('#faviconSize').value,temp=document.createElement('canvas');temp.width=temp.height=size;
    const s=Math.min(canvas.width,canvas.height),x=(canvas.width-s)/2,y=(canvas.height-s)/2;
    temp.getContext('2d').drawImage(canvas,x,y,s,s,0,0,size,size);H.download(await blobFor('image/png',1,temp),`${sourceName}-favicon-${size}.png`);
  }
  H.enhanceDrop($('#dropzone'),load);setEnabled(false);
  $('#width').addEventListener('input',()=>{if($('#lockRatio').checked)$('#height').value=Math.round((+$('#width').value||1)/ratio);estimate()});
  $('#height').addEventListener('input',()=>{if($('#lockRatio').checked)$('#width').value=Math.round((+$('#height').value||1)*ratio);estimate()});
  ['format','quality','targetKb'].forEach(id=>$('#'+id).addEventListener('input',()=>{$('#qualityLabel').textContent=$('#quality').value+'%';estimate()}));
  const syncEffectLabels=()=>{$('#effectLabel').textContent=$('#effectStrength').value;const f=$('#featherLabel');if(f)f.textContent=$('#featherStrength').value};
  $('#effectStrength').oninput=()=>{syncEffectLabels();queueEffectPreview()};
  $('#featherStrength').oninput=()=>{syncEffectLabels();queueEffectPreview()};
  syncEffectLabels();
  $('#cropBtn').onclick=crop;
  $$('[data-transform]').forEach(b=>b.onclick=()=>transform(b.dataset.transform));
  $('#blurBtn').onclick=()=>H.busy($('#blurBtn'),()=>effect('blur'));
  $('#pixelBtn').onclick=()=>H.busy($('#pixelBtn'),()=>effect('pixel'));
  $$('.js-export-image').forEach(b=>b.onclick=()=>H.busy(b,()=>exportImage()));
  $('#cleanExport').onclick=()=>H.busy($('#cleanExport'),()=>exportImage(true));
  $('#undoEffect').onclick=undoLastEffect;
  $('#preset').addEventListener('change',presetSelection);
  $('#applyPreset').onclick=applyPresetCrop;$('#faviconBtn').onclick=favicon;
  $('#resetBtn').onclick=()=>{drawImage(original.img);undo=null;if($('#undoImage'))$('#undoImage').disabled=true;liveUI.announce('reset')};
  canvas.addEventListener('click',e=>{
    if(selecting)return;
    const r=canvas.getBoundingClientRect(),x=clamp(Math.floor((e.clientX-r.left)*canvas.width/r.width),0,canvas.width-1),y=clamp(Math.floor((e.clientY-r.top)*canvas.height/r.height),0,canvas.height-1),d=ctx.getImageData(x,y,1,1).data,hex='#'+[d[0],d[1],d[2]].map(n=>n.toString(16).padStart(2,'0')).join('');
    H.copy(hex.toUpperCase(),'color');
  });
  document.addEventListener('DOMContentLoaded',()=>{
    const head=$('#resetBtn').parentElement;
    const undoBtn=document.createElement('button');undoBtn.id='undoImage';undoBtn.type='button';undoBtn.className='btn small ghost';undoBtn.innerHTML='<span data-en="Undo" data-ar="تراجع" data-es="Deshacer">Undo</span>';undoBtn.disabled=true;
    undoBtn.onclick=()=>{
      if(!undo)return;
      canvas.width=undo.width;canvas.height=undo.height;ctx.drawImage(undo,0,0);undo=null;undoBtn.disabled=true;clearEffectState();
      ratio=canvas.width/canvas.height;syncDims();syncCrop();renderMeta();extractPalette();$('#status').textContent=`${canvas.width}×${canvas.height}`;selectionUI.afterCanvasChange();liveUI.announce('undo');estimate();
    };
    head.append(undoBtn);
    const change=document.createElement('button');change.id='changeImage';change.type='button';change.className='btn small ghost';change.innerHTML='<span data-en="Change image" data-ar="تغيير الصورة" data-es="Cambiar imagen">Change image</span>';change.onclick=()=>$('#imageInput').click();head.append(change);
    const oldDock=$('#livePreviewDock');
    if(oldDock)oldDock.hidden=true;
    const previewBox=canvas.parentElement;
    const floatWrap=document.createElement('div');
    floatWrap.id='floatingImagePreview';
    floatWrap.className='floating-image-preview';
    floatWrap.setAttribute('aria-hidden','true');
    const closeBtn=document.createElement('button');
    closeBtn.type='button';
    closeBtn.className='floating-image-preview-close';
    closeBtn.setAttribute('aria-label',t('Hide floating preview','إخفاء المعاينة العائمة','Ocultar vista flotante'));
    closeBtn.innerHTML=H.icon('X');
    const floatCanvas=document.createElement('canvas');
    floatCanvas.className='floating-image-preview-canvas';
    const floatSelection=document.createElement('div');
    floatSelection.className='floating-crop-overlay';
    floatSelection.hidden=true;
    floatWrap.append(closeBtn,floatCanvas,floatSelection);
    document.body.append(floatWrap);
    const floatCtx=floatCanvas.getContext('2d');
    let currentAction='ready',scrollRaf=0,bitmapKey='',lastVisible=false,floatDismissed=false;
    function syncFloatingBitmap(force=false){
      if(!canvas.width||!canvas.height)return;
      const r=canvas.getBoundingClientRect();
      if(r.width<1||r.height<1)return;
      const dpr=Math.min(window.devicePixelRatio||1,2);
      const bw=Math.max(1,Math.round(r.width*dpr));
      const bh=Math.max(1,Math.round(r.height*dpr));
      const key=`${canvas.width}x${canvas.height}:${bw}x${bh}`;
      const changed=force||bitmapKey!==key;
      if(!changed)return;
      floatCanvas.width=bw;floatCanvas.height=bh;bitmapKey=key;
      floatCtx.clearRect(0,0,floatCanvas.width,floatCanvas.height);
      floatCtx.drawImage(canvas,0,0,floatCanvas.width,floatCanvas.height);
    }
    function topOffset(){
      const bar=document.querySelector('.topbar');
      return Math.round((bar?.getBoundingClientRect().height||58)+8);
    }
    function updateFloatingGeometry(){
      scrollRaf=0;
      if(!original||!canvas.width){
        floatWrap.classList.remove('is-visible');
        lastVisible=false;
        return;
      }
      const r=canvas.getBoundingClientRect();
      if(r.width<2||r.height<2)return;
      const stickyTop=topOffset();
      const travel=Math.max(90,Math.min(r.height*.55,220));
      const raw=(stickyTop-r.top)/travel;
      const p=clamp(raw,0,1);
      if(p<=.005){
        floatWrap.classList.remove('is-visible');
        lastVisible=false;
        floatDismissed=false;
        return;
      }
      if(floatDismissed){
        floatWrap.classList.remove('is-visible');
        lastVisible=false;
        return;
      }
      if(!lastVisible){syncFloatingBitmap(true);lastVisible=true}else syncFloatingBitmap(false);
      floatWrap.classList.add('is-visible');
      const e=p*p*(3-2*p);
      const compact=window.innerWidth<=640;
      const targetScale=compact?.52:.46;
      let targetW=r.width*targetScale;
      let targetH=r.height*targetScale;
      const maxW=compact?Math.min(window.innerWidth*.38,152):Math.min(window.innerWidth*.28,190);
      if(targetW>maxW){const s=maxW/targetW;targetW*=s;targetH*=s}
      const maxH=compact?window.innerHeight*.24:window.innerHeight*.28;
      if(targetH>maxH){const s=maxH/targetH;targetW*=s;targetH*=s}
      const rtl=document.documentElement.dir==='rtl';
      const sideGap=10;
      const targetX=rtl?sideGap:Math.max(sideGap,window.innerWidth-targetW-sideGap);
      const targetY=stickyTop;
      const w=r.width+(targetW-r.width)*e;
      const h=r.height+(targetH-r.height)*e;
      const x=r.left+(targetX-r.left)*e;
      const y=r.top+(targetY-r.top)*e;
      floatWrap.style.width=`${w}px`;
      floatWrap.style.height=`${h}px`;
      floatWrap.style.transform=`translate3d(${x}px,${y}px,0)`;
      floatWrap.style.borderRadius=`${Math.round(14*e)}px`;
    }
    function scheduleFloatingUpdate(){
      if(scrollRaf)return;
      scrollRaf=requestAnimationFrame(updateFloatingGeometry);
    }
    function renderLive(action=currentAction){
      currentAction=action||currentAction;
      syncFloatingBitmap(true);
      scheduleFloatingUpdate();
    }
    function announce(action){
      renderLive(action);
      floatWrap.classList.remove('is-updated');
      void floatWrap.offsetWidth;
      floatWrap.classList.add('is-updated');
      setTimeout(()=>floatWrap.classList.remove('is-updated'),260);
    }
    liveUI={refresh:renderLive,announce};
    closeBtn.onclick=e=>{e.preventDefault();e.stopPropagation();floatDismissed=true;floatWrap.classList.remove('is-visible');lastVisible=false};
    window.addEventListener('scroll',scheduleFloatingUpdate,{passive:true});
    window.addEventListener('resize',()=>{bitmapKey='';scheduleFloatingUpdate()},{passive:true});
    if('ResizeObserver'in window)new ResizeObserver(()=>{bitmapKey='';scheduleFloatingUpdate()}).observe(previewBox);
    document.addEventListener('hoz:language',()=>{closeBtn.setAttribute('aria-label',t('Hide floating preview','إخفاء المعاينة العائمة','Ocultar vista flotante'));dismiss?.setAttribute('aria-label',t('Clear crop selection','إلغاء تحديد القص','Borrar selección de recorte'));scheduleFloatingUpdate()});
    const parent=canvas.parentElement;parent.classList.add('selection-wrap');
    const rect=document.createElement('div');rect.className='crop-overlay';rect.hidden=true;
    rect.innerHTML='<button type="button" class="crop-dismiss" aria-label="'+t('Clear crop selection','إلغاء تحديد القص','Borrar selección de recorte')+'">&times;</button><span class="crop-handle" data-handle="nw"></span><span class="crop-handle" data-handle="n"></span><span class="crop-handle" data-handle="ne"></span><span class="crop-handle" data-handle="e"></span><span class="crop-handle" data-handle="se"></span><span class="crop-handle" data-handle="s"></span><span class="crop-handle" data-handle="sw"></span><span class="crop-handle" data-handle="w"></span>';
    parent.append(rect);
    const dismiss=$('.crop-dismiss',rect);
    let drawStart=null,drag=null,selectionVisible=false;
    function coord(e){
      const r=canvas.getBoundingClientRect();
      return{x:clamp(Math.round((e.clientX-r.left)*canvas.width/r.width),0,canvas.width),y:clamp(Math.round((e.clientY-r.top)*canvas.height/r.height),0,canvas.height)};
    }
    function writeSelection(s){
      const x=clamp(Math.round(s.x),0,Math.max(0,canvas.width-1)),y=clamp(Math.round(s.y),0,Math.max(0,canvas.height-1));
      const w=clamp(Math.round(s.w),1,Math.max(1,canvas.width-x)),h=clamp(Math.round(s.h),1,Math.max(1,canvas.height-y));
      $('#cropX').value=x;$('#cropY').value=y;$('#cropW').value=w;$('#cropH').value=h;
    }
    function syncFloatingSelection(){
      if(!canvas.width||!selectionVisible||!selecting){floatSelection.hidden=true;return}
      const s=selection();
      floatSelection.hidden=false;
      floatSelection.style.left=`${s.x/canvas.width*100}%`;
      floatSelection.style.top=`${s.y/canvas.height*100}%`;
      floatSelection.style.width=`${s.w/canvas.width*100}%`;
      floatSelection.style.height=`${s.h/canvas.height*100}%`;
    }
    function overlay(){
      if(!canvas.width)return;
      const s=selection();
      rect.style.left=`${s.x/canvas.width*100}%`;rect.style.top=`${s.y/canvas.height*100}%`;rect.style.width=`${s.w/canvas.width*100}%`;rect.style.height=`${s.h/canvas.height*100}%`;
      const cr=canvas.getBoundingClientRect(),displayW=Math.max(1,s.w/canvas.width*cr.width),displayH=Math.max(1,s.h/canvas.height*cr.height),displayShort=Math.min(displayW,displayH);
      const corner=Math.max(7,Math.min(13,Math.round(displayShort*.13)));
      const edgeH=Math.max(14,Math.min(38,Math.round(displayW*.28)));
      const edgeV=Math.max(14,Math.min(38,Math.round(displayH*.28)));
      const edgeThickness=Math.max(7,Math.min(10,Math.round(corner*.76)));
      rect.style.setProperty('--corner',`${corner}px`);
      rect.style.setProperty('--edge-h',`${edgeH}px`);
      rect.style.setProperty('--edge-v',`${edgeV}px`);
      rect.style.setProperty('--edge-thick',`${edgeThickness}px`);
      rect.style.setProperty('--offset',`${Math.max(3,Math.round(corner*.42))}px`);
      rect.style.setProperty('--dismiss-size',`${Math.max(18,Math.min(25,corner+10))}px`);
      syncFloatingSelection();
    }
    function showSelection(){selectionVisible=true;if(selecting)rect.hidden=false;overlay()}
    function hideSelection(){selectionVisible=false;rect.hidden=true;floatSelection.hidden=true;drawStart=null;drag=null;stopLiveEffect()}
    function afterCanvasChange(){hideSelection();overlay()}
    selectionUI={show:showSelection,hide:hideSelection,refresh:overlay,afterCanvasChange};
    document.addEventListener('hoz:tab',e=>{
      selecting=['edit','privacy','presets'].includes(e.detail);
      parent.classList.toggle('selecting',selecting);
      rect.hidden=!(selecting&&selectionVisible);
      floatSelection.hidden=!(selecting&&selectionVisible);
      if(selectionVisible)overlay();
    });
    canvas.onpointerdown=e=>{
      if(!selecting||!canvas.width)return;
      stopLiveEffect();
      e.preventDefault();drawStart=coord(e);selectionVisible=true;rect.hidden=false;
      writeSelection({x:Math.min(drawStart.x,canvas.width-1),y:Math.min(drawStart.y,canvas.height-1),w:1,h:1});overlay();
      canvas.setPointerCapture?.(e.pointerId);
    };
    canvas.onpointermove=e=>{
      if(!drawStart)return;
      const p=coord(e),x1=clamp(drawStart.x,0,canvas.width-1),y1=clamp(drawStart.y,0,canvas.height-1),x2=clamp(p.x,0,canvas.width),y2=clamp(p.y,0,canvas.height);
      const left=Math.min(x1,x2),top=Math.min(y1,y2),right=Math.max(x1+1,x2),bottom=Math.max(y1+1,y2);
      writeSelection({x:left,y:top,w:right-left,h:bottom-top});overlay();
    };
    canvas.onpointerup=canvas.onpointercancel=()=>{drawStart=null};
    dismiss.onclick=e=>{e.preventDefault();e.stopPropagation();hideSelection()};
    rect.onpointerdown=e=>{
      if(!selecting)return;
      if(e.target.closest('.crop-dismiss'))return;
      stopLiveEffect();
      e.preventDefault();e.stopPropagation();
      const handle=e.target.closest('.crop-handle')?.dataset.handle||'move';
      drag={handle,start:coord(e),s:selection()};rect.setPointerCapture?.(e.pointerId);
    };
    rect.onpointermove=e=>{
      if(!drag)return;
      e.preventDefault();
      const p=coord(e),dx=p.x-drag.start.x,dy=p.y-drag.start.y,{handle,s}=drag;
      if(handle==='move'){
        writeSelection({x:clamp(s.x+dx,0,canvas.width-s.w),y:clamp(s.y+dy,0,canvas.height-s.h),w:s.w,h:s.h});overlay();return;
      }
      let left=s.x,top=s.y,right=s.x+s.w,bottom=s.y+s.h;
      if(handle.includes('w'))left=clamp(s.x+dx,0,right-1);
      if(handle.includes('e'))right=clamp(s.x+s.w+dx,left+1,canvas.width);
      if(handle.includes('n'))top=clamp(s.y+dy,0,bottom-1);
      if(handle.includes('s'))bottom=clamp(s.y+s.h+dy,top+1,canvas.height);
      writeSelection({x:left,y:top,w:right-left,h:bottom-top});overlay();
    };
    rect.onpointerup=rect.onpointercancel=()=>{drag=null};
    ['cropX','cropY','cropW','cropH'].forEach(id=>$('#'+id).addEventListener('input',()=>{stopLiveEffect();showSelection();overlay()}));
    document.addEventListener('hoz:language',()=>{if(original)renderMeta()});
  });
})();
