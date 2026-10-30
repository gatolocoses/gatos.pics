/* ---------- lección de la demo (gatos-ops#394) ----------
   La demo del creador (app/demo.js) trae `lesson: 'defectos'` en la raíz del
   paquete y una versión por defecto típico. Esta tarjeta los recorre: cada paso
   pone la fuente a la izquierda y esa versión a la derecha, prende la
   herramienta que mejor lo muestra (Recortes se probó para los halos, pero con
   ocho versiones la fila buscada quedaba fuera de la vista: ahí va zoom) y marca con un recuadro dónde mirar
   (coordenadas en píxeles de la imagen de 960×540 de la demo). La tarjeta no se
   va sola: se cierra con × y se achica con –. Solo existe en la demo: una
   página publicada no trae `lesson` (el servicio no guarda campos de raíz). */
const LESSON_IDS = ['src', 'blur', 'band', 'halo', 'dirty', 'dnr', 'block', 'crush'];
function lessonSteps(){
  return [
    {title: T('Cómo leer una comparación'), v: 'blur',
     text: T('La misma imagen en dos versiones: la fuente a la izquierda y un encode a la derecha. Arrastra la línea del centro, usa la rueda para acercar y las flechas para cambiar de cuadro. Cada paso te muestra un defecto típico de los encodes, exagerado para que se vea fácil.')},
    {title: T('Desenfoque + ruido'), v: 'blur', tools: ['blink'], spot: [600, 367, 330, 151], where: T('mira la tela'),
     text: T('El encode perdió detalle fino y sumó ruido. Mira la tela a rayas: en la fuente las líneas son nítidas, en el encode se empastan.'),
     how: T('<b>Parpadeo</b> alterna las dos versiones en el mismo lugar: lo que cambia salta a la vista.')},
    {title: 'Banding', v: 'band', tools: ['solar'], spot: [30, 80, 260, 240], where: T('mira el cielo'),
     text: T('Donde la fuente tiene un degradado suave, el encode lo muestra en escalones. Pasa en cielos, humo y paredes lisas.'),
     how: T('<b>Solar</b> exagera los cambios pequeños de brillo: los escalones se vuelven franjas.')},
    {title: T('Halos'), v: 'halo', tools: ['zoom'], zoomAt: [270, 38], spot: [18, 12, 520, 52], where: T('mira el borde de las letras'),
     text: T('Contornos claros u oscuros alrededor de los bordes: el resultado de enfocar de más. Se notan en letras y en bordes con mucho contraste.'),
     how: T('Con <b>zoom</b> en las letras se ven los contornos a los dos lados de la línea. <b>Recortes</b> muestra un punto 1:1 en todas las versiones a la vez.')},
    {title: T('Líneas sucias'), v: 'dirty', tools: ['zoom'], zoomAt: [480, 0], spot: [400, 0, 160, 30], where: T('mira el borde de arriba'),
     text: T('Las primeras o últimas filas y columnas de la imagen con otro brillo, como un marco fino. Vienen en muchos Blu-ray; un buen encode las corrige.'),
     how: T('Con <b>zoom</b> en el borde de arriba se ven las filas oscuras del lado del encode; arrastra la línea del centro para comparar.')},
    {title: T('Grano borrado'), v: 'dnr', tools: ['zoom', 'blink'], zoomAt: [480, 430], spot: [400, 370, 160, 120], where: T('mira la superficie'),
     text: T('La fuente tiene grano; el encode lo borró y las superficies quedan lisas, como de cera. Pasa al quitar ruido de más o con pocos bits.'),
     how: T('<b>Zoom</b> y <b>Parpadeo</b>: el grano aparece y desaparece.')},
    {title: T('Bloques'), v: 'block', tools: ['solar'], spot: [30, 357, 330, 162], where: T('mira la sombra'),
     text: T('Cuadros visibles en zonas planas u oscuras: al encoder le faltaron bits.'),
     how: T('<b>Solar</b> resalta los bordes de los cuadros en lo oscuro.')},
    {title: T('Sombras aplastadas'), v: 'crush', tools: ['solar'], spot: [30, 357, 330, 162], where: T('mira la sombra'),
     text: T('El detalle de las zonas oscuras pasa a negro: las formas de la sombra desaparecen.'),
     how: T('<b>Solar</b> aclara lo oscuro: en la fuente aparecen formas, en el encode no queda nada.')},
    {title: T('¿Te animas a probarte?'), v: 'blur', last: true,
     text: T('Ya conoces los defectos más comunes. En la prueba ciega las versiones no tienen nombre: eliges la que se ve mejor y al final se revela cuál era cada una.')},
  ];
}
let lesson = null;   // {steps, i, card, spot, raf, small}
// acerca un punto de la imagen y lo deja bajo la línea del centro: a un lado la
// fuente, al otro la versión (con setZoomAt el punto quedaba donde estaba, lejos de la línea)
function lessonZoomTo(u, v){
  zoom = clamp(4 / (fitScale * dpr()), 1, zmax());
  pan.x = comp.clientWidth * dividerPos - ox - u * fitScale * zoom;
  pan.y = comp.clientHeight / 2 - oy - v * fitScale * zoom;
  clampPan(); applyTransform(); writeHash();
}
// imagen (px) -> punto de la ventana, con el zoom y el desplazamiento de ahora
function lessonClient(u, v){
  const r = comp.getBoundingClientRect();
  return [r.left + ox + pan.x + u * fitScale * zoom, r.top + oy + pan.y + v * fitScale * zoom];
}
const LESSON_TOOLS = {
  blink: {on: () => setBlink(true), off: () => setBlink(false), is: () => blinkMode},
  solar: {on: () => setSolar(true), off: () => setSolar(false), is: () => solarMode},
  zoom: {on: s => lessonZoomTo(s.zoomAt[0], s.zoomAt[1]), off: () => fitView(), is: () => zoom !== 1},
};
function lessonReset(){
  setDiff(false); setBlink(false); setSolar(false);
  if (cropMode || cropUV){ setCropMode(false); if (cropUV) closeCrop(); }
  fitView();
}
function lessonToolsOn(s){ return (s.tools || []).every(t => LESSON_TOOLS[t].is()); }
function lessonToggleTools(){
  const s = lesson.steps[lesson.i], on = lessonToolsOn(s);
  for (const t of s.tools || []) on ? LESSON_TOOLS[t].off(s) : LESSON_TOOLS[t].on(s);
  lessonPaintChip();
}
function lessonPaintChip(){
  const chip = lesson.card.querySelector('.lchip'), s = lesson.steps[lesson.i];
  if (!chip) return;
  const on = lessonToolsOn(s);
  chip.textContent = on ? T('activada') : T('activar');
  chip.classList.toggle('off', !on);
}
function lessonGo(i){
  const s = lesson.steps[i];
  lesson.i = i;
  lessonReset();
  frame = FRAMES[0]; varA = 'src'; varB = s.v;
  loadImg();
  // las herramientas que dependen del tamaño de la imagen esperan a que cargue
  const apply = () => { if (lesson && lesson.i === i) for (const t of s.tools || []) LESSON_TOOLS[t].on(s); };
  if (imgA.complete && imgA.naturalWidth) apply(); else imgA.addEventListener('load', apply, {once: true});
  lessonPaint();
}
function lessonPaint(){
  const {steps, i, card} = lesson, s = steps[i];
  const dots = steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
  const tool = s.how ? `<div class="ltool"><span>${s.how}</span><button class="lchip" type="button"></button></div>` : '';
  const next = s.last
    ? `<button type="button" class="lplay" data-l="test">${T('Probar la prueba ciega')}</button>`
    : `<button type="button" class="lgo" data-l="next">${T('Siguiente ›')}</button>`;
  card.innerHTML = `<div class="lkick"><span>${T`LECCIÓN · ${i + 1} DE ${steps.length}`}</span><span class="lsp"></span>`
    + `<button type="button" data-l="min" title="${T('Minimizar la lección')}">–</button><button type="button" data-l="close" title="${T('Cerrar la lección')}">×</button></div>`
    + `<h3>${s.title}</h3><p>${s.text}</p>${tool}`
    + `<div class="lnav"><button type="button" data-l="prev"${i === 0 ? ' disabled' : ''}>${T('‹ Anterior')}</button><span class="ldots">${dots}</span>${next}</div>`;
  if (s.last) card.querySelector('.lnav').insertAdjacentHTML('beforeend', `<button type="button" data-l="close">${T('Cerrar')}</button>`);
  lessonPaintChip();
  lessonPlace();
}
function lessonPlace(){
  if (!lesson) return;
  const {card} = lesson;
  if (PHONE_MQ.matches){ card.style.bottom = ''; return; }   // teléfono: hoja abajo (CSS)
  card.style.bottom = Math.max(8, innerHeight - comp.getBoundingClientRect().bottom + 12) + 'px';
}
// el recuadro sigue al zoom y al desplazamiento; se esconde si cambian el cuadro o la versión
function lessonTick(){
  if (!lesson) return;
  const s = lesson.steps[lesson.i], spot = lesson.spot;
  const show = s.spot && !lesson.small && frame === FRAMES[0] && varA === 'src' && varB === s.v && imgA.naturalWidth && !testRun;
  spot.hidden = !show;
  if (show){
    const r = comp.getBoundingClientRect(), [x, y] = lessonClient(s.spot[0], s.spot[1]), k = fitScale * zoom;
    Object.assign(spot.style, {left: (x - r.left) + 'px', top: (y - r.top) + 'px', width: s.spot[2] * k + 'px', height: s.spot[3] * k + 'px'});
    spot.firstChild.textContent = s.where;
    spot.classList.toggle('below', y - r.top < 34);   // pegado arriba: el rótulo va debajo
  }
  const chip = lesson.card.querySelector('.lchip');
  if (chip && chip.classList.contains('off') === lessonToolsOn(s)) lessonPaintChip();
  lesson.raf = requestAnimationFrame(lessonTick);
}
function lessonClose(){
  if (!lesson) return;
  cancelAnimationFrame(lesson.raf);
  lesson.card.remove(); lesson.spot.remove();
  lesson = null;
}
function lessonStart(){
  if (lesson || !LESSON_IDS.every(id => VARIANTS.some(v => v.id === id))) return;
  const card = document.createElement('div');
  card.id = 'lesson'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', T('Lección'));
  const spot = document.createElement('div');
  spot.className = 'lspot'; spot.hidden = true; spot.appendChild(document.createElement('span'));
  document.body.appendChild(card); comp.appendChild(spot);
  lesson = {steps: lessonSteps(), i: 0, card, spot, raf: 0, small: false};
  card.addEventListener('click', e => {
    if (e.target.closest('.lchip')) return lessonToggleTools();
    const b = e.target.closest('[data-l]');
    if (!b) return;
    const act = b.dataset.l;
    if (act === 'next') lessonGo(Math.min(lesson.i + 1, lesson.steps.length - 1));
    else if (act === 'prev') lessonGo(Math.max(lesson.i - 1, 0));
    else if (act === 'close') lessonClose();
    else if (act === 'test'){ lessonClose(); lessonReset(); testEnter(); }
    else if (act === 'min' || act === 'grow'){
      lesson.small = act === 'min';
      if (lesson.small) lesson.spot.hidden = true;   // ya, sin esperar al próximo cuadro
      card.classList.toggle('small', lesson.small);
      if (lesson.small) card.innerHTML = `<button type="button" data-l="grow">${T`Lección · ${lesson.i + 1}/${lesson.steps.length}`} ›</button>`;
      else lessonPaint();
    }
  });
  window.addEventListener('resize', lessonPlace);
  lessonGo(0);
  lesson.raf = requestAnimationFrame(lessonTick);
}
