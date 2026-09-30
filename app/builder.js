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
    $('pvBox').srcdoc = buildStandaloneHTML(pkg);
    $('pvFrame').classList.add('show');
    $('onboard').hidden = true;
    btn.disabled = false; btn.textContent = 'Ver un ejemplo';
  }, 30);
});
$('obLoad').addEventListener('click', async () => {
  // cargar el ejemplo como proyecto básico para poder tocarlo
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
});
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

/* básico -> paquete */
async function basicPackage(cancelled = () => false){
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
  const images = {};
  for (let i = 0; i < pairs.length; i++){
    if (cancelled()) throw new Error('Preparación cancelada.');
    if (pairs[i][0]) images['a_'+(i+1)] = await readAsDataURL(pairs[i][0]);
    if (pairs[i][1]) images['b_'+(i+1)] = await readAsDataURL(pairs[i][1]);
  }
  return {format: FORMAT, manifest, images};
}

/* ============================================================
   MODO VIDEO · del video a la comparación
   ============================================================ */
const vidDrop = $('vidDrop'), vidFile = $('vidFile'), vidPlayer = $('vidPlayer');
const vidState = { files: [], marks: [], cur: 0 };
vidDrop.addEventListener('click', () => vidFile.click());
vidFile.addEventListener('change', () => { addVideos([...vidFile.files]); vidFile.value=''; });
['dragover','dragenter'].forEach(ev => vidDrop.addEventListener(ev, e => { e.preventDefault(); vidDrop.classList.add('over'); }));
['dragleave','drop'].forEach(ev => vidDrop.addEventListener(ev, e => { e.preventDefault(); vidDrop.classList.remove('over'); }));
vidDrop.addEventListener('drop', e => addVideos([...e.dataTransfer.files]));

const vidURLs = new Map();
function vidURL(f){ if (!vidURLs.has(f)) vidURLs.set(f, URL.createObjectURL(f)); return vidURLs.get(f); }
const fmtT = t => {
  const m = Math.floor(t/60), s = t - m*60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
};

function addVideos(files){
  const vids = files.filter(f => f.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|m4v)$/i.test(f.name));
  vidState.files.push(...vids);
  renderVidList();
  syncVideoToAdvanced();
  if (vidState.files.length === vids.length && vids.length) showVid(0);
}
function renderVidList(){
  const host = $('vidList');
  host.innerHTML = '';
  vidState.files.forEach((f, i) => {
    const row = document.createElement('div');
    row.className = 'pair';
    const url = vidURL(f);
    row.innerHTML = `<span class="no">${i === 0 ? 'máster' : 'var '+(i)}</span>
      <span class="mono" style="min-width:0; overflow:hidden; text-overflow:ellipsis; max-width:420px;">${esc(f.name)}</span>
      <span class="hint">${(f.size/1048576).toFixed(1)} MB</span>
      <div class="tools">
        <button data-a="up" title="subir">↑</button>
        <button data-a="dn" title="bajar">↓</button>
        <button data-a="rm" title="quitar">×</button>
      </div>`;
    row.querySelector('[data-a=up]').onclick = () => { if (i>0){ [vidState.files[i-1], vidState.files[i]] = [vidState.files[i], vidState.files[i-1]]; renderVidList(); syncVideoToAdvanced(); } };
    row.querySelector('[data-a=dn]').onclick = () => { if (i<vidState.files.length-1){ [vidState.files[i+1], vidState.files[i]] = [vidState.files[i], vidState.files[i+1]]; renderVidList(); syncVideoToAdvanced(); } };
    row.querySelector('[data-a=rm]').onclick = () => { vidState.files.splice(i,1); renderVidList(); syncVideoToAdvanced(); };
    host.appendChild(row);
  });
  $('vidStage').style.display = vidState.files.length ? '' : 'none';
}
function showVid(i){
  vidState.cur = clampV(i);
  const f = vidState.files[vidState.cur];
  if (!f) return;
  vidPlayer.src = vidURL(f);
  $('vidWho').textContent = (vidState.cur === 0 ? 'máster · ' : 'variante '+vidState.cur+' · ') + f.name;
  vidPlayer.onloadedmetadata = () => {
    $('vidDur').textContent = `${vidPlayer.videoWidth}×${vidPlayer.videoHeight} · ${fmtT(vidPlayer.duration)}`;
  };
  vidPlayer.onerror = () => {
    $('vidDur').textContent = 'este navegador no puede abrir este archivo (¿códec o contenedor?) · pruébalo en otro navegador o usa capturas';
  };
}
const clampV = i => Math.max(0, Math.min(vidState.files.length-1, i));
$('vidPrev').addEventListener('click', () => showVid(vidState.cur-1));
$('vidNext').addEventListener('click', () => showVid(vidState.cur+1));

$('vidMark').addEventListener('click', () => {
  const t = vidPlayer.currentTime;
  if (!isFinite(t) || t < 0) return;
  vidState.marks.push(t);
  vidState.marks.sort((a,b) => a-b);
  renderVidMarks();
});
function renderVidMarks(){
  const host = $('vidMarks');
  if (!vidState.marks.length){ host.innerHTML = '<span class="hint">sin marcas · reproduce, pausa donde quieras comparar, y marca</span>'; return; }
  host.innerHTML = vidState.marks.map((t, i) =>
    `<span class="markchip" data-i="${i}" title="clic para saltar ahí">${fmtT(t)} <b data-rm="${i}" title="quitar">×</b></span>`
  ).join(' ');
  host.querySelectorAll('.markchip').forEach(chip => {
    chip.addEventListener('click', e => {
      if (e.target.dataset.rm !== undefined){
        vidState.marks.splice(+e.target.dataset.rm, 1);
        renderVidMarks();
        return;
      }
      vidPlayer.currentTime = vidState.marks[+chip.dataset.i];
    });
  });
}

/* el modo video siembra el estado avanzado: variantes = archivos, frames = marcas */
function syncVideoToAdvanced(){
  if (!vidState.files.length) return;
  const old = new Map(state.variants.map(v => [v.id, v]));
  state.variants = vidState.files.map((f, i) => {
    const id = 'v'+(i+1);
    const o = old.get(id);
    // fusión por id: si la variante ya existe se conserva entera (nombres,
    // notas, colores), no solo los campos técnicos
    return o || {id, name: i === 0 ? 'Máster' : f.name.replace(/\.[^.]+$/, '').slice(0, 24), codec:'', crf:'', bitrate:'', note:'', cmd:'', metric:'', color:PALETTE[i % PALETTE.length]};
  });
  // las variantes que desaparecen llevan sus celdas: sin esto quedan huérfanas
  const live = new Set(state.variants.map(v => v.id));
  for (const k of [...state.cells.keys()]) if (!live.has(k.split('|')[0])) state.cells.delete(k);
  while (state.variants.some(v => v.id === 'v'+nextVar)) nextVar++;   // monótono: nunca reutilizar un id
  renderVariants();
}

/* Seek to a timestamp. This does not establish frame alignment across videos. */
function captureFrame(video, t){
  return new Promise((res, rej) => {
    let finished = false, callback = null, fallback = null;
    const cleanup = () => {
      clearTimeout(timeout); clearTimeout(fallback);
      video.removeEventListener('seeked', seeked); video.removeEventListener('error', failed);
      if (callback != null) video.cancelVideoFrameCallback(callback);
    };
    const finish = error => {
      if (finished) return;
      finished = true; cleanup();
      if (error){ rej(error); return; }
      try {
        if (!video.videoWidth || video.readyState < 2) throw new Error('El video no tiene una imagen decodificada.');
        const c = document.createElement('canvas');
        c.width = video.videoWidth; c.height = video.videoHeight;
        c.getContext('2d').drawImage(video, 0, 0);
        res(c);
      } catch(e){ rej(e); }
    };
    const failed = () => finish(new Error('Error al decodificar el video.'));
    const seeked = () => {
      // Paused, detached videos may not submit another frame to the compositor.
      fallback = setTimeout(() => finish(), 120);
    };
    const timeout = setTimeout(() => finish(new Error('Se agotó el tiempo para buscar la captura.')), 15000);
    if (!Number.isFinite(t) || t < 0 || (Number.isFinite(video.duration) && t >= video.duration)){
      finish(new Error('El tiempo marcado queda fuera de este video.')); return;
    }
    video.addEventListener('error', failed);
    if (!video.seeking && Math.abs(video.currentTime-t) < 0.000001 && video.readyState >= 2){ finish(); return; }
    video.addEventListener('seeked', seeked, {once:true});
    if ('requestVideoFrameCallback' in video){
      callback = video.requestVideoFrameCallback(() => {
        if (!video.seeking && Math.abs(video.currentTime-t) < 0.001) finish();
      });
    }
    try { video.currentTime = t; } catch(e){ finish(e); }
  });
}
function canvasToBlob(c, fmt){
  return new Promise(res => {
    if (fmt === 'jpeg') c.toBlob(b => res(b), 'image/jpeg', 0.92);
    else c.toBlob(b => res(b), 'image/png');
  });
}

$('vidGo').addEventListener('click', async () => {
  if (!vidState.files.length){ $('vidProg').textContent = 'primero suelta los videos'; return; }
  if (!vidState.marks.length){ $('vidProg').textContent = 'primero marca al menos un momento'; return; }
  const fmt = 'png';   // evidencia sin pérdida, siempre
  syncVideoToAdvanced();
  const files = [...vidState.files], variants = [...state.variants];
  const marks = [...new Set(vidState.marks)].map(t => ({t,key:'t'+String(t).replace('.','_')}));
  // Drop only the unused starter frame, keep existing captures and manual rows.
  if (state.frames.length===1 && state.frames[0].key==='1' && !state.frames[0].label && !state.cells.size) state.frames=[];
  const frameKeys = new Set(state.frames.map(f=>f.key));
  for (const {t,key} of marks){
    if (!frameKeys.has(key)){ state.frames.push({key, label:fmtT(t)}); frameKeys.add(key); }
  }
  const btn = $('vidGo');
  btn.disabled = true;
  busy = true;   // gate único: guardar/publicar/importar/vista previa quedan fuera durante el lote
  // Freeze capture inputs while this batch owns the shared project state.
  const controls = [...document.querySelectorAll('#videoView button, #videoView input, #videoView select, #tabBasic, #tabAdv, #btnOpen, #btnSave, #btnPublish, #btnPreviewTop')];
  const disabled = controls.map(el=>el.disabled);
  controls.forEach(el=>el.disabled=true);
  $('vidDrop').style.pointerEvents='none'; $('vidMarks').style.pointerEvents='none';
  let n=0, failures=0;
  const total = files.length * marks.length, host=$('vidResults');
  host.replaceChildren(); $('vidDone').replaceChildren();
  const rows = files.map((file,vi)=>marks.map(({t},mi)=>{
    const row=document.createElement('li');
    row.textContent=`Marca ${mi+1} · ${t.toFixed(3)} s · ${variants[vi].name} (${file.name}): pendiente`;
    const prefix=row.textContent.replace(/pendiente$/,'');
    host.appendChild(row);
    return (message,status) => { row.textContent=prefix+message; row.dataset.status=status; };
  }));
  for (let vi=0;vi<files.length;vi++){
    const f=files[vi], vid=variants[vi];
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto';
    let loadError;
    $('vidProg').textContent = `Abriendo ${f.name}…`;
    try {
      await new Promise((resolve,reject) => {
        const finish = error => {
          clearTimeout(timer); v.onloadeddata=v.onerror=null;
          error ? reject(error) : resolve();
        };
        const timer=setTimeout(()=>finish(new Error('Se agotó el tiempo al abrir el video.')),15000);
        v.onloadeddata=()=>finish();
        v.onerror=()=>finish(new Error('El navegador no pudo abrir o decodificar este archivo (código '+(v.error?.code || 'desconocido')+').'));
        v.src=vidURL(f);
      });
    } catch(e){ loadError=e; }
    for (let mi=0;mi<marks.length;mi++){
      const {t,key}=marks[mi], result=rows[vi][mi];
      result('buscando el instante pedido…','working');
      try {
        if (loadError) throw loadError;
        const c = await captureFrame(v, t);
        const b = await canvasToBlob(c, fmt);
        if (!b) throw new Error('El navegador no pudo generar la imagen.');
        const ext = fmt === 'jpeg' ? 'jpg' : 'png';
        state.cells.set(vid.id+'|'+key, new File([b], `${vid.id}_${key}.${ext}`, {type: b.type}));
        probeDims(state.cells.get(vid.id+'|'+key));
        result('captura lista','ok');
      } catch (err) {
        failures++;
        const previous = state.cells.has(vid.id+'|'+key) ? ' Se conservó la captura anterior.' : '';
        result('Falló: '+err.message+previous,'error');
      }
      n++;
      $('vidProg').textContent = `Capturas procesadas: ${n}/${total}. Fallas: ${failures}.`;
      // Paint each result before proceeding, including consecutive decode errors.
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    v.removeAttribute('src'); v.load();
  }
  controls.forEach((el,i)=>el.disabled=disabled[i]); btn.disabled=false; busy = false;
  $('vidDrop').style.pointerEvents=''; $('vidMarks').style.pointerEvents='';
  renderFrames(); renderMatrix(); renderVariants();
  $('vidProg').textContent = failures
    ? `${n-failures}/${total} capturas listas. Revisa las ${failures} fallas indicadas abajo.`
    : `✓ ${total} capturas listas`;
  $('vidDone').innerHTML = `<button class="primary" id="vidToMatrix">Seguir en Avanzado → revisar imágenes</button>`;
  $('vidToMatrix').onclick = () => { setMode('advanced'); window.BUILDER.renderSteps(); [...document.querySelectorAll('#stepNav button')][3].click(); };
});


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

async function advancedPackage(cancelled = () => false){
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
  const images = {};
  for (const [k, f] of state.cells){
    if (cancelled()) throw new Error('Preparación cancelada.');
    const [vid, fk] = k.split('|');
    images[vid+'_'+fk] = await readAsDataURL(f);
  }
  if ($('s2Toggle') && $('s2Toggle').checked) await computeS2Metrics(manifest);
  return {format: FORMAT, manifest, images};
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
async function currentPackage({complete = false, cancelled = () => false} = {}){
  const mode = packageMode();
  if (complete){
    const problems = mode === 'basic'
      ? (!state.pairs.length || state.pairs.some(p => !p[0] || !p[1]) ? ['Agrega dos imágenes a cada par antes de compartir.'] : [])
      : validateAdvanced().filter(([type]) => type === 'bad').map(([,text]) => text);
    if (problems.length) throw new Error(problems.join(' '));
  }
  return mode === 'basic' ? basicPackage(cancelled) : advancedPackage(cancelled);   // video también alimenta el estado avanzado
}
async function runAction(action){
  $('builderStatus').textContent = '';
  try { await action(); } catch(e){
    $('builderStatus').textContent = e.message;
    $('builderStatus').scrollIntoView({block:'nearest'});
  }
}
function buildStandaloneHTML(pkg){
  const json = JSON.stringify(pkg).replace(/</g, '\\u003c');
  const injection = '<script>window.GATOS_PACKAGE = ' + json + ';<\/script>\n';
  const engineTag = '<script>\n' + ENGINE_SRC + '\n<\/script>';
  return SHELL_HTML
    .replace('<script src="upload.js"><\/script>', () => '<script>\n'+UPLOAD_SRC+'\n<\/script>')
    .replace('<script src="compare.js"><\/script>', () => injection + engineTag);
}
async function openPreviewOverlay(){
  if (busy){ $('builderStatus').textContent = 'La captura de video está en curso; espera a que termine para abrir la vista previa.'; return; }
  const pkg = await currentPackage({complete:true});
  $('pvFrame').classList.add('show');
  $('pvBox').srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#000;color:#9a9aa8;font:14px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}</style></head><body>Generando vista previa…</body></html>';
  $('pvBox').srcdoc = buildStandaloneHTML(pkg);
}
$('pvClose').addEventListener('click', () => { $('pvFrame').classList.remove('show'); $('pvBox').srcdoc = ''; });
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

/* dataURL -> bytes */
function dataURLtoBytes(du){
  const parts = du.split(',');
  const mime = (parts[0].match(/^data:([^;]+)/) || [,'image/png'])[1];
  const bin = atob(parts[1] || '');
  const buf = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) buf[i] = bin.charCodeAt(i);
  return {mime, buf};
}
const te = new TextEncoder();
function strBytes(s){ return te.encode(s); }

/* ---------- zip (sin compresión, sin dependencias) ---------- */
let CRC_T = null;
function crc32(buf){
  if (!CRC_T){
    CRC_T = new Uint32Array(256);
    for (let n = 0; n < 256; n++){
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      CRC_T[n] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function makeZip(entries){
  // entradas: [{name, data:Uint8Array}] · método STORE
  const chunks = [], central = [];
  let offset = 0;
  const enc = new TextEncoder();
  for (const e of entries){
    const nameB = enc.encode(e.name);
    const crc = crc32(e.data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);            // versión necesaria
    lh.setUint16(6, 0x0800, true);        // nombres UTF-8
    lh.setUint16(8, 0, true);             // store
    lh.setUint16(10, 0, true); lh.setUint16(12, 0x2100, true);   // hora/fecha DOS fija
    lh.setUint32(14, crc, true);
    lh.setUint32(18, e.data.length, true);
    lh.setUint32(22, e.data.length, true);
    lh.setUint16(26, nameB.length, true);
    lh.setUint16(28, 0, true);
    chunks.push(new Uint8Array(lh.buffer), nameB, e.data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true); cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true);
    cd.setUint16(12, 0, true); cd.setUint16(14, 0x2100, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, e.data.length, true); cd.setUint32(24, e.data.length, true);
    cd.setUint16(28, nameB.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nameB);
    offset += 30 + nameB.length + e.data.length;
  }
  const cdStart = offset;
  let cdLen = 0;
  for (const c of central) cdLen += c.length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, cdLen, true);
  end.setUint32(16, cdStart, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], {type:'application/zip'});
}

/* ---------- export: HTML / .cmp / .zip ---------- */
$('btnExpHtml').addEventListener('click', () => runAction(async () => {
  const pkg = await currentPackage({complete:true});
  download(fileBase()+'.html', new Blob([buildStandaloneHTML(pkg)], {type:'text/html'}));
}));
$('btnExpCmp').addEventListener('click', async () => {
  const pkg = await currentPackage();
  download(fileBase()+'.cmp', new Blob([JSON.stringify(pkg)], {type:'application/json'}));
});

/* ---------- publicar en gatos.pics ---------- */
const serviceHere = location.hostname === 'gatos.pics' ||
  (['localhost','127.0.0.1'].includes(location.hostname) && location.pathname.startsWith('/crear'));
const PUBLISH_URL = serviceHere ? '/api/upload' : 'https://gatos.pics/api/upload';
let publicationReceipt = null;
const publisher = new GatosUpload({
  panel:$('publishUpload'), progress:$('publishProgress'), status:$('publishStatus'),
  cancel:$('publishCancel'), retry:$('publishRetry'),
  retryCaution:'El servidor pudo recibir el paquete. Reintentar puede crear otra página.',
  onApiKeyRequired: () => { setTimeout(askApiKeyAndRetry, 400); },
  onBusy:busy => { for (const id of ['btnPublish','btnPublish2']) $(id).disabled = busy; },
  onSuccess:(j, meta) => {
    $('pubUrl').value = j.url;
    $('pubKey').value = j.delete_key;
    publicationReceipt = {url:j.url, delete_url:j.delete_url, delete_key:j.delete_key};
    try { localStorage.setItem('gatosOwner:'+j.token, j.delete_key); } catch(e){}
    $('pubDel').textContent = 'curl -X DELETE -H "x-delete-key: ' + j.delete_key + '" ' + j.delete_url;
    // formatos para compartir: vista previa clicable con la primera variante/frame
    const img = j.url + meta.image;
    const title = meta.title;
    $('pubBB').value = '[url=' + j.url + '][img]' + img + '[/img][/url]';
    $('pubMD').value = '[![' + title + '](' + img + ')](' + j.url + ')';
    $('pubHTML').value = '<a href="' + esc(j.url) + '"><img src="' + esc(img) + '" alt="' + esc(title) + '" loading="lazy"></a>';
    $('pubFrame').style.display = 'flex';
  }
});
function publishPage(){
  if (busy){ $('builderStatus').textContent = 'La captura de video está en curso; espera a que termine para publicar.'; return; }
  publisher.start(async cancelled => {
    const pkg = await currentPackage({complete:true, cancelled});
    if (cancelled()) return;
    const v = pkg.manifest.variants[0], f = pkg.manifest.frames[0];
    const ext = pkg.images[v.id+'_'+f].slice(0,40).match(/^data:image\/([^;]+)/)[1].replace('jpeg','jpg');
    let apiKey = '';
    try { apiKey = localStorage.getItem('gatosApiKey') || ''; } catch(e){}
    return {url:PUBLISH_URL, headers:{'content-type':'application/json', ...(apiKey ? { 'x-api-key': apiKey } : {})},
      body:new Blob([JSON.stringify(pkg)], {type:'application/json'}),
      meta:{title:pkg.manifest.title || 'Comparación', image:'img/'+v.id+'_'+f+'.'+ext}};
  });
  $('publishUpload').scrollIntoView({block:'nearest'});
}
$('btnPublish').addEventListener('click', publishPage);
$('btnPublish2').addEventListener('click', publishPage);
$('pubClose').addEventListener('click', () => { $('pubFrame').style.display = 'none'; });
$('pubOpen').addEventListener('click', () => { window.open($('pubUrl').value, '_blank'); });
$('pubReceipt').addEventListener('click', () => {
  if (publicationReceipt) download('gatos-publicacion.json', new Blob([JSON.stringify(publicationReceipt,null,2)], {type:'application/json'}));
});
$('pubCopy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('pubUrl').value);
    $('pubCopy').textContent = '✓';
    setTimeout(() => { $('pubCopy').textContent = 'Copiar'; }, 1200);
  } catch(e){}
});

/* guardar / abrir proyecto (.cmp) */
async function saveProject(){
  if (busy){ $('builderStatus').textContent = 'La captura de video está en curso; espera a que termine para guardar.'; return; }
  const pkg = await currentPackage();
  download(fileBase()+'.cmp', new Blob([JSON.stringify(pkg)], {type:'application/json'}));
}
$('btnSave').addEventListener('click', saveProject);
$('btnOpen').addEventListener('click', () => $('openFile').click());
$('openFile').addEventListener('change', () => {
  if ($('openFile').files[0]) importCmp($('openFile').files[0]);
  $('openFile').value = '';
});
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')){ e.preventDefault(); saveProject(); }
});
$('btnExpZip').addEventListener('click', () => runAction(async () => {
  const pkg = await currentPackage({complete:true});
  // el visor hospedado resuelve img/<id>_<frame>.<ext>: la extensión va en el
  // manifest por variante, derivada de los archivos reales
  const exts = {};
  for (const v of pkg.manifest.variants){
    v.image_exts = {};
    for (const f of pkg.manifest.frames){
      const key = v.id+'_'+f;
      const ext = dataURLtoBytes(pkg.images[key]).mime.split('/')[1].replace('jpeg','jpg');
      exts[key] = ext; v.image_exts[f] = ext;
    }
    exts[v.id] = v.image_exts[pkg.manifest.frames[0]];
    v.ext = exts[v.id];
  }
  const entries = [
    {name:'index.html', data: strBytes(SHELL_HTML)},
    {name:'compare.js', data: strBytes(ENGINE_SRC)},
    {name:'upload.js', data: strBytes(UPLOAD_SRC)},
    {name:'manifest.json', data: strBytes(JSON.stringify(pkg.manifest, null, 2))},
  ];
  for (const [key, du] of Object.entries(pkg.images)){
    const {buf} = dataURLtoBytes(du);
    entries.push({name:'img/'+key+'.'+exts[key], data: buf});
  }
  download(fileBase()+'.zip', makeZip(entries));
}));

/* ---------- importar .cmp (en ambos modos) ---------- */
async function importCmp(file){
  if (busy){ $('builderStatus').textContent = 'La captura de video está en curso; espera a que termine para importar.'; return; }
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
      const variants = pkg.manifest.variants.map(v => ({
        id: v.id, name: v.name||'', codec:'', crf:'', bitrate:'', note: v.note||'', cmd: v.cmd||'', metric: (v.metrics && v.metrics.custom_note) || '', color: /^#[0-9a-f]{6}$/i.test(v.color) ? v.color : '#7bd389', source:{...v},
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
  // el drop en cualquier parte es el camino accidental: con trabajo abierto,
  // reemplazar el proyecto tiene que ser una decisión explícita
  if (state.cells.size || state.pairs.length){
    if (confirm('Soltar este archivo reemplaza el proyecto que tienes abierto. ¿Continuar?')) importCmp(f);
    else $('builderStatus').textContent = 'No se importó nada: tu proyecto sigue como estaba.';
    return;
  }
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
renderVidMarks();
setMode('basic');
showOnboard(false);
if (new URLSearchParams(location.search).get('demo') === '1') $('obDemo').click();
window.addEventListener('beforeunload', e => {
  const hasWork = state.pairs.some(p => p[0] || p[1]) || state.cells.size;
  if (hasWork){ e.preventDefault(); e.returnValue = ''; }
});
window.addEventListener('unload', () => { for (const u of fileURLs.values()) URL.revokeObjectURL(u); });

/* gancho de prueba/consola: permite manejar la página sin mouse (útil también para usuarios avanzados) */
window.BUILDER = {state, currentPackage, buildStandaloneHTML, addBasicFiles, bulkAdd, importCmp, validateAdvanced, makeDemoPackage, setMode, renderSteps};
