/* ---------- métricas de quien sube: la tarjeta (gatos-ops#395) ----------
   La etiqueta de cada lado muestra hasta 4 métricas del cuadro (variantStats,
   30-ui.js) y una ⓘ. Con el mouse encima, con el foco o tocándola en un
   teléfono se abre una tarjeta con todas: las de este cuadro y la media de los
   cuadros que las tienen, izquierda contra derecha, la mejor de cada fila en
   verde cuando se sabe la dirección (08-metric-kinds.js). Las calcula quien
   sube la página y gatos.pics no las verifica: la tarjeta lo dice. En la
   prueba ciega no hay ⓘ ni tarjeta (paintStats lo apaga). */
const metricCard = document.createElement('div');
metricCard.id = 'metricCard'; metricCard.setAttribute('role', 'tooltip'); metricCard.hidden = true;
document.body.appendChild(metricCard);
let metricFor = null;   // la etiqueta que la abrió
const framePairs = (id, f) => { const m = variant(id).metrics; return metricList(m && own(m.per_frame, String(f))); };
// la línea de stats de un lado, con su ⓘ al final de la primera línea
function paintStats(side, id){
  const el = side === 'A' ? statsA : statsB, label = side === 'A' ? labelA : labelB;
  const text = variantStats(id), has = !blindMode && !testRun && framePairs(id, frame).length > 0;
  const nl = text.indexOf('\n');
  el.textContent = has && nl >= 0 ? text.slice(0, nl) : text;
  if (has){
    const i = document.createElement('span');
    i.className = 'minfo'; i.textContent = ' ⓘ'; i.setAttribute('aria-hidden', 'true');
    el.appendChild(i);
    if (nl >= 0) el.appendChild(document.createTextNode(text.slice(nl)));
  }
  label.classList.toggle('hasm', has);
  if (has) label.tabIndex = 0; else label.removeAttribute('tabindex');
  if (metricFor === label && !metricCard.hidden) has ? showMetricCard(label) : hideMetricCard();
}
function metricCell(tag, text, cls){
  const c = document.createElement(tag);
  c.textContent = text;
  if (cls) c.className = cls;
  return c;
}
// una tabla nombre | izquierda | derecha; devuelve si pintó algún verde
function metricTable(names, a, b, withWord){
  const tbl = document.createElement('table');
  let green = false;
  for (const name of names){
    const kind = metricKind(name), va = a.get(name), vb = b.get(name), tr = document.createElement('tr');
    const td = metricCell('td', kind.long);
    if (kind.dir) td.appendChild(metricCell('small', ' ' + (kind.dir > 0 ? '↑' : '↓') + (withWord ? ' ' + T('mejor') : '')));
    const best = kind.dir && va != null && vb != null && va !== vb ? ((va > vb) === (kind.dir > 0) ? 'a' : 'b') : '';
    if (best) green = true;
    tr.append(td,
      metricCell('td', va == null ? '—' : metricFmt(va, kind.digits), best === 'a' ? 'best' : ''),
      metricCell('td', vb == null ? '—' : metricFmt(vb, kind.digits), best === 'b' ? 'best' : ''));
    tbl.appendChild(tr);
  }
  return {tbl, green};
}
// nombres de dos mapas, en el orden de la tabla de métricas
const metricNames = (a, b) => metricList(Object.fromEntries([...a.keys(), ...b.keys()].map(k => [k, 0]))).map(e => e[0]);
function metricAverages(id){
  const sum = new Map(), n = new Map();
  for (const f of FRAMES) for (const [k, v] of framePairs(id, f)){ sum.set(k, (sum.get(k) || 0) + v); n.set(k, (n.get(k) || 0) + 1); }
  return new Map([...sum].map(([k, s]) => [k, s / n.get(k)]));
}
function showMetricCard(label){
  const a = new Map(framePairs(varA, frame)), b = new Map(framePairs(varB, frame));
  if (blindMode || testRun || (!a.size && !b.size)) return hideMetricCard();
  metricCard.replaceChildren(metricCell('div', T`Métricas · cuadro «${FRAME_LABELS[frame] || frame}»`, 'mh'));
  const hr = document.createElement('tr');
  hr.append(metricCell('th', ''), metricCell('th', variantName(varA) + ' ' + T('(izq.)')), metricCell('th', variantName(varB) + ' ' + T('(der.)')));
  const now = metricTable(metricNames(a, b), a, b, true);
  now.tbl.prepend(hr);
  metricCard.appendChild(now.tbl);
  let green = now.green;
  const counted = FRAMES.filter(f => framePairs(varA, f).length || framePairs(varB, f).length).length;
  if (FRAMES.length > 1 && counted > 1){
    const ma = metricAverages(varA), mb = metricAverages(varB);
    metricCard.appendChild(metricCell('div', counted === FRAMES.length ? T`Media de los ${counted} cuadros` : T`Media de ${counted} de ${FRAMES.length} cuadros (los que tienen métricas)`, 'msec'));
    const avg = metricTable(metricNames(ma, mb), ma, mb, false);
    metricCard.appendChild(avg.tbl);
    green = green || avg.green;
  }
  metricCard.appendChild(metricCell('div', T('Las calculó quien subió la página; gatos.pics no las verifica.') + (green ? ' ' + T('En verde, la mejor de cada fila.') : ''), 'mfoot'));
  metricCard.hidden = false;
  metricFor = label;
  label.setAttribute('aria-describedby', 'metricCard');
  const r = label.getBoundingClientRect(), w = metricCard.offsetWidth, h = metricCard.offsetHeight;
  metricCard.style.left = clamp(label === labelB ? r.right - w : r.left, 8, Math.max(8, innerWidth - w - 8)) + 'px';
  metricCard.style.top = clamp(r.bottom + 8, 8, Math.max(8, innerHeight - h - 8)) + 'px';
}
function hideMetricCard(){
  metricCard.hidden = true;
  if (metricFor) metricFor.removeAttribute('aria-describedby');
  metricFor = null;
}
for (const label of [labelA, labelB]){
  const on = () => label.classList.contains('hasm');
  label.addEventListener('mouseenter', () => { if (HOVER_MQ.matches && on()) showMetricCard(label); });
  label.addEventListener('mouseleave', () => { if (HOVER_MQ.matches) hideMetricCard(); });
  // solo el foco del teclado: el de un toque llegaba antes del click y el click la volvía a cerrar
  label.addEventListener('focus', () => { if (on() && label.matches(':focus-visible')) showMetricCard(label); });
  label.addEventListener('blur', hideMetricCard);
  // con métricas la etiqueta recibe el puntero: no arrastra la imagen ni ajusta con doble clic
  for (const ev of ['pointerdown', 'dblclick']) label.addEventListener(ev, e => { if (on()) e.stopPropagation(); });
  label.addEventListener('click', e => {   // táctil: tocar abre y cierra (con mouse ya la abrió el paso del puntero)
    if (!on()) return;
    e.stopPropagation();
    if (HOVER_MQ.matches) return;
    if (metricFor === label && !metricCard.hidden) hideMetricCard(); else showMetricCard(label);
  });
}
document.addEventListener('pointerdown', e => { if (!metricCard.hidden && !e.target.closest('.label.hasm')) hideMetricCard(); }, true);
