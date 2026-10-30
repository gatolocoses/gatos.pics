'use strict';
/* metrics.js — métricas de quien sube (gatos-ops#395). Un .json con el mismo
   nombre que una captura (x265_01.json junto a x265_01.png), soltado con las
   imágenes en el modo Básico, pega sus números a esa captura: viajan en
   `metrics.per_frame[cuadro]` de su versión y el visor los muestra al pasar el
   mouse por el nombre. gatos.pics no los calcula ni los verifica.

   Forma aceptada: un objeto de números, `{"ssimulacra2": 81.4, "vmaf": 97.2}`,
   o el mismo dentro de `{"metrics": {...}}`. Un nivel anidado se aplana
   (`{"butteraugli": {"max": 1.9}}` -> butteraugli_max) y un número escrito
   como texto se acepta. Los nombres quedan en minúsculas con _ (CVVDP (JOD) ->
   cvvdp_jod), máximo 32 caracteres y 16 por captura: las mismas reglas que
   aplica el servicio (service/lib/validate.mjs). Lo demás se ignora.
   Cargado antes de builder.js; usa esc() y T() solo dentro de funciones. */
const METRIC_NAME_RE = /^[a-z0-9_]{1,32}$/;
const METRIC_RESERVED = new Set(['__proto__', 'constructor', 'prototype']);
const METRIC_MAX = 16;
const metricName = k => String(k).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
const metricValue = v => typeof v === 'number' ? (isFinite(v) ? v : null)
  : typeof v === 'string' && /^\s*-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?\s*$/i.test(v) ? +v : null;
// objeto cualquiera -> [[nombre, número]…] limpio, o null si no queda nada
function metricPairs(obj){
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  if (obj.metrics && typeof obj.metrics === 'object' && !Array.isArray(obj.metrics)) obj = obj.metrics;
  const out = new Map();
  const put = (k, v) => {
    const name = metricName(k), n = metricValue(v);
    if (n == null || !METRIC_NAME_RE.test(name) || METRIC_RESERVED.has(name) || out.has(name) || out.size >= METRIC_MAX) return;
    out.set(name, n);
  };
  for (const [k, v] of Object.entries(obj)){
    if (v && typeof v === 'object' && !Array.isArray(v)) for (const [k2, v2] of Object.entries(v)) put(k + '_' + k2, v2);
    else put(k, v);
  }
  return out.size ? [...out] : null;
}
// un per_frame de un .cmp ajeno -> el mismo, solo con claves y números válidos
function cleanPerFrame(pf){
  if (!pf || typeof pf !== 'object') return undefined;
  const out = {};
  for (const [fk, pm] of Object.entries(pf)){
    const pairs = pm && typeof pm === 'object' && !Array.isArray(pm)
      ? Object.entries(pm).filter(([k, v]) => METRIC_NAME_RE.test(k) && !METRIC_RESERVED.has(k) && typeof v === 'number' && isFinite(v)).slice(0, METRIC_MAX)
      : [];
    if (pairs.length && !METRIC_RESERVED.has(fk)) out[fk] = Object.fromEntries(pairs);
  }
  return Object.keys(out).length ? out : undefined;
}

/* los .json del modo Básico, por nombre sin extensión en minúsculas */
const sideMetrics = new Map();   // nombre -> {file, pairs} | {file, bad: true}
const metricStem = name => name.replace(/\.[^.]+$/, '').trim().toLowerCase();
const isMetricFile = f => /\.json$/i.test(f.name);
// guarda los .json de una tanda de archivos y llama a `done` cuando están leídos
function takeMetricFiles(files, done){
  const jsons = [...files].filter(isMetricFile).sort((a, b) => a.name.localeCompare(b.name, 'es', {numeric:true}));
  if (!jsons.length) return;
  Promise.all(jsons.map(async f => {
    try { return metricPairs(JSON.parse(await f.text())); } catch (e) { return null; }   // no es JSON
  })).then(all => {   // en orden de nombre, no en el que terminan de leerse
    jsons.forEach((f, i) => sideMetrics.set(metricStem(f.name), all[i] ? {file: f.name, pairs: all[i]} : {file: f.name, bad: true}));
    done();
  });
}
function metricsOfFile(f){
  const m = f && sideMetrics.get(metricStem(f.name));
  return m && m.pairs ? m : null;
}
// per_frame de cada columna del modo Básico (cuadro i+1)
function basicPerFrame(pairs, columns){
  const out = Array.from({length: columns}, () => ({}));
  pairs.forEach((row, i) => row.forEach((f, c) => {
    const m = metricsOfFile(f);
    if (m && c < columns) out[c][String(i + 1)] = Object.fromEntries(m.pairs);
  }));
  return out;
}
/* el aviso bajo la tabla: cuántos se emparejaron y qué .json no tienen captura */
function metricsNoteHTML(files){
  if (!sideMetrics.size) return '';
  const used = new Set(files.filter(Boolean).map(f => metricStem(f.name)));
  const paired = [], orphan = [], bad = [];
  for (const [stem, m] of sideMetrics){
    if (!used.has(stem)) orphan.push(m.file);
    else if (m.bad) bad.push(m.file);
    else paired.push(stem);
  }
  const shown = list => list.slice(0, 3).map(esc).join(', ') + (list.length > 3 ? '…' : '');
  let h = '';
  if (paired.length){
    const ex = files.find(f => f && metricStem(f.name) === paired[0]);
    const pair = ex ? ` ${esc(sideMetrics.get(paired[0]).file)} → ${esc(ex.name)}${paired.length > 1 ? '…' : '.'}` : '';
    h += `<div class="mnote"><b>${paired.length === 1 ? T('1 archivo de métricas') : T`${paired.length} archivos de métricas`}</b> `
      + T('emparejados con su captura (mismo nombre, .json):') + pair + ' '
      + T('Se muestran en la comparación al pasar el mouse por el nombre de la versión.') + '</div>';
  }
  if (orphan.length) h += `<div class="warn mwarn"><b>${orphan.length === 1 ? T('1 archivo sin captura:') : T`${orphan.length} archivos sin captura:`}</b> ${shown(orphan)} `
    + (orphan.length === 1 ? T('(ninguna imagen se llama igual): no se usa.') : T('(ninguna imagen se llama igual): no se usan.')) + '</div>';
  if (bad.length) h += `<div class="warn mwarn"><b>${bad.length === 1 ? T('1 archivo no trae métricas:') : T`${bad.length} archivos no traen métricas:`}</b> ${shown(bad)}. `
    + T('Se espera un objeto de números, como {"ssimulacra2": 81.4, "vmaf": 97.2}.') + '</div>';
  return h;
}
/* la insignia «N métricas» de una casilla y su lista al pasar el mouse */
const metricPop = document.createElement('div');
metricPop.className = 'mpop'; metricPop.hidden = true;
document.body.appendChild(metricPop);
function metricBadge(f){
  const m = metricsOfFile(f);
  if (!m) return null;
  const b = document.createElement('span');
  b.className = 'mbadge';   // sin foco propio: Enter abriría el selector de la casilla; el conteo va en su aria-label
  b.textContent = m.pairs.length === 1 ? T('1 métrica') : T`${m.pairs.length} métricas`;
  const show = () => {
    metricPop.replaceChildren();
    const h = document.createElement('div'); h.className = 'mfile'; h.textContent = m.file; metricPop.appendChild(h);
    for (const [k, v] of metricList(Object.fromEntries(m.pairs))){   // rótulos de viewer/src/08-metric-kinds.js
      const kind = metricKind(k), row = document.createElement('div');
      const a = document.createElement('span'); a.textContent = kind.long;
      const n = document.createElement('b'); n.textContent = metricFmt(v, kind.digits);
      row.append(a, n); metricPop.appendChild(row);
    }
    metricPop.hidden = false;
    const r = b.getBoundingClientRect(), w = metricPop.offsetWidth, ht = metricPop.offsetHeight;
    metricPop.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px';
    metricPop.style.top = (r.bottom + 6 + ht > innerHeight - 8 ? Math.max(8, r.top - ht - 6) : r.bottom + 6) + 'px';
  };
  const hide = () => { metricPop.hidden = true; };
  b.addEventListener('mouseenter', show); b.addEventListener('mouseleave', hide);
  b.addEventListener('click', e => { e.stopPropagation(); metricPop.hidden ? show() : hide(); });   // táctil: tocar abre y cierra
  return b;
}
