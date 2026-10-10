/* advanced.js — modo Avanzado: los pasos y lo que pintan (proyecto, variantes,
   frames, tabla de imágenes y archivos sin asignar).
   Extraído de builder.js (gatos.pics#30, serie de extracción sancionada por
   AGENTS.md: builder.js pasó el presupuesto). Cargado justo después de
   builder.js: usa su estado y sus utilidades (state, $, esc, thumb, probeDims,
   pickMany, countLossy…) y, como builder.js necesita estas funciones para
   arrancar, el arranque (`startBuilder`, definido allá) se llama al final de
   este archivo, en el mismo momento en que corría antes. */
/* ============================================================
   MODO AVANZADO · pasos
   ============================================================ */
const STEPS = [T('Proyecto'),T('Variantes'),'Frames',T('Imágenes'),T('Revisar')];
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
    const a = defVariant(); a.name = T('Fuente'); a.note = T('referencia');
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
    const badge = i===0 ? `<span class="badge">${T('izquierda por defecto')}</span>` : i===1 ? `<span class="badge">${T('derecha por defecto')}</span>` : '';
    card.innerHTML = `
      <div class="vrow">
        <div class="dot" style="background:${v.color}" title="${T('clic para cambiar el color')}"></div>
        <input type="text" data-k="name" placeholder="${T('nombre (p. ej. Fuente, CRF 26)')}" value="${esc(v.name)}">
        <input type="text" class="opt" data-k="codec" placeholder="codec" value="${esc(v.codec)}" title="${T('codec · p. ej. AV1, x264, HEVC')}">
        <input type="text" class="opt" data-k="crf" placeholder="CRF" value="${esc(v.crf)}" title="${T('número de calidad')}">
        <input type="text" class="opt" data-k="bitrate" placeholder="Mb/s" value="${esc(v.bitrate)}" title="bitrate">
        <button class="iconbtn" data-a="up" title="${T('subir')}">↑</button>
        <button class="iconbtn" data-a="dn" title="${T('bajar')}">↓</button>
        <button class="iconbtn" data-a="rm" title="${T('quitar')}">×</button>
      </div>
      <div class="vrow2">
        <span class="hint">${esc(v.id)}${badge}</span>
        <input type="text" data-k="note" placeholder="${T('nota extra · sale bajo el botón')}" value="${esc(v.note)}">
        <input type="text" class="mono" data-k="cmd" placeholder="${T('comando del encoder (tooltip)')}" value="${esc(v.cmd)}">
        <input type="text" data-k="metric" placeholder="${T('Métrica opcional: VMAF 96.2')}" value="${esc(v.metric)}" title="${T('Se muestra bajo el nombre de la variante')}">
      </div>`;
    card.querySelector('.dot').onclick = () => {
      v.color = PALETTE[(PALETTE.indexOf(v.color)+1) % PALETTE.length];
      renderVariants();
    };
    card.querySelectorAll('input[data-k]').forEach(inp => {
      inp.setAttribute('aria-label', T`${({name:T('Nombre'),codec:'Codec',crf:'CRF',bitrate:T('Bitrate en Mb/s'),note:T('Nota'),cmd:T('Comando del encoder'),metric:T('Métrica opcional')})[inp.dataset.k]} de la variante ${i+1}`);
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
  if (state.variants.length < 2) lines.push(`<div class="err">${T('Hacen falta al menos dos variantes para comparar.')}</div>`);
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
      <input type="text" class="mono" data-k="key" placeholder="1" value="${esc(fr.key)}" title="${T('número del frame · se usa en los nombres de archivo')}">
      <input type="text" data-k="label" placeholder="${T('etiqueta (opcional · p. ej. escena oscura, primer plano de grano)')}" value="${esc(fr.label)}">
      <button class="iconbtn" data-a="up" title="${T('subir')}">↑</button>
      <button class="iconbtn" data-a="dn" title="${T('bajar')}">↓</button>
      <button class="iconbtn" data-a="rm" title="${T('quitar')}">×</button>`;
    row.querySelectorAll('input[data-k]').forEach(inp => {
      inp.addEventListener(inp.dataset.k === 'key' ? 'change' : 'input', () => {
        const old = fr.key;
        if (inp.dataset.k === 'key' && (!ID_RE.test(inp.value) || state.frames.some(f => f !== fr && f.key === inp.value))){
          inp.value = old; $('builderStatus').textContent = T('Usa un identificador único de frame, con letras, números o guiones.'); return;
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
  w.innerHTML = state.frames.length < 1 ? `<div class="err">${T('Hace falta al menos un frame.')}</div>`
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
  if (r.createdV.length) bits.push(r.createdV.length === 1 ? T`1 variante nueva (${r.createdV[0]})` : T`${r.createdV.length} variantes nuevas (${r.createdV.join(', ')})`);
  if (r.createdF.length) bits.push(r.createdF.length === 1 ? T('1 frame nuevo') : T`${r.createdF.length} frames nuevos`);
  if (r.misses) bits.push(T`${r.misses} sin asignar`);
  el.textContent = bits.length ? '✓ ' + bits.join(' · ') : T('✓ todo asignado');
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
        misses.push({file:f, why:T('nombre ambiguo · usa el nombre completo o el identificador de la variante')});
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
      ? T('no se pudo interpretar el nombre · se espera <variante>_<frame>')
      : T('nombre sin guion bajo · se espera <variante>_<frame>');
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
  if (!state.variants.length || !state.frames.length){ host.innerHTML = '<p class="hint">' + T('Primero define variantes y frames.') + '</p>'; return; }
  let html = '<table class="mtx"><tr><th></th>';
  for (const v of state.variants) html += `<th class="vcol" data-vcol="${esc(v.id)}" role="button" tabindex="0" title="${T('Clic (o suelta aquí) para elegir todas las imágenes de esta variante: llenan sus frames en orden de nombre')}"><span style="color:${v.color}">●</span> ${esc(v.name || v.id)} <span class="vcolhint">${T('elegir todas')}</span></th>`;
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
  return f ? `<img src="${thumb(f)}" loading="lazy" decoding="async" alt=""><button class="rm" title="${T('quitar')}">×</button>` : T('suelta / clic');
}
function updateMatrixCell(key,file){
  if (file){ state.cells.set(key,file); probeDims(file); }
  else state.cells.delete(key);
  const cell = matrixCells.get(key);
  if (cell){ cell.className = 'cell '+(file?'filled':'empty'); cell.innerHTML = matrixCellContent(file); }
}
/* Llenar una variante con varios archivos (ops#171): en orden de nombre, un
   frame cada uno desde `fromKey` (o el primero); los frames que falten se crean. */
const cellParts = key => { const cut = key.indexOf('|'); return [key.slice(0, cut), key.slice(cut + 1)]; };
function matrixFillColumn(vid, files, fromKey){
  const imgs = imagesInOrder(files);
  if (!imgs.length) return;
  let at = fromKey === undefined ? 0 : Math.max(0, state.frames.findIndex(f => f.key === fromKey));
  let grew = false;
  for (const f of imgs){
    if (at >= state.frames.length){
      let n = nextFrame;
      while (state.frames.some(fr => fr.key === String(n))) n++;
      nextFrame = n + 1;
      state.frames.push({key:String(n), label:''}); grew = true;
    }
    state.cells.set(vid+'|'+state.frames[at++].key, f); probeDims(f);
  }
  if (grew) renderFrames();
  renderMatrix();
  countLossy(imgs).then(n => { if (n) $('bulkWarn').innerHTML = lossyWarnHTML(n); });
}
$('matrix').addEventListener('click', e => {
  const col = e.target.closest('[data-vcol]');
  if (col){ pickMany(files => matrixFillColumn(col.dataset.vcol, files)); return; }
  const cell = e.target.closest('[data-cell]'); if (!cell) return;
  if (e.target.closest('.rm')) updateMatrixCell(cell.dataset.cell,null);
  else pickMany(files => files.length === 1 ? updateMatrixCell(cell.dataset.cell,files[0]) : matrixFillColumn(...cellParts(cell.dataset.cell), files));
});
$('matrix').addEventListener('keydown', e => { const col = e.target.closest('[data-vcol]'); if (col && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); col.click(); } });
for (const event of ['dragover','dragleave','drop']) $('matrix').addEventListener(event, e => {
  const cell = e.target.closest('[data-cell], [data-vcol]'); if (!cell) return;
  e.preventDefault(); cell.classList.toggle('over',event==='dragover');
  if (event==='drop'){
    e.stopPropagation();
    const files = imagesInOrder(e.dataTransfer.files);
    if (cell.dataset.vcol) matrixFillColumn(cell.dataset.vcol, files);
    else if (files.length === 1) updateMatrixCell(cell.dataset.cell,files[0]);
    else matrixFillColumn(...cellParts(cell.dataset.cell), files);
  }
});
function renderUnassigned(){
  /* archivos sin asignar */
  const un = $('unassigned');
  if (state.unassigned.length){
    const variantOptions = state.variants.map(v=>`<option value="${esc(v.id)}">${esc(v.name||v.id)}</option>`).join('');
    const frameOptions = state.frames.map(f=>`<option value="${esc(f.key)}">${esc(f.key)}${f.label?' · '+esc(f.label):''}</option>`).join('');
    let h = '<div class="card"><b>' + T('Archivos sin asignar') + '</b><ul style="list-style:none;margin-top:6px;">';
    state.unassigned.forEach((u, i) => {
      h += `<li style="display:flex;gap:8px;align-items:center;margin:4px 0;flex-wrap:wrap;">
        <img src="${thumb(u.file)}" style="width:54px;height:32px;object-fit:contain;border-radius:4px;background:#000;">
        <span class="mono" style="min-width:0;overflow:hidden;text-overflow:ellipsis;max-width:280px;">${esc(u.file.name)}</span>
        <span class="hint">${esc(u.why)}</span>
        <span style="margin-left:auto;"></span>
        <select data-i="${i}" data-w="v" class="asSel">
          <option value="">${T('variante…')}</option>${variantOptions}
        </select>
        <select data-i="${i}" data-w="f" class="asSel">
          <option value="">frame…</option>${frameOptions}
        </select>
        <button class="iconbtn" data-rm="${i}" title="${T('descartar este archivo')}">×</button>
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

/* con todo lo del modo Avanzado definido, arranca el creador */
startBuilder();
