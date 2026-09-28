/* gatos.pics compare engine.
   Two data sources, picked at boot:
   - Embedded: window.GATOS_PACKAGE = {format, manifest, images:{"<id>_<frame>": dataURL}}
     Set by a self-contained export or by the builder preview. Works from file://
     with zero network: images become object URLs (canvas-safe, so diff and
     1:1 crops keep working).
   - Http: manifest.json + img/<id>_<frame>.<ext> next to this page (classic
     static hosting). version -> ?v= cache busting for immutable image caches. */
'use strict';

const $ = id => document.getElementById(id);
const comp = $('comp'), imgA = $('imgA'), imgB = $('imgB'), diffCanvas = $('diffCanvas');
const paneA = $('paneA'), paneB = $('paneB');
const labelA = $('labelA'), labelB = $('labelB');
const labelAName = $('labelAName'), labelBName = $('labelBName');
const statsA = $('statsA'), statsB = $('statsB');
const divider = $('divider'), zoomBadge = $('zoomBadge'), diffNote = $('diffNote');
const modeBadge = $('modeBadge'), cropHint = $('cropHint'), cropPanel = $('cropPanel');
const cropRows = $('cropRows'), cropTitle = $('cropTitle');
const diffBtn = $('diffBtn'), blinkBtn = $('blinkBtn'), cropBtn = $('cropBtn');
const pixBtn = $('pixBtn');
const blindBtn = $('blindBtn');
const solarBtn = $('solarBtn');
const metaLine = $('metaLine'), pageTitle = $('pageTitle');
const diffCtx = diffCanvas.getContext('2d', {willReadFrequently:true});

let FRAMES = [], VARIANTS = [];
let FRAME_LABELS = {}, FRAME_META = {};
let VERSION = '', CLIP = {};
const AMPLIFY_DEFAULT_IDX = 1;
const GAINS = [5, 10, 20, 40];
const HEAT_T = 4;

/* ---------- data sources ---------- */
function makeHttpSource(){
  return {
    async init(){
      const r = await fetch('manifest.json?t='+Date.now(), {cache:'no-store'});
      const m = await r.json();
      VERSION = String(m.version || '');
      return m;
    },
    srcFor(id, f){
      const ext = variant(id).ext || 'webp';
      return `img/${id}_${f}.${ext}${VERSION ? '?v='+VERSION : ''}`;
    }
  };
}
function makeEmbeddedSource(pkg){
  const urls = new Map();   // "<id>_<frame>" -> object URL (canvas-safe)
  function toObjectURL(dataurl){
    const parts = dataurl.split(',');
    const mime = (parts[0].match(/^data:([^;]+)/) || [,'image/png'])[1];
    const bin = atob(parts[1] || '');
    const buf = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) buf[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([buf], {type:mime}));
  }
  return {
    async init(){ return pkg.manifest; },
    srcFor(id, f){
      const key = id+'_'+f;
      if (!urls.has(key)){
        const d = pkg.images && pkg.images[key];
        urls.set(key, d ? toObjectURL(d) : '');
      }
      return urls.get(key);
    }
  };
}
const SOURCE = (typeof window !== 'undefined' && window.GATOS_PACKAGE)
  ? makeEmbeddedSource(window.GATOS_PACKAGE)
  : makeHttpSource();

let frame = null, varA = null, varB = null;
let mobileZoomPending = matchMedia('(pointer:coarse)').matches || innerWidth <= 820;
let diffMode = false, blinkMode = false, heat = false, gainIdx = AMPLIFY_DEFAULT_IDX;
let cropMode = false, cropUV = null;
let dividerPos = 0.5;
let zoom = 1;                       // 1 = fit
let pan = {x:0, y:0};               // viewport-space px offset of the content rect
let fitScale = 1, rw = 0, rh = 0, ox = 0, oy = 0;
let drag = null, pinch = null;
const pointers = new Map();
const realB = new Image();          // offscreen holder for B's true pixels (diff)
let diffData = null;                // cached abs-diff planes for current pair
const cropImgs = new Map();         // variant id -> Image for current frame

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function variant(id){ return VARIANTS.find(v=>v.id===id) || {id, name:id, color:'#ccc'}; }
function variantName(id){
  const v = variant(id);
  if (blindMode) return String(VARIANTS.findIndex(x => x.id === id)+1);
  return v.name;
}
function srcFor(id, f){ return SOURCE.srcFor(id, f); }
function naturalDims(){ return {nw: imgA.naturalWidth || 1920, nh: imgA.naturalHeight || 1080}; }
function dpr(){ return window.devicePixelRatio || 1; }

/* ---------- fit geometry: the content rect is sized/positioned explicitly,
   so zoom/pan/1:1 math is exact regardless of window aspect ---------- */
function computeFit(){
  const w = comp.clientWidth, h = comp.clientHeight;
  const {nw, nh} = naturalDims();
  fitScale = Math.min(w/nw, h/nh);
  rw = nw*fitScale; rh = nh*fitScale;
  ox = (w-rw)/2; oy = (h-rh)/2;
  for (const el of [imgA, imgB, diffCanvas]){
    el.style.width = rw+'px'; el.style.height = rh+'px';
    el.style.left = ox+'px'; el.style.top = oy+'px';
  }
}
function zmax(){ return 8/(fitScale*dpr()); }   // 800% of native device pixels
function clampPan(){
  const w = comp.clientWidth, h = comp.clientHeight;
  pan.x = clamp(pan.x, Math.min(0, w-ox-rw*zoom), Math.max(0, -ox));
  pan.y = clamp(pan.y, Math.min(0, h-oy-rh*zoom), Math.max(0, -oy));
}
function updateBadge(){
  if (!imgA.complete || !imgB.complete){ zoomBadge.textContent = 'cargando\u2026'; return; }
  zoomBadge.textContent = zoom === 1 ? 'ajustar' : Math.round(fitScale*zoom*dpr()*100)+'%';
}
function applyTransform(){
  const t = `translate(${pan.x}px,${pan.y}px) scale(${zoom})`;
  imgA.style.transform = t;
  imgB.style.transform = t;
  diffCanvas.style.transform = t;
  paneB.style.clipPath = blinkMode ? 'inset(0 0 0 0)' : `inset(0 0 0 ${dividerPos*100}%)`;
  divider.style.display = blinkMode ? 'none' : '';
  divider.style.left = `${dividerPos*100}%`;
  updateBadge();
}
function setZoomAt(cx, cy, Z2){
  const r = comp.getBoundingClientRect();
  const x = cx-r.left, y = cy-r.top;
  const u = (x-ox-pan.x)/zoom, v = (y-oy-pan.y)/zoom;
  zoom = clamp(Z2, 1, zmax());
  if (zoom === 1){ pan = {x:0, y:0}; }
  else { pan.x = x-ox-u*zoom; pan.y = y-oy-v*zoom; clampPan(); }
  applyTransform(); writeHash();
}
function oneToOne(){
  const r = comp.getBoundingClientRect();
  setZoomAt(r.left+comp.clientWidth/2, r.top+comp.clientHeight/2, 1/(fitScale*dpr()));
}
function fitView(){ zoom = 1; pan = {x:0, y:0}; applyTransform(); writeHash(); }

comp.addEventListener('wheel', e => {
  e.preventDefault();
  setZoomAt(e.clientX, e.clientY, zoom * (e.deltaY < 0 ? 1.15 : 1/1.15));
}, {passive:false});

/* ---------- pointer input: mouse + touch unified, pinch zoom ---------- */
const pdist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
comp.addEventListener('pointerdown', e => {
  comp.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if (pointers.size === 2){
    const [p1, p2] = [...pointers.values()];
    pinch = {d0: pdist(p1,p2) || 1, z0: zoom, mx0:(p1.x+p2.x)/2, my0:(p1.y+p2.y)/2, tx0:pan.x, ty0:pan.y};
    drag = null;
  } else if (pointers.size === 1){
    const r = comp.getBoundingClientRect();
    const x = e.clientX-r.left, w = comp.clientWidth;
    if (Math.abs(x - dividerPos*w) < (matchMedia('(pointer:coarse)').matches ? 34 : 18) && !blinkMode){ drag = {mode:'divider', sx:e.clientX, start:dividerPos}; }
    else if (cropMode){ pickCrop(e.clientX, e.clientY); }
    else if (zoom > 1){ drag = {mode:'pan', sx:e.clientX, sy:e.clientY, px:pan.x, py:pan.y}; }
  }
  e.preventDefault();
});
comp.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if (pointers.size === 2 && pinch){
    const [p1, p2] = [...pointers.values()];
    const mx = (p1.x+p2.x)/2, my = (p1.y+p2.y)/2;
    setZoomAt(mx, my, pinch.z0 * pdist(p1,p2)/pinch.d0);
    pan.x = pinch.tx0 + (mx-pinch.mx0);
    pan.y = pinch.ty0 + (my-pinch.my0);
    clampPan(); applyTransform();
  } else if (drag){
    const w = comp.clientWidth, h = comp.clientHeight;
    if (drag.mode === 'divider'){
      dividerPos = clamp(drag.start + (e.clientX-drag.sx)/w, 0, 1);
      applyTransform(); writeHash();
    } else {
      pan.x = drag.px - (e.clientX-drag.sx);
      pan.y = drag.py - (e.clientY-drag.sy);
      clampPan(); applyTransform();
    }
  }
});
function pointerEnd(e){
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pointers.size === 0) drag = null;
}
comp.addEventListener('pointerup', pointerEnd);
comp.addEventListener('pointercancel', pointerEnd);
comp.addEventListener('dblclick', fitView);
window.addEventListener('resize', () => { computeFit(); clampPan(); applyTransform(); syncVariantOverflow(); });

/* ---------- pane strips: bounded, horizontally scrollable ---------- */
function syncVariantOverflow(){
  ['varA','varB'].forEach(id => {
    const s = $(id); if (!s) return;
    const g = s.closest('.group');
    const over = s.scrollWidth - s.clientWidth > 2;
    if (g) g.classList.toggle('overflowing', over);
    // keep the selected pane visible when the list is longer than its strip
    const act = s.querySelector('button.active') || s.querySelector('.on') || s.querySelector('button[aria-pressed="true"]');
    if (over && act) act.scrollIntoView({inline:'nearest', block:'nearest'});
  });
}
document.querySelectorAll('.vscroll').forEach(b => {
  b.addEventListener('click', () => {
    const s = $(b.dataset.scroll); if (!s) return;
    s.scrollBy({left: Number(b.dataset.dir) * 220, behavior:'smooth'});
  });
});
['varA','varB'].forEach(id => {
  const s = $(id); if (!s) return;
  s.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { s.scrollLeft += e.deltaY; e.preventDefault(); }
  }, {passive:false});
});

/* ---------- diff mode: cached abs-diff planes, canvas overlay ---------- */
function ensureDiffBase(){
  if (!imgA.complete || !imgA.naturalWidth || !realB.complete || !realB.naturalWidth) return null;
  const w = imgA.naturalWidth, h = imgA.naturalHeight;
  if (realB.naturalWidth !== w || realB.naturalHeight !== h) return null;
  const keyA = imgA.currentSrc || imgA.src, keyB = realB.currentSrc || realB.src;
  if (diffData && diffData.keyA === keyA && diffData.keyB === keyB) return diffData;
  const ca = document.createElement('canvas');
  ca.width = w; ca.height = h;
  const ctx = ca.getContext('2d', {willReadFrequently:true});
  ctx.drawImage(imgA, 0, 0);
  const a = ctx.getImageData(0,0,w,h).data;
  ctx.drawImage(realB, 0, 0);
  const b = ctx.getImageData(0,0,w,h).data;
  const n = w*h;
  const dr = new Uint8Array(n), dg = new Uint8Array(n), db = new Uint8Array(n);
  let sum = 0;
  for (let i=0, j=0; j<n; i+=4, j++){
    dr[j] = Math.abs(a[i]-b[i]); dg[j] = Math.abs(a[i+1]-b[i+1]); db[j] = Math.abs(a[i+2]-b[i+2]);
    sum += dr[j]+dg[j]+db[j];
  }
  diffData = {keyA, keyB, w, h, dr, dg, db, mean: sum/(n*3)};
  return diffData;
}
function renderDiff(){
  if (!diffMode) return;
  const d = ensureDiffBase();
  if (!d){ diffNote.textContent = 'Diff \u00D7'+GAINS[gainIdx]+' \u00B7 cargando\u2026'; return; }
  const A = GAINS[gainIdx];
  const out = diffCtx.createImageData(d.w, d.h);
  const o = out.data;
  for (let j=0, i=0; j<d.dr.length; j++, i+=4){
    if (heat && (d.dr[j] >= HEAT_T || d.dg[j] >= HEAT_T || d.db[j] >= HEAT_T)){
      o[i] = 255;
    } else {
      o[i] = Math.min(255, d.dr[j]*A);
      o[i+1] = Math.min(255, d.dg[j]*A);
      o[i+2] = Math.min(255, d.db[j]*A);
    }
    o[i+3] = 255;
  }
  diffCtx.putImageData(out, 0, 0);
  diffNote.textContent = `Diff \u00D7${A}${heat ? ` \u00B7 calor (\u0394\u2265${HEAT_T} en rojo)` : ''} \u00B7 color = canal que difiere \u00B7 \u0394 media ${d.mean.toFixed(2)}/255`;
}
function setDiff(on){
  diffMode = on;
  if (on) setBlink(false, true);
  diffBtn.classList.toggle('diff-on', on);
  diffCanvas.style.display = on ? 'block' : 'none';
  imgB.style.display = on ? 'none' : '';
  diffNote.style.display = on ? 'block' : 'none';
  if (on){
    diffNote.textContent = 'Diff \u00D7'+GAINS[gainIdx]+' \u00B7 calculando\u2026';
    realB.src = srcFor(varB, frame);
    imgB.src = realB.src;
    renderDiff();
  } else {
    diffData = null;
    imgB.src = srcFor(varB, frame);
  }
  updateMeta(); writeHash();
}
function setGain(i){
  gainIdx = clamp(i, 0, GAINS.length-1);
  if (diffMode) renderDiff();
  writeHash();
}
function setHeat(on){
  heat = on;
  if (diffMode) renderDiff();
  writeHash();
}
imgA.addEventListener('load', () => { computeFit(); if (mobileZoomPending){ mobileZoomPending = false; oneToOne(); } applyTransform(); renderDiff(); updateBadge(); });
imgA.addEventListener('error', () => { zoomBadge.textContent = 'la imagen no carg\u00f3'; });

/* ---------- escala: suave o píxeles nítidos (inspección de píxel) ---------- */
let smoothScale = true;
try { smoothScale = localStorage.getItem('gatosSmooth') !== '0'; } catch(e){}
function setSmooth(on){
  smoothScale = on;
  for (const el of [imgA, imgB, diffCanvas]) el.style.imageRendering = on ? 'auto' : 'pixelated';
  pixBtn.classList.toggle('active', !on);
  try { localStorage.setItem('gatosSmooth', on ? '1' : '0'); } catch(e){}
}
pixBtn.addEventListener('click', () => setSmooth(!smoothScale));
setSmooth(smoothScale);
imgB.addEventListener('load', updateBadge);
realB.addEventListener('load', renderDiff);
diffBtn.addEventListener('click', () => setDiff(!diffMode));

/* ---------- blink mode ---------- */
let blinkTimer = null;
function setBlink(on, quiet){
  blinkMode = on;
  if (on) setDiff(false);
  blinkBtn.classList.toggle('blink-on', on);
  modeBadge.style.display = on ? 'block' : 'none';
  if (on){
    imgB.style.opacity = '1';
    blinkTimer = setInterval(() => { imgB.style.opacity = imgB.style.opacity === '1' ? '0' : '1'; }, 500);
  } else {
    clearInterval(blinkTimer);
    imgB.style.opacity = '';
  }
  if (!quiet){ applyTransform(); updateMeta(); writeHash(); }
}
blinkBtn.addEventListener('click', () => setBlink(!blinkMode));

/* ---------- modo ciego: oculta qué variante es cuál (anti-sesgo) ---------- */
let blindMode = false;
function setBlind(on){
  blindMode = on;
  blindBtn.classList.toggle('blind-on', on);
  if (on) hideTip();
  refreshVariantButtons();
  loadImg();
  updateMeta();
  writeHash();
}
blindBtn.addEventListener('click', () => setBlind(!blindMode));

/* ---------- curva solar: revela banding ---------- */
let solarMode = false;
function setSolar(on){
  solarMode = on;
  solarBtn.classList.toggle('solar-on', on);
  const f = on ? 'url(#solarCurve)' : '';
  imgA.style.filter = f;
  imgB.style.filter = f;
  updateMeta();
  writeHash();
}
solarBtn.addEventListener('click', () => setSolar(!solarMode));

/* ---------- crops N-up: 1:1 crops of every variant at a picked point ---------- */
function pickCrop(cx, cy){
  const r = comp.getBoundingClientRect();
  const {nw, nh} = naturalDims();
  const u = clamp(((cx-r.left)-ox-pan.x)/zoom/fitScale, 0, nw);
  const v = clamp(((cy-r.top)-oy-pan.y)/zoom/fitScale, 0, nh);
  cropUV = {u: Math.round(u), v: Math.round(v)};
  openCropPanel();
  writeHash();
}
function cropImg(id){
  const url = srcFor(id, frame);
  let im = cropImgs.get(id);
  if (!im || (im.currentSrc||im.src) !== url){
    im = new Image();
    im.decoding = 'async';
    im.src = url;
    cropImgs.set(id, im);
  }
  return im;
}
function drawCropRow(id, canvas){
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const im = cropImg(id);
  if (!im.complete || !im.naturalWidth){
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9a9aa8'; ctx.fillText('cargando\u2026', 10, 20);
    im.addEventListener('load', () => { if (cropPanel.style.display !== 'none') drawCropRow(id, canvas); }, {once:true});
    return;
  }
  const sw = Math.round(canvas.width), sh = Math.round(canvas.height);
  const sx = clamp(Math.round(cropUV.u - sw/2), 0, im.naturalWidth - sw);
  const sy = clamp(Math.round(cropUV.v - sh/2), 0, im.naturalHeight - sh);
  ctx.drawImage(im, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
}
function openCropPanel(){
  cropPanel.style.display = 'block';
  cropHint.style.display = 'none';
  const d = dpr();
  const CW = Math.min(480, comp.clientWidth - 220), CH = Math.round(CW*9/16);
  cropTitle.textContent = `Recortes 1:1 @ ${cropUV.u},${cropUV.v} (px nativos)`;
  cropRows.innerHTML = '';
  VARIANTS.forEach(v => {
    const row = document.createElement('div');
    row.className = 'cropRow';
    const name = document.createElement('span');
    name.className = 'cname';
    name.textContent = variantName(v.id);
    name.style.color = v.color;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(CW*d); canvas.height = Math.round(CH*d);
    canvas.style.width = CW+'px'; canvas.style.height = CH+'px';
    row.appendChild(name); row.appendChild(canvas);
    cropRows.appendChild(row);
    drawCropRow(v.id, canvas);
  });
}
function closeCrop(){
  cropPanel.style.display = 'none';
  cropUV = null;
  if (cropMode) cropHint.style.display = 'block';
  writeHash();
}
function setCropMode(on){
  cropMode = on;
  cropBtn.classList.toggle('crop-on', on);
  cropHint.style.display = on ? 'block' : 'none';
  if (on){ VARIANTS.forEach(v => cropImg(v.id)); }   // warm the cache for current frame
  else if (cropUV) closeCrop();
  writeHash();
}
cropBtn.addEventListener('click', () => setCropMode(!cropMode));
$('cropClose').addEventListener('click', () => { setCropMode(false); closeCrop(); });

/* ---------- state: URL hash (shareable) > localStorage > defaults ---------- */
let hashTimer = null;
function writeHash(){
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const p = new URLSearchParams();
    if (frame != null) p.set('f', frame);
    if (varA) p.set('a', varA);
    if (varB) p.set('b', varB);
    if (dividerPos !== 0.5) p.set('d', dividerPos.toFixed(3));
    if (zoom !== 1){ p.set('z', zoom.toFixed(3)); p.set('x', Math.round(pan.x)); p.set('y', Math.round(pan.y)); }
    if (diffMode){ p.set('diff', 1); if (gainIdx !== AMPLIFY_DEFAULT_IDX) p.set('g', gainIdx); if (heat) p.set('heat', 1); }
    if (blinkMode) p.set('blink', 1);
    if (blindMode) p.set('blind', 1);
    if (solarMode) p.set('solar', 1);
    if (cropMode) p.set('crops', 1);
    if (cropUV){
      const {nw, nh} = naturalDims();
      p.set('crop', (cropUV.u/nw).toFixed(4)+','+(cropUV.v/nh).toFixed(4));
    }
    history.replaceState(null, '', '#'+p.toString());
    try {
      localStorage.setItem('gatosState', JSON.stringify({f:frame, a:varA, b:varB, d:dividerPos, g:gainIdx, h:heat}));
    } catch(e){}
  }, 150);
}
function readState(){
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('gatosState')) || {}; } catch(e){}
  const h = new URLSearchParams(location.hash.slice(1));
  const num = s => { const n = parseFloat(s); return isFinite(n) ? n : null; };
  const hf = num(h.get('f'));
  frame = FRAMES.includes(hf) ? hf : (FRAMES.includes(saved.f) ? saved.f : FRAMES[Math.floor(FRAMES.length/2)]);
  const hv = (k, fb) => VARIANTS.some(v=>v.id===h.get(k)) ? h.get(k) : (VARIANTS.some(v=>v.id===fb) ? fb : null);
  varA = hv('a', saved.a) || (VARIANTS[0] && VARIANTS[0].id);
  varB = hv('b', saved.b) || (VARIANTS[Math.min(1, VARIANTS.length-1)] || VARIANTS[0] || {}).id;
  const hd = num(h.get('d'));
  dividerPos = clamp(hd != null ? hd : (isFinite(saved.d) ? saved.d : 0.5), 0, 1);
  const hg = parseInt(h.get('g'));
  gainIdx = clamp(GAINS.includes(hg) ? hg-0 : (Number.isInteger(saved.g) ? saved.g : AMPLIFY_DEFAULT_IDX), 0, GAINS.length-1);
  heat = h.get('heat') === '1' || saved.h === true;
  const hz = num(h.get('z'));
  if (hz != null && hz >= 1){
    zoom = hz;
    pan.x = num(h.get('x')) || 0;
    pan.y = num(h.get('y')) || 0;
  }
  return h;
}

/* ---------- UI ---------- */
function variantStats(id){
  if (blindMode) return '';
  const m = variant(id).metrics;
  if (!m) return '';
  const lines = [];
  const pf = m.per_frame && m.per_frame[String(frame)];
  if (pf){
    const l = [];
    if (pf.psnr_avg != null) l.push('PSNR '+pf.psnr_avg.toFixed(2)+' dB');
    if (pf.ssim_all != null) l.push('SSIM '+pf.ssim_all.toFixed(4));
    if (l.length) lines.push(l.join(' \u00B7 ')+' @'+frame+'s');
  }
  const l2 = [];
  if (m.psnr_avg != null) l2.push('clip PSNR '+m.psnr_avg.toFixed(2));
  if (m.ssim_all != null) l2.push('SSIM '+m.ssim_all.toFixed(4));
  if (m.size_bytes) l2.push((m.size_bytes/1048576).toFixed(1)+' MB');
  if (m.kbps) l2.push(Math.round(m.kbps)+' kbps');
  if (l2.length) lines.push(l2.join(' \u00B7 '));
  return lines.join('\n');
}
function updateMeta(){
  const lbl = FRAME_LABELS[frame] || (frame + 's');
  const m = FRAME_META[frame] || {};
  const where = m.clip_s != null ? ` \u00B7 clip +${m.clip_s.toFixed(1)}s` : '';
  const origin = CLIP.start_label ? `clip starts ${CLIP.start_label} \u00B7 ` : '';
  const modes = [diffMode ? 'DIFF' : '', blinkMode ? 'BLINK' : '', blindMode ? 'CIEGO' : '', solarMode ? 'SOLAR' : ''].filter(Boolean).join('+');
  metaLine.textContent =
    `${origin}frame ${lbl} (#${frame}${where}) \u2014 izq. ${blindMode ? '?' : varA} \u00B7 der. ${blindMode ? '?' : varB}${modes ? ' \u00B7 '+modes : ''}`;
}
function preload(){
  const i = FRAMES.indexOf(frame);
  [i-1, i+1].forEach(j => {
    if (j >= 0 && j < FRAMES.length){
      new Image().src = srcFor(varA, FRAMES[j]);
      new Image().src = srcFor(varB, FRAMES[j]);
    }
  });
}
function loadImg(){
  imgA.src = srcFor(varA, frame);
  if (diffMode){
    realB.src = srcFor(varB, frame);
    imgB.src = realB.src;
  } else {
    imgB.src = srcFor(varB, frame);
  }
  labelAName.textContent = variantName(varA);
  labelBName.textContent = variantName(varB);
  statsA.textContent = variantStats(varA);
  statsB.textContent = variantStats(varB);
  labelA.style.color = variant(varA).color;
  labelB.style.color = variant(varB).color;
  refreshFrameButtons(); refreshVariantButtons(); syncVariantOverflow();
  updateMeta();
  updateBadge();
  preload();
  if (cropMode) VARIANTS.forEach(v => cropImg(v.id));
  if (cropUV && cropPanel.style.display !== 'none') openCropPanel();
  writeHash();
}
function makeButtons(containerId, items, activeId, onPick){
  const c = $(containerId);
  c.innerHTML = '';
  items.forEach(item => {
    const b = document.createElement('button');
    if (item.sub != null){
      b.className = 'vbtn' + (item.id === activeId ? ' active' : '');
      if (item.cmd) b.dataset.cmd = item.cmd;
      const main = document.createElement('span'); main.className = 'main'; main.textContent = item.main;
      const sub = document.createElement('span'); sub.className = 'sub'; sub.textContent = item.sub;
      b.append(main, sub);
    } else {
      b.textContent = item.label;
      b.className = item.id === activeId ? 'active' : '';
    }
    b.addEventListener('click', () => onPick(item.id));
    c.appendChild(b);
  });
}
const cmdTip = document.createElement('div');
cmdTip.id = 'cmdTip'; document.body.appendChild(cmdTip);
let cmdPinned = false, cmdFor = null, cmdTimer = null, cmdText = '';
function cmdKey(t){
  // a line starting with '|' is the second stage of a piped command
  return t.startsWith('|') ? '|piped' : t.split(/\s+/)[0];
}
function showTip(b){
  if (blindMode) return;
  cmdText = b.dataset.cmd;
  const pane = b.closest('.variants') ? b.closest('.variants').id : null;
  const otherId = pane === 'varA' ? varB : (pane === 'varB' ? varA : null);
  const other = otherId ? variant(otherId) : null;
  const hlOk = {'--crf':1, '--preset':1, '--film-grain':1, '--film-grain-denoise':1};
  const omap = {};
  if (other && other.cmd){
    other.cmd.split('\n').forEach(l => {
      const t = l.trim().replace(/\\$/,'').trim();
      if (t) omap[cmdKey(t)] = t;
    });
  }
  const esc = x => x.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  let body;
  if (other && other.cmd){
    body = cmdText.split('\n').map(l => {
      const t = l.trim().replace(/\\$/,'').trim();
      if (!t) return esc(l);
      const key = cmdKey(t);
      const differs = !!hlOk[key] && (!(key in omap) || omap[key] !== t);
      return differs ? '<span class="dline">' + esc(l) + '</span>' : esc(l);
    }).join('\n');
  } else {
    body = esc(cmdText);
  }
  const legend = other && other.cmd ? 'en \u00e1mbar lo que difiere de <b>' + esc(other.name) + '</b>'
                                     : 'comando';
  cmdTip.innerHTML = '<div class="tiphead"><span class="tt">' + legend + '</span>'
    + '<button data-act="copy">Copiar</button><button data-act="close">\u00d7</button></div>'
    + '<div class="cmdtext">' + body + '</div>';
  cmdTip.style.display = 'block';
  const r = b.getBoundingClientRect();
  cmdTip.style.left = Math.min(window.innerWidth - cmdTip.offsetWidth - 8, Math.max(8, r.left)) + 'px';
  const below = r.bottom + 6;
  cmdTip.style.top = (below + cmdTip.offsetHeight > window.innerHeight - 8
    ? Math.max(8, r.top - cmdTip.offsetHeight - 6) : below) + 'px';
}
function hideTip(){
  cmdPinned = false; cmdFor = null; clearTimeout(cmdTimer);
  cmdTip.style.display = 'none';
}
document.addEventListener('mouseover', e => {
  const b = e.target.closest('button.vbtn');
  if (cmdPinned) return;
  if (!b || !b.dataset.cmd){ clearTimeout(cmdTimer); cmdFor = null; cmdTip.style.display = 'none'; return; }
  if (cmdFor === b) return;
  clearTimeout(cmdTimer); cmdFor = b; cmdTip.style.display = 'none';
  cmdTimer = setTimeout(() => { showTip(b); cmdPinned = true; }, 2000);
});
document.addEventListener('click', e => {
  const act = e.target.closest('#cmdTip [data-act]');
  if (act && act.dataset.act === 'copy'){
    const done = ok => { const b = act; b.textContent = ok ? 'Copiado \u2713' : 'Fall\u00f3 la copia';
      setTimeout(() => { b.textContent = 'Copiar'; }, 1200); };
    if (navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(cmdText).then(() => done(true), () => done(false));
    } else {
      const ta = document.createElement('textarea');
      ta.value = cmdText; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(true); } catch (err) { done(false); }
      ta.remove();
    }
    return;
  }
  if (act && act.dataset.act === 'close'){ hideTip(); return; }
  if (cmdPinned && !e.target.closest('#cmdTip')) hideTip();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTip(); });
function refreshFrameButtons(){
  makeButtons('frames', FRAMES.map(f=>({id:f, label: FRAME_LABELS[f] || (f+'s')})), frame, f => { frame = f; loadImg(); });
}
function variantButtonItems(){
  return VARIANTS.map((v, vi) => {
    if (blindMode) return {id: v.id, main: String(vi+1), sub: '', cmd: null};
    const cmd = v.cmd || null;
    if (v.id === 'src') return {id: v.id, main: v.name || 'Source', sub: (v.note || '').replace(/Source \u00B7 /, ''), cmd: null};
    const m = v.id.match(/^crf(\d+)_p(\d)(?:_fg(\d+))?$/);
    if (!m) return {id: v.id, main: v.name, sub: v.note || '', cmd: cmd};
    const parts = (v.note || '').split(' \u00B7 ');
    const mbps = (parts[1] || '').replace(' Mbps', ' Mb/s');
    const s2 = (parts[2] || '');
    const main = `CRF ${m[1]}` + (m[3] ? ` \u00B7 FG ${m[3]}` : '');
    return {id: v.id, main: main, sub: `P${m[2]} \u00B7 ${mbps}${s2 ? ' \u00B7 ' + s2 : ''}`, cmd: cmd};
  });
}
function fillSelect(selId, items, activeId, onPick){
  const s = $(selId);
  s.innerHTML = '';
  items.forEach(it => {
    const o = document.createElement('option');
    o.value = it.id;
    o.textContent = it.id === 'src' ? it.main + ' \u2014 ' + it.sub : `${it.main} \u2014 ${it.sub}`;
    s.appendChild(o);
  });
  s.value = activeId;
  s.onchange = () => onPick(s.value);
}
function refreshVariantButtons(){
  const items = variantButtonItems();
  makeButtons('varA', items, varA, v => { varA = v; loadImg(); });
  makeButtons('varB', items, varB, v => { varB = v; loadImg(); });
  fillSelect('selA', items, varA, v => { varA = v; loadImg(); });
  fillSelect('selB', items, varB, v => { varB = v; loadImg(); });
}
function swapAB(){ [varA, varB] = [varB, varA]; loadImg(); }
function nudgeDivider(delta){ dividerPos = clamp(dividerPos+delta, 0, 1); applyTransform(); writeHash(); }

$('oneBtn').addEventListener('click', oneToOne);
$('resetBtn').addEventListener('click', fitView);
$('swapBtn').addEventListener('click', swapAB);

window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){
    const i = FRAMES.indexOf(frame);
    const ni = e.key === 'ArrowRight' ? i+1 : i-1;
    if (ni >= 0 && ni < FRAMES.length){ frame = FRAMES[ni]; loadImg(); }
  } else if (e.key === ' ' && !e.repeat){
    e.preventDefault();   // no hacer scroll de página
    const ids = VARIANTS.map(v => v.id);
    varB = ids[(ids.indexOf(varB)+1) % ids.length];
    loadImg();
  } else if (!e.repeat && (e.key === 'n' || e.key === 'N')){ setSmooth(!smoothScale);
  } else if (/^[1-9]$/.test(e.key)){
    const idx = +e.key-1;
    if (idx >= VARIANTS.length) return;
    if (e.shiftKey) varA = VARIANTS[idx].id; else varB = VARIANTS[idx].id;
    loadImg();
  } else if (!e.repeat && (e.key === 'd' || e.key === 'D')){ setDiff(!diffMode); }
  else if (!e.repeat && (e.key === 'b' || e.key === 'B')){ setBlink(!blinkMode); }
  else if (!e.repeat && (e.key === 'g' || e.key === 'G')){ setBlind(!blindMode); }
  else if (!e.repeat && (e.key === 'l' || e.key === 'L')){ setSolar(!solarMode); }
  else if (!e.repeat && (e.key === 'c' || e.key === 'C')){ setCropMode(!cropMode); }
  else if (!e.repeat && (e.key === 's' || e.key === 'S')){ swapAB(); }
  else if (!e.repeat && (e.key === 'o' || e.key === 'O')){ oneToOne(); }
  else if (!e.repeat && (e.key === 'f' || e.key === 'F')){ fitView(); }
  else if (!e.repeat && (e.key === 'h' || e.key === 'H')){ setHeat(!heat); }
  else if (e.key === '+' || e.key === '='){ setGain(gainIdx+1); }
  else if (e.key === '-' || e.key === '_'){ setGain(gainIdx-1); }
  else if (e.key === ','){ nudgeDivider(e.shiftKey ? -0.05 : -0.01); }
  else if (e.key === '.'){ nudgeDivider(e.shiftKey ? 0.05 : 0.01); }
  else if (e.key === 'Escape'){ if (cropMode || cropUV){ setCropMode(false); closeCrop(); } }
});

/* ---------- init ---------- */
function applyManifest(m){
  FRAMES = m.frames;
  VARIANTS = m.variants;
  FRAME_LABELS = m.frame_labels || {};
  FRAME_META = m.frame_meta || {};
  CLIP = m.clip || {};
  if (m.title){ document.title = m.title; pageTitle.textContent = m.title; }
  const h = readState();
  if (h.get('z') != null) mobileZoomPending = false;
  computeFit();
  loadImg();
  applyTransform();
  if (!h.get('z') && matchMedia('(max-width:820px), (pointer:coarse)').matches) oneToOne();
  if (h.get('diff') === '1') setDiff(true);
  if (h.get('blink') === '1') setBlink(true);
  if (h.get('blind') === '1') setBlind(true);
  if (h.get('solar') === '1') setSolar(true);
  if (h.get('crops') === '1') setCropMode(true);
  if (h.get('crop')){
    const [cu, cv] = h.get('crop').split(',').map(Number);
    if (isFinite(cu) && isFinite(cv)){
      const {nw, nh} = naturalDims();
      cropUV = {u: Math.round(cu*nw), v: Math.round(cv*nh)};
      openCropPanel();
    }
  }
}
(async () => {
  computeFit();
  applyTransform();
  try {
    const m = await SOURCE.init();
    applyManifest(m);
  } catch (err) {
    console.error('comparison data unavailable', err);
    metaLine.textContent = 'no se encontraron datos de comparaci\u00f3n (sin paquete embebido, sin manifest.json)';
  }
})();
