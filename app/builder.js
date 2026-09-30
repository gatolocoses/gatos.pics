'use strict';
/* ============================================================
   gatos.pics creador · JS puro, sin dependencias.
   Construye el mismo paquete que consume el motor del visor:
   {format, manifest:{title, version, frames, frame_labels, variants},
    images:{"<id>_<frame>": dataURL}}
   assets.js (generado) define SHELL_HTML, ENGINE_SRC y UPLOAD_SRC.
   ============================================================ */
const $ = id => document.getElementById(id);

const PALETTE = ['#7bd389','#7bb3ff','#f0b429','#e879a6','#67e8f9','#fb923c','#b79bff','#ff5d5d'];
const FORMAT = 'gatos.pics/cmp@1';

const state = {
  mode: 'basic',
  title: '',
  version: 1,
  manifestExtras: {},
  importedCells: null,
  /* avanzado */
  variants: [],          // {id, name, codec, crf, bitrate, note, cmd, color}
  frames: [],            // {key, label}
  cells: new Map(),      // "vid|fkey" -> File
  unassigned: [],        // {file, why}
  /* básico */
  pairs: [],             // [File|null, File|null]
};
let nextVar = 1, nextFrame = 1;
let busy = false;   // un lote de captura de video posee el estado compartido: nada más puede guardarlo ni reemplazarlo

const slug = s => String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ID_RE = /^[A-Za-z0-9_-]{1,32}$/;   // ids de variante/frame: lo que el .cmp puede traer y la UI acepta

/* ---------- onboarding ---------- */
function showOnboard(force){
  let seen = false;
  try { seen = localStorage.getItem('gatosOnboarded') === '1'; } catch(e){}
  if (seen && !force) return;
  $('onboard').hidden = false;
}
$('obStart').addEventListener('click', () => {
  if ($('obDontShow').checked){ try { localStorage.setItem('gatosOnboarded','1'); } catch(e){} }
  $('onboard').hidden = true;
});
$('obDemo').addEventListener('click', () => {
  const btn = $('obDemo');
  btn.disabled = true; btn.textContent = 'Generando ejemplo…';
  setTimeout(async () => {
    const pkg = await makeDemoPackage();
    $('pvBox').srcdoc = buildStandaloneHTML(pkg, {blob:true});
    $('pvFrame').classList.add('show');
    $('onboard').hidden = true;
    btn.disabled = false; btn.textContent = 'Ver un ejemplo';
  }, 30);
});
$('obLoad').addEventListener('click', () => runAction(async () => {
  // cargar el ejemplo como proyecto básico para poder tocarlo
  if (state.pairs.some(p => p[0] || p[1]) && !confirm('Cargar el ejemplo descarta tu proyecto actual. ¿Continuar?')) return;
  const pkg = await makeDemoPackage();
  setMode('basic');
  state.pairs = [];
  for (const f of pkg.manifest.frames){
    const fa = pkg.images['src_'+f], fb = pkg.images['enc_'+f];
    const toFile = async du => {
      const parts = du.split(',');
      const bin = atob(parts[1]);
      const buf = new Uint8Array(bin.length);
      for (let i=0;i<bin.length;i++) buf[i] = bin.charCodeAt(i);
      return new File([buf], 'ejemplo_'+f+'.png', {type:'image/png'});
    };
    state.pairs.push([await toFile(fa), await toFile(fb)]);
  }
  renderPairs();
  $('onboard').hidden = true;
}));
$('btnHelp').addEventListener('click', () => showOnboard(true));

/* demo sintética: gradientes + figuras por canvas, sin archivos externos */
function makeDemoPackage(){
  const W = 960, H = 540;
  function draw(seed, blurred){
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    let s = seed;
    const rnd = () => (s = (s*1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const hue = rnd();
    const g = x.createLinearGradient(0, 0, W, H);
    for (let i = 0; i <= 4; i++){
      const t = i/4;
      g.addColorStop(t, `hsl(${Math.round((hue*360 + t*120) % 360)}, 62%, ${38 + t*22}%)`);
    }
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++){
      x.strokeStyle = `hsl(${Math.round(rnd()*360)}, 80%, 65%)`;
      x.lineWidth = 3 + rnd()*7;
      const cx = 80 + rnd()*(W-160), cy = 60 + rnd()*(H-120), r = 30 + rnd()*70;
      x.beginPath();
      if (rnd() < .5) x.arc(cx, cy, r, 0, Math.PI*2);
      else x.rect(cx-r, cy-r/2, r*2, r);
      x.stroke();
    }
    x.font = '600 26px system-ui, sans-serif';
    x.fillStyle = '#fff';
    x.fillText('ejemplo sintético · nada real', 26, 42);
    if (blurred){
      const c2 = document.createElement('canvas');
      c2.width = W; c2.height = H;
      const x2 = c2.getContext('2d');
      x2.filter = 'blur(1.4px)';
      x2.drawImage(c, 0, 0);
      x2.filter = 'none';
      const id = x2.getImageData(0, 0, W, H), d = id.data;
      for (let i = 0; i < d.length; i += 4){
        const n = (rnd()*12) - 6;
        d[i] = Math.max(0, Math.min(255, d[i]+n));
        d[i+1] = Math.max(0, Math.min(255, d[i+1]+n));
        d[i+2] = Math.max(0, Math.min(255, d[i+2]+n));
      }
      x2.putImageData(id, 0, 0);
      return c2;
    }
    return c;
  }
  const images = {};
  const per = {};
  let sum = 0;
  for (let i = 0; i < 3; i++){
    const f = i+1;
    const srcC = draw(100+i*7, false);
    const encC = draw(100+i*7, true);
    images['src_'+f] = srcC.toDataURL('image/png');
    images['enc_'+f] = encC.toDataURL('image/png');
    // S2 real del par sintético (determinista: los mismos números en toda máquina)
    const sc = S2.score(srcC.getContext('2d').getImageData(0, 0, W, H),
                        encC.getContext('2d').getImageData(0, 0, W, H));
    per[f] = {ssimulacra2: Math.round(sc*100)/100};
    sum += sc;
  }
  return {
    format: FORMAT,
    manifest: {
      title: 'gatos.pics · ejemplo',
      version: 1,
      frames: [1, 2, 3],
      frame_labels: {1: 'ejemplo 1', 2: 'ejemplo 2', 3: 'ejemplo 3'},
      variants: [
        {id: 'src', name: 'Fuente', color: '#7bd389', note: 'referencia'},
        {id: 'enc', name: 'Encode', color: '#7bb3ff', note: 'desenfoque + ruido simulados',
         cmd: 'encoder --entrada in.png --crf 26 --preset 4 --salida out.png',
         metrics: {ssimulacra2: Math.round((sum/3)*100)/100, per_frame: per}},
      ],
    },
    images,
  };
}

/* ---------- deteccion de formatos con perdida ---------- */
async function countLossy(files){
  let n = 0;
  for (const f of files){
    let head;
    try { head = new Uint8Array(await f.slice(0, 32).arrayBuffer()); } catch(e){ continue; }
    if (head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF){ n++; continue; }   // JPEG: siempre con perdida
    if (head[0] === 0x52 && head[1] === 0x49 && head[8] === 0x57 && head[9] === 0x45){ // RIFF....WEBP
      const four = String.fromCharCode(head[12], head[13], head[14], head[15]);
      if (four !== 'VP8L') n++;   // VP8L es sin perdida; VP8 y VP8X se asumen con perdida
    }
  }
  return n;
}
function lossyWarnHTML(n){
  return n ? `<div class="warn" style="margin-top:6px;">\u26a0 ${n} imagen${n>1?'es':''} con p\u00e9rdida (JPEG o WebP con p\u00e9rdida): la evidencia se degrada y el S2 medir\u00e1 esa compresi\u00f3n extra, no tu encode. Se aceptan, pero usa PNG sin p\u00e9rdida para comparaciones serias.</div>` : '';
}

/* ---------- archivos ---------- */
const fileURLs = new Map();   // File -> object URL (miniaturas)
function thumb(f){ if (f && !fileURLs.has(f)) fileURLs.set(f, URL.createObjectURL(f)); return f ? fileURLs.get(f) : ''; }
const fileDims = new Map();   // File -> "WxH"
const probingDims = new WeakSet();
let dimsRenderPending = false;
function probeDims(f){
  if (!f || fileDims.has(f) || probingDims.has(f)) return;
  probingDims.add(f);
  const im = new Image();
  im.onerror = () => probingDims.delete(f);
  im.onload = () => {
    probingDims.delete(f);
    fileDims.set(f, im.naturalWidth+'x'+im.naturalHeight);
    if (!dimsRenderPending){
      dimsRenderPending = true;
      requestAnimationFrame(() => {
        dimsRenderPending = false;
        if (state.mode === 'basic') renderPairs();
        else if (curStep === 4) renderFinish();
      });
    }
  };
  im.src = thumb(f);
}
function readAsDataURL(f){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });
}
function readAsText(f){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsText(f);
  });
}

/* ---------- pestañas de modo ---------- */
function setMode(m){
  state.mode = m;
  for (const [id, mode] of [['tabBasic','basic'],['tabVideo','video'],['tabAdv','advanced']]){
    $(id).setAttribute('aria-pressed', String(m === mode));
  }
  $('basicView').style.display = m==='basic' ? '' : 'none';
  $('videoView').style.display = m==='video' ? '' : 'none';
  $('advView').style.display = m==='advanced' ? '' : 'none';
}
$('tabBasic').addEventListener('click', () => setMode('basic'));
$('tabVideo').addEventListener('click', () => setMode('video'));
$('tabAdv').addEventListener('click', () => setMode('advanced'));

/* ============================================================
   MODO BÁSICO · pares, nada más
   ============================================================ */
const basicDrop = $('basicDrop'), basicFile = $('basicFile');
basicDrop.addEventListener('click', () => basicFile.click());
basicFile.addEventListener('change', () => { addBasicFiles([...basicFile.files]); basicFile.value=''; });
['dragover','dragenter'].forEach(ev => basicDrop.addEventListener(ev, e => { e.preventDefault(); basicDrop.classList.add('over'); }));
['dragleave','drop'].forEach(ev => basicDrop.addEventListener(ev, e => { e.preventDefault(); basicDrop.classList.remove('over'); }));
basicDrop.addEventListener('drop', e => addBasicFiles([...e.dataTransfer.files]));

let pairWarns = [];   // avisos del último emparejamiento por nombre
function addBasicFiles(files){
  $('builderStatus').textContent = '';
  pairWarns = [];
  const imgs = files.filter(f => f.type.startsWith('image/')).sort((a,b) => a.name.localeCompare(b.name, 'es', {numeric:true}));
  imgs.forEach(probeDims);
  const loose = [...imgs];

  // emparejamiento por nombre: <variante>_<frame> comparte frame. La referencia
  // (fuente/src/master...) queda a la izquierda contra cada otra variante.
  const REFERENCE_RE = /^(fuente|src|source|master|original|orig|remux|bd|bluray)$/i;
  const prefixOf = f => { const stem = f.name.replace(/\.[^.]+$/, ''); const cut = stem.lastIndexOf('_'); return cut > 0 ? stem.slice(0, cut).toLowerCase() : null; };
  const groups = new Map();
  for (const f of loose){
    const pre = prefixOf(f);
    if (pre === null) continue;
    const stem = f.name.replace(/\.[^.]+$/, '');
    const g = stem.slice(stem.lastIndexOf('_') + 1).toLowerCase();
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(f);
  }
  const sameVariant = (a, b) => prefixOf(a) && prefixOf(a) === prefixOf(b);
  const usable = [...groups.entries()].filter(([,g]) => g.length >= 2 && new Set(g.map(prefixOf)).size >= 2);
  if (usable.length){
    const patterned = new Set(usable.flatMap(([,g]) => g));
    for (const [suffix, g] of usable){
      // la referencia se detecta por el token inicial del prefijo: master_shot_001 -> master
      let ref = g.find(f => REFERENCE_RE.test(prefixOf(f).split('_')[0]));
      if (!ref){
        ref = [...g].sort((a, b) => prefixOf(a).localeCompare(prefixOf(b)))[0];
        pairWarns.push(`Ningún archivo del grupo «${suffix}» parece la referencia (fuente, src, máster): el lado izquierdo es una suposición. Revísalo.`);
      }
      for (const other of g){
        if (other === ref) continue;
        state.pairs.push([ref, other]);
      }
    }
    loose.length = 0;
    loose.push(...imgs.filter(f => !patterned.has(f)));
  }

  // completa primero el par cojo del final
  for (let i = state.pairs.length-1; i >= 0; i--){
    const p = state.pairs[i];
    if (p[0] && !p[1] && loose.length){
      const b = loose.shift();
      if (sameVariant(p[0], b)) pairWarns.push(`${p[0].name} y ${b.name} parecen la misma variante: se completó el par por orden. Revísalo.`);
      p[1] = b;
    }
  }
  while (loose.length >= 2){
    const a = loose.shift(), b = loose.shift();
    if (sameVariant(a, b)) pairWarns.push(`${a.name} y ${b.name} parecen la misma variante: se emparejaron por orden. Revísalos.`);
    state.pairs.push([a, b]);
  }
  if (loose.length) state.pairs.push([loose.shift(), null]);
  renderPairs();
  countLossy(imgs).then(n => { if (n) $('basicFoot').insertAdjacentHTML('beforeend', lossyWarnHTML(n)); });
}

function renderPairs(){
  const host = $('pairList');
  host.innerHTML = '';
  state.pairs.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'pair';
    const mk = (f, side) => {
      const s = document.createElement('div');
      s.className = 'slot ' + (f ? 'filled' : 'empty');
      s.setAttribute('role', 'button'); s.tabIndex = 0;
      s.setAttribute('aria-label', `${side ? 'Derecha' : 'Izquierda'}, par ${i+1}: ${f ? f.name : 'elegir imagen'}`);
      s.innerHTML = f ? `<img src="${thumb(f)}" alt="${esc(f.name)}">` : (side ? 'Derecha: elegir imagen' : 'Izquierda: elegir imagen');
      s.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); s.click(); } });
      s.title = f ? f.name + (fileDims.get(f) ? ' · '+fileDims.get(f) : '') : 'clic para elegir una imagen';
      s.addEventListener('click', () => pickOne(file => { state.pairs[i][side] = file; probeDims(file); renderPairs(); }));
      return s;
    };
    row.innerHTML = `<span class="no">par ${i+1}</span>`;
    row.appendChild(mk(p[0], 0));
    row.appendChild(mk(p[1], 1));
    const tools = document.createElement('div');
    tools.className = 'tools';
    const up = document.createElement('button'); up.textContent='↑'; up.title='subir';
    up.onclick = () => { if (i>0){ [state.pairs[i-1], state.pairs[i]] = [state.pairs[i], state.pairs[i-1]]; renderPairs(); } };
    const dn = document.createElement('button'); dn.textContent='↓'; dn.title='bajar';
    dn.onclick = () => { if (i<state.pairs.length-1){ [state.pairs[i+1], state.pairs[i]] = [state.pairs[i], state.pairs[i+1]]; renderPairs(); } };
    const rm = document.createElement('button'); rm.textContent='×'; rm.title='quitar par';
    rm.onclick = () => { state.pairs.splice(i,1); renderPairs(); };
    const swap = document.createElement('button'); swap.textContent='↔'; swap.title='Intercambiar izquierda y derecha';
    swap.onclick = () => { [p[0],p[1]] = [p[1],p[0]]; renderPairs(); };
    tools.append(swap, up, dn, rm);
    row.appendChild(tools);
    host.appendChild(row);
  });
  const foot = $('basicFoot');
  const half = state.pairs.some(p => !p[0] || !p[1]);
  const dims = new Set([...state.pairs.flat()].filter(Boolean).map(f => fileDims.get(f)).filter(Boolean));
  let h = '';
  if (half) h += `<div class="warn">Completa el par vacío antes de compartir. Puedes guardar el proyecto para seguir después.</div>`;
  if (dims.size > 1) h += `<div class="warn">Las imágenes tienen tamaños distintos (${[...dims].join(', ')}) · el diff y los recortes 1:1 necesitan dimensiones idénticas.</div>`;
  for (const w of pairWarns) h += `<div class="warn">${esc(w)}</div>`;
  if (state.pairs.length && !half){
    h += `<div class="okline">${state.pairs.length} par${state.pairs.length>1?'es':''} listo${state.pairs.length>1?'s':''} · y exporta cuando quieras:</div>`;
    h += `<div class="exports" style="margin-top:8px;">
      <button id="bExpHtml">Descargar .html</button>
      <button id="bExpZip">Descargar .zip</button>
      <button id="bExpCmp">Descargar .cmp</button>
    </div>`;
  }
  foot.innerHTML = h;
  const wire = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  wire('bExpHtml', () => $('btnExpHtml').click());
  wire('bExpZip', () => $('btnExpZip').click());
  wire('bExpCmp', () => $('btnExpCmp').click());
}
function pickOne(cb){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => { if (inp.files[0]) cb(inp.files[0]); };
  inp.click();
}

/* básico -> núcleo: manifest listo + File por clave canónica. Sin dataURLs:
   la representación única del proyecto son los archivos (gatos.pics#29) */
async function basicCore(cancelled = () => false){
  const pairs = state.pairs;
  const manifest = {
    title: 'Comparación',
    version: state.version,
    frames: pairs.map((_, i) => i+1),
    frame_labels: Object.fromEntries(pairs.map((_, i) => [String(i+1), String(i+1)])),
    variants: [
      {id:'a', name:'A', color:PALETTE[0]},
      {id:'b', name:'B', color:PALETTE[1]},
    ],
  };
  const entries = [];
  for (let i = 0; i < pairs.length; i++){
    if (cancelled()) throw new Error('Preparación cancelada.');
    if (pairs[i][0]) entries.push(['a_'+(i+1), pairs[i][0]]);
    if (pairs[i][1]) entries.push(['b_'+(i+1), pairs[i][1]]);
  }
  return {format: FORMAT, manifest, entries};
}

/* ============================================================
   MODO VIDEO · del video a la comparación
   ------------------------------------------------------------
   Extraído a app/capture.js (gatos.pics#28): vidState/marcas/captura y el
   lote de vidGo. Este archivo conserva el estado avanzado que ese modo
   siembra (variants/frames/cells) y los render* que lo pintan.
   ============================================================ */


/* ============================================================
   MODO AVANZADO · pasos
   ============================================================ */
const STEPS = ['Proyecto','Variantes','Frames','Imágenes','Revisar'];
let curStep = 0;
function renderSteps(){
  const nav = $('stepNav');
  nav.innerHTML = '';
  const badCount = validateAdvanced().filter(x => x[0] === 'bad').length;
  STEPS.forEach((s, i) => {
    const b = document.createElement('button');
    const badge = (i === 4 && badCount) ? ` <span class="stepbad">${badCount}</span>` : '';
    b.innerHTML = `<span class="n">${i+1}</span>${esc(s)}${badge}`;
    if (i === curStep) b.classList.add('on');
    nav.appendChild(b);
    b.onclick = () => { curStep = i; renderSteps(); };
  });
  document.querySelectorAll('.step').forEach(el => el.style.display = (+el.dataset.step === curStep) ? '' : 'none');
  if (curStep === 4) renderFinish();
  $('stepBack').disabled = curStep === 0;
  $('stepNext').hidden = curStep === STEPS.length-1;
}
$('stepBack').onclick = () => { curStep = Math.max(0, curStep-1); renderSteps(); };
$('stepNext').onclick = () => { curStep = Math.min(STEPS.length-1, curStep+1); renderSteps(); };
for (const id of ['basicDrop','vidDrop','bulkDrop']) $(id).addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); $(id).click(); }
});

/* ---------- paso: proyecto ---------- */
$('pjTitle').addEventListener('input', () => { state.title = $('pjTitle').value; $('pjTitleWarn').style.display = state.title.trim() ? 'none' : ''; });
$('pjVersion').addEventListener('change', () => { state.version = Math.max(1, parseInt($('pjVersion').value)||1); });
$('pjBump').addEventListener('click', () => { state.version++; $('pjVersion').value = state.version; });

/* ---------- paso: variantes ---------- */
function defVariant(ids){
  while (ids ? ids.has('v'+nextVar) : state.variants.some(v => v.id === 'v'+nextVar)) nextVar++;
  return {id:'v'+(nextVar++), name:'', codec:'', crf:'', bitrate:'', note:'', cmd:'', metric:'', color:PALETTE[(nextVar-2) % PALETTE.length]};
}
function ensureSeed(){
  if (!state.variants.length){
    const a = defVariant(); a.name = 'Fuente'; a.note = 'referencia';
    const b = defVariant(); b.name = 'Encode';
    state.variants.push(a, b);
  }
  if (!state.frames.length){
    state.frames.push({key:String(nextFrame++), label:''});
  }
}
function variantNote(v){
  return [v.codec, v.crf, v.bitrate, v.note].map(s => String(s||'').trim()).filter(Boolean).join(' \u00B7 ');
}
function renderVariants(){
  ensureSeed();
  const host = $('varList');
  host.innerHTML = '';
  state.variants.forEach((v, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    const badge = i===0 ? '<span class="badge">izquierda por defecto</span>' : i===1 ? '<span class="badge">derecha por defecto</span>' : '';
    card.innerHTML = `
      <div class="vrow">
        <div class="dot" style="background:${v.color}" title="clic para cambiar el color"></div>
        <input type="text" data-k="name" placeholder="nombre (p. ej. Fuente, CRF 26)" value="${esc(v.name)}">
        <input type="text" class="opt" data-k="codec" placeholder="codec" value="${esc(v.codec)}" title="codec · p. ej. AV1, x264, HEVC">
        <input type="text" class="opt" data-k="crf" placeholder="CRF" value="${esc(v.crf)}" title="número de calidad">
        <input type="text" class="opt" data-k="bitrate" placeholder="Mb/s" value="${esc(v.bitrate)}" title="bitrate">
        <button class="iconbtn" data-a="up" title="subir">↑</button>
        <button class="iconbtn" data-a="dn" title="bajar">↓</button>
        <button class="iconbtn" data-a="rm" title="quitar">×</button>
      </div>
      <div class="vrow2">
        <span class="hint">${esc(v.id)}${badge}</span>
        <input type="text" data-k="note" placeholder="nota extra · sale bajo el botón" value="${esc(v.note)}">
        <input type="text" class="mono" data-k="cmd" placeholder="comando del encoder (tooltip)" value="${esc(v.cmd)}">
        <input type="text" data-k="metric" placeholder="Métrica opcional: VMAF 96.2" value="${esc(v.metric)}" title="Se muestra bajo el nombre de la variante">
      </div>`;
    card.querySelector('.dot').onclick = () => {
      v.color = PALETTE[(PALETTE.indexOf(v.color)+1) % PALETTE.length];
      renderVariants();
    };
    card.querySelectorAll('input[data-k]').forEach(inp => {
      inp.setAttribute('aria-label', ({name:'Nombre',codec:'Codec',crf:'CRF',bitrate:'Bitrate en Mb/s',note:'Nota',cmd:'Comando del encoder',metric:'Métrica opcional'})[inp.dataset.k]+' de la variante '+(i+1));
      inp.addEventListener('input', () => { v[inp.dataset.k] = inp.value; renderVarWarns(); });
    });
    card.querySelectorAll('button[data-a]').forEach(b => {
      b.onclick = () => {
        if (b.dataset.a==='up' && i>0) [state.variants[i-1], state.variants[i]] = [state.variants[i], state.variants[i-1]];
        if (b.dataset.a==='dn' && i<state.variants.length-1) [state.variants[i+1], state.variants[i]] = [state.variants[i], state.variants[i+1]];
        if (b.dataset.a==='rm') removeVariant(v.id);
        renderVariants(); renderMatrix();
      };
    });
    host.appendChild(card);
  });
  renderVarWarns();
}
function removeVariant(vid){
  state.variants = state.variants.filter(v => v.id !== vid);
  for (const k of [...state.cells.keys()]) if (k.startsWith(vid+'|')) state.cells.delete(k);
}
function renderVarWarns(){
  const w = $('varWarns');
  const lines = [];
  if (state.variants.length < 2) lines.push(`<div class="err">Hacen falta al menos dos variantes para comparar.</div>`);
  w.innerHTML = lines.join('');
}
$('varAdd').addEventListener('click', () => { state.variants.push(defVariant()); renderVariants(); renderMatrix(); });

/* ---------- paso: frames ---------- */
function renderFrames(){
  ensureSeed();
  const host = $('frameList');
  host.innerHTML = '';
  state.frames.forEach((fr, i) => {
    const row = document.createElement('div');
    row.className = 'frow';
    row.innerHTML = `
      <input type="text" class="mono" data-k="key" placeholder="1" value="${esc(fr.key)}" title="número del frame · se usa en los nombres de archivo">
      <input type="text" data-k="label" placeholder="etiqueta (opcional · p. ej. escena oscura, primer plano de grano)" value="${esc(fr.label)}">
      <button class="iconbtn" data-a="up" title="subir">↑</button>
      <button class="iconbtn" data-a="dn" title="bajar">↓</button>
      <button class="iconbtn" data-a="rm" title="quitar">×</button>`;
    row.querySelectorAll('input[data-k]').forEach(inp => {
      inp.addEventListener(inp.dataset.k === 'key' ? 'change' : 'input', () => {
        const old = fr.key;
        if (inp.dataset.k === 'key' && (!ID_RE.test(inp.value) || state.frames.some(f => f !== fr && f.key === inp.value))){
          inp.value = old; $('builderStatus').textContent = 'Usa un identificador único de frame, con letras, números o guiones.'; return;
        }
        fr[inp.dataset.k] = inp.value;
        if (inp.dataset.k === 'key' && old !== fr.key){
          for (const k of [...state.cells.keys()]){
            const [vid, fk] = k.split('|');
            if (fk === old){ state.cells.set(vid+'|'+fr.key, state.cells.get(k)); state.cells.delete(k); }
          }
        }
      });
    });
    row.querySelectorAll('button[data-a]').forEach(b => {
      b.onclick = () => {
        if (b.dataset.a==='up' && i>0) [state.frames[i-1], state.frames[i]] = [state.frames[i], state.frames[i-1]];
        if (b.dataset.a==='dn' && i<state.frames.length-1) [state.frames[i+1], state.frames[i]] = [state.frames[i], state.frames[i+1]];
        if (b.dataset.a==='rm'){
          for (const k of [...state.cells.keys()]) if (k.endsWith('|'+fr.key)) state.cells.delete(k);
          state.frames = state.frames.filter(x => x !== fr);
        }
        renderFrames(); renderMatrix();
      };
    });
    host.appendChild(row);
  });
  const w = $('frameWarns');
  w.innerHTML = state.frames.length < 1 ? `<div class="err">Hace falta al menos un frame.</div>`
    : '';
}
$('frameAdd').addEventListener('click', () => {
  let n = nextFrame;
  while (state.frames.some(f => f.key === String(n))) n++;
  nextFrame = n+1;
  state.frames.push({key:String(n), label:''});
  renderFrames(); renderMatrix();
});

/* ---------- paso: imágenes (tabla + autocompletado por nombre) ---------- */
const bulkDrop = $('bulkDrop'), bulkFile = $('bulkFile');
bulkDrop.addEventListener('click', () => bulkFile.click());
bulkFile.addEventListener('change', () => { noteBulk(bulkAdd([...bulkFile.files])); bulkFile.value=''; });
['dragover','dragenter'].forEach(ev => bulkDrop.addEventListener(ev, e => { e.preventDefault(); bulkDrop.classList.add('over'); }));
['dragleave','drop'].forEach(ev => bulkDrop.addEventListener(ev, e => { e.preventDefault(); bulkDrop.classList.remove('over'); }));
bulkDrop.addEventListener('drop', e => {
  const r = bulkAdd([...e.dataTransfer.files]);
  noteBulk(r);
});
let bulkNoteT = null;
function noteBulk(r){
  if (!r) return;
  const el = $('bulkNote');
  const bits = [];
  if (r.createdV.length) bits.push(`${r.createdV.length} variante${r.createdV.length>1?'s':''} nueva${r.createdV.length>1?'s':''} (${r.createdV.join(', ')})`);
  if (r.createdF.length) bits.push(`${r.createdF.length} frame${r.createdF.length>1?'s':''} nuevo${r.createdF.length>1?'s':''}`);
  if (r.misses) bits.push(`${r.misses} sin asignar`);
  el.textContent = bits.length ? '✓ ' + bits.join(' · ') : '✓ todo asignado';
  el.style.color = r.misses ? 'var(--warn)' : 'var(--ok)';
  clearTimeout(bulkNoteT);
  bulkNoteT = setTimeout(() => { el.textContent = ''; }, 6000);
}

function bulkAdd(files){
  const imgs = files.filter(f => f.type.startsWith('image/'));
  const misses = [];
  const createdV = new Set(), createdF = new Set();
  const ids = new Map(), names = new Map(), prefixes = new Map(), keys = new Map(), labels = new Map();
  const first = (map,key,value) => { if (key && !map.has(key)) map.set(key,value); };
  const indexVariant = v => {
    ids.set(v.id,v);
    const name = slug(v.name); first(names,name,v);
    for (let n=3;n<=name.length;n++){
      const prefix = name.slice(0,n);
      prefixes.set(prefix, prefixes.has(prefix) ? null : v);
    }
  };
  const indexFrame = f => { first(keys,slug(f.key),f); first(labels,slug(f.label),f); };
  state.variants.forEach(indexVariant); state.frames.forEach(indexFrame);
  for (const f of imgs){
    const stem = f.name.replace(/\.[^.]+$/, '');
    const cut = stem.lastIndexOf('_');
    if (cut > 0){
      const vt = slug(stem.slice(0,cut)), ft = slug(stem.slice(cut+1));
      let v = ids.get(vt) || names.get(vt) || prefixes.get(vt);
      let fr = keys.get(ft) || labels.get(ft);
      if (!v && prefixes.has(vt)){
        misses.push({file:f, why:'nombre ambiguo · usa el nombre completo o el identificador de la variante'});
        continue;
      }
      // lo que no existe, se crea: soltar todo y que la tabla se arme sola
      if (!v && vt.length >= 2){
        v = defVariant(ids);
        v.name = stem.slice(0, cut).replace(/[-_]+/g,' ').replace(/\b\w/g, c=>c.toUpperCase());
        state.variants.push(v); indexVariant(v); createdV.add(v.name);
      }
      if (!fr && ft.length >= 1){
        const key = stem.slice(cut+1).trim();
        fr = {key,label:''};
        state.frames.push(fr); indexFrame(fr); createdF.add(key);
      }
      if (v && fr){ state.cells.set(v.id+'|'+fr.key, f); probeDims(f); continue; }
    }
    const why = cut > 0
      ? 'no se pudo interpretar el nombre · se espera <variante>_<frame>'
      : 'nombre sin guion bajo · se espera <variante>_<frame>';
    misses.push({file:f, why});
  }
  // frames numericos en orden natural tras el volcado
  if (createdF.size && state.frames.every(fr => /^\d+$/.test(fr.key)))
    state.frames.sort((a,b) => parseInt(a.key,10) - parseInt(b.key,10));
  state.unassigned.push(...misses);
  renderMatrix(); renderVariants(); renderFrames();
  countLossy(imgs).then(n => { if (n) $('bulkWarn').innerHTML = lossyWarnHTML(n); });
  return {createdV: [...createdV], createdF: [...createdF], misses: misses.length};
}
function renderMatrix(){
  const host = $('matrix');
  matrixCells.clear();
  if (!state.variants.length || !state.frames.length){ host.innerHTML = '<p class="hint">Primero define variantes y frames.</p>'; return; }
  let html = '<table class="mtx"><tr><th></th>';
  for (const v of state.variants) html += `<th><span style="color:${v.color}">\u25CF</span> ${esc(v.name || v.id)}</th>`;
  html += '</tr>';
  for (const fr of state.frames){
    html += `<tr><th class="mono">${esc(fr.key)}${fr.label ? '<br><span style="font-weight:400">'+esc(fr.label)+'</span>' : ''}</th>`;
    for (const v of state.variants){
      const f = state.cells.get(v.id+'|'+fr.key);
      html += `<td><div class="cell ${f?'filled':'empty'}" data-cell="${esc(v.id)}|${esc(fr.key)}">${
        matrixCellContent(f)
      }</div></td>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  host.innerHTML = html;
  host.querySelectorAll('.cell').forEach(cell => matrixCells.set(cell.dataset.cell,cell));
  renderUnassigned();
}
const matrixCells = new Map();
function matrixCellContent(f){
  return f ? `<img src="${thumb(f)}" loading="lazy" decoding="async" alt=""><button class="rm" title="quitar">×</button>` : 'suelta / clic';
}
function updateMatrixCell(key,file){
  if (file){ state.cells.set(key,file); probeDims(file); }
  else state.cells.delete(key);
  const cell = matrixCells.get(key);
  if (cell){ cell.className = 'cell '+(file?'filled':'empty'); cell.innerHTML = matrixCellContent(file); }
}
$('matrix').addEventListener('click', e => {
  const cell = e.target.closest('[data-cell]'); if (!cell) return;
  if (e.target.closest('.rm')) updateMatrixCell(cell.dataset.cell,null);
  else pickOne(file => updateMatrixCell(cell.dataset.cell,file));
});
for (const event of ['dragover','dragleave','drop']) $('matrix').addEventListener(event, e => {
  const cell = e.target.closest('[data-cell]'); if (!cell) return;
  e.preventDefault(); cell.classList.toggle('over',event==='dragover');
  if (event==='drop'){
    e.stopPropagation();
    const file = [...e.dataTransfer.files].find(f=>f.type.startsWith('image/'));
    if (file) updateMatrixCell(cell.dataset.cell,file);
  }
});
function renderUnassigned(){
  /* archivos sin asignar */
  const un = $('unassigned');
  if (state.unassigned.length){
    const variantOptions = state.variants.map(v=>`<option value="${esc(v.id)}">${esc(v.name||v.id)}</option>`).join('');
    const frameOptions = state.frames.map(f=>`<option value="${esc(f.key)}">${esc(f.key)}${f.label?' · '+esc(f.label):''}</option>`).join('');
    let h = '<div class="card"><b>Archivos sin asignar</b><ul style="list-style:none;margin-top:6px;">';
    state.unassigned.forEach((u, i) => {
      h += `<li style="display:flex;gap:8px;align-items:center;margin:4px 0;flex-wrap:wrap;">
        <img src="${thumb(u.file)}" style="width:54px;height:32px;object-fit:contain;border-radius:4px;background:#000;">
        <span class="mono" style="min-width:0;overflow:hidden;text-overflow:ellipsis;max-width:280px;">${esc(u.file.name)}</span>
        <span class="hint">${esc(u.why)}</span>
        <span style="margin-left:auto;"></span>
        <select data-i="${i}" data-w="v" class="asSel">
          <option value="">variante…</option>${variantOptions}
        </select>
        <select data-i="${i}" data-w="f" class="asSel">
          <option value="">frame…</option>${frameOptions}
        </select>
        <button class="iconbtn" data-rm="${i}" title="descartar este archivo">×</button>
      </li>`;
    });
    h += '</ul></div>';
    un.innerHTML = h;
    un.querySelectorAll('.asSel').forEach(sel => sel.addEventListener('change', () => {
      const i = +sel.dataset.i;
      const vs = un.querySelector(`select[data-i="${i}"][data-w="v"]`);
      const fs = un.querySelector(`select[data-i="${i}"][data-w="f"]`);
      if (vs.value && fs.value){
        updateMatrixCell(vs.value+'|'+fs.value, state.unassigned[i].file);
        state.unassigned.splice(i,1);
        renderUnassigned();
      }
    }));
    un.querySelectorAll('button[data-rm]').forEach(b => b.addEventListener('click', () => { state.unassigned.splice(+b.dataset.rm,1); renderUnassigned(); }));
  } else un.innerHTML = '';
}

/* ---------- avanzado -> paquete ---------- */
/* ---------- S2 (SSIMULACRA2) opcional ---------- */
const idCache = new WeakMap();   // File -> ImageData · débil: los Files viven en state.cells; sin esto, 10 PNG 4K retenían ~330 MB para siempre
async function imageDataOf(f){
  if (!idCache.has(f)) idCache.set(f, await S2.imageDataFrom(f));
  return idCache.get(f);
}
const s2Cache = new WeakMap();
async function s2Of(fa, fb){
  if (!s2Cache.has(fa)) s2Cache.set(fa, new WeakMap());
  const scores = s2Cache.get(fa);
  if (!scores.has(fb)) scores.set(fb, S2.score(await imageDataOf(fa), await imageDataOf(fb)));
  return scores.get(fb);
}
async function computeS2Metrics(manifest){
  const ref = manifest.variants[0];
  if (!ref) return;
  const refId = ref.id;
  let total = 0, done = 0;
  for (const v of manifest.variants.slice(1)) total += manifest.frames.length;
  for (const v of manifest.variants.slice(1)){
    const per = {};
    let sum = 0, n = 0;
    for (const fk of manifest.frames){
      const fa = state.cells.get(refId+'|'+fk), fb = state.cells.get(v.id+'|'+fk);
      if (fa && fb){
        try { const sc = await s2Of(fa, fb); per[fk] = {ssimulacra2: sc}; sum += sc; n++; }
        catch (e) { /* dimensiones distintas u otro problema: se omite */ }
      }
      done++;
      $('s2Prog').textContent = 'S2: ' + done + '/' + total;
    }
    if (n){
      v.metrics = Object.assign(v.metrics || {}, {ssimulacra2: Math.round((sum/n)*100)/100, per_frame: per});
    }
  }
  $('s2Prog').textContent = '';
}

async function advancedCore(cancelled = () => false){
  const manifest = {
    ...state.manifestExtras,
    title: state.title.trim() || 'Comparación',
    version: state.version,
    frames: state.frames.map(f => f.key),
    frame_labels: Object.fromEntries(state.frames.filter(f => f.label.trim()).map(f => [f.key, f.label.trim()])),
    variants: state.variants.map(v => {
      const o = {...v.source, id: v.id, name: v.name.trim() || v.id, color: v.color};
      if (o.metrics) o.metrics = {...o.metrics};
      if (o.metrics && state.importedCells){
        const ref = state.variants[0]?.id;
        const sameFrames = JSON.stringify(state.frames.map(f=>String(f.key))) === JSON.stringify((state.manifestExtras.frames || []).map(String));
        const sameInputs = sameFrames && ref === state.manifestExtras.variants?.[0]?.id && state.frames.every(f =>
          [v.id,ref].every(id=>state.cells.get(id+'|'+f.key) === state.importedCells.get(id+'|'+f.key)));
        if (!sameInputs) delete o.metrics;
      }
      if (o.metrics) delete o.metrics.custom_note;
      delete o.note; delete o.cmd;
      const n = variantNote(v);
      if (n) o.note = n;
      if (v.cmd.trim()) o.cmd = v.cmd.trim();
      if (v.metric.trim()) o.metrics = Object.assign(o.metrics || {}, {custom_note: v.metric.trim().slice(0, 60)});
      return o;
    }),
  };
  const entries = [];
  for (const [k, f] of state.cells){
    if (cancelled()) throw new Error('Preparación cancelada.');
    const [vid, fk] = k.split('|');
    entries.push([vid+'_'+fk, f]);
  }
  if ($('s2Toggle') && $('s2Toggle').checked) await computeS2Metrics(manifest);
  return {format: FORMAT, manifest, entries};
}

/* ---------- validación (paso final) ---------- */
function validateAdvanced(){
  const out = [];
  const missing = [];
  for (const fr of state.frames) for (const v of state.variants)
    if (!state.cells.get(v.id+'|'+fr.key)) missing.push(`${v.name||v.id} \u00B7 frame ${fr.key}`);
  if (missing.length) out.push(['bad', `${missing.length} casilla${missing.length>1?'s':''} vacía${missing.length>1?'s':''} · ahí la página mostrará un cuadro roto.`]);
  else if (state.variants.length && state.frames.length) out.push(['good', `Las ${state.variants.length * state.frames.length} casillas llenas.`]);
  if (state.variants.length < 2) out.push(['bad','Hacen falta al menos dos variantes.']);
  if (!state.frames.length) out.push(['bad','Hace falta al menos un frame.']);
  const keys = state.frames.map(f => f.key);
  if (new Set(keys).size !== keys.length) out.push(['bad','Hay identificadores de frame repetidos. Usa uno distinto para cada momento.']);
  if (keys.some(k => !ID_RE.test(k))) out.push(['bad','Los identificadores de frame admiten letras, números, guion y guion bajo (máximo 32).']);
  const dims = new Set([...state.cells.values()].map(f => fileDims.get(f)).filter(Boolean));
  if (dims.size > 1) out.push(['bad',`Tamaños de imagen mezclados (${[...dims].join(', ')}) · el diff y los recortes 1:1 necesitan dimensiones idénticas.`]);
  let total = 0; for (const f of state.cells.values()) total += f.size;
  out.push([total > 60*1048576 ? 'warnl' : 'good', `Tamaño del paquete ≈ ${(total*1.34/1048576).toFixed(1)} MB en base64.`]);
  if (total > 60*1048576) out.push(['warnl','Pesado · considera menos frames o imágenes más chicas.']);
  if (state.unassigned.length) out.push(['warnl',`${state.unassigned.length} archivo${state.unassigned.length>1?'s':''} sin asignar NO ${state.unassigned.length>1?'van':'va'} a entrar a la página.`]);
  return out;
}
function renderFinish(){
  $('checkList').innerHTML = validateAdvanced()
    .map(([cls, msg]) => `<li class="${cls==='bad'?'bad':cls==='warnl'?'warnl':'good'}">${esc(msg)}</li>`).join('');
}

/* ============================================================
   vista previa + exportaciones
   ============================================================ */
function packageMode(){
  /* Guardar/publicar el modo que TIENE trabajo: la pestaña activa es la última
     tocada, no la del proyecto real (6 pares en Básico + toque en Video no debe
     guardar el avanzado sembrado y vacío). */
  const basicWork = state.pairs.some(p => p[0] || p[1]);
  const advWork = state.cells.size > 0;
  return basicWork === advWork ? state.mode : (basicWork ? 'basic' : 'advanced');
}
/* núcleo del paquete: manifest + archivos, SIN convertir nada a dataURL */
async function packageCore({complete = false, cancelled = () => false} = {}){
  const mode = packageMode();
  if (complete){
    let problems;
    if (mode === 'basic'){
      problems = !state.pairs.length || state.pairs.some(p => !p[0] || !p[1]) ? ['Agrega dos imágenes a cada par antes de compartir.'] : [];
      // igual que avanzado: dimensiones mezcladas rompen el diff y los recortes 1:1
      const dims = new Set(state.pairs.flat().filter(Boolean).map(f => fileDims.get(f)).filter(Boolean));
      if (dims.size > 1) problems.push(`Tamaños de imagen mezclados (${[...dims].join(', ')}) · el diff y los recortes 1:1 necesitan dimensiones idénticas.`);
    } else {
      problems = validateAdvanced().filter(([type]) => type === 'bad').map(([,text]) => text);
    }
    if (problems.length) throw new Error(problems.join(' '));
    // límites de ley (GOALS.md): el servidor rechaza 25 MiB/imagen y 300 MiB/paquete;
    // avisar acá evita subir 200 MB para que fallen al final
    const files = mode === 'basic' ? state.pairs.flat().filter(Boolean) : [...state.cells.values()];
    const big = files.find(f => f.size > 25*1048576);
    if (big) throw new Error(`«${big.name}» pesa ${(big.size/1048576).toFixed(1)} MB: el límite por imagen es 25 MiB.`);
    let total = 0; for (const f of files) total += f.size;
    if (total*1.34 > 300*1048576) throw new Error(`El paquete proyectado pasa de 300 MiB (${(total*1.34/1048576).toFixed(1)} MB en base64): reduce frames o imágenes.`);
  }
  return mode === 'basic' ? basicCore(cancelled) : advancedCore(cancelled);   // video también alimenta el estado avanzado
}
/* compat con dataURLs eager: consola/pruebas (window.BUILDER) y demo. Los
   botones de exportar/publicar NO pasan por aquí (gatos.pics#29). */
async function currentPackage(opts = {}){
  const cancelled = opts.cancelled || (() => false);
  const core = await packageCore(opts);
  const images = {};
  for (const [k, f] of core.entries){
    if (cancelled()) throw new Error('Preparación cancelada.');
    images[k] = await readAsDataURL(f);
  }
  return {format: core.format, manifest: core.manifest, images};
}

/* ---------- serialización por partes (gatos.pics#29) ----------
   El .cmp sigue necesitando dataURLs, pero cada una vive solo el instante
   que tarda en entrar a su Blob propio: nunca conviven el paquete completo
   en cadenas Y su JSON, ni el estado Y la serialización. Los bytes de salida
   son idénticos a los de JSON.stringify(pkg) con las claves en el mismo
   orden (format, manifest, images; inserción de entries). */
const jsonChunk = (s, htmlSafe) => {
  const j = JSON.stringify(s);
  return htmlSafe ? j.replace(/</g, '\\u003c') : j;
};
async function packageJSONBlob(core, {htmlSafe = false, cancelled = () => false} = {}){
  const head = '{"format":' + jsonChunk(core.format, htmlSafe) + ',"manifest":'
    + jsonChunk(core.manifest, htmlSafe) + ',"images":{';
  const parts = [head];
  let first = true;
  for (const [k, f] of core.entries){
    if (cancelled()) throw new Error('Preparación cancelada.');
    const du = await readAsDataURL(f);
    // Blob por imagen: la cadena se suelta en cuanto entra, el Blob final es
    // una concatenación diferida (no copia) de todos ellos
    parts.push(new Blob([(first ? '' : ',') + jsonChunk(k, htmlSafe) + ':' + jsonChunk(du, htmlSafe)]));
    first = false;
  }
  parts.push(new Blob(['}}']));
  return new Blob(parts, {type:'application/json'});
}
async function runAction(action){
  $('builderStatus').textContent = '';
  try { await action(); } catch(e){
    $('builderStatus').textContent = e.message;
    $('builderStatus').scrollIntoView({block:'nearest'});
  }
}
function buildStandaloneHTML(pkg, opts){
  // camino eager con el paquete YA armado (demo sintética y consola/pruebas):
  // los botones de exportar usan standaloneParts y los dataURL nunca se
  // sostienen todos a la vez (gatos.pics#29).
  // export: inline (portatil, file:// sin CSP). preview: URLs blob: — el srcdoc
  // hereda la CSP del creador hospedado y bloquea scripts inline generados en
  // runtime; los blob: solo pueden mintearlos nuestros scripts (inadivinables)
  const json = JSON.stringify(pkg).replace(/</g, '\\u003c');
  if (opts && opts.blob){
    for (const u of previewUrls) URL.revokeObjectURL(u);
    previewUrls.length = 0;
    const blobSrc = (code) => { const u = URL.createObjectURL(new Blob([code], {type:'text/javascript'})); previewUrls.push(u); return u; };
    return SHELL_HTML
      .replace('<script src="upload.js"><\/script>', () => '<script src="' + blobSrc(UPLOAD_SRC) + '"><\/script>')
      .replace('<script src="compare.js"><\/script>', () => '<script src="' + blobSrc('window.GATOS_PACKAGE = ' + json + ';') + '"><\/script>\n<script src="' + blobSrc(ENGINE_SRC) + '"><\/script>');
  }
  const injection = '<script>window.GATOS_PACKAGE = ' + json + ';<\/script>\n';
  const engineTag = '<script>\n' + ENGINE_SRC + '\n<\/script>';
  return SHELL_HTML
    .replace('<script src="upload.js"><\/script>', () => '<script>\n'+UPLOAD_SRC+'\n<\/script>')
    .replace('<script src="compare.js"><\/script>', () => injection + engineTag);
}
const previewUrls = [];
/* vista previa: el paquete entra al iframe como Blob por imagen (gatos.pics#29).
   El srcdoc queda del tamaño del shell y el creador nunca sostiene el paquete
   serializado: solo un dataURL a la vez, dentro de packageJSONBlob. */
async function buildPreviewSrcdoc(core){
  for (const u of previewUrls) URL.revokeObjectURL(u);
  previewUrls.length = 0;
  const blobURL = blob => { const u = URL.createObjectURL(blob); previewUrls.push(u); return u; };
  const pkg = await packageJSONBlob(core, {htmlSafe:true});
  return SHELL_HTML
    .replace('<script src="upload.js"><\/script>', () => '<script src="' + blobURL(new Blob([UPLOAD_SRC], {type:'text/javascript'})) + '"><\/script>')
    .replace('<script src="compare.js"><\/script>', () => '<script src="' + blobURL(new Blob(['window.GATOS_PACKAGE = ', pkg, ';'], {type:'text/javascript'})) + '"><\/script>\n<script src="' + blobURL(new Blob([ENGINE_SRC], {type:'text/javascript'})) + '"><\/script>');
}
async function openPreviewOverlay(){
  if (busy){ $('builderStatus').textContent = 'La captura de video está en curso; espera a que termine para abrir la vista previa.'; return; }
  const core = await packageCore({complete:true});
  $('pvFrame').classList.add('show');
  $('pvBox').srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#000;color:#9a9aa8;font:14px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}</style></head><body>Generando vista previa…</body></html>';
  $('pvBox').srcdoc = await buildPreviewSrcdoc(core);
}
$('pvClose').addEventListener('click', () => { $('pvFrame').classList.remove('show'); $('pvBox').srcdoc = ''; for (const u of previewUrls) URL.revokeObjectURL(u); previewUrls.length = 0; });
$('btnPreviewTop').addEventListener('click', () => runAction(openPreviewOverlay));
$('btnPreview').addEventListener('click', () => runAction(openPreviewOverlay));

function download(name, blob){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
function fileBase(){
  return slug(state.title || 'comparacion') || 'comparacion';
}

/* ---------- bytes y zip: ver app/zip.js (extraído, gatos.pics#26) ---------- */
/* dataURLtoBytes, dataURLMime, strBytes, crc32 y makeZip (streaming por
   entradas) se cargan desde zip.js, antes que este archivo. */

/* ---------- export: HTML / .cmp / .zip ---------- */
/* HTML por partes (gatos.pics#29): el JSON del paquete es un Blob diferido y
   el archivo final se arma cortando el shell en sus dos etiquetas <script>.
   Bytes idénticos a buildStandaloneHTML(pkg): mismos marcadores (únicos en el
   shell), mismo orden de reemplazo, mismo escapado \u003c. */
const UP_TAG = '<script src="upload.js"><\/script>';
const CMP_TAG = '<script src="compare.js"><\/script>';
async function standaloneParts(core){
  const pkg = await packageJSONBlob(core, {htmlSafe:true});
  const shell = SHELL_HTML;
  const i1 = shell.indexOf(UP_TAG), i2 = shell.indexOf(CMP_TAG);
  if (i1 < 0 || i2 < 0 || i2 < i1) throw new Error('El shell del visor no tiene las etiquetas esperadas.');
  return [
    new Blob([shell.slice(0, i1)]),
    '<script>\n' + UPLOAD_SRC + '\n<\/script>',
    shell.slice(i1 + UP_TAG.length, i2),
    new Blob(['<script>window.GATOS_PACKAGE = ', pkg, ';<\/script>\n<script>\n' + ENGINE_SRC + '\n<\/script>']),
    new Blob([shell.slice(i2 + CMP_TAG.length)]),
  ];
}
$('btnExpHtml').addEventListener('click', () => runAction(async () => {
  const core = await packageCore({complete:true});
  download(fileBase()+'.html', new Blob(await standaloneParts(core), {type:'text/html'}));
}));
$('btnExpCmp').addEventListener('click', () => runAction(async () => {
  const core = await packageCore();
  download(fileBase()+'.cmp', await packageJSONBlob(core));
}));

/* ---------- publicar en gatos.pics: ver app/publish.js (extraído, gatos.pics#28) ---------- */
/* El cableado del publisher (GatosUpload), el recibo de publicación y los
   manejadores del panel viven en publish.js, cargado tras este archivo. */

/* guardar / abrir proyecto (.cmp) */
async function saveProject(){
  if (busy){ $('builderStatus').textContent = 'La captura de video está en curso; espera a que termine para guardar.'; return; }
  const core = await packageCore();
  download(fileBase()+'.cmp', await packageJSONBlob(core));
}
$('btnSave').addEventListener('click', () => runAction(saveProject));
$('btnOpen').addEventListener('click', () => $('openFile').click());
$('openFile').addEventListener('change', () => {
  if ($('openFile').files[0]) importCmp($('openFile').files[0]);
  $('openFile').value = '';
});
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')){ e.preventDefault(); runAction(saveProject); }
});
$('btnExpZip').addEventListener('click', () => runAction(async () => {
  const core = await packageCore({complete:true});
  // el visor hospedado resuelve img/<id>_<frame>.<ext>: la extensión va en el
  // manifest por variante, derivada del tipo de los archivos reales
  const fileOf = new Map(core.entries);
  const exts = {};
  for (const v of core.manifest.variants){
    v.image_exts = {};
    for (const f of core.manifest.frames){
      const key = v.id+'_'+f;
      const ext = ((fileOf.get(key) || {type:'image/png'}).type.split('/')[1] || 'png').replace('jpeg','jpg');
      exts[key] = ext; v.image_exts[f] = ext;
    }
    exts[v.id] = v.image_exts[core.manifest.frames[0]];
    v.ext = exts[v.id];
  }
  // entradas diferidas para makeZip: los bytes salen DIRECTO del File
  // (gatos.pics#29): el zip ya no pasa por dataURL en absoluto, cada imagen
  // se lee recién cuando entra al zip y nunca está el paquete en cadenas
  const makers = [
    () => ({name:'index.html', data: strBytes(SHELL_HTML)}),
    () => ({name:'compare.js', data: strBytes(ENGINE_SRC)}),
    () => ({name:'upload.js', data: strBytes(UPLOAD_SRC)}),
    () => ({name:'manifest.json', data: strBytes(JSON.stringify(core.manifest, null, 2))}),
  ];
  for (const [key, f] of core.entries){
    makers.push(async () => ({name:'img/'+key+'.'+exts[key], data: new Uint8Array(await f.arrayBuffer())}));
  }
  let next = 0;
  download(fileBase()+'.zip', await makeZip(async () => next < makers.length ? await makers[next++]() : null));
}));

/* ---------- importar .cmp (en ambos modos) ---------- */
async function importCmp(file){
  if (busy){ $('builderStatus').textContent = 'La captura de video está en curso; espera a que termine para importar.'; return; }
  // Importar sobre trabajo abierto (botón Abrir o drop) tiene que ser una
  // decisión explícita: la pregunta vive aquí, en el único punto de entrada,
  // y cancelar preserva el proyecto tal como estaba.
  if (state.pairs.length || state.cells.size || state.unassigned.length){
    if (!confirm('Abrir este archivo reemplaza el proyecto que tienes abierto. ¿Continuar?')){
      $('builderStatus').textContent = 'No se importó nada: tu proyecto sigue como estaba.';
      return;
    }
  }
  try {
    const pkg = JSON.parse(await readAsText(file));
    if (pkg.format !== FORMAT) { alert('No es un paquete '+FORMAT+'.'); return; }
    if (!pkg.manifest || !Array.isArray(pkg.manifest.frames) || !Array.isArray(pkg.manifest.variants) || !pkg.images)
      throw new Error('Faltan los datos del proyecto.');
    // Los ids llegan de un archivo externo y llegan a innerHTML: sin este
    // filtro, un .cmp hostil inyecta HTML en la matriz (XSS same-origin en /crear/).
    if (pkg.manifest.variants.some(v => !ID_RE.test(String(v.id))) || pkg.manifest.frames.some(f => !ID_RE.test(String(f))))
      throw new Error('identificador de variante o frame no válido: se admite A-Z a-z 0-9 _ y -, máximo 32.');
    const b64toFile = async (key, du) => {
      const {mime, buf} = dataURLtoBytes(du);
      return new File([buf], key.replace(/[\\/:*?"<>|]/g,'_')+'.'+mime.split('/')[1], {type:mime});
    };
      // metricas de archivo externo: el visor las lee asumiendo tipos; un
      // ssimulacra2 no-numerico tumba TODO el export (pf.ssimulacra2.toFixed)
      const cleanMetrics = (m) => {
        if (!m || typeof m !== 'object') return undefined;
        const out = {};
        if (typeof m.ssimulacra2 === 'number' && isFinite(m.ssimulacra2)) out.ssimulacra2 = m.ssimulacra2;
        if (typeof m.custom_note === 'string') out.custom_note = m.custom_note.slice(0,60);
        if (m.per_frame && typeof m.per_frame === 'object'){
          out.per_frame = {};
          for (const [fk, pm] of Object.entries(m.per_frame))
            if (pm && typeof pm === 'object' && typeof pm.ssimulacra2 === 'number' && isFinite(pm.ssimulacra2))
              out.per_frame[fk] = {ssimulacra2: pm.ssimulacra2};
        }
        return Object.keys(out).length ? out : undefined;
      };
      const variants = pkg.manifest.variants.map(v => ({
        id: v.id, name: v.name||'', codec:'', crf:'', bitrate:'', note: v.note||'', cmd: v.cmd||'', metric: (typeof (v.metrics&&v.metrics.custom_note) === 'string' ? v.metrics.custom_note : ''), color: /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : '#7bd389', source: cleanMetrics(v.metrics) ? {...v, metrics: cleanMetrics(v.metrics)} : {...v, metrics: undefined},
      }));
      const frames = pkg.manifest.frames.map(f => ({key:String(f), label:(pkg.manifest.frame_labels||{})[String(f)]||''}));
      const cells = new Map();
      for (const v of variants) for (const fr of frames){
        const du = pkg.images[v.id+'_'+fr.key];
        if (du) cells.set(v.id+'|'+fr.key, await b64toFile(v.id+'_'+fr.key, du));
      }
      // Commit only after every file decoded successfully. Always retain all variants.
      state.title = pkg.manifest.title === 'Comparación' ? '' : (pkg.manifest.title || '');
      state.version = pkg.manifest.version || 1;
      state.manifestExtras = {...pkg.manifest};
      state.variants = variants; state.frames = frames; state.cells = cells;
      state.importedCells = new Map(cells);
      state.unassigned = []; state.pairs = [];
      $('builderStatus').textContent = '';
      setMode('advanced'); $('onboard').hidden = true;
      state.cells.forEach(probeDims);
      nextVar = state.variants.length+1; nextFrame = state.frames.length+1;
      $('pjTitle').value = state.title; $('pjTitleWarn').style.display = state.title.trim()?'none':'';
      $('pjVersion').value = state.version;
      renderVariants(); renderFrames(); renderMatrix();
  } catch (e) { alert('No se pudo leer este paquete: ' + e.message); }
}
window.addEventListener('dragover', e => { if ([...e.dataTransfer.items].some(i => i.kind === 'file')) e.preventDefault(); });
window.addEventListener('drop', e => {
  const f = [...e.dataTransfer.files].find(f => /\.cmp$/i.test(f.name));
  if (!f) return;
  e.preventDefault();
  // el drop en cualquier parte es el camino accidental: importCmp hace la
  // misma pregunta de confirmación que el botón Abrir
  importCmp(f);
});

/* ============================================================
   arranque
   ============================================================ */
ensureSeed();
renderVariants();
renderFrames();
renderMatrix();
renderPairs();
renderSteps();
setMode('basic');
showOnboard(false);
if (new URLSearchParams(location.search).get('demo') === '1') $('obDemo').click();
window.addEventListener('beforeunload', e => {
  /* marcas y archivos sin asignar también son trabajo que se pierde */
  const hasWork = state.pairs.some(p => p[0] || p[1]) || state.cells.size || state.unassigned.length || vidState.marks.length;
  if (hasWork){ e.preventDefault(); e.returnValue = ''; }
});
window.addEventListener('pagehide', () => { for (const u of fileURLs.values()) URL.revokeObjectURL(u); });

/* gancho de prueba/consola: permite manejar la página sin mouse (útil también para usuarios avanzados) */
window.BUILDER = {state, currentPackage, buildStandaloneHTML, addBasicFiles, bulkAdd, importCmp, validateAdvanced, makeDemoPackage, setMode, renderSteps};
