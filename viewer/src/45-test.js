/* ---------- prueba ciega: ordenar las versiones a ciegas (gatos-ops#196, #200) ----------
   Cada versión recibe un número al azar al empezar y así se llama toda la
   prueba («Variante 3»): se sabe qué número se está juzgando, nunca qué es.

   La prueba no recorre todos los pares: ORDENA las versiones con lo que se va
   respondiendo (inserción binaria). Cada versión nueva se compara contra la
   del medio de las ya ordenadas, y según gane o pierda, contra la mitad que
   corresponde: con 4 versiones son 4 o 5 duelos, no 6; con 5, de 6 a 8, no 10.
   Lo que no se comparó se deduce: si A le gana a B y B a C, A va antes que C.
   Un duelo se juega cuadro a cuadro (hasta TEST_FRAMES, los mismos para todos,
   al azar) y se corta en cuanto está decidido: 2-0, o a puntos al tercero
   (ganar 1, empate ½). Un duelo empatado deja a las dos en el mismo puesto.

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
   imágenes van como blob. */
const TEST_MAX = 5, TEST_FRAMES = 3;
let testRun = null, testMine = null;
const testToken = (location.pathname.match(/^\/p\/([A-Za-z0-9_-]{10,64})/) || [])[1] || null;
const testPanel = $('testPanel'), testBody = $('testBody');
const shuffled = list => { const a = [...list]; for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const testPairs = () => VARIANTS.flatMap((a, i) => VARIANTS.slice(i + 1).map(b => [a.id, b.id]));
const testShared = (a, b, frames = FRAMES) => frames.filter(f => hasFrame(a, f) && hasFrame(b, f)).slice(0, TEST_FRAMES);
// se ofrece con 2 a 5 versiones y solo si cada par comparte al menos un cuadro
const testOk = () => VARIANTS.length >= 2 && VARIANTS.length <= TEST_MAX && testPairs().every(([a, b]) => testShared(a, b).length > 0);
// duelos que, como mucho, pide la inserción binaria con n versiones: la suma de ceil(log2 k)
const testDuels = n => { let max = 0; for (let k = 2; k <= n; k++) max += Math.ceil(Math.log2(k)); return max; };

/* El plan es un generador: entrega la comparación que toca ({a, b, f}: izquierda,
   derecha, cuadro) y recibe la respuesta ('a', 'b' o 't'). Es determinista dado
   `run` (orden de entrada, cuadros y lados ya sorteados), así «Atrás» lo rehace
   desde el principio con las respuestas anteriores. Devuelve los grupos, de
   mejor a peor; un grupo de varias = empatadas. */
function* testDuel(run, x, y){
  const frames = testShared(x, y, run.frames);
  let d = 0;   // puntos de x menos puntos de y
  for (let i = 0; i < frames.length; i++){
    const key = [x, y].sort().join('|') + '|' + frames[i];
    if (!run.flips.has(key)) run.flips.set(key, Math.random() < .5);
    const flip = run.flips.get(key), r = yield flip ? {a: y, b: x, f: frames[i]} : {a: x, b: y, f: frames[i]};
    if (r !== 't') d += (r === 'a') !== flip ? 1 : -1;
    if (Math.abs(d) > frames.length - 1 - i) break;   // los cuadros que quedan ya no lo cambian
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
const testVoted = () => { try { return localStorage.getItem('gatosVoted:' + testToken) === '1'; } catch(e){ return false; } };
function testOpen(html){ testBody.innerHTML = html; testPanel.style.display = 'flex'; const b = testBody.querySelector('button'); if (b) b.focus(); }
function testClose(){ if (testPanel.style.display === 'flex'){ testPanel.style.display = 'none'; $('testBtn').focus(); } }

function testIntro(){
  const n = VARIANTS.length, hi = testDuels(n) * Math.min(TEST_FRAMES, FRAMES.length);
  testOpen(`<h2>${T('Prueba ciega')}</h2>
    <p>${T`Vas a ordenar las ${n} versiones de mejor a peor sin saber cuál es cuál. Cada una recibe un número al azar y lo conserva toda la prueba.`}</p>
    <p>${n === 2 ? T`Son como mucho ${hi} comparaciones.` : T`Son como mucho ${hi} comparaciones, y suelen ser bastantes menos: la prueba elige cada una según lo que vas respondiendo y se detiene cuando el orden queda claro.`} ${T('En cada una eliges la que se ve mejor, o empate. Puedes usar zoom, diff y parpadeo.')}</p>
    ${testHttp() ? `<p>${testVoted() ? T('Ya enviaste un resultado de esta página desde este navegador: esta prueba no se suma otra vez.') : T('Al terminar, tu resultado se suma a la tabla de todos. No se guarda nada sobre ti.')}</p>` : ''}
    <div class="acts"><button class="xbtn" data-test="start">${T('Empezar')}</button>${testToken ? `<button data-test="all">${T('Ver la tabla de todos')}</button>` : ''}<button data-test="close">${T('Cancelar')}</button></div>
    ${testToken ? `<p class="hint">${T('Ver la tabla antes de hacer la prueba condiciona tu juicio.')}</p>` : ''}`);
}
let testOpening = false;
async function testStart(){
  if (testRun || testOpening) return;
  testClose();
  if (cropMode){ setCropMode(false); closeCrop(); }
  let session = null;
  if (testHttp()){
    testOpening = true;
    try { const r = await fetch('/api/blind/' + testToken, {method: 'POST', headers: {'accept-language': I18N.lang}}); if (r.ok) session = await r.json(); } catch(e){}
    testOpening = false;
  }
  const real = VARIANTS, before = {varA, varB, frame};
  if (session){
    // versiones de mentira: la «Variante k» es n<k>, y de cada una solo se sabe qué cuadros tiene
    VARIANTS = Array.from({length: session.n}, (_, k) => ({id: 'n' + (k + 1), name: '', color: '#e8e8f0', frames: Object.keys(session.pics[k + 1])}));
    blindPics = Object.fromEntries(VARIANTS.map((v, k) => [v.id, session.pics[k + 1]]));
    blindOrder = VARIANTS;
  } else blindOrder = shuffled(VARIANTS);   // la numeración de ESTA prueba
  // el orden en que entran a ordenarse es otro sorteo: el número no dice nada de cuándo le toca a cada una
  const frames = session ? session.frames.map(f => FRAMES.find(x => String(x) === f)).filter(f => f !== undefined) : shuffled(FRAMES);
  testRun = {sid: session && session.sid, real, order: shuffled(VARIANTS.map(v => v.id)), frames, flips: new Map(), answers: [], games: [], before};
  testRun.max = testDuels(VARIANTS.length) * Math.min(TEST_FRAMES, FRAMES.length);
  blindMode = true;
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
  for (const r of run.answers){ run.games.push([step.value.a, step.value.b, String(step.value.f), r]); step = gen.next(r); }
  run.gen = gen;
  if (step.done) testFinish(step.value); else { run.cur = step.value; testShow(); }
}
function testShow(){
  const g = testRun.cur;
  varA = g.a; varB = g.b; frame = g.f;
  $('testStep').textContent = T`Comparación ${testRun.answers.length + 1} · como mucho ${testRun.max} · ¿cuál se ve mejor?`;
  $('testLeft').textContent = '← ' + variantName(g.a);
  $('testRight').textContent = variantName(g.b) + ' →';
  $('testBack').disabled = !testRun.answers.length;
  loadImg();
}
function testPick(r){
  if (!testRun) return;
  const run = testRun, g = run.cur;
  run.answers.push(r); run.games.push([g.a, g.b, String(g.f), r]);
  const step = run.gen.next(r);
  if (step.done) testFinish(step.value); else { run.cur = step.value; testShow(); }
}
function testBackOne(){ if (testRun && testRun.answers.length){ testRun.answers.pop(); testReplay(); } }
// sale del modo: vuelve la vista de antes, se olvida la numeración y se sueltan las imágenes sin nombre
function testLeave(){
  const before = testRun.before;
  if (testRun.sid){ VARIANTS = testRun.real; blindPics = null; }   // vuelven las versiones de verdad
  testRun = null; blindOrder = null;
  document.body.classList.remove('testing');
  $('testBar').hidden = true;
  ({varA, varB, frame} = before);
  setBlind(false);
  dropBlindSrc();
  computeFit(); applyTransform();
}
function testQuit(){ if (testRun && confirm(T('¿Salir de la prueba? Se pierde lo que llevas.'))) testLeave(); }
function testFinish(rank){
  const games = testRun.games, sid = testRun.sid, num = new Map(blindOrder.map((v, i) => [v.id, i + 1]));
  testLeave();
  if (sid){
    // con sesión todavía no se sabe qué era cada número: las respuestas van en números y el servidor lo revela
    const n = id => num.get(id);
    testMine = {sid, count: !testVoted(), state: 'sending', rank: rank.map(g => g.map(n)), games: games.map(([a, b, f, r]) => [n(a), n(b), f, r])};
  } else testMine = {rank, games, num, state: !testHttp() ? 'local' : testVoted() ? 'voted' : 'sending'};
  testResult();
  if (testMine.state === 'sending') testSend();
}
// el resultado se suma solo al terminar; si falla queda el botón para reintentar
async function testSend(){
  const mine = testMine;
  mine.state = 'sending'; if (testMine === mine && testBody.querySelector('#testNote')) testResult();
  try {
    const body = mine.sid ? {sid: mine.sid, rank: mine.rank, games: mine.games, count: mine.count} : {rank: mine.rank, games: mine.games};
    const r = await fetch('/api/vote/' + testToken, {method: 'POST', headers: {'content-type': 'application/json', 'accept-language': I18N.lang}, body: JSON.stringify(body)});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
    if (mine.sid){   // la revelación: qué versión era cada número
      const id = k => j.reveal[k - 1];
      mine.rank = mine.rank.map(g => g.map(id)); mine.games = mine.games.map(([a, b, f, r]) => [id(a), id(b), f, r]);
      mine.num = new Map(j.reveal.map((v, i) => [v, i + 1]));
      mine.sid = null;
    }
    if (mine.count !== false) try { localStorage.setItem('gatosVoted:' + testToken, '1'); } catch(e){}
    mine.state = mine.count === false ? 'voted' : 'sent';
  } catch (e){ mine.state = 'failed'; mine.error = e.message; }
  if (testMine === mine && testBody.querySelector('#testNote')) testResult();
}
function testResult(){
  const st = testMine.state, http = testHttp();
  if (testMine.sid){   // todavía sin revelar: solo el estado (y reintentar si falló)
    testOpen(`<h2>${T('Tu resultado')}</h2>
      <p class="hint" id="testNote" role="status">${st === 'failed' ? testEsc(T`No se pudo enviar tu resultado: ${testMine.error}`) : T('Enviando tus respuestas para saber qué versión era cada número…')}</p>
      <div class="acts">${st === 'failed' ? `<button class="xbtn" data-test="send">${T('Reintentar el envío')}</button>` : ''}<button data-test="close">${T('Cerrar')}</button></div>`);
    return;
  }
  const note = {local: T('Esta copia no está publicada en gatos.pics: el resultado no se envía.'), voted: T('Ya habías enviado un resultado de esta página desde este navegador: este no se sumó.'),
    sending: T('Sumando tu resultado a la tabla de todos…'), sent: T('Tu resultado se sumó a la tabla de todos. No se guardó nada sobre ti.'), failed: T`No se pudo enviar tu resultado: ${testMine.error}`}[st];
  // lo que respondiste sobre cada versión: comparaciones ganadas, empatadas y perdidas
  const row = Object.fromEntries(VARIANTS.map(v => [v.id, {w: 0, t: 0, l: 0}]));
  for (const [a, b, , r] of testMine.games){ if (r === 't'){ row[a].t++; row[b].t++; } else { row[r === 'a' ? a : b].w++; row[r === 'a' ? b : a].l++; } }
  let place = 1;
  const lines = testMine.rank.map(g => { const p = place; place += g.length;
    return g.map(id => `<tr><td>${p}º</td><td>${T`Variante ${testMine.num.get(id)}`}</td><td>${testName(id)}</td><td>${row[id].w}-${row[id].t}-${row[id].l}</td></tr>`).join(''); }).join('');
  testOpen(`<h2>${T('Tu resultado')}</h2>
    <table class="ttable"><tr><th>${T('Puesto')}</th><th>${T('Era')}</th><th>${T('Versión')}</th><th title="${T('comparaciones ganadas, empatadas y perdidas')}">${T('G-E-P')}</th></tr>${lines}</table>
    <p class="hint">${T`Respondiste ${testMine.games.length} comparaciones. Los pares que no viste se ordenaron con tus respuestas: si una le gana a otra y esa a una tercera, la primera va antes.`}</p>
    <p class="hint" id="testNote" role="status">${testEsc(note)}</p>
    <div class="acts">${st === 'failed' ? `<button class="xbtn" data-test="send">${T('Reintentar el envío')}</button>` : ''}${http ? `<button${st === 'sent' ? ' class="xbtn"' : ''} data-test="all">${T('Ver la tabla de todos')}</button>` : ''}<button data-test="start">${T('Repetir la prueba')}</button><button data-test="close">${T('Cerrar')}</button></div>`);
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
});
$('testBtn').addEventListener('click', testIntro);
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
