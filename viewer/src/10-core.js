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
      if (!r.ok) throw new Error('manifest.json HTTP '+r.status);
      let m;
      try { m = await r.json(); }
      catch(e){ throw Object.assign(new Error('manifest inv\u00e1lido: JSON truncado o malformado'), {manifestInvalid:true}); }
      VERSION = String(m?.version || '');
      return m;
    },
    srcFor(id, f){
      const ext = variant(id).image_exts?.[f] || variant(id).ext || 'webp';
      return `img/${id}_${f}.${ext}${VERSION ? '?v='+VERSION : ''}`;
    }
  };
}
function makeEmbeddedSource(pkg){
  const urls = new Map();   // "<id>_<frame>" -> Promise<objectURL>
  function toObjectURL(dataurl){
    const parts = dataurl.split(',');
    const mime = (parts[0].match(/^data:([^;]+)/) || [,'image/png'])[1];
    const bin = atob(parts[1] || '');
    const buf = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) buf[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([buf], {type:mime}));
  }
  // gatolocoses/gatos.pics#7: fetch(dataURL).blob() decodifica base64 en
  // código nativo y asíncrono (el bucle atob+byte a byte congelaba cada
  // interacción) y soltar la dataURL tras convertir evita que un paquete viva
  // dos veces en RAM. En about:srcdoc (vista previa del creador hospedado) la
  // CSP heredada bloquea connect-src data: y el intento ensuciaría consola:
  // ahí y ante cualquier fallo de fetch se decodifica síncrono como antes.
  async function convert(d, key){
    if (location.href !== 'about:srcdoc'){
      try {
        const u = URL.createObjectURL(await (await fetch(d)).blob());
        pkg.images[key] = null;
        return u;
      } catch(e){ /* sin fetch de data:: decodificador de respaldo síncrono */ }
    }
    try { const u = toObjectURL(d); pkg.images[key] = null; return u; } catch(e){ return ''; }
  }
  return {
    async init(){ return pkg.manifest; },
    srcFor(id, f){
      const key = id+'_'+f;
      if (!urls.has(key)){
        const d = pkg.images && pkg.images[key];
        urls.set(key, d ? convert(d, key) : Promise.resolve(''));
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
// Carrera de generaciones: al cambiar de par, .src ya apunta a lo NUEVO
// mientras los pixeles siguen siendo los VIEJOS (complete=true), y el primer
// load que llega difunde A_nuevo−B_viejo y lo cachea bajo la clave nueva.
// La autoridad es la URL que cada lado TERMINO de cargar (la registra su
// handler de load); el diff solo se calcula cuando ambos lados coinciden
// con la URL actual del par.
let loadedUrlA = null, loadedUrlB = null;   // URLs que cada lado termino de cargar (A: imgA, B: realB)
let loadedUrlPaneB = null;                 // imgB carga sola fuera de diff: asentamiento propio (ops#24)
// Fallo de carga del par actual (ops#2): el panel afectado se vacia con
// estado de error visible y las etiquetas revierten al par asentado.
let loadFailA = false, loadFailB = false;
let shownA = null, shownB = null;   // ids del par cuyos pixeles hay en pantalla
const cropImgs = new Map();         // variant id -> Image for current frame

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function variant(id){ return VARIANTS.find(v=>v.id===id) || {id, name:id, color:'#ccc'}; }
function variantName(id){
  const v = variant(id);
  if (blindMode) return 'Variante '+(blindOrder.findIndex(x => x.id === id)+1);
  return v.name;
}
function orderedVariants(){ return blindMode ? blindOrder : VARIANTS; }
// la fuente embebida convierte dataURLs de forma asíncrona (#7): se normaliza
// a promesa para que ambas fuentes se consuman igual. Memoizada por clave:
// la misma petición devuelve siempre el MISMO promesa (los consumidores
// comparan identidad para descartar carreras) y la fuente http, que no
// cachea, no genera promesas nuevos en cada llamada.
const srcCache = new Map();
function srcFor(id, f){
  const key = id+'_'+f;
  if (!srcCache.has(key)) srcCache.set(key, Promise.resolve(SOURCE.srcFor(id, f)));
  return srcCache.get(key);
}
// gana la última petición de cada lado: la resolución tardía de una petición
// vieja no puede sobreescribir el par que el usuario ya pidió
const sideReq = {A:0, B:0};
function setSideSrc(side, id){
  const gen = ++sideReq[side];
  srcFor(id, frame).then(url => {
    if (gen !== sideReq[side]) return;
    if (side === 'A') imgA.src = url;
    else if (diffMode){ realB.src = url; imgB.src = url; }
    else imgB.src = url;
  });
}
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
  // ramificar por cobertura: si el contenido cubre el eje, sus bordes deben
  // poder llegar a 0 y al borde contrario (sin franjas muertas); si no cubre,
  // no hay pan posible y queda centrado por ox/oy (contenido letterbox)
  if (rw*zoom >= w) pan.x = clamp(pan.x, w-ox-rw*zoom, -ox); else pan.x = 0;
  if (rh*zoom >= h) pan.y = clamp(pan.y, h-oy-rh*zoom, -oy); else pan.y = 0;
}
function updateBadge(){
  if (loadFailA){ zoomBadge.textContent = 'la imagen no carg\u00f3'; return; }
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
    dot.style.left = (8 + t * (brand.clientWidth - 16)) + 'px';
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
