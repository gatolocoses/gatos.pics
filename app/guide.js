/* guide.js — Ayuda: guías paso a paso sobre la pantalla real, y comentarios.
   (gatos-ops#175)

   Una guía es una lista de pasos. Cada paso señala un elemento REAL del
   creador por su marca `data-guide` y dice una frase. Algunos pasos cargan
   capturas de ejemplo con las mismas funciones que usa quien suelta archivos,
   así la persona ve armarse las filas sin tener que traer los suyos; al salir,
   si el proyecto solo tiene ejemplos, se quitan.

   Para que no envejezca: tools/check_guides.mjs (gate de push) comprueba que
   cada `target` exista en el código del creador, y tools/review_browser.cjs
   recorre cada guía entera y exige que cada paso encuentre su elemento visible. */
'use strict';
const GUIDES = [
  { id: 'por-version', title: 'Tengo una carpeta por versión', sub: 'Cada versión (fuente, encode…) con sus capturas aparte. Los nombres de archivo no importan.',
    steps: [
      { target: 'tab-basic', text: 'Empieza en Básico: no hay nada que configurar.', enter: () => setMode('basic') },
      { target: 'vname-0', text: 'Cada versión tiene un nombre. Escribe el tuyo: Fuente, Encode, WEB-DL…' },
      { target: 'vfill-0', text: 'Pulsa «Elegir sus imágenes» y selecciona TODAS las capturas de esta versión de una vez. También puedes soltarlas sobre el nombre.' },
      { target: 'rows', text: 'Quedan en fila, una por cuadro, en orden de nombre.', sample: () => guideFill(0, 0) },
      { target: 'vfill-1', text: 'Ahora la segunda versión, igual. No importa que sus archivos se llamen igual que los de la primera.' },
      { target: 'rows', text: 'Cada fila es un cuadro con sus versiones lado a lado. Si a una versión le faltan capturas, el hueco queda a la vista.', sample: () => guideFill(1, 130) },
      { target: 'add-version', text: '¿Tres o más versiones? Agrega otra y llénala del mismo modo.' },
      { target: 'preview', text: 'Vista previa: revisa la comparación antes de compartirla.' },
      { target: 'publish', text: 'Publicar te da el enlace y el código para foros. La imagen para compartir se crea sola.' },
    ] },
  { id: 'todas-juntas', title: 'Tengo todas las capturas juntas', sub: 'Una sola carpeta, con nombres que dicen la versión y el cuadro.',
    steps: [
      { target: 'tab-basic', text: 'Empieza en Básico: no hay nada que configurar.', enter: () => setMode('basic') },
      { target: 'drop', text: 'Suelta aquí todas las capturas juntas, o haz clic para elegirlas. Si el nombre dice la versión y el cuadro (fuente_01, Encode - 01, 01_encode) se agrupan solas. Si no lo dice, usa la guía «una carpeta por versión».' },
      { target: 'rows', text: 'Cada fila es un cuadro con todas sus versiones. La referencia (fuente, src, máster) queda a la izquierda.', sample: () => guideDump() },
      { target: 'vname-0', text: 'Los nombres de las versiones salen de los archivos. Corrígelos aquí si hace falta.' },
      { target: 'preview', text: 'Vista previa: revisa la comparación antes de compartirla.' },
      { target: 'publish', text: 'Publicar te da el enlace y el código para foros. La imagen para compartir se crea sola.' },
    ] },
];

/* ---------- capturas de ejemplo ---------- */
const guideSamples = new WeakSet();
async function guideImages(label, hue, names){
  const out = [];
  for (let i = 0; i < names.length; i++){
    const c = document.createElement('canvas'); c.width = 480; c.height = 270;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 480, 270);
    g.addColorStop(0, `hsl(${hue} 55% 30%)`); g.addColorStop(1, `hsl(${hue + 40} 60% 50%)`);
    x.fillStyle = g; x.fillRect(0, 0, 480, 270);
    x.fillStyle = '#fff'; x.textAlign = 'center';
    x.font = 'bold 90px sans-serif'; x.fillText(String(i + 1), 240, 150);
    x.font = '28px sans-serif'; x.fillText(label + ' · ejemplo', 240, 215);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const f = new File([blob], names[i], { type: 'image/png' });
    guideSamples.add(f); out.push(f);
  }
  return out;
}
async function guideFill(col, hue){ basicFillColumn(col, await guideImages(state.basicNames[col] || 'versión', hue, ['shot0001.png', 'shot0002.png', 'shot0003.png'])); }
async function guideDump(){
  const files = [];
  for (const [v, hue] of [['fuente', 0], ['encode', 130], ['web', 220]]) files.push(...await guideImages(v, hue, [1, 2, 3].map(n => `${v}_0${n}.png`)));
  addBasicFiles(files);
}
const guideOnlySamples = () => state.pairs.length > 0 && state.pairs.every(row => row.every(f => !f || guideSamples.has(f)));
const guideHasWork = () => state.pairs.some(row => row.some(f => f && !guideSamples.has(f))) || state.cells.size > 0;

/* ---------- el recorrido ---------- */
const guide = { def: null, i: 0, samples: false, el: null };
const guideTarget = name => document.querySelector(`[data-guide="${name}"]`);
function guidePlace(){
  if (!guide.def) return;
  const spot = $('guideSpot'), card = $('guideCard'), el = guide.el;
  const shown = el && el.isConnected && el.getClientRects().length;
  spot.hidden = !shown;
  card.classList.toggle('free', !shown);
  if (!shown) return;
  const r = el.getBoundingClientRect(), pad = 6;
  Object.assign(spot.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
  if (matchMedia('(max-width:700px)').matches){ card.style.left = card.style.top = ''; return; }   // teléfono: la tarjeta va fija abajo (CSS)
  const cw = card.offsetWidth, ch = card.offsetHeight;
  const below = r.bottom + pad + 12, top = below + ch <= innerHeight - 8 ? below : Math.max(8, r.top - pad - 12 - ch);
  card.style.left = Math.max(12, Math.min(r.left, innerWidth - cw - 12)) + 'px';
  card.style.top = top + 'px';
}
async function guideShow(i){
  const def = guide.def, step = def.steps[i];
  guide.i = i;
  if (step.enter) step.enter();
  if (step.sample && guide.samples && !step.done){ step.done = true; await step.sample(); }
  if (guide.def !== def) return;   // salieron mientras se armaban los ejemplos
  guide.el = guideTarget(step.target);
  $('guideText').textContent = step.text + (step.sample && guide.samples ? ' (Estas capturas son de ejemplo.)' : '');
  $('guideCount').textContent = `${def.title} · paso ${i + 1} de ${def.steps.length}`;
  $('guideBack').disabled = i === 0;
  $('guideNext').textContent = i === def.steps.length - 1 ? 'Terminar' : 'Siguiente';
  $('guideCard').hidden = false;
  // lo alto (la lista de filas) se muestra desde arriba; lo demás, al centro
  if (guide.el) guide.el.scrollIntoView({ block: guide.el.getBoundingClientRect().height > innerHeight * .6 ? 'start' : 'center', inline: 'nearest' });
  guidePlace(); requestAnimationFrame(guidePlace);
  $('guideNext').focus({ preventScroll: true });
}
function guideStart(id){
  const def = GUIDES.find(g => g.id === id);
  if (!def) return;
  $('helpFrame').style.display = 'none'; $('onboard').hidden = true;
  for (const s of def.steps) s.done = false;
  // con trabajo abierto la guía solo señala: nunca mezcla ejemplos con tus capturas
  Object.assign(guide, { def, i: 0, samples: !guideHasWork() });
  if (guide.samples && state.pairs.length){ resetBasic(); renderPairs(); }
  guideShow(0);
}
function guideEnd(){
  if (!guide.def) return;
  guide.def = null; guide.el = null;
  $('guideCard').hidden = true; $('guideSpot').hidden = true;
  if (guideOnlySamples()){ resetBasic(); renderPairs(); }   // los ejemplos no se quedan en tu proyecto
  $('btnHelp').focus();
}
$('guideNext').addEventListener('click', () => { guide.i + 1 < guide.def.steps.length ? guideShow(guide.i + 1) : guideEnd(); });
$('guideBack').addEventListener('click', () => { if (guide.i > 0) guideShow(guide.i - 1); });
$('guideExit').addEventListener('click', guideEnd);
window.addEventListener('resize', guidePlace);
window.addEventListener('scroll', guidePlace, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && guide.def) guideEnd(); });

/* ---------- panel de Ayuda ---------- */
function openHelp(){
  $('helpGuides').innerHTML = GUIDES.map(g => `<button data-start="${g.id}"><b>${esc(g.title)}</b><span>${esc(g.sub)}</span></button>`).join('');
  $('fbStatus').textContent = '';
  $('helpFrame').style.display = 'flex';
}
$('helpGuides').addEventListener('click', e => { const b = e.target.closest('[data-start]'); if (b) guideStart(b.dataset.start); });
$('helpWelcome').addEventListener('click', () => { $('helpFrame').style.display = 'none'; showOnboard(true); });
$('helpClose').addEventListener('click', () => { $('helpFrame').style.display = 'none'; });
$('obGuide').addEventListener('click', () => { $('onboard').hidden = true; openHelp(); });

/* ---------- comentarios: texto libre, sin datos de quien escribe ---------- */
$('fbSend').addEventListener('click', async () => {
  const text = $('fbText').value.trim(), status = $('fbStatus'), btn = $('fbSend');
  if (text.length < 3){ status.textContent = 'Escribe tu comentario primero.'; $('fbText').focus(); return; }
  btn.disabled = true; status.textContent = 'Enviando…';
  try {
    const r = await fetch((serviceHere ? '' : 'https://gatos.pics') + '/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, where: 'creador · ' + state.mode }) });
    if (r.status === 429) throw new Error('Ya enviaste varios hace poco. Prueba más tarde.');
    if (!r.ok) throw new Error('No se pudo enviar (HTTP ' + r.status + ').');
    $('fbText').value = ''; status.textContent = 'Enviado. Gracias: lo leemos todo.';
  } catch (e){ status.textContent = e.message === 'Failed to fetch' ? 'No se pudo enviar: sin conexión con gatos.pics.' : e.message; }
  btn.disabled = false;
});
window.GUIDE = { GUIDES, start: guideStart, end: guideEnd, state: guide, open: openHelp };
