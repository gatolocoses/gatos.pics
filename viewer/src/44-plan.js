/* ---------- prueba ciega: qué comparar, según lo que se va respondiendo (gatos-ops#347) ----------
   Antes la prueba ordenaba por inserción binaria: una versión que entraba tarde podía quedar 2ª con
   dos comparaciones, y su lugar se deducía del resto. Ahora cada comparación es UN cuadro entre dos
   versiones y se elige con lo respondido hasta ahí. La idea: la basura obvia necesita pocas
   comparaciones, las mejores necesitan muchas.
   1. Cada versión juega primero un mínimo (testMin, 2) contra rivales distintos, de puntuación
      parecida a la suya: la que pierde dos veces ya se ve, y nadie sube con un solo acierto.
   2. El resto va a las que pelean arriba: el par más parejo entre las primeras, el que menos se ha
      enfrentado, en un cuadro que ese par no usó (el que menos se vio en la prueba).
   Termina cuando el orden de las primeras está claro (testClear) o se acaba el presupuesto
   (testBudget: 15 con hasta 5 versiones, 3 por versión con 6 a 8; la página puede cambiar ambos con
   blind.min y blind.budget). El resultado sale de la misma cuenta que la tabla de todos
   (Bradley-Terry, service/lib/rank.mjs): testStrengths y testGroups. El plan es un generador
   determinista dado `run` (orden de entrada, cuadros y lados sorteados): «Atrás», retomar y la
   precarga lo rehacen igual con las respuestas dadas. */
const TEST_PRIOR = 2, TEST_MIN = 2;
const testMin = cfg => { const m = Math.round(Number(cfg.min)); return m >= 1 && m <= 6 ? m : TEST_MIN; };
const testBudget = (n, cfg) => { const b = Math.round(Number(cfg.budget)); return b >= n && b <= 60 ? b : n <= 5 ? 15 : 3 * n; };
// fuerza de cada versión (la promedio vale 1); cada una arranca con TEST_PRIOR ganadas y perdidas contra la promedio
function testStrengths(ids, games){
  const W = new Map(ids.map(i => [i, TEST_PRIOR])), N = new Map(ids.map(i => [i, new Map()]));
  for (const [a, b, , r] of games){
    if (!N.has(a) || !N.has(b) || a === b) continue;
    if (r === 't'){ W.set(a, W.get(a) + .5); W.set(b, W.get(b) + .5); } else { const w = r === 'a' ? a : b; W.set(w, W.get(w) + 1); }
    N.get(a).set(b, (N.get(a).get(b) || 0) + 1); N.get(b).set(a, (N.get(b).get(a) || 0) + 1);
  }
  let f = new Map(ids.map(i => [i, 1]));
  for (let it = 0; it < 2000; it++){
    const next = new Map(); let move = 0;
    for (const i of ids){
      let den = 2 * TEST_PRIOR / (f.get(i) + 1);
      for (const [j, n] of N.get(i)) den += n / (f.get(i) + f.get(j));
      const v = W.get(i) / den;
      move = Math.max(move, Math.abs(v - f.get(i)) / f.get(i));
      next.set(i, v);
    }
    f = next;
    if (move < 1e-10) break;
  }
  return f;
}
// grupos de mejor a peor; las de igual fuerza (todo empates, por ejemplo) comparten puesto
function testGroups(ids, games){
  const f = testStrengths(ids, games), out = [];
  for (const x of ids.map((id, k) => ({id, s: Math.log(f.get(id)), k})).sort((a, b) => b.s - a.s || a.k - b.k)){
    const last = out[out.length - 1];
    if (last && Math.abs(last.s - x.s) < 1e-9) last.ids.push(x.id); else out.push({s: x.s, ids: [x.id]});
  }
  return out.map(g => g.ids);
}
// el orden de las primeras ya está claro: cada una le saca a la siguiente al menos 1.2 (≈ 77 % de
// ganarle) y se enfrentaron de verdad. Con 2 versiones son 3 seguidas; con más, casi siempre se juega
// el presupuesto entero (medido con jueces simulados)
function testClear(order, th, met, top){
  for (let i = 0; i < top; i++){ const a = order[i], b = order[i + 1]; if (th(a) - th(b) < 1.2 || !met(a, b)) return false; }
  return true;
}
function* testPlan(run){
  const cfg = run.blind || {}, ids = run.order, n = ids.length, min = testMin(cfg), top = Math.min(3, n - 1);
  const budget = testBudget(n, cfg) + (run.more || 0) * n;
  const pk = (a, b) => a < b ? a + '|' + b : b + '|' + a;
  const count = new Map(ids.map(i => [i, 0])), meets = new Map(), used = new Map(), seenF = new Map();
  const met = (a, b) => meets.get(pk(a, b)) || 0;
  const left = (a, b) => run.frames.filter(f => hasFrame(a, f) && hasFrame(b, f) && !(used.get(pk(a, b)) || []).includes(String(f)));
  let k = 0;
  function* play(x, y){
    const fs = left(x, y); if (!fs.length) return false;
    const f = fs.reduce((best, g) => (seenF.get(String(g)) || 0) < (seenF.get(String(best)) || 0) ? g : best, fs[0]);
    const key = pk(x, y) + '|' + f;
    if (!run.flips.has(key)) run.flips.set(key, Math.random() < .5);
    const g = run.flips.get(key) ? {a: y, b: x, f} : {a: x, b: y, f}, r = yield g;
    run.games.push([g.a, g.b, String(f), r]);
    count.set(x, count.get(x) + 1); count.set(y, count.get(y) + 1);
    meets.set(pk(x, y), met(x, y) + 1);
    used.set(pk(x, y), [...(used.get(pk(x, y)) || []), String(f)]);
    seenF.set(String(f), (seenF.get(String(f)) || 0) + 1);
    if (++k === 1 && cfg.control) yield* testControl(run, x);
    return true;
  }
  const ranked = () => {
    const f = testStrengths(ids, run.games);
    return {th: id => Math.log(f.get(id)), order: ids.slice().sort((a, b) => f.get(b) - f.get(a) || ids.indexOf(a) - ids.indexOf(b))};
  };
  // 1. el mínimo para todas: la que menos jugó, contra la rival más cercana que menos enfrentó
  while (k < budget){
    const {order} = ranked(), pos = id => order.indexOf(id);
    const x = ids.filter(i => count.get(i) < min).sort((a, b) => count.get(a) - count.get(b) || pos(a) - pos(b))[0];
    if (x === undefined) break;
    const y = ids.filter(o => o !== x && left(x, o).length).sort((a, b) => met(x, a) - met(x, b)
      || (count.get(b) < min) - (count.get(a) < min) || Math.abs(pos(a) - pos(x)) - Math.abs(pos(b) - pos(x)) || ids.indexOf(a) - ids.indexOf(b))[0];
    if (y === undefined || !(yield* play(x, y))) count.set(x, min);   // no queda con qué compararla
  }
  // 2. el resto, a las que pelean arriba: las primeras y las que no están a más de 0.7 (≈ 67 %) de ellas
  while (k < budget){
    const {th, order} = ranked();
    if (!run.more && testClear(order, th, met, top)) break;
    const cut = th(order[top - 1]) - .7, cont = order.filter((id, i) => i < top || th(id) >= cut);
    let best = null;
    for (let i = 0; i < cont.length; i++) for (let j = i + 1; j < cont.length; j++){
      const a = cont[i], b = cont[j];
      if (!left(a, b).length) continue;
      const cost = Math.abs(th(a) - th(b)) + .2 * met(a, b) + .1 * j;   // parejas, poco vistas, cerca de arriba
      if (!best || cost < best[0]) best = [cost, a, b];
    }
    if (!best) break;
    yield* play(best[1], best[2]);
  }
  if (cfg.repeat) yield* testRepeats(run, cfg.repeat);
  return testGroups(ids, run.games);
}
