/* ---------- prueba ciega: ordenar las versiones a ciegas (gatos-ops#196, #200) ----------
   Durante la prueba ninguna versión tiene nombre ni número en pantalla
   (gatos-ops#230): solo «Izquierda» y «Derecha», y el lado se sortea en cada
   comparación. Así no se sabe si la de ahora es la que ya se eligió antes.
   Por dentro cada versión sí tiene un número al azar (blindOrder): es como
   las respuestas viajan al servidor.

   La prueba no recorre todos los pares: elige cada comparación (un cuadro entre dos
   versiones) con lo que se va respondiendo (44-plan.js, gatos-ops#347): primero un mínimo
   para cada versión, después casi todo para las que pelean arriba, y para cuando el orden de
   las primeras queda claro o se acaba el presupuesto. El orden sale de la misma cuenta que la
   tabla de todos (Bradley-Terry): lo que no se comparó se estima con lo que sí.

   Al final salen los puestos con los nombres revelados, y en una página
   publicada el resultado se suma solo a la tabla de todos (/api/vote/<token>):
   la introducción lo avisa antes de empezar. Un navegador suma una vez por
   página. Usa el modo ciego del visor: blindOrder ES la numeración.

   En una página publicada la numeración la sortea el SERVIDOR (#207): el
   visor abre una sesión (/api/blind/<token>) y recibe solo números y
   direcciones al azar para las imágenes. Mientras dura la prueba VARIANTS son
   versiones de mentira («n1», «n2»…): ni este código ni las herramientas del
   navegador saben cuál es cuál. Al terminar manda las respuestas en números y
   el servidor contesta qué versión era cada uno. Sin sesión (copia sin
   publicar, o el servidor no responde) la numeración se sortea aquí y las
   imágenes van como blob.

   Una prueba a medias sobrevive a salir de la página (gatos-ops#222): con
   sesión, tras cada respuesta el navegador guarda en su propio almacenamiento
   lo que hace falta para rehacerla (la sesión: números y direcciones al azar;
   el orden y las respuestas). Al volver se ofrece seguir. Nada de eso dice
   qué versión es cada número, y nada nuevo se guarda en el servidor.

   Un enlace con ?test=1 (o #test=1, el de antes) abre la página directo en la introducción
   (gatos-ops#223, #336), sobre fondo opaco: la comparación normal, con sus nombres a
   cada lado, no se ve detrás. La introducción dice qué versiones se comparan,
   en el orden de la página (no dice qué número le toca a cada una). */
const TEST_MAX = 8, TEST_KEEP_MS = 2 * 3600e3;   // lo que vive una sesión en el servidor
let testRun = null, testMine = null, testSeen = false;
const testToken = (location.pathname.match(/^\/p\/([A-Za-z0-9_-]{10,64})/) || [])[1] || null;
const testPanel = $('testPanel'), testBody = $('testBody');
const shuffled = list => { const a = [...list]; for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const testPairs = () => VARIANTS.flatMap((a, i) => VARIANTS.slice(i + 1).map(b => [a.id, b.id]));
const testShared = (a, b, frames = FRAMES) => frames.filter(f => hasFrame(a, f) && hasFrame(b, f));
// se ofrece con 2 a 8 versiones y solo si cada par comparte al menos un cuadro
const testOk = () => VARIANTS.length >= 2 && VARIANTS.length <= TEST_MAX && testPairs().every(([a, b]) => testShared(a, b).length > 0);
/* Comprobaciones (gatos-ops#312), si la página las pide en su manifiesto (`blind`). Son comparaciones
   de más que NO entran en el resultado: dicen qué tan firmes fueron las respuestas.
   - control: una vez, la misma versión en los dos lados. Quien elige un lado adivina.
   - repeat: al final, una o dos comparaciones ya respondidas, con los lados cambiados.
   Salen del mismo plan, así «Atrás», retomar y «seguir» las rehacen igual que a las demás. */
function* testControl(run, v){
  const f = run.frames.find(f => hasFrame(v, f)); if (f === undefined) return;
  const key = 'c|' + v + '|' + f; let r = run.chkKnown ? run.chkKnown.get(key) : undefined;
  if (r === undefined) r = yield {a: v, b: v, f, chk: 'control'};
  run.checks.push({k: 'control', key, v, f, r});
}
function* testRepeats(run, n){
  const dec = run.games.filter(g => g[3] !== 't');
  const pick = [...new Set(n === 1 ? [dec[dec.length >> 1]] : [dec[0], dec[dec.length - 1]])].filter(Boolean);
  for (const [a, b, f, r] of pick){
    const key = 'r|' + [a, b].sort().join('|') + '|' + f; let r2 = run.chkKnown ? run.chkKnown.get(key) : undefined;
    if (r2 === undefined) r2 = yield {a: b, b: a, f, chk: 'repeat'};   // los lados, al revés
    const first = r === 'a' ? a : b, again = r2 === 't' ? null : r2 === 'a' ? b : a;
    run.checks.push({k: 'repeat', key, a, b, f, r: r2, same: again === first});
  }
}
const testEsc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const testName = id => `<b style="color:${testEsc(variant(id).color || '#e8e8f0')}">${testEsc(variant(id).name || id)}</b>`;
const testHttp = () => !!testToken && location.protocol !== 'file:';
// La marca «ya envié» de este navegador vale para una época de la tabla
// (gatos-ops#218): guarda la época en que se sumó, o '1' si la página nunca se
// reinició. testEpoch: undefined = todavía no se sabe (entonces la marca vale).
let testEpoch;
const testMark = () => { try { return localStorage.getItem('gatosVoted:' + testToken); } catch(e){ return null; } };
const testVoted = () => { const m = testMark(); return !!m && (testEpoch === undefined || m === (testEpoch || '1')); };
// Sello del resultado que este navegador ya sumó (gatos-ops#252): lo da el
// servidor, es opaco, y al repetir la prueba se devuelve para que el resultado
// nuevo reemplace a aquel. Vale para la época en que se emitió, como la marca.
const testSealKey = 'gatosSeal:' + testToken;
function testSeal(){
  try { const j = JSON.parse(localStorage.getItem(testSealKey)); return j && typeof j.s === 'string' && testVoted() && j.e === testMark() ? j.s : null; } catch(e){ return null; }
}
const testKeepSeal = s => { try { if (s) localStorage.setItem(testSealKey, JSON.stringify({e: testEpoch || '1', s})); } catch(e){} };
// este resultado cuenta: el navegador todavía no sumó en esta época, o tiene con qué reemplazar lo que sumó
const testCounts = () => !testVoted() || !!testSeal();
// en una copia sin publicar la clave es su ruta; la vista previa incrustada (about:srcdoc) no guarda nada
const testLocalOk = !testToken && location.protocol !== 'about:' && !/^about:/.test(location.href);
const testKey = 'gatosTest:' + (testToken || location.pathname);
function testSave(){
  const run = testRun; if (!run || !(run.session || testLocalOk)) return;
  // sin sesión (gatos-ops#264) se guarda también la numeración y el orden de los cuadros: en una copia local no hay servidor que los recuerde
  const local = run.session ? null : {ids: blindOrder.map(v => v.id), frames: run.frames};
  try { localStorage.setItem(testKey, JSON.stringify({v: 2, t: run.t, s: run.session, local, order: run.order, flips: [...run.flips], extra: [...run.extra], chk: run.chkKnown ? [...run.chkKnown] : null, answers: run.answers, more: run.more || 0, held: run.held})); } catch(e){}
}
const testForget = () => { try { localStorage.removeItem(testKey); } catch(e){} };
// la prueba a medias de esta página, si la hay, respondió algo y su sesión todavía puede estar viva
function testSaved(){
  if (!(testHttp() || testLocalOk) || testRun) return null;
  try {
    const j = JSON.parse(localStorage.getItem(testKey));
    if (!j || j.v !== 2 || Date.now() - j.t >= TEST_KEEP_MS || !j.answers.length) return null;   // v2 (#347): una prueba del plan de antes no se retoma
    if (testHttp() && j.s && j.s.sid && j.s.n === VARIANTS.length) return j;
    // copia local: vale si sigue teniendo exactamente esas versiones y esos cuadros
    if (testLocalOk && j.local && j.local.ids.length === VARIANTS.length && j.local.ids.every(id => VARIANTS.some(v => v.id === id))
      && j.local.frames.every(f => FRAMES.some(x => String(x) === String(f)))) return j;
  } catch(e){}
  return null;
}
function testOpen(html){ testSeeEnd(); testBody.innerHTML = html; testPanel.style.display = 'flex'; const b = testBody.querySelector('button'); if (b) b.focus(); }
function testClose(){ if (testRun && testRun.settled) return;   // hay que elegir: ver el resultado o seguir
  testPanel.classList.remove('solid');
  if (testPanel.style.display === 'flex'){ testPanel.style.display = 'none'; $('testBtn').focus(); } }

// el botón (o G): si hay una prueba a medias, primero se ofrece seguirla
function testEnter(){ if (testOpening) return; const saved = testSaved(); if (saved) testOffer(saved); else testIntro(); }
function testOffer(saved){
  const n = saved.answers.length;
  testOpen(`<h2>${T('Prueba ciega a medias')}</h2>
    <p>${n === 1 ? T('Dejaste una prueba ciega sin terminar en esta página, con 1 respuesta.') : T`Dejaste una prueba ciega sin terminar en esta página, con ${n} respuestas.`} ${T('Puedes seguir donde ibas.')}</p>
    <p class="hint" id="testNote" role="status"></p>
    <div class="acts"><button class="xbtn" data-test="resume">${T('Seguir la prueba')}</button><button data-test="fresh">${T('Empezar otra')}</button><button data-test="close">${T('Ahora no')}</button></div>`);
}
// La sesión vive en la memoria del servidor: si venció o el servicio se
// reinició ya no hay cómo pedir sus imágenes, y la prueba empieza de nuevo.
async function testResume(){
  const saved = testSaved(); if (!saved){ testIntro(); return; }
  const btn = testBody.querySelector('[data-test="resume"]'); if (btn) btn.disabled = true;
  if (saved.local){ testStart(saved); return; }   // copia local: no hay sesión que pueda haber vencido
  let alive = false;
  try { alive = (await fetch('b/' + Object.values(saved.s.pics[1])[0], {method: 'HEAD', signal: testWait()})).ok; } catch(e){}
  // la tabla pudo reiniciarse mientras tanto: la época de ahora, no la guardada
  if (alive) try { const j = await (await fetch('/api/vote/' + testToken, {signal: testWait()})).json(); testEpoch = j.epoch || null; } catch(e){}
  if (testRun) return;
  if (alive){ testStart(saved); return; }
  testForget();
  testIntro(T('La prueba que dejaste ya venció: hay que empezar otra.'));
}
/* Aviso de privacidad (gatos-ops#310). Desde que quien publica puede ver el detalle de cada resultado,
   ya no es cierto que «no se guarda nada»: aquí se dice qué se guarda, qué no, quién lo ve y hasta cuándo. */
const testPrivLink = `<button class="tlink" data-test="privacy">${T('Qué se guarda')}</button>`;
function testPrivacy(back){
  testOpen(`<h2>${T('Privacidad de la prueba ciega')}</h2>
    <p><b>${T('Qué se guarda:')}</b> ${T('tus respuestas (qué lado elegiste en cada comparación), lo que marques o escribas en «¿Por qué?», cuánto tardaste en cada respuesta y la hora del envío, redondeada al minuto.')}</p>
    <p><b>${T('Qué no se guarda:')}</b> ${T('tu dirección, tu navegador, una cuenta ni cookies de seguimiento. Tu resultado no lleva nada que diga quién eres. La dirección se usa un momento para frenar abusos y no se guarda.')}</p>
    <p><b>${T('Quién lo ve:')}</b> ${T('la tabla con los totales es pública. El detalle (respuestas, motivos y notas) solo lo ve quien publicó la página.')}</p>
    <p><b>${T('Hasta cuándo:')}</b> ${T('mientras exista la página, o hasta que quien la publicó reinicie sus resultados.')}</p>
    <p class="hint">${T('En tu navegador queda una marca para que repetir la prueba reemplace tu resultado en vez de sumar otro. Si escribes una nota, no pongas datos personales.')}</p>
    <div class="acts"><button class="xbtn" data-test="${back === 'mine' ? 'mine' : 'intro'}">${T('Volver')}</button></div>`);
}
function testIntro(note){
  const n = VARIANTS.length, hi = testBudget(n, BLIND_CFG);
  testOpen(`<h2>${T('Prueba ciega')}</h2>
    <p>${T`Vas a ordenar las ${n} versiones de mejor a peor sin saber cuál es cuál. En cada comparación solo ves «izquierda» y «derecha»: nada dice qué versión es ni si ya la viste antes.`}</p>
    <p id="testNames">${T('Se comparan:')} ${VARIANTS.map(v => testName(v.id)).join(', ')}.</p>
    <p>${n === 2 ? T`Son como mucho ${hi} comparaciones.` : T`Son como mucho ${hi} comparaciones, y suelen ser bastantes menos: la prueba elige cada una según lo que vas respondiendo y se detiene cuando el orden queda claro.`} ${T('En cada una eliges la que se ve mejor, o empate. Puedes usar zoom, diff y parpadeo.')}</p>
    ${BLIND_CFG.repeat || BLIND_CFG.control ? `<p id="testChkNote">${T('En esta página algunas comparaciones se repiten o son de control: sirven para saber qué tan firmes son las respuestas y no cambian tu resultado.')}</p>` : ''}
    ${testAreas() ? `<p id="testAreaNote">${T('En esta página las versiones no tienen la misma área de imagen: durante la prueba solo se ve la parte que todas comparten.')}</p>` : ''}
    ${testHttp() ? `<p id="testIntroNote">${testSeal() ? T('Ya enviaste un resultado de esta página desde este navegador: si terminas esta prueba, el nuevo reemplaza al anterior.') : testVoted() ? T('Ya enviaste un resultado de esta página desde este navegador: esta prueba no se suma otra vez.') : T('Al terminar, tu resultado se suma a la tabla de todos.') + ' ' + testPrivLink}</p>` : ''}
    <div class="acts"><button class="xbtn" data-test="start">${T('Empezar')}</button>${testToken ? `<button data-test="all">${T('Ver la tabla de todos')}</button>` : ''}${testHttp() ? `<button data-test="link" title="${T('Copia el enlace que abre esta página directo en la prueba ciega')}">${T('Copiar enlace a la prueba')}</button>` : ''}<button data-test="close">${T('Cancelar')}</button></div>
    ${testToken ? `<p class="hint">${T('Ver la tabla antes de hacer la prueba condiciona tu juicio.')}</p>` : ''}
    ${typeof note === 'string' ? `<p class="hint" role="status">${testEsc(note)}</p>` : ''}`);
  // con marca y sin saber la época: se pregunta una vez, por si la tabla se reinició después
  if (testHttp() && testMark() && testEpoch === undefined && !testIntro.asked){
    testIntro.asked = true;
    fetch('/api/vote/' + testToken).then(r => r.ok ? r.json() : null).then(j => {
      if (!j || testEpoch !== undefined) return;
      testEpoch = j.epoch || null;
      if (!testRun && testPanel.style.display === 'flex' && testBody.querySelector('#testIntroNote')) testIntro(note);
    }).catch(() => {});
  }
}
// el enlace directo a la prueba (testLink), también desde la introducción (gatos-ops#226)
async function testCopyLink(btn){
  const url = testLink();
  let ok = false;
  if (navigator.clipboard && window.isSecureContext){ try { await navigator.clipboard.writeText(url); ok = true; } catch(e){} }
  if (!ok){ prompt(T('Copia este enlace:'), url); return; }
  btn.textContent = T('copiado ✓');
  setTimeout(() => { if (btn.isConnected) btn.textContent = T('Copiar enlace a la prueba'); }, 1500);
}
let testOpening = false;
// ninguna petición de la prueba espera para siempre (gatos-ops#239)
const testWait = () => typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined;
async function testStart(saved){
  if (testRun || testOpening) return;
  testSeeEnd();
  let session = saved ? saved.s : null;
  if (!saved) testForget();
  if (!saved && testHttp()){
    // el panel sigue puesto mientras se abre la sesión (gatos-ops#239): con el enlace directo tapa la comparación con nombres
    testOpening = true;
    testOpen(`<h2>${T('Prueba ciega')}</h2><p class="hint" role="status">${T('Preparando la prueba…')}</p>`);
    try { const r = await fetch('/api/blind/' + testToken, {method: 'POST', headers: {'accept-language': I18N.lang}, signal: testWait()}); if (r.ok) session = await r.json(); } catch(e){}
    testOpening = false;
    // la página cambió desde que se cargó esta pestaña: la sesión trae otra cantidad de versiones o cuadros que aquí no existen
    if (session && (session.n !== VARIANTS.length || session.frames.some(f => !FRAMES.some(x => String(x) === f)))){
      testOpen(`<h2>${T('Prueba ciega')}</h2><p>${T('Esta página cambió desde que la abriste. Recárgala para hacer la prueba con las versiones de ahora.')}</p>
        <div class="acts"><button class="xbtn" data-test="reload">${T('Recargar la página')}</button><button data-test="close">${T('Cerrar')}</button></div>`);
      return;
    }
  }
  testClose();
  closeCrop(); pendingCropFraction = null;   // el panel de recortes numera las versiones: fuera durante la prueba
  if (cropMode) setCropMode(false);
  const real = VARIANTS, before = {varA, varB, frame};
  if (!saved && session && session.epoch !== undefined) testEpoch = session.epoch;   // al retomar, la época guardada puede ser vieja
  if (session){
    // versiones de mentira: la «Variante k» es n<k>, y de cada una solo se sabe qué cuadros tiene
    VARIANTS = Array.from({length: session.n}, (_, k) => ({id: 'n' + (k + 1), name: '', color: '#e8e8f0', frames: Object.keys(session.pics[k + 1])}));
    blindPics = Object.fromEntries(VARIANTS.map((v, k) => [v.id, session.pics[k + 1]]));
    blindOrder = VARIANTS;
  } else blindOrder = saved && saved.local ? saved.local.ids.map(id => VARIANTS.find(v => v.id === id)) : shuffled(VARIANTS);   // la numeración de ESTA prueba
  // el orden en que entran a ordenarse es otro sorteo: el número no dice nada de cuándo le toca a cada una
  const frames = session ? session.frames.map(f => FRAMES.find(x => String(x) === f)).filter(f => f !== undefined)
    : saved && saved.local ? saved.local.frames.map(f => FRAMES.find(x => String(x) === String(f))) : shuffled(FRAMES);
  testRun = {sid: session && session.sid, session, t: saved ? saved.t : Date.now(), real, order: saved ? saved.order : shuffled(VARIANTS.map(v => v.id)), frames,
    flips: new Map(saved ? saved.flips : []), extra: new Map(saved && saved.extra || []), more: saved && saved.more || 0, blind: BLIND_CFG, checks: [], chkKnown: saved && saved.chk ? new Map(saved.chk) : null, answers: saved ? saved.answers : [], games: [], before};
  // lo que quedó en espera ya está sumado en el servidor: no se manda otra vez
  if (saved && saved.held !== undefined){ testRun.held = saved.held; testRun.holdP = Promise.resolve(); }
  blindMode = true; blindSides = true;
  document.body.classList.add('testing');
  $('testBar').hidden = false;
  pageTitle.textContent = T('Prueba ciega'); document.title = pageTitle.textContent;
  hideTip();
  testReplay();
  computeFit(); applyTransform();
}
// rehace el plan con las respuestas dadas y deja en pantalla la comparación que toca (o termina)
function testReplay(){
  const run = testRun, gen = testPlan(run);
  run.games = []; run.checks = [];
  let step = gen.next();
  for (const r of run.answers){ if (step.done) break; step = gen.next(r); }
  run.gen = gen;
  if (step.done) testSettled(step.value); else { run.cur = step.value; testShow(); }
}
/* El orden ya salió de las respuestas. Se ofrece seguir una vez (gatos-ops#220, #347): quien sigue
   juega tantas comparaciones más como versiones hay, entre las que van arriba, con la misma
   numeración y sin que se haya revelado nada. En una página publicada el resultado se manda ya, en
   espera (`hold`): cuenta desde ahora y el resultado final de esta sesión lo reemplaza, así que irse
   a la mitad no pierde nada ni suma dos veces. */
// comparaciones como mucho: el presupuesto (más «seguir») y las comprobaciones
const testMax = run => testBudget(VARIANTS.length, run.blind || {}) + (run.more || 0) * VARIANTS.length + (BLIND_CFG.control ? 1 : 0) + (BLIND_CFG.repeat || 0);
// queda algún par con cuadros sin usar (si no, seguir no tiene qué preguntar)
const testRoom = run => testPairs().some(([a, b]) => testShared(a, b, run.frames).length > run.games.filter(g => (g[0] === a && g[1] === b) || (g[0] === b && g[1] === a)).length);
function testSettled(groups){
  const run = testRun;
  if (run.more || !testRoom(run)){ testFinish(groups); return; }
  run.settled = groups;
  if (run.sid && !run.holdP) run.holdP = testHold(run, groups);
  testSave();
  testOpen(`<h2>${T('Ya hay suficientes respuestas')}</h2>
    <p>${T`Con tus ${run.games.length} respuestas ya se pueden ordenar las versiones. Puedes ver tu resultado ahora o seguir con ${VARIANTS.length} comparaciones más entre las que van arriba: si sigues, tu resultado se actualiza al terminar.`}</p>
    <div class="acts"><button class="xbtn" data-test="done">${T('Ver mi resultado')}</button><button data-test="more">${T('Seguir comparando las mejores')}</button></div>`);
}
async function testHold(run, groups){
  const num = new Map(blindOrder.map((v, i) => [v.id, i + 1])), n = id => num.get(id), count = testCounts(), old = testSeal();
  const body = {sid: run.sid, rank: groups.map(g => g.map(n)), games: run.games.map(([a, b, f, r]) => [n(a), n(b), f, r]), extra: testExtras(run, run.games), checks: testChecks(run, n), count, hold: true, ...(old ? {replaces: old} : {})};
  try {
    const r = await fetch('/api/vote/' + testToken, {method: 'POST', headers: {'content-type': 'application/json', 'accept-language': I18N.lang}, body: JSON.stringify(body), signal: testWait()});
    if (!r.ok) return;
    const j = await r.json();
    if (j.epoch !== undefined) testEpoch = j.epoch;
    if (count && j.counted !== false) try { localStorage.setItem('gatosVoted:' + testToken, testEpoch || '1'); } catch(e){}
    testKeepSeal(j.seal);
    run.held = count && j.counted !== false;   // lo que mande esta sesión al final cuenta (reemplaza) solo si esto contó
    if (testRun === run) testSave();
  } catch(e){}
}
function testMore(){
  const run = testRun; if (!run || !run.settled) return;
  run.more = (run.more || 0) + 1; run.settled = null;   // las respuestas siguen: el plan las rehace y continúa
  testPanel.style.display = 'none';
  testReplay();
}
/* Área común (gatos-ops#305): si las versiones no tienen la misma área de imagen (una con el
   cuadro más alto, otra recortada y puesta sobre negro), las bandas dirían cuál es cuál. Con
   `frame_areas` en el manifiesto, durante la prueba cada imagen se recorta al área que todas
   comparten en ese cuadro. Se aplica al cargar cada imagen: la anterior conserva su recorte. */
const testArea = () => { const a = blindSides ? FRAME_AREAS[String(frame)] : null; return Array.isArray(a) && a.length === 4 ? a : null; };
function testClipOne(el){
  const a = testArea(), w = el.naturalWidth || el.width, h = el.naturalHeight || el.height;
  const pct = n => Math.max(0, Math.min(100, n)).toFixed(4) + '%';
  el.style.clipPath = a && w && h ? `inset(${pct(a[1] / h * 100)} ${pct((w - a[0] - a[2]) / w * 100)} ${pct((h - a[1] - a[3]) / h * 100)} ${pct(a[0] / w * 100)})` : '';
}
imgA.addEventListener('load', () => { testClipOne(imgA); testClipOne(diffCanvas); });
imgB.addEventListener('load', () => { testClipOne(imgB); testClipOne(diffCanvas); });
const testAreas = () => VARIANTS.length && FRAMES.some(f => FRAME_AREAS[String(f)]);
/* Lo opcional de cada respuesta (gatos-ops#310): cuánto tardó, y si quien responde quiere, qué notó
   (etiquetas rápidas y una nota corta). Se marca ANTES de elegir, así saltarlo no cuesta ningún toque.
   Va por par y cuadro (run.extra), en los números de la prueba: no dice qué versión es cuál. */
const testWhy = $('testWhy'), testWhyNote = $('testWhyNote');
const testWhyTags = () => [...testWhy.querySelectorAll('[data-tag][aria-pressed="true"]')].map(b => b.dataset.tag);
// Marcar dónde (gatos-ops#312): con el botón armado, el siguiente toque en la imagen no mueve nada:
// guarda ese punto (de 0 a 1 del ancho y el alto de la imagen) para la respuesta de esta comparación.
let testMarkArmed = false, testMarkAtPoint = null;
function testMarkUi(){ const b = $('testMarkBtn'); b.setAttribute('aria-pressed', String(testMarkArmed)); b.textContent = testMarkAtPoint ? T('Punto marcado ✓') : testMarkArmed ? T('Toca la imagen…') : T('Marcar dónde'); }
function testMarkAt(cx, cy){
  const r = comp.getBoundingClientRect(), {nw, nh} = naturalDims();
  testMarkAtPoint = [clamp(((cx - r.left) - ox - pan.x) / zoom / fitScale / nw, 0, 1), clamp(((cy - r.top) - oy - pan.y) / zoom / fitScale / nh, 0, 1)];
  testMarkArmed = false; testMarkUi();
  const dot = $('testDot'); dot.style.left = (cx - r.left) + 'px'; dot.style.top = (cy - r.top) + 'px'; dot.hidden = false;
  clearTimeout(testMarkAt.t); testMarkAt.t = setTimeout(() => { dot.hidden = true; }, 1200);
}
$('testMarkBtn').addEventListener('click', () => { testMarkArmed = !testMarkArmed; if (testMarkArmed) testMarkAtPoint = null; testMarkUi(); });
function testWhyReset(){ for (const b of testWhy.querySelectorAll('[data-tag]')) b.setAttribute('aria-pressed', 'false'); testWhyNote.value = ''; testMarkArmed = false; testMarkAtPoint = null; testMarkUi(); $('testDot').hidden = true; }
testWhy.addEventListener('click', e => { const b = e.target.closest('[data-tag]'); if (b) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); });
$('testWhyBtn').addEventListener('click', () => { testWhy.hidden = !testWhy.hidden; $('testWhyBtn').setAttribute('aria-expanded', String(!testWhy.hidden)); computeFit(); applyTransform(); });
const testExtraKey = g => [g.a, g.b].sort().join('|') + '|' + g.f;
function testShow(){
  const g = testRun.cur;
  testWhyReset(); testRun.shownAt = performance.now();
  varA = g.a; varB = g.b; frame = g.f;
  $('testStep').textContent = T`Comparación ${testRun.answers.length + 1} · como mucho ${testMax(testRun)} · ¿cuál se ve mejor?`;
  $('testLeft').textContent = '← ' + T('Izquierda');
  $('testRight').textContent = T('Derecha') + ' →';
  $('testBack').disabled = !testRun.answers.length;
  testSave();
  loadImg();
  setTimeout(() => { if (testRun && testRun.cur === g) testWarm(); }, 120);   // primero las de ahora
}
// Precarga (gatos-ops#234): mientras se mira una comparación se piden las
// imágenes de la que sigue, sea cual sea la respuesta. El plan es determinista:
// se simula sobre una copia (lados y cuadros elegidos en la copia no cuentan).
function testWarm(){
  const run = testRun, cur = run && run.cur, seen = new Set();
  if (!cur || run.settled) return;
  run.warm = [];
  for (const r of ['a', 'b', 't']){
    const sim = {...run, flips: new Map(run.flips), games: [], checks: []}, gen = testPlan(sim);
    let step = gen.next();
    for (const x of [...run.answers, r]){ if (step.done) break; step = gen.next(x); }
    if (step.done) continue;
    for (const id of [step.value.a, step.value.b]){
      const k = id + '|' + step.value.f; if (seen.has(k)) continue; seen.add(k);
      srcFor(id, step.value.f).then(u => { if (testRun !== run || run.cur !== cur) return; const im = new Image(); im.src = u; run.warm.push(im); }).catch(() => {});
    }
  }
}
function testPick(r){
  if (!testRun || testRun.settled) return;
  const run = testRun;
  if (run.cur){
    const x = {ms: Math.round(performance.now() - (run.shownAt || performance.now()))}, tags = testWhyTags(), note = testWhyNote.value.trim().slice(0, 200);
    if (tags.length) x.t = tags; if (note) x.n = note; if (testMarkAtPoint) x.p = testMarkAtPoint;
    run.extra.set(testExtraKey(run.cur), x);
  }
  run.answers.push(r);
  const step = run.gen.next(r);   // el plan anota la respuesta en run.games
  if (step.done) testSettled(step.value); else { run.cur = step.value; testShow(); }
}
// las comprobaciones, en los números de la prueba (el servidor sabe qué versión es cada uno)
const testChecks = (run, n) => run.checks.map(c => c.k === 'control' ? {k: 'control', v: n(c.v), f: String(c.f), r: c.r} : {k: 'repeat', a: n(c.a), b: n(c.b), f: String(c.f), same: c.same});
// lo opcional, alineado con las comparaciones que se mandan (null donde no hay nada)
const testExtras = (run, games) => games.map(([a, b, f]) => run.extra.get([a, b].sort().join('|') + '|' + f) || null);
function testBackOne(){ if (testRun && !testRun.settled && testRun.answers.length){ testRun.answers.pop(); testReplay(); } }
// sale del modo: vuelve la vista de antes, se olvida la numeración y se sueltan las imágenes sin nombre
function testLeave(){
  const before = testRun.before;
  if (testRun.sid){ VARIANTS = testRun.real; blindPics = null; }   // vuelven las versiones de verdad
  testRun = null; blindOrder = null; blindSides = false;
  testWhy.hidden = true; $('testWhyBtn').setAttribute('aria-expanded', 'false'); testWhyReset();
  for (const el of [imgA, imgB, diffCanvas]) el.style.clipPath = '';   // fuera de la prueba la página se ve entera
  testForget();   // terminada o abandonada a propósito: ya no hay nada que seguir
  document.body.classList.remove('testing');
  $('testBar').hidden = true;
  ({varA, varB, frame} = before);
  setBlind(false);
  dropBlindSrc();
  computeFit(); applyTransform();
}
function testQuit(){ if (testRun && confirm(T('¿Salir de la prueba? Se pierde lo que llevas.'))) testLeave(); }
function testFinish(rank){
  const run = testRun, games = run.games, sid = run.sid, num = new Map(blindOrder.map((v, i) => [v.id, i + 1]));
  run.settled = null; testSeen = false;
  testLeave();
  if (sid){
    // con sesión todavía no se sabe qué era cada número: las respuestas van en números y el servidor lo revela
    const n = id => num.get(id);
    testMine = {sid, run, count: testCounts(), state: 'sending', rank: rank.map(g => g.map(n)), games: games.map(([a, b, f, r]) => [n(a), n(b), f, r]), extra: testExtras(run, games), checks: testChecks(run, n), chk: run.checks.slice()};
  } else testMine = {rank, games, extra: testExtras(run, games), checks: testChecks(run, id => id), chk: run.checks.slice(), state: !testHttp() ? 'local' : testCounts() ? 'sending' : 'voted'};
  testResult();
  if (testMine.state === 'sending') testSend();
}
// el resultado se suma solo al terminar; si falla queda el botón para reintentar
async function testSend(){
  const mine = testMine;
  mine.state = 'sending'; if (testMine === mine && testBody.querySelector('#testNote')) testResult();
  try {
    // si ya se mandó en espera (#220), este lo reemplaza: cuenta solo si aquel contó
    if (mine.run && mine.run.holdP){ await mine.run.holdP; if (mine.run.held !== undefined) mine.count = mine.run.held; }
    const old = testSeal();
    const body = {...(mine.sid ? {sid: mine.sid, rank: mine.rank, games: mine.games, extra: mine.extra, checks: mine.checks, count: mine.count} : {rank: mine.rank, games: mine.games, extra: mine.extra, checks: mine.checks}), ...(old ? {replaces: old} : {})};
    const r = await fetch('/api/vote/' + testToken, {method: 'POST', headers: {'content-type': 'application/json', 'accept-language': I18N.lang}, body: JSON.stringify(body)});
    const j = await r.json().catch(() => ({}));
    // la página cambió de versiones a mitad de la prueba (gatos-ops#228): no se suma y reintentar no sirve;
    // se muestra igual el resultado si esta copia de la página todavía conoce esas versiones
    const stale = r.status === 409 && !!mine.sid && Array.isArray(j.reveal);
    if (stale) mine.stale = true;
    const known = !!mine.sid && Array.isArray(j.reveal) && j.reveal.every(v => VARIANTS.some(x => x.id === v));
    if (!r.ok && !(stale && known)) throw new Error(j.error || 'HTTP ' + r.status);
    if (j.limited || j.counted === false) mine.count = false;
    // se sumó, pero esta pestaña es de antes de un cambio de la página y no conoce esas versiones
    if (mine.sid && !known){ mine.stale = true; if (mine.count !== false) try { localStorage.setItem('gatosVoted:' + testToken, (j.epoch !== undefined ? j.epoch : testEpoch) || '1'); } catch(e){}
      throw new Error(T('la página cambió desde que la abriste')); }
    if (mine.sid){   // la revelación: qué versión era cada número
      const id = k => j.reveal[k - 1];
      mine.rank = mine.rank.map(g => g.map(id)); mine.games = mine.games.map(([a, b, f, r]) => [id(a), id(b), f, r]);
      mine.sid = null;
    }
    if (j.epoch !== undefined) testEpoch = j.epoch;
    if (!stale && mine.count !== false) try { localStorage.setItem('gatosVoted:' + testToken, testEpoch || '1'); } catch(e){}
    if (!stale) testKeepSeal(j.seal);
    mine.state = stale ? 'stale' : j.limited ? 'limited' : mine.count === false ? 'voted' : j.replaced ? 'replaced' : 'sent';
  } catch (e){ mine.state = 'failed'; mine.error = e.message; }
  if (testMine === mine && testBody.querySelector('#testNote')) testResult();
}
// lo que dijeron las comprobaciones de esta prueba, para quien la hizo
function testChkLine(){
  const c = testMine.chk || [], rep = c.filter(x => x.k === 'repeat'), ctl = c.find(x => x.k === 'control'), out = [];
  if (rep.length) out.push(T`Se repitieron ${rep.length} comparaciones con los lados cambiados: elegiste la misma versión en ${rep.filter(x => x.same).length}.`);
  if (ctl) out.push(ctl.r === 't' ? T('En la comparación de control (la misma versión en los dos lados) dijiste empate: bien visto.') : T('En la comparación de control los dos lados eran la misma versión, y elegiste uno.'));
  return out.length ? `<p class="hint" id="testChkLine">${out.map(testEsc).join(' ')}</p>` : '';
}
function testResult(){
  const st = testMine.state, http = testHttp();
  if (testMine.sid){   // todavía sin revelar: solo el estado (y reintentar si falló)
    testOpen(`<h2>${T('Tu resultado')}</h2>
      <p class="hint" id="testNote" role="status">${st === 'failed' ? testEsc(T`No se pudo enviar tu resultado: ${testMine.error}`) : T('Enviando tus respuestas para saber qué versión era cada una…')}</p>
      <div class="acts">${st !== 'failed' ? '' : testMine.stale ? `<button class="xbtn" data-test="reload">${T('Recargar la página')}</button>` : `<button class="xbtn" data-test="send">${T('Reintentar el envío')}</button>`}<button data-test="close">${T('Cerrar')}</button></div>`);
    return;
  }
  const note = {local: T('Esta copia no está publicada en gatos.pics: el resultado no se envía.'), voted: T('Ya habías enviado un resultado de esta página desde este navegador: este no se sumó.'),
    sending: T('Sumando tu resultado a la tabla de todos…'), sent: T('Tu resultado se sumó a la tabla de todos.'),
    replaced: T('Tu resultado reemplazó en la tabla de todos al que habías enviado antes desde este navegador.'),
    limited: T('Llegaron demasiados resultados desde tu conexión en la última hora: este no se sumó.'),
    stale: T('La página cambió de versiones mientras hacías la prueba: este resultado no se sumó. Recarga la página para hacer la prueba con las versiones de ahora.'), failed: T`No se pudo enviar tu resultado: ${testMine.error}`}[st];
  // lo que respondiste sobre cada versión: comparaciones ganadas, empatadas y perdidas
  const row = Object.fromEntries(VARIANTS.map(v => [v.id, {w: 0, t: 0, l: 0}]));
  for (const [a, b, , r] of testMine.games){ if (r === 't'){ row[a].t++; row[b].t++; } else { row[r === 'a' ? a : b].w++; row[r === 'a' ? b : a].l++; } }
  let place = 1;
  const lines = testMine.rank.map(g => { const p = place; place += g.length;
    return g.map(id => `<tr><td>${p}º</td><td>${testName(id)}</td><td>${row[id].w}-${row[id].t}-${row[id].l}</td></tr>`).join(''); }).join('');
  testOpen(`<h2>${T('Tu resultado')}</h2>
    <table class="ttable"><tr><th>${T('Puesto')}</th><th>${T('Versión')}</th><th title="${T('comparaciones ganadas, empatadas y perdidas')}">${T('G-E-P')}</th></tr>${lines}</table>
    ${testChkLine()}
    <details class="tgames"${testSeen ? ' open' : ''}><summary>${T('Tus respuestas, comparación por comparación')}</summary>
      <table class="tgtable"><tr><th>${T('Cuadro')}</th><th>${T('Izquierda')}</th><th>${T('Derecha')}</th><th>${T('Elegiste')}</th><th></th></tr>
      ${testMine.games.map(([a, b, f, r], i) => `<tr><td>${testEsc(FRAME_LABELS[f] || f)}</td><td>${testName(a)}</td><td>${testName(b)}</td><td>${r === 't' ? T('Empate') : testName(r === 'a' ? a : b)}</td><td>${testCanSee(a, b, f) ? `<button data-test="see" data-i="${i}" title="${T('Abre esta comparación otra vez, con las mismas versiones a cada lado')}">${T('Ver')}</button>` : ''}</td></tr>`).join('')}</table></details>
    <p class="hint">${T`Respondiste ${testMine.games.length} comparaciones. Los pares que no viste se ordenaron con tus respuestas: si una le gana a otra y esa a una tercera, la primera va antes.`}</p>
    <p class="hint" id="testNote" role="status">${testEsc(note)}${http && st !== 'local' ? ` <button class="tlink" data-test="privacy-mine">${T('Qué se guarda')}</button>` : ''}</p>
    <div class="acts">${st === 'failed' ? `<button class="xbtn" data-test="send">${T('Reintentar el envío')}</button>` : ''}${http ? `<button${st === 'sent' || st === 'replaced' ? ' class="xbtn"' : ''} data-test="all">${T('Ver la tabla de todos')}</button>` : ''}${st === 'stale' ? `<button class="xbtn" data-test="reload">${T('Recargar la página')}</button>` : `<button data-test="start">${T('Repetir la prueba')}</button>`}<button data-test="close">${T('Cerrar')}</button></div>`);
}
// volver a mirar una comparación ya respondida: el mismo cuadro con las mismas versiones a cada lado,
// ya con sus nombres. Una barra dice qué se está viendo y lleva de vuelta al resultado
const testCanSee = (a, b, f) => FRAMES.some(x => String(x) === String(f)) && [a, b].every(id => VARIANTS.some(v => v.id === id));
function testSee(i){
  const [a, b, f, r] = testMine.games[i];
  testSeen = true; testClose();
  varA = a; varB = b; frame = FRAMES.find(x => String(x) === String(f));
  refreshFrameButtons(); refreshVariantButtons(); loadImg(); updateMeta(); writeHash();
  $('testSeeText').innerHTML = testEsc(T`Comparación ${i + 1} de ${testMine.games.length}:`) + ' ' + (r === 't' ? T('dijiste empate') : testEsc(T('elegiste')) + ' ' + testName(r === 'a' ? a : b) + ' (' + (r === 'a' ? T('izquierda') : T('derecha')) + ')');
  $('testSeeBar').hidden = false; $('testSeeBack').focus();
}
function testSeeEnd(){ $('testSeeBar').hidden = true; }
function testStandings(j){
  testOpen(`<h2>${T('Tabla de todos')}</h2>
    <p class="hint">${j.ballots === 1 ? T('1 prueba enviada.') : T`${j.ballots} pruebas enviadas.`} ${T('Ordenada por la probabilidad de ganarle a una versión promedio, con todas las comparaciones de todas las pruebas. Con pocas comparaciones ese número todavía dice poco.')}</p>
    ${j.ballots ? `<table class="ttable"><tr><th>${T('Puesto')}</th><th>${T('Versión')}</th><th title="${T('probabilidad de ganarle a una versión promedio')}">${T('Puntuación')}</th><th>${T('Comparaciones')}</th><th title="${T('comparaciones ganadas, empatadas y perdidas')}">${T('G-E-P')}</th></tr>
    ${j.standings.map((s, i) => `<tr${s.few ? ' class="tfew"' : ''}><td>${i + 1}º</td><td>${testName(s.id)}</td><td>${s.score == null ? '—' : Math.round(s.score * 100) + ' %'}</td><td>${s.n ?? s.w + s.t + s.l}${s.few ? ` <span class="tfewtag">${T('pocas comparaciones')}</span>` : ''}</td><td>${s.w}-${s.t}-${s.l}</td></tr>`).join('')}</table>` : ''}
    <div class="acts">${testMine ? `<button data-test="mine">${T('Volver a mi resultado')}</button>` : `<button class="xbtn" data-test="start">${T('Hacer la prueba')}</button>`}<button data-test="close">${T('Cerrar')}</button></div>`);
}
async function testAll(){
  const btn = testBody.querySelector('[data-test="all"]');
  if (btn) btn.disabled = true;
  try {
    const r = await fetch('/api/vote/' + testToken, {headers: {'accept-language': I18N.lang}});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
    testStandings(j);
  } catch (e){
    const n = testBody.querySelector('.hint'); if (n) n.textContent = T`No se pudo leer la tabla: ${e.message}`;
    if (btn) btn.disabled = false;
  }
}
testBody.addEventListener('click', e => {
  const b = e.target.closest('[data-test]'); if (!b) return;
  const act = b.dataset.test;
  if (act === 'start') testStart(); else if (act === 'close') testClose(); else if (act === 'mine') testResult(); else if (act === 'see') testSee(+b.dataset.i);
  else if (act === 'send') testSend(); else if (act === 'all') testAll();
  else if (act === 'link') testCopyLink(b); else if (act === 'reload') location.reload();
  else if (act === 'privacy') testPrivacy('intro'); else if (act === 'privacy-mine') testPrivacy('mine'); else if (act === 'intro') testIntro();
  else if (act === 'resume') testResume(); else if (act === 'fresh'){ testForget(); testIntro(); }
  else if (act === 'done'){ if (testRun && testRun.settled) testFinish(testRun.settled); } else if (act === 'more') testMore();
});
$('testBtn').addEventListener('click', testEnter);
$('testLeft').addEventListener('click', () => testPick('a'));
$('testRight').addEventListener('click', () => testPick('b'));
$('testTie').addEventListener('click', () => testPick('t'));
$('testBack').addEventListener('click', testBackOne);
$('testQuit').addEventListener('click', testQuit);
$('testSeeBack').addEventListener('click', () => { testSeeEnd(); testResult(); });
$('testSeeClose').addEventListener('click', testSeeEnd);
// teclas de la prueba: ← y → eligen lado, ↑/↓/0 empate, Retroceso vuelve una. Las
// que cambiarían el par o lo revelarían (números, espacio, G, R, S, C) no hacen nada
function testKeys(e){
  if (testPanel.style.display === 'flex'){ if (e.key === 'Escape'){ e.preventDefault(); testClose(); } return true; }
  if (!testRun) return false;
  if (e.key === 'ArrowLeft') testPick('a'); else if (e.key === 'ArrowRight') testPick('b');
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === '0') testPick('t');
  else if (e.key === 'Backspace') testBackOne(); else if (e.key === 'Escape') testQuit();
  else if (!(e.key === ' ' || /^[1-9]$/.test(e.key) || /^Digit[1-9]$/.test(e.code) || 'gGrRsScC'.includes(e.key))) return false;
  e.preventDefault();
  return true;
}
