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
  pairs: [],             // filas: un File|null por versión (con .key/.label si el nombre trajo el cuadro)
  basicNames: ['A','B'], // nombre de cada columna (versión)
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
  btn.disabled = true; btn.textContent = T('Generando ejemplo…');
  setTimeout(async () => {
    const pkg = await makeDemoPackage();
    await VIEWER_ASSETS;
    $('pvBox').srcdoc = buildStandaloneHTML(pkg, {blob:true});
    $('pvFrame').classList.add('show');
    $('onboard').hidden = true;
    btn.disabled = false; btn.textContent = T('Ver un ejemplo');
  }, 30);
});
$('obLoad').addEventListener('click', () => runAction(async () => {
  // cargar el ejemplo como proyecto básico para poder tocarlo
  if (state.pairs.some(p => p.some(Boolean)) && !confirm(T('Cargar el ejemplo descarta tu proyecto actual. ¿Continuar?'))) return;
  const pkg = await makeDemoPackage();
  setMode('basic');
  resetBasic();
  // una columna por versión del ejemplo (gatos-ops#394), con su nombre
  const vs = pkg.manifest.variants;
  state.basicNames = vs.map(v => v.name);
  const toFile = (du, name) => {
    const bin = atob(du.split(',')[1]);
    const buf = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) buf[i] = bin.charCodeAt(i);
    return new File([buf], name, {type:'image/png'});
  };
  for (const f of pkg.manifest.frames) state.pairs.push(vs.map(v => toFile(pkg.images[v.id+'_'+f], v.id+'_'+f+'.png')));
  renderPairs();
  $('onboard').hidden = true;
}));
$('btnHelp').addEventListener('click', () => openHelp());   // guías y comentarios: guide.js


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
  return n ? `<div class="warn" style="margin-top:6px;">⚠ ${n === 1 ? T('1 imagen con pérdida') : T`${n} imágenes con pérdida`} ${T('(JPEG o WebP con pérdida): la evidencia se degrada y el S2 medirá esa compresión extra, no tu encode. Se aceptan, pero usa PNG sin pérdida para comparaciones serias.')}</div>` : '';
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
   ------------------------------------------------------------
   Extraído a app/basic.js (gatos.pics#30): la tabla, el emparejamiento por
   nombre, pickOne/pickMany y basicCore. Este archivo conserva el estado
   (state.pairs, state.basicNames) que ese modo llena.
   ============================================================ */

/* ============================================================
   MODO VIDEO · del video a la comparación
   ------------------------------------------------------------
   Extraído a app/capture.js (gatos.pics#28): vidState/marcas/captura y el
   lote de vidGo. Este archivo conserva el estado avanzado que ese modo
   siembra (variants/frames/cells) y los render* que lo pintan.
   ============================================================ */


/* ============================================================
   MODO AVANZADO · pasos, variantes, frames, tabla de imágenes
   ------------------------------------------------------------
   Extraído a app/advanced.js (gatos.pics#30). Este archivo conserva el
   paquete que arma ese modo (advancedCore), su validación y el arranque,
   que advanced.js dispara al terminar de cargar (startBuilder).
   ============================================================ */

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
    title: state.title.trim() || T('Comparación'),
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
  // solo casillas de una variante y un cuadro que existen: una imagen sin dueño
  // viajaría sin declarar y el servicio rechaza el paquete entero (ops#254)
  const live = new Set();
  for (const v of state.variants) for (const fr of state.frames) live.add(v.id+'|'+fr.key);
  for (const [k, f] of state.cells){
    if (cancelled()) throw new Error(T('Preparación cancelada.'));
    if (!live.has(k)) continue;
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
  if (missing.length) out.push(['bad', missing.length === 1 ? T('1 casilla vacía · ahí la página mostrará un cuadro roto.') : T`${missing.length} casillas vacías · ahí la página mostrará un cuadro roto.`]);
  else if (state.variants.length && state.frames.length) out.push(['good', T`Las ${state.variants.length * state.frames.length} casillas llenas.`]);
  if (state.variants.length < 2) out.push(['bad',T('Hacen falta al menos dos variantes.')]);
  if (!state.frames.length) out.push(['bad',T('Hace falta al menos un frame.')]);
  const keys = state.frames.map(f => f.key);
  if (new Set(keys).size !== keys.length) out.push(['bad',T('Hay identificadores de frame repetidos. Usa uno distinto para cada momento.')]);
  if (keys.some(k => !ID_RE.test(k))) out.push(['bad',T('Los identificadores de frame admiten letras, números, guion y guion bajo (máximo 32).')]);
  const dims = new Set([...state.cells.values()].map(f => fileDims.get(f)).filter(Boolean));
  if (dims.size > 1) out.push(['bad',T`Tamaños de imagen mezclados (${[...dims].join(', ')}) · el diff y los recortes 1:1 necesitan dimensiones idénticas.`]);
  let total = 0; for (const f of state.cells.values()) total += f.size;
  out.push([total > 60*1048576 ? 'warnl' : 'good', T`Tamaño del paquete ≈ ${(total*1.34/1048576).toFixed(1)} MB en base64.`]);
  if (total > 60*1048576) out.push(['warnl',T('Pesado · considera menos frames o imágenes más chicas.')]);
  if (state.unassigned.length) out.push(['warnl',state.unassigned.length === 1 ? T('1 archivo sin asignar NO va a entrar a la página.') : T`${state.unassigned.length} archivos sin asignar NO van a entrar a la página.`]);
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
  const basicWork = state.pairs.some(p => p.some(Boolean));
  const advWork = state.cells.size > 0;
  return basicWork === advWork ? state.mode : (basicWork ? 'basic' : 'advanced');
}
/* núcleo del paquete: manifest + archivos, SIN convertir nada a dataURL */
async function packageCore({complete = false, cancelled = () => false} = {}){
  const mode = packageMode();
  if (complete){
    let problems;
    if (mode === 'basic'){
      problems = !state.pairs.length || state.pairs.some(p => p.some(f => !f)) ? [state.basicNames.length === 2 ? T('Agrega dos imágenes a cada par antes de compartir.') : T('Completa todas las versiones de cada cuadro antes de compartir.')] : [];
      // igual que avanzado: dimensiones mezcladas rompen el diff y los recortes 1:1
      problems.push(...basicOverLimits());
      const dims = new Set(state.pairs.flat().filter(Boolean).map(f => fileDims.get(f)).filter(Boolean));
      if (dims.size > 1) problems.push(T`Tamaños de imagen mezclados (${[...dims].join(', ')}) · el diff y los recortes 1:1 necesitan dimensiones idénticas.`);
    } else {
      problems = validateAdvanced().filter(([type]) => type === 'bad').map(([,text]) => text);
    }
    if (problems.length) throw new Error(problems.join(' '));
    // límites de ley (GOALS.md): 25 MiB por imagen y 1 GiB por página (publicar
    // reparte lo que pase de un pedido en varias partes: publish.js)
    const files = mode === 'basic' ? state.pairs.flat().filter(Boolean) : [...state.cells.values()];
    const big = files.find(f => f.size > 25*1048576);
    if (big) throw new Error(T`«${big.name}» pesa ${(big.size/1048576).toFixed(1)} MB: el límite por imagen es 25 MiB.`);
    let total = 0; for (const f of files) total += f.size;
    if (total > 1024*1048576) throw new Error(T`Las imágenes suman ${(total/1048576).toFixed(0)} MiB: el límite por página es 1 GiB. Reduce frames o variantes.`);
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
    if (cancelled()) throw new Error(T('Preparación cancelada.'));
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
    if (cancelled()) throw new Error(T('Preparación cancelada.'));
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
/* ---------- vista previa, exportar HTML/.cmp/.zip y guardar/abrir: ver app/export.js (extraído, gatos.pics#30) ---------- */
/* buildStandaloneHTML, la vista previa, download/fileBase y los botones de
   exportar y guardar se cargan desde export.js, tras este archivo. */

/* ---------- importar .cmp (en ambos modos) ---------- */
async function importCmp(file){
  if (busy){ $('builderStatus').textContent = T('La captura de video está en curso; espera a que termine para importar.'); return; }
  // Importar sobre trabajo abierto (botón Abrir o drop) tiene que ser una
  // decisión explícita: la pregunta vive aquí, en el único punto de entrada,
  // y cancelar preserva el proyecto tal como estaba.
  if (state.pairs.length || state.cells.size || state.unassigned.length){
    if (!confirm(T('Abrir este archivo reemplaza el proyecto que tienes abierto. ¿Continuar?'))){
      $('builderStatus').textContent = T('No se importó nada: tu proyecto sigue como estaba.');
      return;
    }
  }
  try {
    const pkg = JSON.parse(await readAsText(file));
    if (pkg.format !== FORMAT) { alert(T`No es un paquete ${FORMAT}.`); return; }
    if (!pkg.manifest || !Array.isArray(pkg.manifest.frames) || !Array.isArray(pkg.manifest.variants) || !pkg.images)
      throw new Error(T('Faltan los datos del proyecto.'));
    // Los ids llegan de un archivo externo y llegan a innerHTML: sin este
    // filtro, un .cmp hostil inyecta HTML en la matriz (XSS same-origin en /crear/).
    if (pkg.manifest.variants.some(v => !ID_RE.test(String(v.id))) || pkg.manifest.frames.some(f => !ID_RE.test(String(f))))
      throw new Error(T('identificador de variante o frame no válido: se admite A-Z a-z 0-9 _ y -, máximo 32.'));
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
        // por cuadro: cualquier métrica con nombre válido y número finito (gatos-ops#395, app/metrics.js)
        const pf = cleanPerFrame(m.per_frame);
        if (pf) out.per_frame = pf;
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
      state.title = ['Comparación', 'Comparison'].includes(pkg.manifest.title) ? '' : (pkg.manifest.title || '');   // i18n-ok: el título por defecto, en cualquier idioma
      state.version = pkg.manifest.version || 1;
      state.manifestExtras = {...pkg.manifest};
      state.variants = variants; state.frames = frames; state.cells = cells;
      state.importedCells = new Map(cells);
      state.unassigned = []; resetBasic();
      const hadVideos = resetVideos();
      $('builderStatus').textContent = hadVideos ? T('Se abrió el archivo. Los videos que estaban en la pestaña Video se quitaron de la lista: el proyecto es el del archivo.') : '';
      setMode('advanced'); $('onboard').hidden = true;
      state.cells.forEach(probeDims);
      nextVar = state.variants.length+1; nextFrame = state.frames.length+1;
      $('pjTitle').value = state.title; $('pjTitleWarn').style.display = state.title.trim()?'none':'';
      $('pjVersion').value = state.version;
      renderVariants(); renderFrames(); renderMatrix();
  } catch (e) { alert(T`No se pudo leer este paquete: ${e.message}`); }
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
function startBuilder(){
  ensureSeed();
  renderVariants();
  renderFrames();
  renderMatrix();
  renderPairs();
  renderSteps();
  setMode('basic');
  // el enlace a la demo la abre directo: la bienvenida no se asoma antes (gatos-ops#394)
  if (new URLSearchParams(location.search).get('demo') === '1') $('obDemo').click();
  else showOnboard(false);
  window.addEventListener('beforeunload', e => {
    /* marcas y archivos sin asignar también son trabajo que se pierde */
    const hasWork = state.pairs.some(p => p.some(Boolean)) || state.cells.size || state.unassigned.length || vidState.marks.length;
    if (hasWork){ e.preventDefault(); e.returnValue = ''; }
  });
  window.addEventListener('pagehide', () => { for (const u of fileURLs.values()) URL.revokeObjectURL(u); });

  /* gancho de prueba/consola: permite manejar la página sin mouse (útil también para usuarios avanzados) */
  window.BUILDER = {state, currentPackage, buildStandaloneHTML, addBasicFiles, renderPairs, bulkAdd, importCmp, validateAdvanced, makeDemoPackage, setMode, renderSteps};
}
