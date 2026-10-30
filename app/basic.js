'use strict';
/* basic.js — modo Básico: la tabla de cuadros × versiones, el emparejamiento
   por nombre de archivo, los selectores de imágenes y el núcleo del paquete
   de ese modo (basicCore).
   Extraído de builder.js (gatos.pics#30, serie de extracción sancionada por
   AGENTS.md: builder.js pasó el presupuesto blando). Cargado justo después de
   builder.js y antes de advanced.js: usa su estado y sus utilidades (state, $,
   esc, thumb, probeDims, fileDims, countLossy, PALETTE, FORMAT…), y el
   arranque (startBuilder, que advanced.js llama al terminar de cargar)
   necesita renderPairs ya definido. tools/check_guides.mjs lee este archivo:
   aquí se ponen las marcas data-guide del modo Básico. */
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
/* Imágenes con pérdida (JPEG, WebP con pérdida) del proyecto (ops#255). El aviso
   se agregaba al pie una vez y el siguiente repintado de la lista lo borraba a
   los pocos milisegundos (al medir las imágenes). Ahora se recuerda qué
   archivos son y renderPairs lo pinta siempre que alguno siga en el proyecto. */
const lossyFiles = new WeakSet();
async function noteLossy(files){
  let found = false;
  for (const f of files) if (await countLossy([f])){ lossyFiles.add(f); found = true; }
  if (found) renderPairs();
}
const basicBlank = () => state.basicNames.map(() => null);
function resetBasic(){ state.pairs = []; state.basicNames = ['A','B']; pairWarns = []; }
function basicAddColumn(name){
  state.basicNames.push(name);
  for (const row of state.pairs) row.push(null);
  return state.basicNames.length - 1;
}
function basicDropColumn(c){
  state.basicNames.splice(c, 1);
  for (const row of state.pairs) row.splice(c, 1);
  state.pairs = state.pairs.filter(row => row.some(Boolean));
}

/* Nombre -> {variante, cuadro}. Se prueban varias lecturas y gana la que arma
   la tabla más completa (ops#164, ops#166):
     corte en cada separador, contando desde el final o desde el principio:
       fuente_intro · x265_crf18_0042 · lat_E02_830 (cuadro "E02_830")
     lo mismo con el cuadro adelante:        01_fuente · E02_830_lat
     número pegado al final o al principio:  src01 · encode (2) · 01fuente */
const BASIC_SEP = /[\s_.\-]+/g;
function basicCut(stem, k, fromEnd){
  const seps = [...stem.matchAll(BASIC_SEP)].filter(m => m.index > 0 && m.index + m[0].length < stem.length);
  const m = fromEnd ? seps[seps.length - k] : seps[k - 1];
  return m ? [stem.slice(0, m.index), stem.slice(m.index + m[0].length)] : null;
}
const flip = pair => pair && [pair[1], pair[0]];
const BASIC_READS = {
  under: stem => basicCut(stem, 1, true),
  tail:  stem => { const m = /^(.*?[^\d\s_.\-(\[#])[\s_.\-]*[(\[#]?(\d+)[)\]]?$/.exec(stem); return m ? [m[1], m[2]] : null; },
  head:  stem => { const m = /^[(\[#]?(\d+)[)\]]?[\s_.\-]*([^\d\s_.\-)\]].*)$/.exec(stem); return m ? [m[2], m[1]] : null; },
  first: stem => basicCut(stem, 1, false),
  last2: stem => basicCut(stem, 2, true),  first2: stem => basicCut(stem, 2, false),
  last3: stem => basicCut(stem, 3, true),  first3: stem => basicCut(stem, 3, false),
  // cuadro adelante
  ffirst: stem => flip(basicCut(stem, 1, false)), flast: stem => flip(basicCut(stem, 1, true)),
  ffirst2: stem => flip(basicCut(stem, 2, false)), flast2: stem => flip(basicCut(stem, 2, true)),
};
const isRefName = v => REFERENCE_RE.test(v.split(' ')[0]) || /^blu ?ray\b/.test(v);
const REFERENCE_RE = /^(fuente|src|source|master|original|orig|remux|bd|bluray|raw)$/i;
const basicSlug = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const frameSlug = t => /^\d+$/.test(t) ? String(parseInt(t, 10)) : basicSlug(t);
function basicMatch(imgs, known = new Set()){
  let best = null, rank = 0;
  for (const [mode, read] of Object.entries(BASIC_READS)){
    rank++;
    const groups = new Map();   // cuadro -> Map(variante -> archivo)
    const names = new Map(), keys = new Map();
    for (const f of imgs){
      const hit = read(f.name.replace(/\.[^.]+$/, '').trim());
      if (!hit) continue;
      const v = basicSlug(hit[0]), k = frameSlug(hit[1].trim());
      if (!v || !k) continue;
      if (!names.has(v)) names.set(v, hit[0].replace(/[\s_.\-]+$/, '').trim());
      if (!keys.has(k)) keys.set(k, hit[1].trim());
      if (!groups.has(k)) groups.set(k, new Map());
      if (!groups.get(k).has(v)) groups.get(k).set(v, f);   // repetido: queda suelto
    }
    // un cuadro sirve si junta al menos dos versiones distintas, o si su fila
    // ya existe (soltar después la versión que faltaba)
    const usable = [...groups].filter(([k, g]) => g.size >= 2 || known.has(k));
    if (!usable.length) continue;
    const variants = [...new Set(usable.flatMap(([, g]) => [...g.keys()]))];
    const covered = usable.reduce((n, [, g]) => n + g.size, 0);
    const full = covered === imgs.length && usable.every(([, g]) => g.size === variants.length);
    // el número pegado (tail/head) no suma por numérico: si un corte en separador
    // ya arma la tabla completa, manda ese (k4_frame1c1 es cuadro "frame1c1", no "1")
    const numeric = mode !== 'tail' && mode !== 'head' && usable.every(([k]) => /^\d+$/.test(k)) && !variants.every(v => /^\d+$/.test(v));
    // tabla completa > cuadros numéricos > una versión con nombre de referencia;
    // a igualdad, la lectura más simple (el orden de BASIC_READS)
    const score = (full ? 4e6 : 0) + (numeric ? 2e6 : 0) + (variants.some(isRefName) ? 1e6 : 0) + covered * 100 - rank;
    if (!best || score > best.score) best = {mode, score, usable, variants, names, keys};
  }
  return best;
}

function addBasicFiles(files){
  $('builderStatus').textContent = '';
  pairWarns = [];
  takeMetricFiles(files, renderPairs);   // los .json de métricas (app/metrics.js)
  const imgs = files.filter(f => f.type.startsWith('image/')).sort((a,b) => a.name.localeCompare(b.name, 'es', {numeric:true}));
  imgs.forEach(probeDims);
  let loose = [...imgs];
  if (!state.pairs.some(row => row.some(Boolean))) resetBasic();

  // emparejamiento por nombre: los archivos del mismo cuadro van a la misma fila,
  // cada versión en su columna. La referencia (fuente/src/master...) a la izquierda.
  const match = basicMatch(imgs, new Set(state.pairs.map(r => r.key).filter(k => k !== undefined)));
  if (match){
    const isRef = isRefName;
    const order = [...match.variants].sort((x, y) => (isRef(y) - isRef(x)) || x.localeCompare(y, 'es', {numeric:true}));
    const fresh = !state.pairs.length;
    if (fresh) state.basicNames = [];
    const have = new Map(state.basicNames.map((n, i) => [basicSlug(n), i]));
    const col = new Map();
    for (const v of order) col.set(v, have.has(v) ? have.get(v) : basicAddColumn(match.names.get(v)));
    if (fresh && !order.some(isRef))
      pairWarns.push(T('Ningún nombre parece la referencia (fuente, src, máster): la columna izquierda es una suposición. Revísala.'));
    const placed = new Set();
    for (const [k, g] of match.usable.sort((x, y) => x[0].localeCompare(y[0], 'es', {numeric:true}))){
      let row = state.pairs.find(r => r.key === k);
      if (!row){ row = basicBlank(); row.key = k; row.label = match.keys.get(k); state.pairs.push(row); }
      for (const [v, f] of g){ row[col.get(v)] = f; placed.add(f); }
    }
    loose = imgs.filter(f => !placed.has(f));
    const holes = state.pairs.filter(r => r.key !== undefined && r.some(f => !f)).length;
    if (holes) pairWarns.push(holes === 1 ? T('1 cuadro no tiene todas las versiones: completa los huecos o quita la fila.') : T`${holes} cuadros no tienen todas las versiones: completa los huecos o quita la fila.`);
  }

  // sin pista en el nombre: por orden. Primero los huecos de la última fila a medias
  const n = state.basicNames.length;
  const sameVariant = (x, y) => { const px = BASIC_READS.under(x.name.replace(/\.[^.]+$/, '')), py = BASIC_READS.under(y.name.replace(/\.[^.]+$/, '')); return px && py && px[0].toLowerCase() === py[0].toLowerCase(); };
  if (!match) for (let i = state.pairs.length-1; i >= 0 && loose.length; i--){
    const row = state.pairs[i];
    if (!row.some(Boolean) || row.every(Boolean)) continue;
    for (let c = 0; c < n && loose.length; c++) if (!row[c]){
      const f = loose.shift();
      if (n === 2 && row[1-c] && sameVariant(row[1-c], f)) pairWarns.push(T`${row[1-c].name} y ${f.name} parecen la misma variante: se completó el par por orden. Revísalo.`);
      row[c] = f;
    }
    break;
  }
  while (loose.length){
    const row = basicBlank();
    for (let c = 0; c < n && loose.length; c++) row[c] = loose.shift();
    if (n === 2 && row[0] && row[1] && sameVariant(row[0], row[1])) pairWarns.push(T`${row[0].name} y ${row[1].name} parecen la misma variante: se emparejaron por orden. Revísalos.`);
    state.pairs.push(row);
  }
  renderPairs();
  noteLossy(imgs);
}

/* Llenar UNA versión con varios archivos (ops#171): van a su columna en orden de
   nombre, uno por fila desde `fromRow`, creando las filas que falten. No mira
   el nombre para agrupar: sirve cuando cada versión trae los mismos nombres
   (shot0001.png… en cada carpeta) o ninguno útil. */
function basicFillColumn(c, files, fromRow = 0){
  takeMetricFiles(files, renderPairs);
  const imgs = imagesInOrder(files);
  if (!imgs.length) return;
  $('builderStatus').textContent = '';
  pairWarns = [];
  imgs.forEach((f, i) => {
    while (state.pairs.length <= fromRow + i) state.pairs.push(basicBlank());
    state.pairs[fromRow + i][c] = f; probeDims(f);
  });
  renderPairs();
  noteLossy(imgs);
}
// topes del servicio por página: avisar aquí, no con un error al publicar
function basicOverLimits(){
  const out = [], n = state.basicNames.length, k = state.pairs.length;
  if (n > 12) out.push(T`Una página admite hasta 12 versiones y aquí hay ${n}: quita ${n-12} con la × junto a su nombre.`);
  if (k > 200) out.push(T`Una página admite hasta 200 cuadros y aquí hay ${k}: quita ${k-200}.`);
  return out;
}
function renderPairs(){
  const host = $('pairList');
  host.innerHTML = '';
  metricPop.hidden = true;   // su insignia se va con el repintado: sin mouseleave
  const names = state.basicNames, n = names.length, two = n === 2;
  const unit = two ? T('par') : T('cuadro');
  {
    // nombres de las versiones: se pueden corregir, y con más de dos, quitar.
    // Cada una se puede llenar entera: botón, o soltando archivos sobre ella
    const head = document.createElement('div');
    head.className = 'pair pairhead';
    head.innerHTML = '<span class="no">' + T('versiones') + '</span>';
    names.forEach((name, c) => {
      const box = document.createElement('div');
      box.className = 'vname'; box.dataset.col = c;
      const line = document.createElement('div'); line.className = 'vline';
      const inp = document.createElement('input');
      inp.type = 'text'; inp.value = name; inp.maxLength = 40; inp.dataset.guide = 'vname-' + c; inp.setAttribute('aria-label', T`Nombre de la versión ${c+1}`);
      inp.onchange = () => { names[c] = inp.value.trim() || String.fromCharCode(65 + c % 26); renderPairs(); };
      line.appendChild(inp);
      box.appendChild(line);
      const fill = document.createElement('button');
      fill.className = 'vfill'; fill.textContent = T('Elegir sus imágenes'); fill.dataset.guide = 'vfill-' + c;
      fill.title = T('Elige (o suelta aquí) todas las imágenes de esta versión: llenan su columna en orden de nombre');
      fill.setAttribute('aria-label', T`Elegir todas las imágenes de la versión ${name}`);
      fill.onclick = () => pickMany(files => basicFillColumn(c, files), true);
      box.appendChild(fill);
      if (n > 2){
        const x = document.createElement('button'); x.textContent = '×'; x.title = T('Quitar esta versión');
        x.setAttribute('aria-label', T`Quitar la versión ${name}`);
        x.onclick = () => { if (confirm(T`¿Quitar la versión «${name}» y sus imágenes?`)){ basicDropColumn(c); renderPairs(); } };
        line.appendChild(x);
      }
      head.appendChild(box);
    });
    const add = document.createElement('button');
    add.id = 'basicAddVersion'; add.textContent = T('+ versión'); add.dataset.guide = 'add-version'; add.title = T('Agregar otra versión a cada cuadro');
    add.onclick = () => { basicAddColumn(String.fromCharCode(65 + n % 26)); renderPairs(); };
    const tools = document.createElement('div'); tools.className = 'tools'; tools.appendChild(add);
    head.appendChild(tools);
    host.appendChild(head);
  }
  state.pairs.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'pair';
    const mk = (f, side) => {
      const where = two ? (side ? T('Derecha') : T('Izquierda')) : names[side];
      const s = document.createElement('div');
      s.className = 'slot ' + (f ? 'filled' : 'empty');
      s.setAttribute('role', 'button'); s.tabIndex = 0;
      s.dataset.col = side; s.dataset.row = i;
      const mb = metricBadge(f);
      s.setAttribute('aria-label', `${where}, ${unit} ${i+1}: ${f ? f.name : T('elegir imagen')}${mb ? ', ' + mb.textContent : ''}`);
      if (f) s.innerHTML = `<img src="${thumb(f)}" alt="${esc(f.name)}">`; else s.textContent = T`${where}: elegir imagen`;
      if (mb) s.appendChild(mb);
      s.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); s.click(); } });
      s.title = f ? f.name + (fileDims.get(f) ? ' · '+fileDims.get(f) : '') : T('clic para elegir una imagen, o varias para llenar esta versión hacia abajo');
      // una imagen llena esta casilla; varias siguen hacia abajo en la misma versión
      s.addEventListener('click', () => pickMany(files => basicFillColumn(side, files, i), true));
      return s;
    };
    row.innerHTML = `<span class="no">${unit} ${i+1}</span>`;
    p.forEach((f, side) => row.appendChild(mk(f, side)));
    const tools = document.createElement('div');
    tools.className = 'tools';
    const up = document.createElement('button'); up.textContent='↑'; up.title=T('subir');
    up.onclick = () => { if (i>0){ [state.pairs[i-1], state.pairs[i]] = [state.pairs[i], state.pairs[i-1]]; renderPairs(); } };
    const dn = document.createElement('button'); dn.textContent='↓'; dn.title=T('bajar');
    dn.onclick = () => { if (i<state.pairs.length-1){ [state.pairs[i+1], state.pairs[i]] = [state.pairs[i], state.pairs[i+1]]; renderPairs(); } };
    const rm = document.createElement('button'); rm.textContent='×'; rm.title=T`quitar ${unit}`;
    rm.onclick = () => { state.pairs.splice(i,1); if (!state.pairs.length){ resetBasic(); sideMetrics.clear(); } renderPairs(); };
    if (two){
      const swap = document.createElement('button'); swap.textContent='↔'; swap.title=T('Intercambiar izquierda y derecha');
      swap.onclick = () => { [p[0],p[1]] = [p[1],p[0]]; renderPairs(); };
      tools.append(swap);
    }
    tools.append(up, dn, rm);
    row.appendChild(tools);
    host.appendChild(row);
  });
  const foot = $('basicFoot');
  const half = state.pairs.some(p => p.some(f => !f));
  const dims = new Set([...state.pairs.flat()].filter(Boolean).map(f => fileDims.get(f)).filter(Boolean));
  let h = '';
  if (half) h += `<div class="warn">${two ? T('Completa el par vacío antes de compartir.') : T('Completa los huecos antes de compartir.')} ${T('Puedes guardar el proyecto para seguir después.')}</div>`;
  if (dims.size > 1) h += `<div class="warn">${T`Las imágenes tienen tamaños distintos (${[...dims].join(', ')}) · el diff y los recortes 1:1 necesitan dimensiones idénticas.`}</div>`;
  for (const w of pairWarns) h += `<div class="warn">${esc(w)}</div>`;
  h += metricsNoteHTML(state.pairs.flat());
  h += lossyWarnHTML(state.pairs.flat().filter(f => f && lossyFiles.has(f)).length);
  const over = basicOverLimits();
  for (const w of over) h += `<div class="warn">${esc(w)}</div>`;
  if (state.pairs.length && !half && !over.length){
    const k = state.pairs.length;
    const ready = two ? (k === 1 ? T('1 par listo') : T`${k} pares listos`)
      : (k === 1 ? T`1 cuadro listo · ${n} versiones en cada uno` : T`${k} cuadros listos · ${n} versiones en cada uno`);
    h += `<div class="okline">${ready} ${T('· y exporta cuando quieras:')}</div>`;
    h += `<div class="exports" style="margin-top:8px;">
      <button id="bExpHtml">${T('Descargar .html')}</button>
      <button id="bExpZip">${T('Descargar .zip')}</button>
      <button id="bExpCmp">${T('Descargar .cmp')}</button>
    </div>`;
  }
  foot.innerHTML = h;
  const wire = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  wire('bExpHtml', () => $('btnExpHtml').click());
  wire('bExpZip', () => $('btnExpZip').click());
  wire('bExpCmp', () => $('btnExpCmp').click());
}
// soltar archivos sobre una versión (su nombre) o sobre una casilla llena esa columna
for (const event of ['dragover','dragleave','drop']) $('pairList').addEventListener(event, e => {
  const t = e.target.closest('.slot[data-col], .vname[data-col]'); if (!t) return;
  e.preventDefault(); t.classList.toggle('over', event === 'dragover');
  if (event === 'drop'){ e.stopPropagation(); basicFillColumn(+t.dataset.col, [...e.dataTransfer.files], t.dataset.row === undefined ? 0 : +t.dataset.row); }
});
function pickOne(cb){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => { if (inp.files[0]) cb(inp.files[0]); };
  inp.click();
}
// varias imágenes de una vez, en orden de nombre (1, 2, 10: orden natural).
// En Básico también se pueden elegir los .json de métricas (`metrics`)
const imagesInOrder = files => [...files].filter(f => f.type.startsWith('image/')).sort((a,b) => a.name.localeCompare(b.name, 'es', {numeric:true}));
function pickMany(cb, metrics = false){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = metrics ? 'image/*,.json,application/json' : 'image/*'; inp.multiple = true;
  inp.onchange = () => { if (metrics) takeMetricFiles(inp.files, renderPairs); const files = imagesInOrder(inp.files); if (files.length) cb(files); };
  inp.click();
}

/* básico -> núcleo: manifest listo + File por clave canónica. Sin dataURLs:
   la representación única del proyecto son los archivos (gatos.pics#29) */
async function basicCore(cancelled = () => false){
  const pairs = state.pairs, names = state.basicNames;
  // ids estables por columna: a, b, c… (a/b son los de siempre con dos versiones)
  const ids = names.map((_, c) => c < 26 ? String.fromCharCode(97 + c) : 'v' + (c+1));
  const manifest = {
    title: T('Comparación'),
    version: state.version,
    frames: pairs.map((_, i) => i+1),
    frame_labels: Object.fromEntries(pairs.map((row, i) => [String(i+1), String(row.label || i+1)])),
    variants: names.map((name, c) => ({id: ids[c], name, color: PALETTE[c % PALETTE.length]})),
  };
  // métricas de los .json con el mismo nombre que cada captura (app/metrics.js)
  basicPerFrame(pairs, names.length).forEach((pf, c) => { if (Object.keys(pf).length) manifest.variants[c].metrics = {per_frame: pf}; });
  const entries = [];
  for (let i = 0; i < pairs.length; i++){
    if (cancelled()) throw new Error(T('Preparación cancelada.'));
    pairs[i].forEach((f, c) => { if (f) entries.push([ids[c]+'_'+(i+1), f]); });
  }
  return {format: FORMAT, manifest, entries};
}
