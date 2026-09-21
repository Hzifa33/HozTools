(function(){
  'use strict';
  const H = window.HozTools, $ = H.$, $$ = H.$$;
  let original = null, sourceName = 'image', ratio = 1, undo = null, selecting = true;
  let effectBase = null, activeEffect = null, effectSelection = null, effectRaf = 0, effectHistory = [];
  let currentTool = 'crop', currentRatio = 'free', currentZoom = 1, isFit = true;
  const canvas = $('#canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
  let selectionUI = { show(){}, hide(){}, refresh(){}, afterCanvasChange(){} };
  let liveUI = { refresh(){}, announce(){} };
  let loadVersion = 0;

  function t(en, ar, es){
    return { en, ar, es }[H.lang()] || en;
  }

  function clamp(n, min, max){
    return Math.min(max, Math.max(min, n));
  }

  function setEnabled(on){
    $$('#editor button, #editor select, #editor input').forEach(b => {
      if(!['themeBtn', 'changeImage', 'drawerToggleBtn', 'zoomFitBtn', 'zoomInBtn', 'zoomOutBtn', 'mobileCancelBtn'].includes(b.id)){
        b.disabled = !on;
      }
    });
    if($('#undoBtn')) $('#undoBtn').disabled = !undo;
    if($('#resetBtn')) $('#resetBtn').disabled = !on;
    if($('#quickExportBtn')) $('#quickExportBtn').disabled = !on;
    if($('#cropBtn')) $('#cropBtn').disabled = !on;
    if($('#exportBtn')) $('#exportBtn').disabled = !on;
    if($('#blurBtn')) $('#blurBtn').disabled = !on;
    if($('#pixelBtn')) $('#pixelBtn').disabled = !on;
    if($('#mBlurBtn')) $('#mBlurBtn').disabled = !on;
    if($('#mPixelBtn')) $('#mPixelBtn').disabled = !on;
    if($('#applyPreset')) $('#applyPreset').disabled = !on;
    if($('#mApplyPreset')) $('#mApplyPreset').disabled = !on;
    if($('#faviconBtn')) $('#faviconBtn').disabled = !on;
    if($('#mFaviconBtn')) $('#mFaviconBtn').disabled = !on;
    if($('#cleanExport')) $('#cleanExport').disabled = !on;
    $$('[data-transform]').forEach(b => b.disabled = !on);
  }

  function snapshot(){
    undo = document.createElement('canvas');
    undo.width = canvas.width;
    undo.height = canvas.height;
    undo.getContext('2d').drawImage(canvas, 0, 0);
    if($('#undoBtn')) $('#undoBtn').disabled = false;
  }

  function canvasCopy(source = canvas){
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    copy.getContext('2d').drawImage(source, 0, 0);
    return copy;
  }

  function updateUndoEffectState(){
    const b = $('#undoEffect'), mb = $('#mUndoEffect'), count = $('#effectLayerCount');
    const hasHistory = effectHistory.length > 0;
    if(b) b.disabled = !hasHistory;
    if(mb) mb.disabled = !hasHistory;
    if(count){
      count.textContent = effectHistory.length;
      count.hidden = !hasHistory;
    }
  }

  function stopLiveEffect(){
    effectBase = null;
    activeEffect = null;
    effectSelection = null;
    if(effectRaf){
      cancelAnimationFrame(effectRaf);
      effectRaf = 0;
    }
  }

  function clearEffectState(resetHistory = true){
    stopLiveEffect();
    if(resetHistory) effectHistory = [];
    updateUndoEffectState();
  }

  function syncDims(){
    $('#width').value = canvas.width;
    $('#height').value = canvas.height;
    if($('#mWidth')) $('#mWidth').value = canvas.width;
    if($('#mHeight')) $('#mHeight').value = canvas.height;
  }

  function syncCrop(){
    $('#cropX').value = 0;
    $('#cropY').value = 0;
    $('#cropW').value = canvas.width;
    $('#cropH').value = canvas.height;
  }

  function selection(){
    if(!canvas.width || !canvas.height) return { x: 0, y: 0, w: 1, h: 1 };
    const rawX = Math.round(+$('#cropX').value || 0), rawY = Math.round(+$('#cropY').value || 0);
    const x = clamp(rawX, 0, Math.max(0, canvas.width - 1));
    const y = clamp(rawY, 0, Math.max(0, canvas.height - 1));
    const rawW = Math.round(+$('#cropW').value || canvas.width);
    const rawH = Math.round(+$('#cropH').value || canvas.height);
    const w = clamp(rawW, 1, Math.max(1, canvas.width - x));
    const h = clamp(rawH, 1, Math.max(1, canvas.height - y));
    return { x, y, w, h };
  }

  function renderMeta(){
    const f = original?.file;
    const ext = (H.ext(f?.name || '') || f?.type?.split('/')[1] || 'image').toUpperCase().replace('JPEG', 'JPG');
    const data = [
      [t('Original size', 'الحجم الأصلي', 'Tamaño original'), f ? H.bytes(f.size) : '—'],
      [t('Current dimensions', 'الأبعاد الحالية', 'Dimensiones actuales'), `${canvas.width} × ${canvas.height}`],
      [t('Format', 'الصيغة', 'Formato'), ext]
    ];
    $('#metadata').innerHTML = data.map(([a, b]) => `<div class="metric"><small>${a}</small><strong title="${String(b).replaceAll('"', '&quot;')}">${H.esc(b)}</strong></div>`).join('');
  }

  function extractPalette(){
    const tmp = document.createElement('canvas'), s = 70;
    tmp.width = s; tmp.height = s;
    tmp.getContext('2d').drawImage(canvas, 0, 0, s, s);
    const d = tmp.getContext('2d').getImageData(0, 0, s, s).data, bins = new Map();
    for(let i = 0; i < d.length; i += 16){
      if(d[i + 3] < 180) continue;
      const r = Math.round(d[i] / 32) * 32, g = Math.round(d[i + 1] / 32) * 32, b = Math.round(d[i + 2] / 32) * 32;
      const key = `${Math.min(r, 255)},${Math.min(g, 255)},${Math.min(b, 255)}`;
      bins.set(key, (bins.get(key) || 0) + 1);
    }
    const colors = [...bins].sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]);
    const swatches = colors.map(c => {
      const hex = '#' + c.split(',').map(n => (+n).toString(16).padStart(2, '0')).join('');
      return `<button class="swatch" style="background:${hex}" title="${hex}" data-color="${hex}"><span>${hex}</span></button>`;
    }).join('');
    if($('#palette')) $('#palette').innerHTML = swatches;
    if($('#mPalette')) $('#mPalette').innerHTML = swatches;
    $$('.swatch').forEach(b => b.onclick = () => H.copy(b.dataset.color.toUpperCase(), 'color'));
    if($('#mMetaInfo')) $('#mMetaInfo').textContent = `${canvas.width} × ${canvas.height}`;
  }

  function drawImage(img){
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    clearEffectState();
    ratio = canvas.width / canvas.height;
    syncDims();
    syncCrop();
    renderMeta();
    extractPalette();
    setEnabled(true);
    document.body.classList.add('has-image');
    $('#dropzone').classList.add('hidden');
    $('#editor').classList.remove('hidden');
    $('#status').textContent = `${canvas.width} × ${canvas.height}`;
    isFit = true;
    currentZoom = 1;
    selectionUI.afterCanvasChange();
    updateZoomDisplay();
    setTool(currentTool || 'crop');
    applyRatio('free');
    estimate();
  }

  function load(files){
    const version = ++loadVersion;
    const file = files[0];
    if(!file || !file.type.startsWith('image/')) return H.toast(t('Choose a supported image', 'اختر صورة مدعومة', 'Elige una imagen compatible'), 'error');
    if(file.size > 30 * 1024 * 1024) return H.toast(t('Choose an image below 30 MB.', 'اختر صورة دون 30 ميجابايت.', 'Elige una imagen menor de 30 MB.'), 'error');
    const img = new Image();
    img.onload = () => {
      if(version !== loadVersion){ URL.revokeObjectURL(img.src); return; }
      if(img.width * img.height > 24e6){
        URL.revokeObjectURL(img.src);
        return H.toast(t('Choose an image below 24 megapixels.', 'اختر صورة دون 24 ميجابكسل.', 'Elige una imagen inferior a 24 megapíxeles.'), 'error');
      }
      sourceName = H.basename(file.name);
      original = { file, img };
      undo = null;
      if($('#undoBtn')) $('#undoBtn').disabled = true;
      drawImage(img);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      H.toast(t('Could not read this image', 'تعذر قراءة الصورة', 'No se pudo leer la imagen'), 'error');
    };
    img.src = URL.createObjectURL(file);
  }

  function replaceWith(next, action){
    snapshot();
    clearEffectState();
    canvas.width = next.width;
    canvas.height = next.height;
    ctx.drawImage(next, 0, 0);
    ratio = canvas.width / canvas.height;
    syncDims();
    syncCrop();
    renderMeta();
    extractPalette();
    $('#status').textContent = `${canvas.width} × ${canvas.height}`;
    updateZoomDisplay();
    selectionUI.afterCanvasChange();
    if(currentTool === 'crop') applyRatio('free');
    estimate();
  }

  function resizeTo(w, h){
    if(!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1 || w * h > 24e6 || w > 16384 || h > 16384){
      H.toast(t('Use positive dimensions below 24 megapixels (maximum side: 16384).', 'استخدم أبعادًا موجبة دون 24 ميجابكسل (أقصى ضلع: 16384).', 'Usa dimensiones positivas inferiores a 24 megapíxeles.'), 'error');
      return;
    }
    const temp = document.createElement('canvas');
    temp.width = Math.max(1, Math.round(w));
    temp.height = Math.max(1, Math.round(h));
    temp.getContext('2d').drawImage(canvas, 0, 0, temp.width, temp.height);
    replaceWith(temp, 'resize');
  }

  function transform(type){
    const temp = document.createElement('canvas'), rot = type.startsWith('rotate');
    temp.width = rot ? canvas.height : canvas.width;
    temp.height = rot ? canvas.width : canvas.height;
    const c = temp.getContext('2d');
    c.translate(temp.width / 2, temp.height / 2);
    if(type === 'rotate-left') c.rotate(-Math.PI / 2);
    if(type === 'rotate-right') c.rotate(Math.PI / 2);
    if(type === 'flip-x') c.scale(-1, 1);
    if(type === 'flip-y') c.scale(1, -1);
    c.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    replaceWith(temp, type.startsWith('rotate') ? 'rotate' : 'flip');
  }

  function crop(){
    const s = selection();
    if(s.w < 1 || s.h < 1) return;
    const temp = document.createElement('canvas');
    temp.width = s.w;
    temp.height = s.h;
    temp.getContext('2d').drawImage(canvas, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
    replaceWith(temp, 'crop');
    selectionUI.hide();
    H.toast(t('Crop applied successfully.', 'تم تطبيق القص بنجاح.', 'Recorte aplicado con éxito.'));
  }

  function drawFeatherMask(maskCtx, w, h, feather){
    maskCtx.clearRect(0, 0, w, h);
    feather = Math.max(0, Math.min(Math.round(feather || 0), Math.floor(Math.min(w, h) / 2)));
    if(feather < 1){ maskCtx.fillStyle = '#fff'; maskCtx.fillRect(0, 0, w, h); return; }
    const innerW = Math.max(0, w - feather * 2), innerH = Math.max(0, h - feather * 2);
    maskCtx.fillStyle = '#fff';
    if(innerW > 0 && innerH > 0) maskCtx.fillRect(feather, feather, innerW, innerH);
    if(innerH > 0){
      let g = maskCtx.createLinearGradient(0, 0, feather, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
      maskCtx.fillStyle = g; maskCtx.fillRect(0, feather, feather, innerH);
      g = maskCtx.createLinearGradient(w - feather, 0, w, 0);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      maskCtx.fillStyle = g; maskCtx.fillRect(w - feather, feather, feather, innerH);
    }
    if(innerW > 0){
      let g = maskCtx.createLinearGradient(0, 0, 0, feather);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
      maskCtx.fillStyle = g; maskCtx.fillRect(feather, 0, innerW, feather);
      g = maskCtx.createLinearGradient(0, h - feather, 0, h);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      maskCtx.fillStyle = g; maskCtx.fillRect(feather, h - feather, innerW, feather);
    }
    const corners = [
      [feather, feather, 0, 0],
      [w - feather, feather, w - feather, 0],
      [feather, h - feather, 0, h - feather],
      [w - feather, h - feather, w - feather, h - feather]
    ];
    corners.forEach(([cx, cy, x, y]) => {
      const g = maskCtx.createRadialGradient(cx, cy, 0, cx, cy, feather);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      maskCtx.fillStyle = g; maskCtx.fillRect(x, y, feather, feather);
    });
  }

  function compositeRectPatch(region, x, y, feather){
    if(!region.width || !region.height) return;
    feather = Math.max(0, Math.min(feather, Math.floor(Math.min(region.width, region.height) / 2)));
    if(feather < 1){ ctx.drawImage(region, x, y); return; }
    const masked = document.createElement('canvas');
    masked.width = region.width; masked.height = region.height;
    const mx = masked.getContext('2d');
    mx.drawImage(region, 0, 0);
    mx.globalCompositeOperation = 'destination-in';
    drawFeatherMask(mx, masked.width, masked.height, feather);
    mx.globalCompositeOperation = 'source-over';
    ctx.drawImage(masked, x, y);
  }

  function fallbackBlurRegion(base, s, strength){
    const region = document.createElement('canvas');
    region.width = s.w; region.height = s.h;
    const rx = region.getContext('2d');
    const factor = Math.max(.06, Math.min(.72, 1 / (1 + strength * .16)));
    const tiny = document.createElement('canvas');
    tiny.width = Math.max(1, Math.round(s.w * factor));
    tiny.height = Math.max(1, Math.round(s.h * factor));
    const tx = tiny.getContext('2d');
    tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = 'high';
    tx.drawImage(base, s.x, s.y, s.w, s.h, 0, 0, tiny.width, tiny.height);
    rx.imageSmoothingEnabled = true; rx.imageSmoothingQuality = 'high';
    rx.drawImage(tiny, 0, 0, tiny.width, tiny.height, 0, 0, s.w, s.h);
    return region;
  }

  function pixelateRectRegion(base, s, strength){
    const box = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, box.width), scaleY = canvas.height / Math.max(1, box.height);
    const sourceScale = Math.max(1, scaleX, scaleY);
    const block = Math.max(2, Math.min(180, Math.round(strength * sourceScale)));
    const tiny = document.createElement('canvas');
    tiny.width = Math.max(1, Math.ceil(s.w / block));
    tiny.height = Math.max(1, Math.ceil(s.h / block));
    const tx = tiny.getContext('2d', { alpha: true });
    tx.imageSmoothingEnabled = true; tx.imageSmoothingQuality = 'low';
    tx.drawImage(base, s.x, s.y, s.w, s.h, 0, 0, tiny.width, tiny.height);
    const region = document.createElement('canvas');
    region.width = s.w; region.height = s.h;
    const rx = region.getContext('2d', { alpha: true });
    rx.imageSmoothingEnabled = false;
    rx.clearRect(0, 0, s.w, s.h);
    rx.drawImage(tiny, 0, 0, tiny.width, tiny.height, 0, 0, s.w, s.h);
    return region;
  }

  function renderEffect(kind, announce = true){
    if(!effectBase || !effectSelection) return false;
    const s = effectSelection, strength = Math.max(1, +$('#effectStrength').value || 1), feather = Math.max(0, +($('#featherStrength')?.value || 0));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(effectBase, 0, 0);
    if(kind === 'pixel'){
      const region = pixelateRectRegion(effectBase, s, strength);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(region, s.x, s.y);
      ctx.restore();
    } else {
      let applied = false;
      try {
        if('filter' in ctx){
          ctx.save();
          ctx.beginPath(); ctx.rect(s.x, s.y, s.w, s.h); ctx.clip();
          ctx.filter = `blur(${strength}px)`;
          const accepted = ctx.filter && ctx.filter !== 'none';
          if(accepted){ ctx.drawImage(effectBase, 0, 0); applied = true; }
          ctx.filter = 'none';
          ctx.restore();
        }
      } catch(e){
        try { ctx.restore(); } catch {}
        ctx.filter = 'none';
      }
      if(!applied){
        const region = fallbackBlurRegion(effectBase, s, strength);
        compositeRectPatch(region, s.x, s.y, Math.min(feather, Math.floor(Math.min(s.w, s.h) / 2)));
      }
    }
    estimate();
    return true;
  }

  function effect(kind){
    const base = canvasCopy(), sel = selection();
    effectBase = base;
    effectSelection = { ...sel };
    activeEffect = kind;
    try {
      const applied = renderEffect(kind, true);
      if(!applied) throw Error(t('The effect could not be applied.', 'تعذر تطبيق التأثير.', 'No se pudo aplicar el efecto.'));
      effectHistory.push(base);
      const historyLimit = Math.max(1, Math.min(8, Math.floor(96 * 1024 * 1024 / (canvas.width * canvas.height * 4))));
      while(effectHistory.length > historyLimit) effectHistory.shift();
      updateUndoEffectState();
    } catch(err){
      canvas.width = base.width;
      canvas.height = base.height;
      ctx.drawImage(base, 0, 0);
      stopLiveEffect();
      updateUndoEffectState();
      throw err;
    }
  }

  function undoLastEffect(){
    const prev = effectHistory.pop();
    if(!prev) return;
    canvas.width = prev.width;
    canvas.height = prev.height;
    ctx.drawImage(prev, 0, 0);
    stopLiveEffect();
    updateUndoEffectState();
    undo = null;
    if($('#undoBtn')) $('#undoBtn').disabled = true;
    ratio = canvas.width / canvas.height;
    syncDims();
    renderMeta();
    extractPalette();
    selectionUI.show();
    selectionUI.refresh();
    estimate();
  }

  function queueEffectPreview(){
    if(!activeEffect || !effectBase) return;
    if(effectRaf) cancelAnimationFrame(effectRaf);
    effectRaf = requestAnimationFrame(() => {
      effectRaf = 0;
      renderEffect(activeEffect, false);
    });
  }

  function blobFor(type, quality, cnv = canvas){
    return new Promise((res, rej) => cnv.toBlob(b => b ? res(b) : rej(Error(H.common[H.lang()].error)), type, quality));
  }

  async function outputBlob(){
    let w = Number($('#width').value), h = Number($('#height').value), temp = canvas;
    if(!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w < 1 || h < 1 || w > 16384 || h > 16384 || w * h > 24e6){
      throw Error(t('Check export dimensions.', 'راجع أبعاد التصدير.', 'Revisa las dimensiones.'));
    }
    if(w !== canvas.width || h !== canvas.height){
      temp = document.createElement('canvas');
      temp.width = w; temp.height = h;
      temp.getContext('2d').imageSmoothingQuality = 'high';
      temp.getContext('2d').drawImage(canvas, 0, 0, w, h);
    }
    const type = $('#format').value;
    if(type === 'image/jpeg'){
      const white = document.createElement('canvas');
      white.width = w; white.height = h;
      const x = white.getContext('2d');
      x.fillStyle = '#fff';
      x.fillRect(0, 0, w, h);
      x.drawImage(temp, 0, 0);
      temp = white;
    }
    let q = +$('#quality').value / 100, blob = await blobFor(type, q, temp), target = (+$('#targetKb').value || 0) * 1024;
    if(target && type !== 'image/png' && blob.size > target){
      let low = .05, high = q, best = await blobFor(type, low, temp), bestQ = low;
      for(let i = 0; i < 7; i++){
        const mid = (low + high) / 2, candidate = await blobFor(type, mid, temp);
        if(candidate.size <= target){ best = candidate; bestQ = mid; low = mid; } else high = mid;
      }
      blob = best; q = bestQ;
    }
    return { blob, type, w, h, q };
  }

  let estimateTimer, estimateVersion = 0;
  function estimate(){
    clearTimeout(estimateTimer);
    const version = ++estimateVersion;
    estimateTimer = setTimeout(async () => {
      if(!canvas.width) return;
      try {
        const { blob, w, h, q } = await outputBlob();
        if(version !== estimateVersion) return;
        const target = +$('#targetKb').value * 1024;
        const warning = target && blob.size > target ? t('Target not reached. Reduce dimensions or choose WebP.', 'لم يتحقق الحجم المطلوب. قلّل الأبعاد أو اختر WebP.', 'Reduce dimensiones o elige WebP.') : '';
        $('#estimate').innerHTML = `<strong class="big">${H.bytes(blob.size)}</strong><span class="muted">${w} × ${h} · ${Math.round(q * 100)}%</span>${warning ? '<p class="notice warn">' + warning + '</p>' : ''}`;
      } catch(e){
        if(version === estimateVersion) $('#estimate').textContent = e.message;
      }
    }, 200);
  }

  async function exportImage(clean = false){
    const { blob } = await outputBlob();
    const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1];
    H.download(blob, `${sourceName}-${clean ? 'clean' : 'edited'}.${extension}`);
  }

  function presetSelection(){
    const val = $('#preset').value;
    if(!val){ selectionUI.hide(); return; }
    const [a, b] = val.split(':').map(Number), target = a / b;
    let w = canvas.width, h = Math.round(w / target);
    if(h > canvas.height){ h = canvas.height; w = Math.round(h * target); }
    $('#cropW').value = w;
    $('#cropH').value = h;
    $('#cropX').value = Math.round((canvas.width - w) / 2);
    $('#cropY').value = Math.round((canvas.height - h) / 2);
    selectionUI.show();
    selectionUI.refresh();
  }

  function applyPresetCrop(){
    if(!$('#preset').value) return;
    crop();
    H.toast(t('Preset crop applied.', 'تم تطبيق المقاس الجاهز بنجاح.', 'Recorte predefinido aplicado.'));
  }

  async function favicon(){
    const size = +$('#faviconSize').value, temp = document.createElement('canvas');
    temp.width = temp.height = size;
    const s = Math.min(canvas.width, canvas.height), x = (canvas.width - s) / 2, y = (canvas.height - s) / 2;
    temp.getContext('2d').drawImage(canvas, x, y, s, s, 0, 0, size, size);
    H.download(await blobFor('image/png', 1, temp), `${sourceName}-favicon-${size}.png`);
  }

  // Ratio calculations
  function applyRatio(rKey){
    if(!canvas.width || !canvas.height) return;
    currentRatio = rKey;
    $$('[data-ratio]').forEach(b => b.classList.toggle('active', b.dataset.ratio === rKey));
    if(rKey === 'free'){
      // Keep existing selection or center an 85% selection
      if(!$('#cropW').value || +$('#cropW').value <= 0){
        const w = Math.round(canvas.width * 0.85);
        const h = Math.round(canvas.height * 0.85);
        const x = Math.round((canvas.width - w) / 2);
        const y = Math.round((canvas.height - h) / 2);
        $('#cropX').value = x; $('#cropY').value = y; $('#cropW').value = w; $('#cropH').value = h;
      }
      selectionUI.show();
      selectionUI.refresh();
      return;
    }
    let targetRatio;
    if(rKey === 'original'){
      targetRatio = canvas.width / canvas.height;
    } else {
      const [rw, rh] = rKey.split(':').map(Number);
      targetRatio = rw / rh;
    }
    let w, h;
    const cw = canvas.width, ch = canvas.height;
    if(cw / ch > targetRatio){
      h = Math.round(ch * 0.85);
      w = Math.round(h * targetRatio);
    } else {
      w = Math.round(cw * 0.85);
      h = Math.round(w / targetRatio);
    }
    const x = Math.round((cw - w) / 2);
    const y = Math.round((ch - h) / 2);
    $('#cropX').value = x; $('#cropY').value = y; $('#cropW').value = w; $('#cropH').value = h;
    selectionUI.show();
    selectionUI.refresh();
  }

  // Unified Tool Switcher
  const toolTitles = {
    crop: { en: 'Crop & Frame', ar: 'القص والإطار', es: 'Recortar y marco' },
    resize: { en: 'Adjust & Resize', ar: 'الحجم والضغط', es: 'Ajustar y redimensionar' },
    transform: { en: 'Rotate & Flip', ar: 'التدوير والانعكاس', es: 'Girar y reflejar' },
    privacy: { en: 'Privacy & Blur', ar: 'الخصوصية والتمويه', es: 'Privacidad y desenfoque' },
    presets: { en: 'Presets & Favicon', ar: 'المقاسات الجاهزة', es: 'Formatos y favicon' },
    palette: { en: 'Palette & Meta', ar: 'الألوان والبيانات', es: 'Colores e info' }
  };

  const toolSubs = {
    crop: { en: 'Select an aspect ratio or drag crop handles', ar: 'اختر نسبة الأبعاد أو اسحب مقابض التحديد', es: 'Elige proporción o arrastra tiradores' },
    resize: { en: 'Adjust pixel dimensions and compression', ar: 'تحكم بأبعاد البكسل وجودة الضغط', es: 'Ajusta dimensiones y compresión' },
    transform: { en: 'Rotate in 90° steps or mirror horizontally/vertically', ar: 'تدوير بدرجة 90 أو انعكاس أفقي وعمودي', es: 'Gira 90° o refleja la imagen' },
    privacy: { en: 'Blur or pixelate faces, documents, or plates', ar: 'تمويه أو بكسلة الوجوه والوثائق والأرقام', es: 'Desenfoca o pixela zonas sensibles' },
    presets: { en: 'Ready sizes for Instagram, YouTube, X & Favicons', ar: 'مقاسات جاهزة لإنستغرام ويوتيوب وفيس وأيقونة الموقع', es: 'Tamaños listos para redes y favicon' },
    palette: { en: 'Sample hex colors and inspect file properties', ar: 'استخرج أكواد الألوان وافحص خصائص الملف', es: 'Extrae colores e inspecciona metadatos' }
  };

  function setTool(toolName){
    currentTool = toolName;

    // 1. Update Rail Buttons (Desktop)
    $$('.rail-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tool === toolName);
    });

    // 2. Update Dock Buttons (Mobile)
    $$('.m-dock-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mTool === toolName);
    });

    // 3. Update Drawer Content (Desktop)
    $$('.tool-content-panel').forEach(p => {
      const active = p.dataset.panel === toolName;
      p.classList.toggle('active', active);
      p.hidden = !active;
    });

    // 4. Update Mobile Dedicated Shelves
    $$('.mobile-shelf').forEach(s => {
      s.classList.toggle('active', s.dataset.mShelf === toolName);
    });

    const info = toolTitles[toolName] || toolTitles.crop;
    const sub = toolSubs[toolName] || toolSubs.crop;
    const l = H.lang();
    const heading = info[l] || info.en;
    const headingEl = $('#drawerHeading');
    if(headingEl){
      headingEl.textContent = heading;
      headingEl.dataset.en = info.en;
      headingEl.dataset.ar = info.ar;
      headingEl.dataset.es = info.es;
    }
    if($('#drawerSubheading')) $('#drawerSubheading').textContent = sub[l] || sub.en;
    const mobileTitleEl = $('#mobileToolTitle');
    if(mobileTitleEl){
      const shortEn = info.en.split('&')[0].trim().split(' ')[0];
      const shortAr = info.ar.split('&')[0].trim().split(' ')[0];
      const shortEs = info.es.split('&')[0].trim().split(' ')[0];
      mobileTitleEl.textContent = (info[l] || info.en).split('&')[0].trim().split(' ')[0];
      mobileTitleEl.dataset.en = shortEn;
      mobileTitleEl.dataset.ar = shortAr;
      mobileTitleEl.dataset.es = shortEs;
    }

    // If desktop drawer was collapsed and user picks a tool, expand drawer
    const drawer = $('#studioDrawer');
    if(drawer && window.innerWidth > 900){
      drawer.classList.remove('is-collapsed');
    }

    // 5. Selection overlay (crop & privacy)
    selecting = (toolName === 'crop' || toolName === 'privacy');
    canvas.parentElement?.classList.toggle('selecting', selecting);
    if(selecting){
      selectionUI.show();
      selectionUI.refresh();
    } else {
      selectionUI.hide();
    }
  }

  // Zoom Handling — zoom is relative to the fitted canvas, never raw megapixels.
  function stageFitScale(){
    const stage = $('#studioStage');
    if(!stage || !canvas.width || !canvas.height) return 1;
    const styles = getComputedStyle(stage);
    const horizontal = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight) + parseFloat(styles.borderLeftWidth) + parseFloat(styles.borderRightWidth);
    const vertical = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom) + parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
    const availableWidth = Math.max(1, stage.clientWidth - horizontal - 4);
    const availableHeight = Math.max(1, stage.clientHeight - vertical - 4);
    return Math.min(1, availableWidth / canvas.width, availableHeight / canvas.height);
  }

  function updateZoomDisplay(){
    if(!canvas.width) return;
    const stage = $('#studioStage');
    if(isFit){
      canvas.style.maxWidth = '100%';
      canvas.style.maxHeight = '100%';
      canvas.style.width = 'auto';
      canvas.style.height = 'auto';
      stage?.classList.remove('is-zoomed');
      $('#zoomFitBtn')?.classList.add('active');
    } else {
      const scale = stageFitScale() * currentZoom;
      const renderedWidth = Math.max(1, Math.round(canvas.width * scale));
      const renderedHeight = Math.max(1, Math.round(canvas.height * scale));
      canvas.style.maxWidth = 'none';
      canvas.style.maxHeight = 'none';
      canvas.style.width = `${renderedWidth}px`;
      canvas.style.height = `${renderedHeight}px`;
      const overflows = !!stage && (renderedWidth > stage.clientWidth - 8 || renderedHeight > stage.clientHeight - 8);
      stage?.classList.toggle('is-zoomed', overflows);
      $('#zoomFitBtn')?.classList.remove('active');
    }
    selectionUI.refresh();
  }

  // Attach basic listeners
  H.enhanceDrop($('#dropzone'), load);
  setEnabled(false);

  $('#width').addEventListener('input', () => {
    if($('#mWidth')) $('#mWidth').value = $('#width').value;
    if($('#lockRatio').checked){
      const h = Math.round((+$('#width').value || 1) / ratio);
      $('#height').value = h;
      if($('#mHeight')) $('#mHeight').value = h;
    }
    estimate();
  });
  $('#height').addEventListener('input', () => {
    if($('#mHeight')) $('#mHeight').value = $('#height').value;
    if($('#lockRatio').checked){
      const w = Math.round((+$('#height').value || 1) * ratio);
      $('#width').value = w;
      if($('#mWidth')) $('#mWidth').value = w;
    }
    estimate();
  });

  // Mobile Adjust Shelf input syncing
  $('#mWidth')?.addEventListener('input', () => {
    $('#width').value = $('#mWidth').value;
    if($('#lockRatio').checked){
      const h = Math.round((+$('#mWidth').value || 1) / ratio);
      $('#height').value = h;
      if($('#mHeight')) $('#mHeight').value = h;
    }
    estimate();
  });

  $('#mHeight')?.addEventListener('input', () => {
    $('#height').value = $('#mHeight').value;
    if($('#lockRatio').checked){
      const w = Math.round((+$('#mHeight').value || 1) * ratio);
      $('#width').value = w;
      if($('#mWidth')) $('#mWidth').value = w;
    }
    estimate();
  });

  $('#mFormat')?.addEventListener('change', () => {
    $('#format').value = $('#mFormat').value;
    estimate();
  });

  ['format', 'quality', 'targetKb'].forEach(id => {
    $('#' + id)?.addEventListener('input', () => {
      const qVal = $('#quality').value;
      $('#qualityLabel').textContent = qVal + '%';
      if($('#mQualityLabel')) $('#mQualityLabel').textContent = qVal + '%';
      if($('#mQuality')) $('#mQuality').value = qVal;
      if($('#mFormat')) $('#mFormat').value = $('#format').value;
      estimate();
    });
  });

  $('#mQuality')?.addEventListener('input', () => {
    const qVal = $('#mQuality').value;
    $('#quality').value = qVal;
    $('#qualityLabel').textContent = qVal + '%';
    if($('#mQualityLabel')) $('#mQualityLabel').textContent = qVal + '%';
    estimate();
  });

  const syncEffectLabels = () => {
    $('#effectLabel').textContent = $('#effectStrength').value;
    const f = $('#featherLabel');
    if(f) f.textContent = $('#featherStrength').value;
  };
  $('#effectStrength').oninput = () => { syncEffectLabels(); queueEffectPreview(); };
  $('#featherStrength').oninput = () => { syncEffectLabels(); queueEffectPreview(); };
  syncEffectLabels();

  $('#cropBtn').onclick = crop;
  $$('[data-transform]').forEach(b => b.onclick = () => transform(b.dataset.transform));
  $('#blurBtn').onclick = () => H.busy($('#blurBtn'), () => effect('blur'));
  $('#pixelBtn').onclick = () => H.busy($('#pixelBtn'), () => effect('pixel'));
  $$('.js-export-image').forEach(b => b.onclick = () => H.busy(b, () => exportImage()));
  $('#cleanExport').onclick = () => H.busy($('#cleanExport'), () => exportImage(true));
  $('#undoEffect').onclick = undoLastEffect;
  $('#preset').addEventListener('change', () => {
    if($('#mPreset')) $('#mPreset').value = $('#preset').value;
    presetSelection();
  });
  $('#applyPreset').onclick = applyPresetCrop;
  $('#faviconBtn').onclick = favicon;

  // Mobile Presets Shelf
  $('#mPreset')?.addEventListener('change', e => {
    if($('#preset')) $('#preset').value = e.target.value;
    presetSelection();
  });
  $('#mApplyPreset')?.addEventListener('click', applyPresetCrop);
  $('#mFaviconBtn')?.addEventListener('click', favicon);

  // History Actions
  $('#resetBtn').onclick = () => {
    if(!original) return;
    drawImage(original.img);
    undo = null;
    if($('#undoBtn')) $('#undoBtn').disabled = true;
    H.toast(t('Reset to original image.', 'تمت استعادة الصورة الأصلية.', 'Restablecido al original.'));
  };

  $('#undoBtn').onclick = () => {
    if(!undo) return;
    canvas.width = undo.width;
    canvas.height = undo.height;
    ctx.drawImage(undo, 0, 0);
    undo = null;
    $('#undoBtn').disabled = true;
    clearEffectState();
    ratio = canvas.width / canvas.height;
    syncDims();
    syncCrop();
    renderMeta();
    extractPalette();
    $('#status').textContent = `${canvas.width} × ${canvas.height}`;
    selectionUI.afterCanvasChange();
    if(currentTool === 'crop') applyRatio('free');
    estimate();
    H.toast(t('Undone.', 'تم التراجع.', 'Deshecho.'));
  };

  $('#changeImage').onclick = () => $('#imageInput').click();

  // Desktop Tool Rail Click
  $$('.rail-btn').forEach(b => {
    b.onclick = () => setTool(b.dataset.tool);
  });

  // Mobile Dock Click
  $$('.m-dock-btn').forEach(b => {
    b.onclick = () => setTool(b.dataset.mTool);
  });

  // Aspect Ratio Pills & Chips (Desktop & Mobile)
  $$('[data-ratio]').forEach(b => {
    b.onclick = () => applyRatio(b.dataset.ratio);
  });

  // Mobile Action Bar
  $('#mobileApplyBtn').onclick = () => {
    if(currentTool === 'crop'){
      crop();
    } else if(currentTool === 'resize'){
      const w = +$('#mWidth').value || +$('#width').value;
      const h = +$('#mHeight').value || +$('#height').value;
      if(w !== canvas.width || h !== canvas.height){
        resizeTo(w, h);
      } else {
        exportImage();
      }
    } else if(currentTool === 'privacy'){
      effect('blur');
    } else if(currentTool === 'presets'){
      applyPresetCrop();
    } else {
      H.toast(t('Changes applied.', 'تم التطبيق.', 'Aplicado.'));
    }
  };

  $('#mobileCancelBtn').onclick = () => {
    setTool('crop');
    selectionUI.hide();
  };

  // Desktop Drawer collapse/expand button
  $('#drawerToggleBtn').onclick = () => {
    $('#studioDrawer')?.classList.toggle('is-collapsed');
    selectionUI.refresh();
  };

  // Mobile Privacy Buttons
  $('#mBlurBtn').onclick = () => H.busy($('#mBlurBtn'), () => effect('blur'));
  $('#mPixelBtn').onclick = () => H.busy($('#mPixelBtn'), () => effect('pixel'));
  $('#mUndoEffect').onclick = undoLastEffect;

  // Zoom Controls
  $('#zoomFitBtn').onclick = () => {
    isFit = true;
    currentZoom = 1;
    updateZoomDisplay();
  };

  $('#zoomInBtn').onclick = () => {
    isFit = false;
    currentZoom = Math.min(3, currentZoom + 0.25);
    updateZoomDisplay();
  };

  $('#zoomOutBtn').onclick = () => {
    isFit = false;
    currentZoom = Math.max(0.25, currentZoom - 0.25);
    updateZoomDisplay();
  };

  // Canvas Color Picker
  canvas.addEventListener('click', e => {
    if(selecting) return;
    const r = canvas.getBoundingClientRect();
    const x = clamp(Math.floor((e.clientX - r.left) * canvas.width / r.width), 0, canvas.width - 1);
    const y = clamp(Math.floor((e.clientY - r.top) * canvas.height / r.height), 0, canvas.height - 1);
    const d = ctx.getImageData(x, y, 1, 1).data;
    const hex = '#' + [d[0], d[1], d[2]].map(n => n.toString(16).padStart(2, '0')).join('');
    H.copy(hex.toUpperCase(), 'color');
  });

  // Global Clipboard Paste Support (Ctrl+V)
  window.addEventListener('paste', e => {
    const items = e.clipboardData?.items;
    if(!items) return;
    for(let i = 0; i < items.length; i++){
      if(items[i].type.startsWith('image/')){
        const file = items[i].getAsFile();
        if(file){
          e.preventDefault();
          load([file]);
          H.toast(t('Pasted image loaded.', 'تم تحميل الصورة الملصقة.', 'Imagen pegada cargada.'));
          break;
        }
      }
    }
  });

  // Setup Crop Selection & Handles
  document.addEventListener('DOMContentLoaded', () => {
    const parent = canvas.parentElement;
    parent.classList.add('selection-wrap');

    const rect = document.createElement('div');
    rect.className = 'crop-overlay';
    rect.hidden = true;
    rect.innerHTML = '<button type="button" class="crop-dismiss" aria-label="' + t('Clear crop selection', 'إلغاء تحديد القص', 'Borrar selección') + '">&times;</button>' +
      '<span class="crop-handle" data-handle="nw"></span>' +
      '<span class="crop-handle" data-handle="n"></span>' +
      '<span class="crop-handle" data-handle="ne"></span>' +
      '<span class="crop-handle" data-handle="e"></span>' +
      '<span class="crop-handle" data-handle="se"></span>' +
      '<span class="crop-handle" data-handle="s"></span>' +
      '<span class="crop-handle" data-handle="sw"></span>' +
      '<span class="crop-handle" data-handle="w"></span>';
    parent.append(rect);

    const dismiss = $('.crop-dismiss', rect);
    let drawStart = null, drag = null, selectionVisible = false;

    function coord(e){
      const r = canvas.getBoundingClientRect();
      return {
        x: clamp(Math.round((e.clientX - r.left) * canvas.width / r.width), 0, canvas.width),
        y: clamp(Math.round((e.clientY - r.top) * canvas.height / r.height), 0, canvas.height)
      };
    }

    function writeSelection(s){
      const x = clamp(Math.round(s.x), 0, Math.max(0, canvas.width - 1));
      const y = clamp(Math.round(s.y), 0, Math.max(0, canvas.height - 1));
      const w = clamp(Math.round(s.w), 1, Math.max(1, canvas.width - x));
      const h = clamp(Math.round(s.h), 1, Math.max(1, canvas.height - y));
      $('#cropX').value = x;
      $('#cropY').value = y;
      $('#cropW').value = w;
      $('#cropH').value = h;
    }

    function overlay(){
      if(!canvas.width) return;
      const s = selection();
      rect.style.left = `${s.x / canvas.width * 100}%`;
      rect.style.top = `${s.y / canvas.height * 100}%`;
      rect.style.width = `${s.w / canvas.width * 100}%`;
      rect.style.height = `${s.h / canvas.height * 100}%`;
    }

    function showSelection(){
      selectionVisible = true;
      if(selecting) rect.hidden = false;
      overlay();
    }

    function hideSelection(){
      selectionVisible = false;
      rect.hidden = true;
      drawStart = null;
      drag = null;
      stopLiveEffect();
    }

    function afterCanvasChange(){
      hideSelection();
      overlay();
    }

    selectionUI = { show: showSelection, hide: hideSelection, refresh: overlay, afterCanvasChange };

    canvas.onpointerdown = e => {
      if(!selecting || !canvas.width) return;
      stopLiveEffect();
      e.preventDefault();
      drawStart = coord(e);
      selectionVisible = true;
      rect.hidden = false;
      writeSelection({ x: Math.min(drawStart.x, canvas.width - 1), y: Math.min(drawStart.y, canvas.height - 1), w: 1, h: 1 });
      overlay();
      canvas.setPointerCapture?.(e.pointerId);
    };

    canvas.onpointermove = e => {
      if(!drawStart) return;
      const p = coord(e), x1 = clamp(drawStart.x, 0, canvas.width - 1), y1 = clamp(drawStart.y, 0, canvas.height - 1);
      const x2 = clamp(p.x, 0, canvas.width), y2 = clamp(p.y, 0, canvas.height);
      const left = Math.min(x1, x2), top = Math.min(y1, y2), right = Math.max(x1 + 1, x2), bottom = Math.max(y1 + 1, y2);
      writeSelection({ x: left, y: top, w: right - left, h: bottom - top });
      overlay();
    };

    canvas.onpointerup = canvas.onpointercancel = () => { drawStart = null; };

    dismiss.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      hideSelection();
    };

    rect.onpointerdown = e => {
      if(!selecting) return;
      if(e.target.closest('.crop-dismiss')) return;
      stopLiveEffect();
      e.preventDefault();
      e.stopPropagation();
      const handle = e.target.closest('.crop-handle')?.dataset.handle || 'move';
      drag = { handle, start: coord(e), s: selection() };
      rect.setPointerCapture?.(e.pointerId);
    };

    rect.onpointermove = e => {
      if(!drag) return;
      e.preventDefault();
      const p = coord(e), dx = p.x - drag.start.x, dy = p.y - drag.start.y, { handle, s } = drag;
      if(handle === 'move'){
        writeSelection({ x: clamp(s.x + dx, 0, canvas.width - s.w), y: clamp(s.y + dy, 0, canvas.height - s.h), w: s.w, h: s.h });
        overlay();
        return;
      }
      let left = s.x, top = s.y, right = s.x + s.w, bottom = s.y + s.h;
      if(handle.includes('w')) left = clamp(s.x + dx, 0, right - 1);
      if(handle.includes('e')) right = clamp(s.x + s.w + dx, left + 1, canvas.width);
      if(handle.includes('n')) top = clamp(s.y + dy, 0, bottom - 1);
      if(handle.includes('s')) bottom = clamp(s.y + s.h + dy, top + 1, canvas.height);
      writeSelection({ x: left, y: top, w: right - left, h: bottom - top });
      overlay();
    };

    rect.onpointerup = rect.onpointercancel = () => { drag = null; };

    ['cropX', 'cropY', 'cropW', 'cropH'].forEach(id => {
      $('#' + id).addEventListener('input', () => {
        stopLiveEffect();
        showSelection();
        overlay();
      });
    });

    window.addEventListener('resize', () => {
      updateZoomDisplay();
      overlay();
    }, { passive: true });

    document.addEventListener('hoz:language', () => {
      if(original) renderMeta();
      const l = H.lang();
      const info = toolTitles[currentTool] || toolTitles.crop;
      const sub = toolSubs[currentTool] || toolSubs.crop;
      const headingEl = $('#drawerHeading');
      if(headingEl){
        headingEl.textContent = info[l] || info.en;
        headingEl.dataset.en = info.en;
        headingEl.dataset.ar = info.ar;
        headingEl.dataset.es = info.es;
      }
      if($('#drawerSubheading')) $('#drawerSubheading').textContent = sub[l] || sub.en;
      const mobileTitleEl = $('#mobileToolTitle');
      if(mobileTitleEl){
        const shortEn = info.en.split('&')[0].trim().split(' ')[0];
        const shortAr = info.ar.split('&')[0].trim().split(' ')[0];
        const shortEs = info.es.split('&')[0].trim().split(' ')[0];
        mobileTitleEl.textContent = (info[l] || info.en).split('&')[0].trim().split(' ')[0];
        mobileTitleEl.dataset.en = shortEn;
        mobileTitleEl.dataset.ar = shortAr;
        mobileTitleEl.dataset.es = shortEs;
      }
    });
  });
})();
