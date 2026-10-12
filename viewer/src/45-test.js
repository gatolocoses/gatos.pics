/* ---------- prueba ciega: ordenar las versiones a ciegas (gatos-ops#196, #200) ----------
   Durante la prueba ninguna versión tiene nombre ni número en pantalla
   (gatos-ops#230): solo «Izquierda» y «Derecha», y el lado se sortea en cada
   comparación. Así no se sabe si la de ahora es la que ya se eligió antes.
   Por dentro cada versión sí tiene un número al azar (blindOrder): es como
   las respuestas viajan al servidor.

   La prueba no recorre todos los pares: ORDENA las versiones con lo que se va
   respondiendo (inserción binaria). Cada versión nueva se compara contra la
   del medio de las ya ordenadas, y según gane o pierda, contra la mitad que
   corresponde: con 4 versiones son 4 o 5 duelos, no 6; con 5, de 6 a 8, no 10.
   Lo que no se comparó se deduce: si A le gana a B y B a C, A va antes que C.
   Un duelo se juega cuadro a cuadro, en los cuadros que menos se han visto
   en esa prueba (testPicks, gatos-ops#232), y se
   corta en cuanto los cuadros que quedan ya no lo cambian (ganar 1, empate ½).
   Un duelo empatado deja a las dos en el mismo puesto. Con pocas versiones
   cada duelo es más largo (gatos-ops#215): testFrames reparte unas
   TEST_BUDGET comparaciones entre los duelos que la prueba puede pedir, así
   que con 2 versiones son hasta 9 cuadros, con 3 hasta 5 y con 4 o 5, 3.

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

   Un enlace que termina en #test=1 abre la página directo en la introducción
   (gatos-ops#223), sobre fondo opaco: la comparación normal, con sus nombres a
   cada lado, no se ve detrás. La introducción dice qué versiones se comparan,
   en el orden de la página (no dice qué número le toca a cada una). */
const TEST_MAX = 5, TEST_BUDGET = 15, TEST_KEEP_MS = 2 * 3600e3;   // lo que vive una sesión en el servidor
let testRun = null, testMine = null;
const testToken = (location.pathname.match(/^\/p\/([A-Za-z0-9_-]{10,64})/) || [])[1] || null;
const testPanel = $('testPanel'), testBody = $('testBody');
const shuffled = list => { const a = [...list]; for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const testPairs = () => VARIANTS.flatMap((a, i) => VARIANTS.slice(i + 1).map(b => [a.id, b.id]));
const testShared = (a, b, frames = FRAMES) => frames.filter(f => hasFrame(a, f) && hasFrame(b, f)).slice(0, testFrames(VARIANTS.length));
// se ofrece con 2 a 5 versiones y solo si cada par comparte al menos un cuadro
const testOk = () => VARIANTS.length >= 2 && VARIANTS.length <= TEST_MAX && testPairs().every(([a, b]) => testShared(a, b).length > 0);
// duelos que, como mucho, pide la inserción binaria con n versiones: la suma de ceil(log2 k)
const testDuels = n => { let max = 0; for (let k = 2; k <= n; k++) max += Math.ceil(Math.log2(k)); return max; };
// cuadros por duelo: TEST_BUDGET entre esos duelos, impar, de 3 a 9 (la misma cuenta hace el servidor, lib/votes.mjs)
const testFrames = n => { const f = Math.floor(TEST_BUDGET / Math.max(1, testDuels(n))); return Math.max(3, Math.min(9, f % 2 ? f : f - 1)); };

/* El plan es un generador: entrega la comparación que toca ({a, b, f}: izquierda,
   derecha, cuadro) y recibe la respuesta ('a', 'b' o 't'). Es determinista dado
   `run` (orden de entrada, cuadros y lados ya sorteados), así «Atrás» lo rehace
   desde el principio con las respuestas anteriores. Devuelve los grupos, de
   mejor a peor; un grupo de varias = empatadas. */
// Los cuadros de un duelo (gatos-ops#232): de los que comparten las dos, los que
// menos se han usado en los duelos anteriores de esta prueba, para no ver
// siempre las mismas imágenes. Se eligen una vez por par y se guardan
// (run.picks): «Atrás», retomar y «seguir con las que faltan» los conservan.
function testPicks(run, x, y){
  const key = [x, y].sort().join('|');
  if (!run.picks.has(key)){
    const use = new Map();
    for (const fs of run.picks.values()) for (const f of fs) use.set(f, (use.get(f) || 0) + 1);
    const n = testShared(x, y, run.frames).length;
    run.picks.set(key, run.frames.filter(f => hasFrame(x, f) && hasFrame(y, f)).map((f, i) => [use.get(f) || 0, i, f])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, n).map(t => t[2]));
  }
  return run.picks.get(key);
}
function* testDuel(run, x, y){
  const frames = testPicks(run, x, y);
  let d = 0;   // puntos de x menos puntos de y
  for (let i = 0; i < frames.length; i++){
    const key = [x, y].sort().join('|') + '|' + frames[i], had = run.known && run.known.get(key);
    if (had !== undefined){   // ya respondida antes de «seguir» (#220): quién ganó, o 't'
      run.games.push([x, y, String(frames[i]), had === 't' ? 't' : had === x ? 'a' : 'b']);
      if (had !== 't') d += had === x ? 1 : -1;
    } else {
      if (!run.flips.has(key)) run.flips.set(key, Math.random() < .5);
      const flip = run.flips.get(key), g = flip ? {a: y, b: x, f: frames[i]} : {a: x, b: y, f: frames[i]}, r = yield g;
      run.games.push([g.a, g.b, String(g.f), r]);
      if (r !== 't') d += (r === 'a') !== flip ? 1 : -1;
    }
    if (!run.full && Math.abs(d) > frames.length - 1 - i) break;   // los cuadros que quedan ya no lo cambian
  }
  return d;
}
function* testPlan(run){
  const groups = [];
  for (const x of run.order){
    let lo = 0, hi = groups.length, tied = false;
    while (lo < hi && !tied){
      const mid = (lo + hi) >> 1, d = yield* testDuel(run, x, groups[mid][0]);
      if (d === 0){ groups[mid].push(x); tied = true; }
      else if (d > 0) hi = mid; else lo = mid + 1;
    }
    if (!tied) groups.splice(lo, 0, [x]);
  }
  return groups;
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
const testKey = 'gatosTest:' + testToken;
function testSave(){
  const run = testRun; if (!run || !run.session) return;
  try { localStorage.setItem(testKey, JSON.stringify({v: 1, t: run.t, s: run.session, order: run.order, flips: [...run.flips], picks: [...run.picks], answers: run.answers, known: run.known ? [...run.known] : null, held: run.held})); } catch(e){}
}
const testForget = () => { try { localStorage.removeItem(testKey); } catch(e){} };
// la prueba a medias de esta página, si la hay, respondió algo y su sesión todavía puede estar viva
function testSaved(){
  if (!testHttp() || testRun) return null;
  try {
    const j = JSON.parse(localStorage.getItem(testKey));
    if (j && j.v === 1 && j.s && j.s.sid && j.s.n === VARIANTS.length && Date.now() - j.t < TEST_KEEP_MS && (j.answers.length || j.known)) return j;
  } catch(e){}
  return null;
}
function testOpen(html){ testBody.innerHTML = html; testPanel.style.display = 'flex'; const b = testBody.querySelector('button'); if (b) b.focus(); }
function testClose(){ if (testRun && testRun.settled) return;   // hay que elegir: ver el resultado o seguir
  testPanel.classList.remove('solid');
  if (testPanel.style.display === 'flex'){ testPanel.style.display = 'none'; $('testBtn').focus(); } }

// el botón (o G): si hay una prueba a medias, primero se ofrece seguirla
function testEnter(){ const saved = testSaved(); if (saved) testOffer(saved); else testIntro(); }
function testOffer(saved){
  const n = saved.answers.length + (saved.known ? saved.known.length : 0);
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
  let alive = false;
  try { alive = (await fetch('b/' + Object.values(saved.s.pics[1])[0], {method: 'HEAD'})).ok; } catch(e){}
  if (testRun) return;
  if (alive){ testStart(saved); return; }
  testForget();
  testIntro(T('La prueba que dejaste ya venció: hay que empezar otra.'));
}
function testIntro(note){
  const n = VARIANTS.length, hi = testDuels(n) * Math.min(testFrames(n), FRAMES.length);
  testOpen(`<h2>${T('Prueba ciega')}</h2>
    <p>${T`Vas a ordenar las ${n} versiones de mejor a peor sin saber cuál es cuál. En cada comparación solo ves «izquierda» y «derecha»: nada dice qué versión es ni si ya la viste antes.`}</p>
    <p id="testNames">${T('Se comparan:')} ${VARIANTS.map(v => testName(v.id)).join(', ')}.</p>
    <p>${n === 2 ? T`Son como mucho ${hi} comparaciones.` : T`Son como mucho ${hi} comparaciones, y suelen ser bastantes menos: la prueba elige cada una según lo que vas respondiendo y se detiene cuando el orden queda claro.`} ${T('En cada una eliges la que se ve mejor, o empate. Puedes usar zoom, diff y parpadeo.')}</p>
    ${testHttp() ? `<p id="testIntroNote">${testVoted() ? T('Ya enviaste un resultado de esta página desde este navegador: esta prueba no se suma otra vez.') : T('Al terminar, tu resultado se suma a la tabla de todos. No se guarda nada sobre ti.')}</p>` : ''}
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
// el enlace directo a la prueba (#test=1), también desde la introducción (gatos-ops#226)
async function testCopyLink(btn){
  const url = location.href.split('#')[0] + '#test=1';
  let ok = false;
  if (navigator.clipboard && window.isSecureContext){ try { await navigator.clipboard.writeText(url); ok = true; } catch(e){} }
  if (!ok){ prompt(T('Copia este enlace:'), url); return; }
  btn.textContent = T('copiado ✓');
  setTimeout(() => { if (btn.isConnected) btn.textContent = T('Copiar enlace a la prueba'); }, 1500);
}
let testOpening = false;
async function testStart(saved){
  if (testRun || testOpening) return;
  testClose();
  if (cropMode){ setCropMode(false); closeCrop(); }
  let session = saved ? saved.s : null;
  if (!saved) testForget();
  if (!saved && testHttp()){
    testOpening = true;
    try { const r = await fetch('/api/blind/' + testToken, {method: 'POST', headers: {'accept-language': I18N.lang}}); if (r.ok) session = await r.json(); } catch(e){}
    testOpening = false;
  }
  const real = VARIANTS, before = {varA, varB, frame};
  if (session && session.epoch !== undefined) testEpoch = session.epoch;
  if (session){
    // versiones de mentira: la «Variante k» es n<k>, y de cada una solo se sabe qué cuadros tiene
    VARIANTS = Array.from({length: session.n}, (_, k) => ({id: 'n' + (k + 1), name: '', color: '#e8e8f0', frames: Object.keys(session.pics[k + 1])}));
    blindPics = Object.fromEntries(VARIANTS.map((v, k) => [v.id, session.pics[k + 1]]));
    blindOrder = VARIANTS;
  } else blindOrder = shuffled(VARIANTS);   // la numeración de ESTA prueba
  // el orden en que entran a ordenarse es otro sorteo: el número no dice nada de cuándo le toca a cada una
  const frames = session ? session.frames.map(f => FRAMES.find(x => String(x) === f)).filter(f => f !== undefined) : shuffled(FRAMES);
  testRun = {sid: session && session.sid, session, t: saved ? saved.t : Date.now(), real, order: saved ? saved.order : shuffled(VARIANTS.map(v => v.id)), frames,
    flips: new Map(saved ? saved.flips : []), picks: new Map(saved && saved.picks || []), answers: saved ? saved.answers : [], games: [], before};
  if (saved && saved.known){ testRun.known = new Map(saved.known); testRun.full = true; }
  // lo que quedó en espera ya está sumado en el servidor: no se manda otra vez
  if (saved && saved.held !== undefined){ testRun.held = saved.held; testRun.holdP = Promise.resolve(); }
  testRun.max = testDuels(VARIANTS.length) * Math.min(testFrames(VARIANTS.length), FRAMES.length);
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
  run.games = [];
  let step = gen.next();
  for (const r of run.answers){ if (step.done) break; step = gen.next(r); }
  run.gen = gen;
  if (step.done) testSettled(step.value); else { run.cur = step.value; testShow(); }
}
/* El orden ya salió de las respuestas. Si algún duelo se cortó antes de jugar
   todos sus cuadros se ofrece seguir (gatos-ops#220): quien sigue juega los
   cuadros que faltan de cada duelo, con la misma numeración y sin que se haya
   revelado nada. En una página publicada el resultado se manda ya, en espera
   (`hold`): cuenta desde ahora y el resultado final de esta sesión lo
   reemplaza, así que irse a la mitad no pierde nada ni suma dos veces. */
const testPairKey = (a, b) => [a, b].sort().join('|');
function testExtra(run){
  const n = new Map();
  for (const [a, b] of run.games) n.set(testPairKey(a, b), (n.get(testPairKey(a, b)) || 0) + 1);
  let left = 0;
  for (const [k, c] of n){ const [a, b] = k.split('|'); left += testShared(a, b, run.frames).length - c; }
  return left;
}
function testSettled(groups){
  const run = testRun, left = run.full ? 0 : testExtra(run);
  if (!left){ testFinish(groups); return; }
  run.settled = groups;
  if (run.sid && !run.holdP) run.holdP = testHold(run, groups);
  testSave();
  testOpen(`<h2>${T('Ya hay suficientes respuestas')}</h2>
    <p>${T`Con tus ${run.games.length} respuestas ya se pueden ordenar las versiones. Puedes ver tu resultado ahora o seguir con lo que falta de los mismos pares (${left} más): si sigues, tu resultado se actualiza al terminar.`}</p>
    <div class="acts"><button class="xbtn" data-test="done">${T('Ver mi resultado')}</button><button data-test="more">${T('Seguir con las que faltan')}</button></div>`);
}
async function testHold(run, groups){
  const num = new Map(blindOrder.map((v, i) => [v.id, i + 1])), n = id => num.get(id), count = !testVoted();
  const body = {sid: run.sid, rank: groups.map(g => g.map(n)), games: run.games.map(([a, b, f, r]) => [n(a), n(b), f, r]), count, hold: true};
  try {
    const r = await fetch('/api/vote/' + testToken, {method: 'POST', headers: {'content-type': 'application/json', 'accept-language': I18N.lang}, body: JSON.stringify(body)});
    if (!r.ok) return;
    const j = await r.json();
    if (j.epoch !== undefined) testEpoch = j.epoch;
    if (count) try { localStorage.setItem('gatosVoted:' + testToken, testEpoch || '1'); } catch(e){}
    run.held = count;   // lo que mande esta sesión al final cuenta (reemplaza) solo si esto contó
    if (testRun === run) testSave();
  } catch(e){}
}
function testMore(){
  const run = testRun; if (!run || !run.settled) return;
  run.known = new Map(run.games.map(([a, b, f, r]) => [testPairKey(a, b) + '|' + f, r === 't' ? 't' : r === 'a' ? a : b]));
  run.full = true; run.settled = null; run.answers = [];
  testPanel.style.display = 'none';
  testReplay();
}
function testShow(){
  const g = testRun.cur;
  varA = g.a; varB = g.b; frame = g.f;
  $('testStep').textContent = T`Comparación ${(testRun.known ? testRun.known.size : 0) + testRun.answers.length + 1} · como mucho ${testRun.max} · ¿cuál se ve mejor?`;
  $('testLeft').textContent = '← ' + T('Izquierda');
  $('testRight').textContent = T('Derecha') + ' →';
  $('testBack').disabled = !testRun.answers.length;
  testSave();
  loadImg();
}
function testPick(r){
  if (!testRun || testRun.settled) return;
  const run = testRun;
  run.answers.push(r);
  const step = run.gen.next(r);   // el plan anota la respuesta en run.games
  if (step.done) testSettled(step.value); else { run.cur = step.value; testShow(); }
}
function testBackOne(){ if (testRun && !testRun.settled && testRun.answers.length){ testRun.answers.pop(); testReplay(); } }
// sale del modo: vuelve la vista de antes, se olvida la numeración y se sueltan las imágenes sin nombre
function testLeave(){
  const before = testRun.before;
  if (testRun.sid){ VARIANTS = testRun.real; blindPics = null; }   // vuelven las versiones de verdad
  testRun = null; blindOrder = null; blindSides = false;
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
  run.settled = null;
  testLeave();
  if (sid){
    // con sesión todavía no se sabe qué era cada número: las respuestas van en números y el servidor lo revela
    const n = id => num.get(id);
    testMine = {sid, run, count: !testVoted(), state: 'sending', rank: rank.map(g => g.map(n)), games: games.map(([a, b, f, r]) => [n(a), n(b), f, r])};
  } else testMine = {rank, games, state: !testHttp() ? 'local' : testVoted() ? 'voted' : 'sending'};
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
    const body = mine.sid ? {sid: mine.sid, rank: mine.rank, games: mine.games, count: mine.count} : {rank: mine.rank, games: mine.games};
    const r = await fetch('/api/vote/' + testToken, {method: 'POST', headers: {'content-type': 'application/json', 'accept-language': I18N.lang}, body: JSON.stringify(body)});
    const j = await r.json().catch(() => ({}));
    // la página cambió de versiones a mitad de la prueba (gatos-ops#228): no se suma y reintentar no sirve;
    // se muestra igual el resultado si esta copia de la página todavía conoce esas versiones
    const stale = r.status === 409 && !!mine.sid && Array.isArray(j.reveal);
    if (stale) mine.stale = true;
    if (!r.ok && !(stale && j.reveal.every(v => VARIANTS.some(x => x.id === v)))) throw new Error(j.error || 'HTTP ' + r.status);
    if (mine.sid){   // la revelación: qué versión era cada número
      const id = k => j.reveal[k - 1];
      mine.rank = mine.rank.map(g => g.map(id)); mine.games = mine.games.map(([a, b, f, r]) => [id(a), id(b), f, r]);
      mine.sid = null;
    }
    if (j.epoch !== undefined) testEpoch = j.epoch;
    if (!stale && mine.count !== false) try { localStorage.setItem('gatosVoted:' + testToken, testEpoch || '1'); } catch(e){}
    mine.state = stale ? 'stale' : mine.count === false ? 'voted' : 'sent';
  } catch (e){ mine.state = 'failed'; mine.error = e.message; }
  if (testMine === mine && testBody.querySelector('#testNote')) testResult();
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
    sending: T('Sumando tu resultado a la tabla de todos…'), sent: T('Tu resultado se sumó a la tabla de todos. No se guardó nada sobre ti.'),
    stale: T('La página cambió de versiones mientras hacías la prueba: este resultado no se sumó. Recarga la página para hacer la prueba con las versiones de ahora.'), failed: T`No se pudo enviar tu resultado: ${testMine.error}`}[st];
  // lo que respondiste sobre cada versión: comparaciones ganadas, empatadas y perdidas
  const row = Object.fromEntries(VARIANTS.map(v => [v.id, {w: 0, t: 0, l: 0}]));
  for (const [a, b, , r] of testMine.games){ if (r === 't'){ row[a].t++; row[b].t++; } else { row[r === 'a' ? a : b].w++; row[r === 'a' ? b : a].l++; } }
  let place = 1;
  const lines = testMine.rank.map(g => { const p = place; place += g.length;
    return g.map(id => `<tr><td>${p}º</td><td>${testName(id)}</td><td>${row[id].w}-${row[id].t}-${row[id].l}</td></tr>`).join(''); }).join('');
  testOpen(`<h2>${T('Tu resultado')}</h2>
    <table class="ttable"><tr><th>${T('Puesto')}</th><th>${T('Versión')}</th><th title="${T('comparaciones ganadas, empatadas y perdidas')}">${T('G-E-P')}</th></tr>${lines}</table>
    <p class="hint">${T`Respondiste ${testMine.games.length} comparaciones. Los pares que no viste se ordenaron con tus respuestas: si una le gana a otra y esa a una tercera, la primera va antes.`}</p>
    <p class="hint" id="testNote" role="status">${testEsc(note)}</p>
    <div class="acts">${st === 'failed' ? `<button class="xbtn" data-test="send">${T('Reintentar el envío')}</button>` : ''}${http ? `<button${st === 'sent' ? ' class="xbtn"' : ''} data-test="all">${T('Ver la tabla de todos')}</button>` : ''}${st === 'stale' ? `<button class="xbtn" data-test="reload">${T('Recargar la página')}</button>` : `<button data-test="start">${T('Repetir la prueba')}</button>`}<button data-test="close">${T('Cerrar')}</button></div>`);
}
function testStandings(j){
  testOpen(`<h2>${T('Tabla de todos')}</h2>
    <p class="hint">${j.ballots === 1 ? T('1 prueba enviada.') : T`${j.ballots} pruebas enviadas.`} ${T('Ordenada por el puesto medio en que quedó cada versión: cuanto más bajo, mejor.')}</p>
    ${j.ballots ? `<table class="ttable"><tr><th>${T('Puesto')}</th><th>${T('Versión')}</th><th>${T('Puesto medio')}</th><th>${T('Puestos en cada prueba')}</th><th title="${T('comparaciones ganadas, empatadas y perdidas')}">${T('G-E-P')}</th></tr>
    ${j.standings.map((s, i) => `<tr><td>${i + 1}º</td><td>${testName(s.id)}</td><td>${s.mean == null ? '—' : s.mean.toFixed(2)}</td><td>${s.places.map((n, p) => n ? `${p + 1}º ×${n}` : '').filter(Boolean).join(' · ')}</td><td>${s.w}-${s.t}-${s.l}</td></tr>`).join('')}</table>` : ''}
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
  if (act === 'start') testStart(); else if (act === 'close') testClose(); else if (act === 'mine') testResult();
  else if (act === 'send') testSend(); else if (act === 'all') testAll();
  else if (act === 'link') testCopyLink(b); else if (act === 'reload') location.reload();
  else if (act === 'resume') testResume(); else if (act === 'fresh'){ testForget(); testIntro(); }
  else if (act === 'done'){ if (testRun && testRun.settled) testFinish(testRun.settled); } else if (act === 'more') testMore();
});
$('testBtn').addEventListener('click', testEnter);
$('testLeft').addEventListener('click', () => testPick('a'));
$('testRight').addEventListener('click', () => testPick('b'));
$('testTie').addEventListener('click', () => testPick('t'));
$('testBack').addEventListener('click', testBackOne);
$('testQuit').addEventListener('click', testQuit);
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
