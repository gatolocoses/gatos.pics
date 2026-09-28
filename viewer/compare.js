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
let originalTitle = 'Comparación';
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
      const ext = variant(id).image_exts?.[f] || variant(id).ext || 'webp';
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
// Opening another saved fragment in the same tab restores the complete view.
// Internal state writes use replaceState, which does not fire hashchange.
window.addEventListener('hashchange', () => location.reload());

let frame = null, varA = null, varB = null;
let mobileZoomPending = matchMedia('(pointer:coarse)').matches || innerWidth <= 820;
let diffMode = false, blinkMode = false, heat = false, gainIdx = AMPLIFY_DEFAULT_IDX;
let cropMode = false, cropUV = null;
let pendingCropFraction = null;
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
function zmax(){ return Math.max(1, 8/(fitScale*dpr())); }
function zmin(){ return Math.min(1, 1/(fitScale*dpr())); }
function clampPan(){
  const w = comp.clientWidth, h = comp.clientHeight;
  pan.x = clamp(pan.x, Math.min(0, w-ox-rw*zoom), Math.max(0, -ox));
  pan.y = clamp(pan.y, Math.min(0, h-oy-rh*zoom), Math.max(0, -oy));
}
function updateBadge(){
  if (!imgA.complete || !imgB.complete){ zoomBadge.textContent = 'cargando\u2026'; return; }
  zoomBadge.textContent = zoom === 1 ? 'ajustar' : Math.round(fitScale*zoom*dpr()*100)+'%';
}
/* la marca del encabezado es un espejo del visor: el circulito cruza las
   palabras siguiendo al divisor real, como el divisor cruza la imagen */
function syncBrandSlider(){
  const dot = document.querySelector('.brand-dot');
  const brand = document.getElementById('brand');
  if (dot && brand){
    const t = blinkMode ? .5 : dividerPos;
    dot.style.left = (t * (brand.clientWidth - 16)) + 'px';
  }
}
function applyTransform(){
  const t = `translate(${pan.x}px,${pan.y}px) scale(${zoom})`;
  imgA.style.transform = t;
  imgB.style.transform = t;
  diffCanvas.style.transform = t;
  paneB.style.clipPath = blinkMode ? 'inset(0 0 0 0)' : `inset(0 0 0 ${dividerPos*100}%)`;
  divider.style.display = blinkMode ? 'none' : '';
  divider.style.left = `${dividerPos*100}%`;
  syncBrandSlider();
  updateBadge();
}
function setZoomAt(cx, cy, Z2){
  const r = comp.getBoundingClientRect();
  const x = cx-r.left, y = cy-r.top;
  const u = (x-ox-pan.x)/zoom, v = (y-oy-pan.y)/zoom;
  zoom = clamp(Z2, zmin(), zmax());
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
    const r = comp.getBoundingClientRect();
    pinch = {d0: pdist(p1,p2) || 1, z0: zoom,
      u: ((p1.x+p2.x)/2-r.left-ox-pan.x)/zoom,
      v: ((p1.y+p2.y)/2-r.top-oy-pan.y)/zoom};
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
    const r = comp.getBoundingClientRect();
    zoom = clamp(pinch.z0 * pdist(p1,p2)/pinch.d0, zmin(), zmax());
    pan.x = mx-r.left-ox-pinch.u*zoom;
    pan.y = my-r.top-oy-pinch.v*zoom;
    clampPan(); applyTransform(); writeHash();
  } else if (drag){
    const w = comp.clientWidth, h = comp.clientHeight;
    if (drag.mode === 'divider'){
      dividerPos = clamp(drag.start + (e.clientX-drag.sx)/w, 0, 1);
      applyTransform(); writeHash();
    } else {
      pan.x = drag.px + (e.clientX-drag.sx);
      pan.y = drag.py + (e.clientY-drag.sy);
      clampPan(); applyTransform(); writeHash();
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
new ResizeObserver(() => { computeFit(); clampPan(); applyTransform(); }).observe(comp);

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
  if (!d){
    diffCanvas.style.display = 'none';
    imgB.style.display = '';
    const mismatch = imgA.naturalWidth && realB.naturalWidth &&
      (imgA.naturalWidth !== realB.naturalWidth || imgA.naturalHeight !== realB.naturalHeight);
    diffNote.textContent = mismatch ? 'Diff no disponible: las imágenes tienen dimensiones distintas.' : 'Diff: cargando…';
    return;
  }
  diffCanvas.width = d.w; diffCanvas.height = d.h;
  diffCanvas.style.display = 'block'; imgB.style.display = 'none';
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
  diffBtn.setAttribute('aria-pressed', String(on));
  $('diffTools').hidden = !on;
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
  applyTransform(); updateMeta(); writeHash();
}
function setGain(i){
  gainIdx = clamp(i, 0, GAINS.length-1);
  $('diffGain').value = String(gainIdx);
  if (diffMode) renderDiff();
  writeHash();
}
function setHeat(on){
  heat = on;
  $('heatBtn').setAttribute('aria-pressed', String(on));
  if (diffMode) renderDiff();
  writeHash();
}
imgA.addEventListener('load', () => {
  computeFit();
  if (mobileZoomPending){ mobileZoomPending = false; oneToOne(); }
  zoom = clamp(zoom, zmin(), zmax()); clampPan();
  if (pendingCropFraction){
    cropUV = {u:Math.round(pendingCropFraction[0]*imgA.naturalWidth),v:Math.round(pendingCropFraction[1]*imgA.naturalHeight)};
    pendingCropFraction = null; openCropPanel();
  }
  applyTransform(); renderDiff(); updateBadge();
});
imgA.addEventListener('error', () => { zoomBadge.textContent = 'la imagen no carg\u00f3'; });

/* ---------- escala: suave o píxeles nítidos (inspección de píxel) ---------- */
let smoothScale = true;
try { smoothScale = localStorage.getItem('gatosSmooth') !== '0'; } catch(e){}
function setSmooth(on){
  smoothScale = on;
  for (const el of [imgA, imgB, diffCanvas]) el.style.imageRendering = on ? 'auto' : 'pixelated';
  pixBtn.classList.toggle('active', !on);
  pixBtn.setAttribute('aria-pressed', String(!on));
  try { localStorage.setItem('gatosSmooth', on ? '1' : '0'); } catch(e){}
  if (FRAMES.length) writeHash();
}
pixBtn.addEventListener('click', () => setSmooth(!smoothScale));
setSmooth(smoothScale);
imgB.addEventListener('load', updateBadge);
realB.addEventListener('load', renderDiff);
diffBtn.addEventListener('click', () => setDiff(!diffMode));
$('diffGain').addEventListener('change', () => setGain(Number($('diffGain').value)));
$('heatBtn').addEventListener('click', () => setHeat(!heat));

/* ---------- blink mode ---------- */
let blinkTimer = null;
function setBlink(on, quiet){
  blinkMode = on;
  if (on) setDiff(false);
  blinkBtn.classList.toggle('blink-on', on);
  blinkBtn.setAttribute('aria-pressed', String(on));
  clearInterval(blinkTimer);
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
  blindBtn.setAttribute('aria-pressed', String(on));
  pageTitle.textContent = on ? 'Comparación a ciegas' : originalTitle;
  document.title = pageTitle.textContent;
  if (on) hideTip();
  refreshVariantButtons();
  loadImg();
  updateMeta();
  writeHash();
}
blindBtn.addEventListener('click', () => setBlind(!blindMode));

/* ---------- curva solar: revela banding ---------- */
let solarMode = false;
// SVG transfer tables use normalized channel values, not byte values.
document.querySelectorAll('#solarCurve feFuncR, #solarCurve feFuncG, #solarCurve feFuncB').forEach(el => {
  const values = el.getAttribute('tableValues').trim().split(/\s+/).map(Number);
  el.setAttribute('tableValues', values.map(v => v/255).join(' '));
});
function setSolar(on){
  solarMode = on;
  solarBtn.classList.toggle('solar-on', on);
  solarBtn.setAttribute('aria-pressed', String(on));
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
  const sw = Math.min(canvas.width, im.naturalWidth), sh = Math.min(canvas.height, im.naturalHeight);
  const sx = clamp(Math.round(cropUV.u - sw/2), 0, im.naturalWidth - sw);
  const sy = clamp(Math.round(cropUV.v - sh/2), 0, im.naturalHeight - sh);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(im, sx, sy, sw, sh, Math.floor((canvas.width-sw)/2), Math.floor((canvas.height-sh)/2), sw, sh);
}
function openCropPanel(){
  cropPanel.style.display = 'block';
  cropHint.style.display = 'none';
  const d = dpr();
  const CW = Math.max(64, Math.min(480, comp.clientWidth - (innerWidth <= 820 ? 64 : 220))), CH = Math.round(CW*9/16);
  cropTitle.textContent = `Recortes 1:1 @ ${cropUV.u},${cropUV.v} (px nativos)`;
  cropRows.innerHTML = '';
  VARIANTS.forEach(v => {
    const row = document.createElement('div');
    row.className = 'cropRow';
    const name = document.createElement('span');
    name.className = 'cname';
    name.textContent = variantName(v.id);
    name.style.color = blindMode ? '#e8e8f0' : v.color;
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
  cropBtn.setAttribute('aria-pressed', String(on));
  cropHint.style.display = on ? 'block' : 'none';
  if (on){ VARIANTS.forEach(v => cropImg(v.id)); }   // warm the cache for current frame
  else if (cropUV) closeCrop();
  writeHash();
}
cropBtn.addEventListener('click', () => setCropMode(!cropMode));
$('cropClose').addEventListener('click', () => { setCropMode(false); closeCrop(); });

/* ---------- state: URL hash (shareable) > localStorage > defaults ---------- */
let hashTimer = null;
function stateParams(){
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
    p.set('smooth', smoothScale ? '1' : '0');
    if (cropMode) p.set('crops', 1);
    if (cropUV){
      const {nw, nh} = naturalDims();
      p.set('crop', (cropUV.u/nw).toFixed(4)+','+(cropUV.v/nh).toFixed(4));
    }
    return p;
}
const stateStorageKey = 'gatosState:' + location.pathname;
function writeHash(){
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    try { history.replaceState(null, '', '#'+stateParams()); } catch(e){}
    try {
      localStorage.setItem(stateStorageKey, JSON.stringify({f:frame, a:varA, b:varB, d:dividerPos, g:gainIdx, h:heat}));
    } catch(e){}
  }, 150);
}
function readState(){
  let saved = {};
  const h = new URLSearchParams(location.hash.slice(1));
  if (!h.size) try { saved = JSON.parse(localStorage.getItem(stateStorageKey)) || {}; } catch(e){}
  const num = s => { const n = parseFloat(s); return isFinite(n) ? n : null; };
  const findFrame = value => value == null ? undefined : FRAMES.find(f => String(f) === String(value));
  frame = findFrame(h.get('f')) ?? findFrame(saved.f) ?? FRAMES[0];
  const hv = (k, fb) => VARIANTS.some(v=>v.id===h.get(k)) ? h.get(k) : (VARIANTS.some(v=>v.id===fb) ? fb : null);
  varA = hv('a', saved.a) || (VARIANTS[0] && VARIANTS[0].id);
  varB = hv('b', saved.b) || (VARIANTS[Math.min(1, VARIANTS.length-1)] || VARIANTS[0] || {}).id;
  const hd = num(h.get('d'));
  dividerPos = clamp(hd != null ? hd : (isFinite(saved.d) ? saved.d : 0.5), 0, 1);
  const hg = parseInt(h.get('g'));
  gainIdx = clamp(Number.isInteger(hg) ? hg : (Number.isInteger(saved.g) ? saved.g : AMPLIFY_DEFAULT_IDX), 0, GAINS.length-1);
  heat = h.get('heat') === '1' || saved.h === true;
  const hz = num(h.get('z'));
  if (hz != null && hz > 0){
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
    if (pf.ssimulacra2 != null) l.push('S2 '+pf.ssimulacra2.toFixed(1));
    if (pf.psnr_avg != null) l.push('PSNR '+pf.psnr_avg.toFixed(2)+' dB');
    if (pf.ssim_all != null) l.push('SSIM '+pf.ssim_all.toFixed(4));
    if (l.length) lines.push(l.join(' \u00B7 ')+' · '+(FRAME_LABELS[frame] || 'frame '+frame));
  }
  const l2 = [];
  if (m.custom_note) l2.push(m.custom_note);
  if (m.ssimulacra2 != null) l2.push('S2 media '+m.ssimulacra2.toFixed(1));
  if (m.psnr_avg != null) l2.push('clip PSNR '+m.psnr_avg.toFixed(2));
  if (m.ssim_all != null) l2.push('SSIM '+m.ssim_all.toFixed(4));
  if (m.size_bytes) l2.push((m.size_bytes/1048576).toFixed(1)+' MB');
  if (m.kbps) l2.push(Math.round(m.kbps)+' kbps');
  if (l2.length) lines.push(l2.join(' \u00B7 '));
  return lines.join('\n');
}
function updateMeta(){
  const lbl = FRAME_LABELS[frame] || String(frame);
  const m = FRAME_META[frame] || {};
  const where = m.clip_s != null ? ` \u00B7 clip +${m.clip_s.toFixed(1)}s` : '';
  const origin = CLIP.start_label ? `Inicio del clip ${CLIP.start_label} \u00B7 ` : '';
  const modes = [diffMode ? 'DIFF' : '', blinkMode ? 'BLINK' : '', blindMode ? 'CIEGO' : '', solarMode ? 'SOLAR' : ''].filter(Boolean).join('+');
  metaLine.textContent =
    `${origin}Frame ${lbl} (#${frame}${where}) · izq. ${blindMode ? '?' : varA} \u00B7 der. ${blindMode ? '?' : varB}${modes ? ' \u00B7 '+modes : ''}`;
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
  labelA.style.color = blindMode ? '#e8e8f0' : variant(varA).color;
  labelB.style.color = blindMode ? '#e8e8f0' : variant(varB).color;

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
    b.setAttribute('aria-pressed', String(item.id === activeId));
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
  makeButtons('frames', FRAMES.map(f=>({id:f, label: FRAME_LABELS[f] || String(f)})), frame, f => { frame = f; loadImg(); });
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
    o.textContent = [it.main, it.sub].filter(Boolean).join(' · ');
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
  const t = e.target;
  if (e.ctrlKey || e.metaKey || e.altKey || t?.isContentEditable) return;
  if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT')){
    if (e.key === 'Escape'){ t.blur(); closeShareIfOpen(); }
    return;   // escribiendo/seleccionando: los atajos esperan
  }
  if (sharePanel.style.display === 'flex'){
    if (e.key === 'Escape') closeShareIfOpen();
    return;
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){
    e.preventDefault();
    const i = FRAMES.indexOf(frame);
    const ni = e.key === 'ArrowRight' ? i+1 : i-1;
    if (ni >= 0 && ni < FRAMES.length){ frame = FRAMES[ni]; loadImg(); }
  } else if (e.key === ' ' && !e.repeat && t?.tagName !== 'BUTTON'){
    e.preventDefault();   // no hacer scroll de página
    const ids = VARIANTS.map(v => v.id);
    varB = ids[(ids.indexOf(varB)+1) % ids.length];
    loadImg();
  } else if (!e.repeat && (e.key === 'n' || e.key === 'N')){ setSmooth(!smoothScale);
  } else if (/^[1-9]$/.test(e.key) || /^Digit[1-9]$/.test(e.code)){
    const idx = Number(/^Digit/.test(e.code) ? e.code.slice(-1) : e.key)-1;
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

/* ---------- compartir: imagen PNG sin pérdida de la vista actual ---------- */
const sharePanel = $('sharePanel'), shareRows = $('shareRows');
let shareBlobUrl = null, shareName = 'gatos.pics.png';
function escq(x){ return String(x).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function drawBrand(ctx, x, y){
  // espejo en miniatura: verde/amarillo fijos, el circulito cruza las palabras
  const W = 72, H = 16, cy = y + H/2;
  ctx.save();
  ctx.globalAlpha = .9;
  ctx.fillStyle = '#7bd389';
  ctx.beginPath(); ctx.roundRect(x, y, 38, H, [3,0,0,3]); ctx.fill();
  ctx.fillStyle = '#ffb454';
  ctx.beginPath(); ctx.roundRect(x+38, y, 34, H, [0,3,3,0]); ctx.fill();
  const cx = x + 8 + (W - 16) * (blinkMode ? .5 : dividerPos);
  ctx.fillStyle = '#fff'; ctx.shadowColor = '#000c'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
  ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI*2); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx-1.8, cy-3.2); ctx.lineTo(cx-4.4, cy); ctx.lineTo(cx-1.8, cy+3.2);
  ctx.moveTo(cx+1.8, cy-3.2); ctx.lineTo(cx+4.4, cy); ctx.lineTo(cx+1.8, cy+3.2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '700 9px system-ui, sans-serif'; ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText('gato', x+19, cy);
  ctx.fillText('pics', x+55, cy);
  ctx.restore();
}

function renderViewCanvas(){
  if (!imgA.complete || !imgA.naturalWidth || !imgB.complete || !imgB.naturalWidth)
    throw new Error('Espera a que terminen de cargar las dos imágenes.');
  if (diffMode && !ensureDiffBase()) throw new Error('No se puede compartir el diff: revisa las dimensiones de las imágenes.');
  const comp2 = $('comp');
  const w = comp2.clientWidth, h = comp2.clientHeight, d = dpr();
  // region visible del contenido, sin barras negras: el lienzo es exactamente
  // la interseccion del cuadro de contenido (con zoom/pan) con la ventana
  const cx = ox + pan.x, cy = oy + pan.y, cw = rw * zoom, chh = rh * zoom;
  const ix = Math.max(0, cx), iy = Math.max(0, cy);
  const ir = Math.min(w, cx + cw), ib = Math.min(h, cy + chh);
  const vw = Math.max(1, ir - ix), vh = Math.max(1, ib - iy);
  const c = document.createElement('canvas');
  c.width = Math.round(vw * d); c.height = Math.round(vh * d);
  const x = c.getContext('2d');
  x.scale(d, d);
  x.translate(-ix, -iy);
  x.fillStyle = '#000';
  x.fillRect(ix, iy, vw, vh);
  x.imageSmoothingEnabled = smoothScale;
  const drawImg = (img) => {
    x.save();
    if (solarMode && img !== diffCanvas) x.filter = 'url(#solarCurve)';
    // CSS left/top are outside the transform. Scaling them shifts the export.
    x.drawImage(img, ox + pan.x, oy + pan.y, rw * zoom, rh * zoom);
    x.restore();
  };
  drawImg(imgA);
  const divX = dividerPos * w;
  if (!blinkMode){
    x.save();
    x.beginPath();
    const split = clamp(divX, ix, ir);
    x.rect(split, iy, ir - split, vh);
    x.clip();
    drawImg(diffMode ? diffCanvas : imgB);
    x.restore();
    // linea del divisor, solo dentro del contenido
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.fillRect(divX - 1, iy, 2, vh);
  } else if (imgB.style.opacity !== '0') {
    drawImg(imgB);
  }
  x.filter = 'none';
  // etiquetas DENTRO del area de contenido, pegadas a sus esquinas
  const ellipsis = (text, max) => {
    let s = text;
    if (x.measureText(s).width <= max) return s;
    while (s.length && x.measureText(s+'…').width > max) s = s.slice(0, -1);
    return s+'…';
  };
  const pill = (right, id) => {
    const name = variantName(id), stats = variantStats(id).split('\n').filter(Boolean);
    const maxWidth = Math.max(20, (vw-36)/2);
    x.font = '600 13px system-ui, sans-serif';
    const wName = x.measureText(name).width;
    x.font = '400 10px system-ui, sans-serif';
    const wStats = Math.max(0, ...stats.map(s => x.measureText(s).width));
    x.font = '600 13px system-ui, sans-serif';
    const pw = Math.min(maxWidth, Math.max(wName, wStats) + 20);
    const px2 = right ? ir-pw-12 : ix+12, py2 = iy+10;
    x.fillStyle = 'rgba(0,0,0,.75)';
    x.beginPath();
    x.roundRect(px2, py2, pw, 24+stats.length*14, 6);
    x.fill();
    x.fillStyle = blindMode ? '#e8e8f0' : variant(id).color || '#e8e8f0';
    x.fillText(ellipsis(name, pw-20), px2 + 10, py2 + 17);
    if (stats.length){
      x.font = '400 10px system-ui, sans-serif';
      x.fillStyle = '#c8c8d4';
      stats.forEach((s, i) => x.fillText(ellipsis(s, pw-20), px2+10, py2+31+i*14));
    }
  };
  if (vw >= 160 && vh >= 80){ pill(false, varA); pill(true, varB); }
  if (vw >= 108 && vh >= 60) drawBrand(x, ix+(vw-72)/2, ib-24);
  const modes = [diffMode ? `Diff ×${GAINS[gainIdx]}${heat ? ' · calor' : ''}` : '', solarMode ? 'Solar' : '', blindMode ? 'Ciego' : ''].filter(Boolean).join(' · ');
  if (modes && vw >= 160 && vh >= 100){
    x.font = '600 11px system-ui, sans-serif';
    const mw = Math.min(vw-16, x.measureText(modes).width+16);
    x.fillStyle = '#101014e6'; x.fillRect(ix+8, ib-54, mw, 18);
    x.fillStyle = '#ffb454'; x.fillText(ellipsis(modes, mw-16), ix+16, ib-41);
  }
  return c;
}

async function openShare(){
  let c;
  try { c = renderViewCanvas(); } catch(e){ alert(e.message); return; }
  const url = location.href.split('#')[0]+'#'+stateParams();
  const rows = location.protocol === 'file:' || location.href === 'about:srcdoc' ? [] : [['Enlace a esta vista', url]];
  $('shareCodes').replaceChildren(); $('shareCodes').style.display = 'none';
  $('shareOwner').hidden = true;
  shareRows.innerHTML = '';
  for (const [label, text] of rows){
    const l = document.createElement('div');
    l.style.cssText = 'font-size:11px; color:var(--dim); margin:6px 0 3px;';
    l.textContent = label;
    const box = document.createElement('textarea');
    box.readOnly = true;
    box.value = text;
    box.style.cssText = 'width:100%; height:36px; background:#23232e; color:#e8e8f0; border:1px solid #333; border-radius:6px; padding:5px 8px; font:11px ui-monospace,Menlo,Consolas,monospace; resize:none;';
    box.onclick = async () => {
      box.select();
      let ok = false;
      if (navigator.clipboard && window.isSecureContext){
        try { await navigator.clipboard.writeText(text); ok = true; } catch(e){}
      }
      if (!ok){ try { ok = document.execCommand('copy'); } catch(e){} }
      const hint = $('shareHint');
      hint.textContent = ok ? 'copiado \u2713' : 'seleccionado: Ctrl+C';
      box.style.borderColor = ok ? '#7bd389' : '#ffb454';
      setTimeout(() => { hint.textContent = ''; box.style.borderColor = '#333'; }, 1500);
    };
    shareRows.appendChild(l);
    shareRows.appendChild(box);
  }
  sharePanel.style.display = 'flex';
  // generar la imagen de la vista actual
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  if (!blob){ $('shareHint').textContent = 'No se pudo generar el PNG.'; return; }
  if (shareBlobUrl) URL.revokeObjectURL(shareBlobUrl);
  shareBlobUrl = URL.createObjectURL(blob);
  const prev = $('sharePreview');
  prev.src = shareBlobUrl;
  prev.style.display = 'block';
  const dl = $('shareDl');
  dl.style.display = 'inline-block';
  const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'x';
  shareName = `gatos-${slug(variantName(varA))}-vs-${slug(variantName(varB))}-${frame}.png`;
  dl.onclick = () => {
    const a = document.createElement('a');
    a.href = shareBlobUrl;
    a.download = shareName;
    a.click();
  };
  // subir la imagen exacta y armar los formatos para compartir
  // una sola imagen por pagina: el link es siempre el mismo y no se rompe
  const m = location.pathname.match(/^\/p\/([A-Za-z0-9_-]{10,64})/);
  const up = $('shareUp');
  if (!m){ up.style.display = 'none'; return; }
  up.style.display = 'inline-block';
  $('shareOwner').hidden = false;
  try { $('shareKey').value = localStorage.getItem('gatosOwner:'+m[1]) || ''; } catch(e){}
  up.onclick = async () => {
    const key = $('shareKey').value.trim();
    if (!key){ $('shareHint').textContent = 'Ingresa la llave que recibiste al publicar.'; $('shareKey').focus(); return; }
    up.disabled = true; up.textContent = 'Subiendo…';
    try {
      const resp = await fetch('/api/shot/' + m[1], { method: 'POST', headers: { 'content-type': 'image/png', 'x-delete-key': key }, body: blob });
      let j = null;
      try { j = await resp.json(); } catch(e){}
      if (!resp.ok) throw new Error((j && j.error) || ('HTTP ' + resp.status));
      const page = url;
      const title = document.title || 'Comparación';
      const codes = [
        ['BBCode (foros, la vista exacta clicable)', '[url=' + page + '][img]' + j.url + '[/img][/url]'],
        ['Markdown', '[![' + title.replace(/[\[\]\\]/g, '\\$&') + '](' + j.url + ')](' + page + ')'],
        ['HTML', '<a href="' + escq(page) + '"><img src="' + escq(j.url) + '" alt="' + escq(title) + '" loading="lazy"></a>'],
        ['Imagen directa', j.url],
      ];
      const host2 = $('shareCodes');
      host2.innerHTML = '';
      for (const [label, text] of codes){
        const l = document.createElement('div');
        l.style.cssText = 'font-size:11px; color:var(--dim); margin:10px 0 3px;';
        l.textContent = label;
        const box = document.createElement('textarea');
        box.readOnly = true;
        box.value = text;
        box.style.cssText = 'width:100%; height:40px; background:#23232e; color:#e8e8f0; border:1px solid #333; border-radius:6px; padding:5px 8px; font:11px ui-monospace,Menlo,Consolas,monospace; resize:none;';
        box.onclick = async () => {
          box.select();
          let ok2 = false;
          if (navigator.clipboard && window.isSecureContext){ try { await navigator.clipboard.writeText(text); ok2 = true; } catch(e){} }
          if (!ok2){ try { ok2 = document.execCommand('copy'); } catch(e){} }
          $('shareHint').textContent = ok2 ? 'copiado \u2713' : 'seleccionado: Ctrl+C';
          box.style.borderColor = ok2 ? '#7bd389' : '#ffb454';
          setTimeout(() => { $('shareHint').textContent = ''; box.style.borderColor = '#333'; }, 1500);
        };
        host2.appendChild(l);
        host2.appendChild(box);
      }
      host2.style.display = 'block';
    } catch (e) {
      alert('No se pudo subir la imagen: ' + e.message);
    } finally {
      up.disabled = false; up.textContent = 'Subir y obtener BBCode';
    }
  };
}
$('shareBtn').addEventListener('click', openShare);
$('shareClose').addEventListener('click', closeShareIfOpen);
function closeShareIfOpen(){ if (sharePanel.style.display === 'flex'){ sharePanel.style.display = 'none'; $('shareBtn').focus(); } }
for (const ev of ['pointerdown','mousedown','touchstart','wheel'])
  sharePanel.addEventListener(ev, e => e.stopPropagation());

/* ---------- init ---------- */
function applyManifest(m){
  FRAMES = m.frames;
  VARIANTS = m.variants;
  FRAME_LABELS = m.frame_labels || {};
  FRAME_META = m.frame_meta || {};
  CLIP = m.clip || {};
  originalTitle = m.title || 'Comparación';
  document.title = originalTitle; pageTitle.textContent = originalTitle;
  const h = readState();
  $('diffGain').value = String(gainIdx);
  $('heatBtn').setAttribute('aria-pressed', String(heat));
  if (h.get('z') != null) mobileZoomPending = false;
  computeFit();
  loadImg();
  applyTransform();
  if (!h.get('z') && matchMedia('(max-width:820px), (pointer:coarse)').matches) oneToOne();
  if (h.get('diff') === '1') setDiff(true);
  if (h.get('blink') === '1') setBlink(true);
  if (h.get('blind') === '1') setBlind(true);
  if (h.get('solar') === '1') setSolar(true);
  if (h.has('smooth')) setSmooth(h.get('smooth') !== '0');
  if (h.get('crops') === '1') setCropMode(true);
  if (h.get('crop')){
    const [cu, cv] = h.get('crop').split(',').map(Number);
    if (isFinite(cu) && isFinite(cv)){
      pendingCropFraction = [clamp(cu,0,1),clamp(cv,0,1)];
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
