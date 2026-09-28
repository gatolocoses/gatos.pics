'use strict';
/* ============================================================
   gatos.pics creador — JS puro, sin dependencias.
   Construye el mismo paquete que consume el motor del visor:
   {format, manifest:{title, version, frames, frame_labels, variants},
    images:{"<id>_<frame>": dataURL}}
   assets.js (generado) define SHELL_HTML y ENGINE_SRC.
   ============================================================ */
const $ = id => document.getElementById(id);

const PALETTE = ['#7bd389','#7bb3ff','#f0b429','#e879a6','#67e8f9','#fb923c','#b79bff','#ff5d5d'];
const FORMAT = 'gatos.pics/cmp@1';

const state = {
  mode: 'basic',
  title: '',
  version: 1,
  /* avanzado */
  variants: [],          // {id, name, codec, crf, bitrate, note, cmd, color}
  frames: [],            // {key, label}
  cells: new Map(),      // "vid|fkey" -> File
  unassigned: [],        // {file, why}
  /* básico */
  pairs: [],             // [File|null, File|null]
};
let nextVar = 1, nextFrame = 1;

const slug = s => String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

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
      return new File([buf], 'ejemplo_'+f+'.jpg', {type:'image/jpeg'});
    };
    state.pairs.push([await toFile(fa), await toFile(fb)]);
  }
  renderPairs();
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
    x.fillText('ejemplo sintético — nada real', 26, 42);
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
    images['src_'+f] = srcC.toDataURL('image/jpeg', 0.92);
    images['enc_'+f] = encC.toDataURL('image/jpeg', 0.72);
    // S2 real del par sintético (determinista: los mismos números en toda máquina)
    const sc = S2.score(srcC.getContext('2d').getImageData(0, 0, W, H),
                        encC.getContext('2d').getImageData(0, 0, W, H));
    per[f] = {ssimulacra2: Math.round(sc*100)/100};
    sum += sc;
  }
  return {
    format: FORMAT,
    manifest: {
      title: 'gatos.pics — ejemplo',
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

/* ---------- archivos ---------- */
const fileURLs = new Map();   // File -> object URL (miniaturas)
function thumb(f){ if (f && !fileURLs.has(f)) fileURLs.set(f, URL.createObjectURL(f)); return f ? fileURLs.get(f) : ''; }
const fileDims = new Map();   // File -> "WxH"
function probeDims(f){
  if (!f || fileDims.has(f)) return;
  const im = new Image();
  im.onload = () => fileDims.set(f, im.naturalWidth+'x'+im.naturalHeight);
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
  $('tabBasic').classList.toggle('primary', m==='basic');
  $('tabVideo').classList.toggle('primary', m==='video');
  $('tabAdv').classList.toggle('primary', m==='advanced');
  $('basicView').style.display = m==='basic' ? '' : 'none';
  $('videoView').style.display = m==='video' ? '' : 'none';
  $('advView').style.display = m==='advanced' ? '' : 'none';
}
$('tabBasic').addEventListener('click', () => setMode('basic'));
$('tabVideo').addEventListener('click', () => setMode('video'));
$('tabAdv').addEventListener('click', () => setMode('advanced'));

/* ============================================================
   MODO BÁSICO — pares, nada más
   ============================================================ */
const basicDrop = $('basicDrop'), basicFile = $('basicFile');
basicDrop.addEventListener('click', () => basicFile.click());
basicFile.addEventListener('change', () => { addBasicFiles([...basicFile.files]); basicFile.value=''; });
['dragover','dragenter'].forEach(ev => basicDrop.addEventListener(ev, e => { e.preventDefault(); basicDrop.classList.add('over'); }));
['dragleave','drop'].forEach(ev => basicDrop.addEventListener(ev, e => { e.preventDefault(); basicDrop.classList.remove('over'); }));
basicDrop.addEventListener('drop', e => addBasicFiles([...e.dataTransfer.files]));

function addBasicFiles(files){
  const imgs = files.filter(f => f.type.startsWith('image/'));
  imgs.forEach(probeDims);
  const loose = [...imgs];
  // completa primero el par cojo del final
  for (let i = state.pairs.length-1; i >= 0; i--){
    const p = state.pairs[i];
    if (p[0] && !p[1] && loose.length){ p[1] = loose.shift(); }
  }
  while (loose.length >= 2) state.pairs.push([loose.shift(), loose.shift()]);
  if (loose.length) state.pairs.push([loose.shift(), null]);
  renderPairs();
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
      s.innerHTML = f ? `<img src="${thumb(f)}" alt="">` : 'vacío';
      s.title = f ? f.name + (fileDims.get(f) ? ' — '+fileDims.get(f) : '') : 'clic para elegir una imagen';
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
    tools.append(up, dn, rm);
    row.appendChild(tools);
    host.appendChild(row);
  });
  const foot = $('basicFoot');
  const half = state.pairs.some(p => !p[0] || !p[1]);
  const dims = new Set([...state.pairs.flat()].filter(Boolean).map(f => fileDims.get(f)).filter(Boolean));
  let h = '';
  if (half) h += `<div class="warn">A un par le falta una imagen — se verá un lado vacío. Suelta una imagen más para completarlo.</div>`;
  if (dims.size > 1) h += `<div class="warn">Las imágenes tienen tamaños distintos (${[...dims].join(', ')}) — el diff y los recortes 1:1 necesitan dimensiones idénticas.</div>`;
  if (state.pairs.length && !half){
    h += `<div class="okline">${state.pairs.length} par${state.pairs.length>1?'es':''} listo${state.pairs.length>1?'s':''} — y exporta cuando quieras:</div>`;
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
async function basicPackage(){
  const pairs = state.pairs.filter(p => p[0] && p[1]);
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
    images['a_'+(i+1)] = await readAsDataURL(pairs[i][0]);
    images['b_'+(i+1)] = await readAsDataURL(pairs[i][1]);
  }
  return {format: FORMAT, manifest, images};
}

/* ============================================================
   MODO VIDEO — del video a la comparación
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
    $('vidDur').textContent = 'este navegador no puede abrir este archivo (¿códec o contenedor?) — pruébalo en otro navegador o usa capturas';
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
  if (!vidState.marks.length){ host.innerHTML = '<span class="hint">sin marcas — reproduce, pausa donde quieras comparar, y marca</span>'; return; }
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
  state.variants = vidState.files.map((f, i) => {
    const id = 'v'+(i+1);
    const old = state.variants.find(v => v.id === id);
    return Object.assign({id, name: i === 0 ? 'Máster' : f.name.replace(/\.[^.]+$/, '').slice(0, 24), codec:'', crf:'', bitrate:'', note:'', cmd:'', color:PALETTE[i % PALETTE.length]}, old ? {codec: old.codec, crf: old.crf, bitrate: old.bitrate, cmd: old.cmd} : {});
  });
  nextVar = state.variants.length+1;
  renderVariants();
}

/* captura un frame exacto: seek + (requestVideoFrameCallback si existe) + drawImage */
function captureFrame(video, t){
  return new Promise((res, rej) => {
    const done = () => {
      const c = document.createElement('canvas');
      c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0);
      res(c);
    };
    const to = setTimeout(() => rej(new Error('timeout al buscar el frame')), 15000);
    video.currentTime = t;
    video.onseeked = () => {
      if ('requestVideoFrameCallback' in video){
        video.requestVideoFrameCallback(() => { clearTimeout(to); done(); });
        // si rVFC no llega (frame ya presentado), cae por el timeout corto
        setTimeout(() => { clearTimeout(to); done(); }, 700);
      } else {
        setTimeout(() => { clearTimeout(to); done(); }, 120);
      }
    };
    video.onerror = () => { clearTimeout(to); rej(new Error('error de decodificación')); };
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
  const fmt = $('vidFmt').value;
  syncVideoToAdvanced();
  // frames desde las marcas: clave = centésimas de segundo
  for (const t of vidState.marks){
    const key = String(Math.round(t*100));
    if (!state.frames.some(f => f.key === key))
      state.frames.push({key, label: fmtT(t)});
  }
  state.frames.sort((a,b) => parseInt(a.key,10) - parseInt(b.key,10));
  const btn = $('vidGo');
  btn.disabled = true;
  let n = 0, fails = [];
  const total = vidState.files.length * vidState.marks.length;
  for (const f of vidState.files){
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto';
    v.src = vidURL(f);
    await new Promise(r => { v.onloadeddata = r; v.onerror = r; });
    const vid = state.variants.find(x => vidState.files.indexOf(f)+1 === +x.id.slice(1));
    if (!vid){ continue; }
    for (const t of vidState.marks){
      try {
        const c = await captureFrame(v, t);
        const b = await canvasToBlob(c, fmt);
        const ext = fmt === 'jpeg' ? 'jpg' : 'png';
        state.cells.set(vid.id+'|'+String(Math.round(t*100)), new File([b], `${vid.id}_${Math.round(t*100)}.${ext}`, {type: b.type}));
        probeDims(state.cells.get(vid.id+'|'+String(Math.round(t*100))));
      } catch (err) {
        fails.push(f.name+' @'+fmtT(t));
      }
      n++;
      $('vidProg').textContent = `capturando… ${n}/${total}`;
    }
    v.removeAttribute('src'); v.load();
  }
  btn.disabled = false;
  renderFrames(); renderMatrix(); renderVariants();
  $('vidProg').textContent = fails.length
    ? `listo con ${fails.length} falla${fails.length>1?'s':''}: ${fails.slice(0,3).join(' · ')}${fails.length>3?'…':''}`
    : `✓ ${total} capturas listas`;
  $('vidDone').innerHTML = `<button class="primary" id="vidToMatrix">Seguir en Avanzado → revisar imágenes</button>`;
  $('vidToMatrix').onclick = () => { setMode('advanced'); window.BUILDER.renderSteps(); [...document.querySelectorAll('#stepNav button')][3].click(); };
});


/* ============================================================
   MODO AVANZADO — pasos
   ============================================================ */
const STEPS = ['Proyecto','Variantes','Frames','Imágenes','Final'];
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
}

/* ---------- paso: proyecto ---------- */
$('pjTitle').addEventListener('input', () => { state.title = $('pjTitle').value; $('pjTitleWarn').style.display = state.title.trim() ? 'none' : ''; });
$('pjVersion').addEventListener('change', () => { state.version = Math.max(1, parseInt($('pjVersion').value)||1); });
$('pjBump').addEventListener('click', () => { state.version++; $('pjVersion').value = state.version; });

/* ---------- paso: variantes ---------- */
function defVariant(){
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
        <input type="text" class="opt" data-k="codec" placeholder="codec" value="${esc(v.codec)}" title="codec — p. ej. AV1, x264, HEVC">
        <input type="text" class="opt" data-k="crf" placeholder="CRF" value="${esc(v.crf)}" title="número de calidad">
        <input type="text" class="opt" data-k="bitrate" placeholder="Mb/s" value="${esc(v.bitrate)}" title="bitrate">
        <button class="iconbtn" data-a="up" title="subir">↑</button>
        <button class="iconbtn" data-a="dn" title="bajar">↓</button>
        <button class="iconbtn" data-a="rm" title="quitar">×</button>
      </div>
      <div class="vrow2">
        <span class="hint">${esc(v.id)}${badge}</span>
        <input type="text" data-k="note" placeholder="nota extra — sale bajo el botón" value="${esc(v.note)}">
        <input type="text" class="mono" data-k="cmd" placeholder="comando del encoder (tooltip)" value="${esc(v.cmd)}">
        <input type="text" data-k="metric" placeholder="métrica propia (p. ej. VMAF 96.2) — opcional" value="${esc(v.metric)}" title="se muestra bajo el nombre de la variante; S2 del toggle se suma a esto" style="grid-column: 2 / 4;">
      </div>`;
    card.querySelector('.dot').onclick = () => {
      v.color = PALETTE[(PALETTE.indexOf(v.color)+1) % PALETTE.length];
      renderVariants();
    };
    card.querySelectorAll('input[data-k]').forEach(inp => {
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
  const bare = state.variants.filter(v => !variantNote(v));
  if (bare.length && state.variants.length >= 2)
    lines.push(`<div class="warn">${bare.length} variante${bare.length>1?'s':''} sin codec/CRF/bitrate — la página funciona, pero se ve mejor con ellos.</div>`);
  if (state.variants.length >= 2 && state.variants.every(v => !v.cmd.trim()))
    lines.push(`<div class="warn">Sin comandos del encoder — opcional, pero los tooltips se ven mejor con ellos.</div>`);
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
      <input type="text" class="mono" data-k="key" placeholder="1" value="${esc(fr.key)}" title="número del frame — se usa en los nombres de archivo">
      <input type="text" data-k="label" placeholder="etiqueta (opcional — p. ej. escena oscura, primer plano de grano)" value="${esc(fr.label)}">
      <button class="iconbtn" data-a="up" title="subir">↑</button>
      <button class="iconbtn" data-a="dn" title="bajar">↓</button>
      <button class="iconbtn" data-a="rm" title="quitar">×</button>`;
    row.querySelectorAll('input[data-k]').forEach(inp => {
      inp.addEventListener('input', () => {
        const old = fr.key;
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
  const noLabel = state.frames.filter(f => !f.label.trim()).length;
  w.innerHTML = state.frames.length < 1 ? `<div class="err">Hace falta al menos un frame.</div>`
    : noLabel ? `<div class="warn">${noLabel} frame${noLabel>1?'s':''} sin etiqueta — el botón muestra el número. Se ve mejor con una.</div>`
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

function matchVariant(token){
  const t = slug(token);
  if (!t) return null;
  return state.variants.find(v => v.id === t)
      || state.variants.find(v => slug(v.name) === t)
      || state.variants.find(v => slug(v.name).startsWith(t) && t.length >= 3)
      || null;
}
function matchFrame(token){
  const t = slug(token);
  if (!t) return null;
  return state.frames.find(f => slug(f.key) === t)
      || state.frames.find(f => slug(f.label) === t)
      || null;
}
function bulkAdd(files){
  const imgs = files.filter(f => f.type.startsWith('image/'));
  const misses = [];
  const createdV = new Set(), createdF = new Set();
  for (const f of imgs){
    const stem = f.name.replace(/\.[^.]+$/, '');
    const cut = stem.lastIndexOf('_');
    if (cut > 0){
      let v = matchVariant(stem.slice(0, cut));
      let fr = matchFrame(stem.slice(cut+1));
      // lo que no existe, se crea: soltar todo y que la tabla se arme sola
      if (!v && slug(stem.slice(0, cut)).length >= 2){
        const id = 'v'+(nextVar++);
        v = {id, name: stem.slice(0, cut).replace(/[-_]+/g,' ').replace(/\b\w/g, c=>c.toUpperCase()),
             codec:'', crf:'', bitrate:'', note:'', cmd:'', color:PALETTE[(nextVar-2) % PALETTE.length]};
        state.variants.push(v); createdV.add(v.name);
      }
      if (!fr && slug(stem.slice(cut+1)).length >= 1){
        const key = stem.slice(cut+1).trim();
        if (!state.frames.some(x => x.key === key)){
          state.frames.push({key, label:''}); createdF.add(key);
        }
        fr = matchFrame(key);
      }
      if (v && fr){ state.cells.set(v.id+'|'+fr.key, f); probeDims(f); continue; }
    }
    const why = cut > 0
      ? 'no se pudo interpretar el nombre — se espera <variante>_<frame>'
      : 'nombre sin guion bajo — se espera <variante>_<frame>';
    misses.push({file:f, why});
  }
  // frames numericos en orden natural tras el volcado
  if (createdF.size && state.frames.every(fr => /^\d+$/.test(fr.key)))
    state.frames.sort((a,b) => parseInt(a.key,10) - parseInt(b.key,10));
  state.unassigned.push(...misses);
  renderMatrix(); renderVariants(); renderFrames();
  return {createdV: [...createdV], createdF: [...createdF], misses: misses.length};
}
function renderMatrix(){
  const host = $('matrix');
  if (!state.variants.length || !state.frames.length){ host.innerHTML = '<p class="hint">Primero define variantes y frames.</p>'; return; }
  let html = '<table class="mtx"><tr><th></th>';
  for (const v of state.variants) html += `<th><span style="color:${v.color}">\u25CF</span> ${esc(v.name || v.id)}</th>`;
  html += '</tr>';
  for (const fr of state.frames){
    html += `<tr><th class="mono">${esc(fr.key)}${fr.label ? '<br><span style="font-weight:400">'+esc(fr.label)+'</span>' : ''}</th>`;
    for (const v of state.variants){
      const f = state.cells.get(v.id+'|'+fr.key);
      html += `<td><div class="cell ${f?'filled':'empty'}" data-cell="${v.id}|${esc(fr.key)}">${
        f ? `<img src="${thumb(f)}" alt=""><button class="rm" title="quitar">×</button>` : 'suelta / clic'
      }</div></td>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  host.innerHTML = html;
  host.querySelectorAll('.cell').forEach(cell => {
    const key = cell.dataset.cell;
    cell.addEventListener('click', e => {
      if (e.target.classList.contains('rm')){ state.cells.delete(key); renderMatrix(); return; }
      pickOne(file => { state.cells.set(key, file); probeDims(file); renderMatrix(); });
    });
    cell.addEventListener('dragover', e => { e.preventDefault(); cell.classList.add('over'); });
    cell.addEventListener('dragleave', () => cell.classList.remove('over'));
    cell.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation(); cell.classList.remove('over');
      const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
      if (f){ state.cells.set(key, f); probeDims(f); renderMatrix(); }
    });
  });
  /* archivos sin asignar */
  const un = $('unassigned');
  if (state.unassigned.length){
    let h = '<div class="card"><b>Archivos sin asignar</b><ul style="list-style:none;margin-top:6px;">';
    state.unassigned.forEach((u, i) => {
      h += `<li style="display:flex;gap:8px;align-items:center;margin:4px 0;flex-wrap:wrap;">
        <img src="${thumb(u.file)}" style="width:54px;height:32px;object-fit:contain;border-radius:4px;background:#000;">
        <span class="mono" style="min-width:0;overflow:hidden;text-overflow:ellipsis;max-width:280px;">${esc(u.file.name)}</span>
        <span class="hint">${esc(u.why)}</span>
        <span style="margin-left:auto;"></span>
        <select data-i="${i}" data-w="v" class="asSel">
          <option value="">variante…</option>${state.variants.map(v=>`<option value="${v.id}">${esc(v.name||v.id)}</option>`).join('')}
        </select>
        <select data-i="${i}" data-w="f" class="asSel">
          <option value="">frame…</option>${state.frames.map(f=>`<option value="${esc(f.key)}">${esc(f.key)}${f.label?' — '+esc(f.label):''}</option>`).join('')}
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
        state.cells.set(vs.value+'|'+fs.value, state.unassigned[i].file);
        state.unassigned.splice(i,1);
        renderMatrix();
      }
    }));
    un.querySelectorAll('button[data-rm]').forEach(b => b.addEventListener('click', () => { state.unassigned.splice(+b.dataset.rm,1); renderMatrix(); }));
  } else un.innerHTML = '';
}

/* ---------- avanzado -> paquete ---------- */
/* ---------- S2 (SSIMULACRA2) opcional ---------- */
const idCache = new Map();   // File -> ImageData
async function imageDataOf(f){
  if (!idCache.has(f)) idCache.set(f, await S2.imageDataFrom(f));
  return idCache.get(f);
}
const s2Cache = new Map();   // "fa|fb" (identidad de File) -> score
async function s2Of(fa, fb){
  const key = fa.name + '\u0000' + fb.name + '\u0000' + fa.size + '\u0000' + fb.size + '\u0000' + fa.lastModified + '\u0000' + fb.lastModified;
  if (!s2Cache.has(key)){
    s2Cache.set(key, S2.score(await imageDataOf(fa), await imageDataOf(fb)));
  }
  return s2Cache.get(key);
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

async function advancedPackage(){
  const manifest = {
    title: state.title.trim() || 'Comparación',
    version: state.version,
    frames: state.frames.map(f => f.key),
    frame_labels: Object.fromEntries(state.frames.filter(f => f.label.trim()).map(f => [f.key, f.label.trim()])),
    variants: state.variants.map(v => {
      const o = {id: v.id, name: v.name.trim() || v.id, color: v.color};
      const n = variantNote(v);
      if (n) o.note = n;
      if (v.cmd.trim()) o.cmd = v.cmd.trim();
      if (v.metric.trim()) o.metrics = Object.assign(o.metrics || {}, {custom_note: v.metric.trim().slice(0, 60)});
      return o;
    }),
  };
  const images = {};
  for (const [k, f] of state.cells){
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
  if (missing.length) out.push(['bad', `${missing.length} casilla${missing.length>1?'s':''} vacía${missing.length>1?'s':''} — ahí la página mostrará un cuadro roto.`]);
  else if (state.variants.length && state.frames.length) out.push(['good', `Las ${state.variants.length * state.frames.length} casillas llenas.`]);
  if (state.variants.length < 2) out.push(['bad','Hacen falta al menos dos variantes.']);
  if (!state.frames.length) out.push(['bad','Hace falta al menos un frame.']);
  if (!state.title.trim()) out.push(['warnl','Sin título — la página se ve mejor con uno.']);
  const bare = state.variants.filter(v => !variantNote(v)).length;
  if (bare) out.push(['warnl',`${bare} variante${bare>1?'s':''} sin codec/CRF/bitrate — se ve mejor con ellos.`]);
  const dims = new Set([...state.cells.values()].map(f => fileDims.get(f)).filter(Boolean));
  if (dims.size > 1) out.push(['bad',`Tamaños de imagen mezclados (${[...dims].join(', ')}) — el diff y los recortes 1:1 necesitan dimensiones idénticas.`]);
  let total = 0; for (const f of state.cells.values()) total += f.size;
  out.push([total > 60*1048576 ? 'warnl' : 'good', `Tamaño del paquete ≈ ${(total*1.34/1048576).toFixed(1)} MB en base64.`]);
  if (total > 60*1048576) out.push(['warnl','Pesado — considera menos frames o imágenes más chicas.']);
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
async function currentPackage(){
  return state.mode === 'basic' ? basicPackage() : advancedPackage();   // video también alimenta el estado avanzado
}
function buildStandaloneHTML(pkg){
  const json = JSON.stringify(pkg).replace(/</g, '\\u003c');
  const injection = '<script>window.GATOS_PACKAGE = ' + json + ';<\/script>\n';
  const engineTag = '<script>\n' + ENGINE_SRC + '\n<\/script>';
  return SHELL_HTML.replace('<script src="compare.js"><\/script>', injection + engineTag);
}
async function openPreviewOverlay(){
  $('pvFrame').classList.add('show');
  $('pvBox').srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#000;color:#9a9aa8;font:14px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}</style></head><body>Generando vista previa…</body></html>';
  const pkg = await currentPackage();
  $('pvBox').srcdoc = buildStandaloneHTML(pkg);
}
$('pvClose').addEventListener('click', () => { $('pvFrame').classList.remove('show'); $('pvBox').srcdoc = ''; });
$('btnPreviewTop').addEventListener('click', openPreviewOverlay);
$('btnPreview').addEventListener('click', openPreviewOverlay);

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
  // entradas: [{name, data:Uint8Array}] — método STORE
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
$('btnExpHtml').addEventListener('click', async () => {
  const pkg = await currentPackage();
  download(fileBase()+'.html', new Blob([buildStandaloneHTML(pkg)], {type:'text/html'}));
});
$('btnExpCmp').addEventListener('click', async () => {
  const pkg = await currentPackage();
  download(fileBase()+'.cmp', new Blob([JSON.stringify(pkg)], {type:'application/json'}));
});

/* ---------- publicar en gatos.pics ---------- */
const PUBLISH_URL = 'https://gatos.pics/api/upload';
async function publishPage(btn, label){
  const orig = label || btn.textContent;
  btn.disabled = true; btn.textContent = 'Publicando…';
  try {
    const pkg = await currentPackage();
    const r = await fetch(PUBLISH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(pkg),
    });
    let j = null;
    try { j = await r.json(); } catch(e){}
    if (!r.ok){
      const msg = (j && j.error) ? j.error : ('HTTP ' + r.status);
      throw new Error(r.status === 429 ? 'demasiadas publicaciones desde tu IP — espera un rato' : msg);
    }
    $('pubUrl').value = j.url;
    $('pubKey').value = j.delete_key;
    $('pubDel').textContent = 'curl -X DELETE -H "x-delete-key: ' + j.delete_key + '" ' + j.delete_url;
    // formatos para compartir: vista previa clicable con la primera variante/frame
    const v0 = pkg.manifest.variants[0], f0 = pkg.manifest.frames[0];
    const ext = (v0.ext || 'png');
    const img = j.url + 'img/' + v0.id + '_' + f0 + '.' + ext;
    const title = pkg.manifest.title || 'Comparación';
    $('pubBB').value = '[url=' + j.url + '][img]' + img + '[/img][/url]';
    $('pubMD').value = '[![' + title + '](' + img + ')](' + j.url + ')';
    $('pubHTML').value = '<a href="' + j.url + '"><img src="' + img + '" alt="' + title + '" loading="lazy"></a>';
    $('pubFrame').style.display = 'flex';
  } catch (e) {
    alert('No se pudo publicar: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}
$('btnPublish').addEventListener('click', e => publishPage(e.target));
$('btnPublish2').addEventListener('click', e => publishPage(e.target));
$('pubClose').addEventListener('click', () => { $('pubFrame').style.display = 'none'; });
$('pubOpen').addEventListener('click', () => { window.open($('pubUrl').value, '_blank'); });
$('pubCopy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('pubUrl').value);
    $('pubCopy').textContent = '✓';
    setTimeout(() => { $('pubCopy').textContent = 'Copiar'; }, 1200);
  } catch(e){}
});

/* guardar / abrir proyecto (.cmp) */
async function saveProject(){
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
$('btnExpZip').addEventListener('click', async () => {
  const pkg = await currentPackage();
  // el visor hospedado resuelve img/<id>_<frame>.<ext>: la extensión va en el
  // manifest por variante, derivada de los archivos reales
  const exts = {};
  for (const v of pkg.manifest.variants){
    const anyKey = Object.keys(pkg.images).find(k => k.startsWith(v.id+'_'));
    const du = anyKey ? pkg.images[anyKey] : null;
    exts[v.id] = du ? (dataURLtoBytes(du).mime.split('/')[1] || 'png').replace('jpeg','jpg') : 'png';
    v.ext = exts[v.id];
  }
  const entries = [
    {name:'index.html', data: strBytes(SHELL_HTML)},
    {name:'compare.js', data: strBytes(ENGINE_SRC)},
    {name:'manifest.json', data: strBytes(JSON.stringify(pkg.manifest, null, 2))},
  ];
  for (const [key, du] of Object.entries(pkg.images)){
    const {buf} = dataURLtoBytes(du);
    const vid = key.slice(0, key.lastIndexOf('_'));
    entries.push({name:'img/'+key+'.'+(exts[vid]||'png'), data: buf});
  }
  download(fileBase()+'.zip', makeZip(entries));
});

/* ---------- importar .cmp (en ambos modos) ---------- */
async function importCmp(file){
  try {
    const pkg = JSON.parse(await readAsText(file));
    if (pkg.format !== FORMAT) { alert('No es un paquete '+FORMAT+'.'); return; }
    state.title = pkg.manifest.title === 'Comparación' ? '' : (pkg.manifest.title || '');
    state.version = pkg.manifest.version || 1;
    const b64toFile = async (key, du) => {
      const {mime, buf} = dataURLtoBytes(du);
      return new File([buf], key.replace(/[\\/:*?"<>|]/g,'_')+'.'+mime.split('/')[1], {type:mime});
    };
    if (state.mode === 'basic'){
      state.pairs = [];
      const frames = pkg.manifest.frames;
      const vs = pkg.manifest.variants;
      for (const f of frames){
        const fa = pkg.images[vs[0].id+'_'+f], fb = pkg.images[(vs[1]||vs[0]).id+'_'+f];
        state.pairs.push([fa ? await b64toFile(vs[0].id+'_'+f, fa) : null, fb ? await b64toFile(vs[1].id+'_'+f, fb) : null]);
      }
      renderPairs();
    } else {
      state.variants = (pkg.manifest.variants||[]).map(v => ({
        id: v.id, name: v.name||'', codec:'', crf:'', bitrate:'', note: v.note||'', cmd: v.cmd||'', metric: (v.metrics && v.metrics.custom_note) || '', color: v.color||'#7bd389',
      }));
      state.frames = (pkg.manifest.frames||[]).map(f => ({key:String(f), label:(pkg.manifest.frame_labels||{})[String(f)]||''}));
      state.cells = new Map(); state.unassigned = [];
      for (const v of state.variants) for (const fr of state.frames){
        const du = pkg.images[v.id+'_'+fr.key];
        if (du) state.cells.set(v.id+'|'+fr.key, await b64toFile(v.id+'_'+fr.key, du));
      }
      nextVar = state.variants.length+1; nextFrame = state.frames.length+1;
      $('pjTitle').value = state.title; $('pjTitleWarn').style.display = state.title.trim()?'none':'';
      $('pjVersion').value = state.version;
      renderVariants(); renderFrames(); renderMatrix();
    }
  } catch (e) { alert('No se pudo leer este paquete: ' + e.message); }
}
window.addEventListener('dragover', e => { if ([...e.dataTransfer.items].some(i => /\.cmp$/i.test(i.name||''))) e.preventDefault(); });
window.addEventListener('drop', e => {
  const f = [...e.dataTransfer.files].find(f => /\.cmp$/i.test(f.name));
  if (f){ e.preventDefault(); importCmp(f); }
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
window.addEventListener('beforeunload', e => {
  const hasWork = state.pairs.some(p => p[0] || p[1]) || state.cells.size;
  if (hasWork){ e.preventDefault(); e.returnValue = ''; }
});
window.addEventListener('unload', () => { for (const u of fileURLs.values()) URL.revokeObjectURL(u); });

/* gancho de prueba/consola: permite manejar la página sin mouse (útil también para usuarios avanzados) */
window.BUILDER = {state, currentPackage, buildStandaloneHTML, addBasicFiles, bulkAdd, importCmp, validateAdvanced, makeDemoPackage, setMode, renderSteps};
