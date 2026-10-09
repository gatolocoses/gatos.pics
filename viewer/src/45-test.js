/* ---------- prueba ciega: todos contra todos (gatos-ops#196) ----------
   Cada versión recibe un número al azar al empezar y así se llama toda la
   prueba («Variante 3»): se sabe qué número se está juzgando, nunca qué es.
   Se comparan todas las versiones de a pares, cada par en hasta TEST_FRAMES
   cuadros (los mismos para todos, al azar), con los lados sorteados. Al final
   salen los puestos con los nombres revelados, y en una página publicada el
   resultado se suma solo a la tabla de todos (/api/vote/<token>): la
   introducción lo avisa antes de empezar. Un navegador suma una vez por página.
   Usa el modo ciego del visor: blindOrder ES la numeración de la prueba. */
const TEST_MAX = 5, TEST_FRAMES = 3;
let testRun = null, testMine = null;
const testToken = (location.pathname.match(/^\/p\/([A-Za-z0-9_-]{10,64})/) || [])[1] || null;
const testPanel = $('testPanel'), testBody = $('testBody');
const shuffled = list => { const a = [...list]; for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const testPairs = () => VARIANTS.flatMap((a, i) => VARIANTS.slice(i + 1).map(b => [a.id, b.id]));
// se ofrece con 2 a 5 versiones y solo si cada par comparte al menos un cuadro
const testOk = () => VARIANTS.length >= 2 && VARIANTS.length <= TEST_MAX && testPairs().every(([a, b]) => FRAMES.some(f => hasFrame(a, f) && hasFrame(b, f)));
function testGames(){
  const frames = shuffled(FRAMES), games = [];
  for (const [a, b] of testPairs())
    for (const f of frames.filter(f => hasFrame(a, f) && hasFrame(b, f)).slice(0, TEST_FRAMES)) games.push(Math.random() < .5 ? {a, b, f} : {a: b, b: a, f});
  return shuffled(games);
}
// puntos (ganar 1, empate ½), ganadas/empatadas/perdidas y puesto; el mismo cálculo que service/lib/votes.mjs
function testTally(games){
  const row = Object.fromEntries(VARIANTS.map(v => [v.id, {pts: 0, w: 0, t: 0, l: 0}]));
  for (const [a, b, , r] of games){
    if (r === 't'){ row[a].t++; row[b].t++; row[a].pts += .5; row[b].pts += .5; }
    else { const win = r === 'a' ? a : b, lose = r === 'a' ? b : a; row[win].w++; row[win].pts++; row[lose].l++; }
  }
  for (const v of VARIANTS) row[v.id].place = 1 + VARIANTS.filter(o => row[o.id].pts > row[v.id].pts).length;
  return row;
}
const testEsc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const testName = id => `<b style="color:${testEsc(variant(id).color || '#e8e8f0')}">${testEsc(variant(id).name || id)}</b>`;
const testHttp = () => !!testToken && location.protocol !== 'file:';
const testVoted = () => { try { return localStorage.getItem('gatosVoted:' + testToken) === '1'; } catch(e){ return false; } };
function testOpen(html){ testBody.innerHTML = html; testPanel.style.display = 'flex'; const b = testBody.querySelector('button'); if (b) b.focus(); }
function testClose(){ if (testPanel.style.display === 'flex'){ testPanel.style.display = 'none'; $('testBtn').focus(); } }

function testIntro(){
  const n = VARIANTS.length, games = testPairs().reduce((s, [a, b]) => s + Math.min(TEST_FRAMES, FRAMES.filter(f => hasFrame(a, f) && hasFrame(b, f)).length), 0);
  testOpen(`<h2>${T('Prueba ciega')}</h2>
    <p>${T`Vas a comparar las ${n} versiones de a pares, sin saber cuál es cuál: ${games} comparaciones. Cada versión recibe un número al azar y lo conserva toda la prueba.`}</p>
    <p>${T('En cada comparación eliges la que se ve mejor, o empate. Puedes usar zoom, diff y parpadeo. Al final ves los puestos con los nombres.')}</p>
    ${testHttp() ? `<p>${testVoted() ? T('Ya enviaste un resultado de esta página desde este navegador: esta prueba no se suma otra vez.') : T('Al terminar, tu resultado se suma a la tabla de todos. No se guarda nada sobre ti.')}</p>` : ''}
    <div class="acts"><button class="xbtn" data-test="start">${T('Empezar')}</button>${testToken ? `<button data-test="all">${T('Ver la tabla de todos')}</button>` : ''}<button data-test="close">${T('Cancelar')}</button></div>
    ${testToken ? `<p class="hint">${T('Ver la tabla antes de hacer la prueba condiciona tu juicio.')}</p>` : ''}`);
}
function testStart(){
  testClose();
  if (cropMode){ setCropMode(false); closeCrop(); }
  blindOrder = shuffled(VARIANTS);   // la numeración de ESTA prueba
  testRun = {games: testGames(), i: 0, picks: [], before: {varA, varB, frame}};
  blindMode = true;
  document.body.classList.add('testing');
  $('testBar').hidden = false;
  pageTitle.textContent = T('Prueba ciega'); document.title = pageTitle.textContent;
  hideTip();
  testShow();
  computeFit(); applyTransform();
}
function testShow(){
  const g = testRun.games[testRun.i];
  varA = g.a; varB = g.b; frame = g.f;
  $('testStep').textContent = T`Comparación ${testRun.i + 1} de ${testRun.games.length} · ¿cuál se ve mejor?`;
  $('testLeft').textContent = '← ' + variantName(g.a);
  $('testRight').textContent = variantName(g.b) + ' →';
  $('testBack').disabled = testRun.i === 0;
  loadImg();
  // la siguiente comparación ya viene en camino: el cambio no delata nada por lo que tarda en cargar
  const next = testRun.games[testRun.i + 1];
  if (next) for (const id of [next.a, next.b]) srcFor(id, next.f).then(u => { new Image().src = u; });
}
function testPick(r){
  if (!testRun) return;
  testRun.picks[testRun.i] = r;
  if (++testRun.i < testRun.games.length) testShow(); else testFinish();
}
function testBackOne(){ if (testRun && testRun.i > 0){ testRun.i--; testShow(); } }
// sale del modo: vuelve la vista de antes y se olvida la numeración (un «Ciego» posterior sortea la suya)
function testLeave(){
  const before = testRun.before;
  testRun = null; blindOrder = null;
  document.body.classList.remove('testing');
  $('testBar').hidden = true;
  ({varA, varB, frame} = before);
  setBlind(false);
  computeFit(); applyTransform();
}
function testQuit(){ if (testRun && confirm(T('¿Salir de la prueba? Se pierde lo que llevas.'))) testLeave(); }
function testFinish(){
  const games = testRun.games.map((g, i) => [g.a, g.b, String(g.f), testRun.picks[i]]);
  const num = new Map(blindOrder.map((v, i) => [v.id, i + 1]));
  testLeave();
  testMine = {games, num, state: !testHttp() ? 'local' : testVoted() ? 'voted' : 'sending'};
  testResult();
  if (testMine.state === 'sending') testSend();
}
// el resultado se suma solo al terminar; si falla queda el botón para reintentar
async function testSend(){
  const mine = testMine;
  mine.state = 'sending'; if (testMine === mine && testBody.querySelector('#testNote')) testResult();
  try {
    const r = await fetch('/api/vote/' + testToken, {method: 'POST', headers: {'content-type': 'application/json', 'accept-language': I18N.lang}, body: JSON.stringify({games: mine.games})});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
    try { localStorage.setItem('gatosVoted:' + testToken, '1'); } catch(e){}
    mine.state = 'sent';
  } catch (e){ mine.state = 'failed'; mine.error = e.message; }
  if (testMine === mine && testBody.querySelector('#testNote')) testResult();
}
function testResult(){
  const row = testTally(testMine.games);
  const order = [...VARIANTS].sort((a, b) => row[a.id].place - row[b.id].place || testMine.num.get(a.id) - testMine.num.get(b.id));
  const st = testMine.state, http = testHttp();
  const note = {local: T('Esta copia no está publicada en gatos.pics: el resultado no se envía.'), voted: T('Ya habías enviado un resultado de esta página desde este navegador: este no se sumó.'),
    sending: T('Sumando tu resultado a la tabla de todos…'), sent: T('Tu resultado se sumó a la tabla de todos. No se guardó nada sobre ti.'), failed: T`No se pudo enviar tu resultado: ${testMine.error}`}[st];
  testOpen(`<h2>${T('Tu resultado')}</h2>
    <table class="ttable"><tr><th>${T('Puesto')}</th><th>${T('Era')}</th><th>${T('Versión')}</th><th>${T('Puntos')}</th><th title="${T('ganadas, empatadas, perdidas')}">${T('G-E-P')}</th></tr>
    ${order.map(v => { const r = row[v.id]; return `<tr><td>${r.place}º</td><td>${T`Variante ${testMine.num.get(v.id)}`}</td><td>${testName(v.id)}</td><td>${r.pts}</td><td>${r.w}-${r.t}-${r.l}</td></tr>`; }).join('')}</table>
    <p class="hint" id="testNote" role="status">${testEsc(note)}</p>
    <div class="acts">${st === 'failed' ? `<button class="xbtn" data-test="send">${T('Reintentar el envío')}</button>` : ''}${http ? `<button${st === 'sent' ? ' class="xbtn"' : ''} data-test="all">${T('Ver la tabla de todos')}</button>` : ''}<button data-test="start">${T('Repetir la prueba')}</button><button data-test="close">${T('Cerrar')}</button></div>`);
}
function testStandings(j){
  const pct = s => s == null ? '—' : Math.round(s * 100) + ' %';
  testOpen(`<h2>${T('Tabla de todos')}</h2>
    <p class="hint">${j.ballots === 1 ? T('1 prueba enviada.') : T`${j.ballots} pruebas enviadas.`} ${T('«Gana» es la parte de sus comparaciones que ganó; un empate cuenta la mitad.')}</p>
    ${j.ballots ? `<table class="ttable"><tr><th>${T('Puesto')}</th><th>${T('Versión')}</th><th>${T('Gana')}</th><th>${T('G-E-P')}</th><th>${T('Puestos en cada prueba')}</th></tr>
    ${j.standings.map((s, i) => `<tr><td>${i + 1}º</td><td>${testName(s.id)}</td><td>${pct(s.share)}</td><td>${s.w}-${s.t}-${s.l}</td><td>${s.places.map((n, p) => n ? `${p + 1}º ×${n}` : '').filter(Boolean).join(' · ')}</td></tr>`).join('')}</table>` : ''}
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
