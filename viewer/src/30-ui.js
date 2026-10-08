/* ---------- state: URL hash (shareable) > localStorage > defaults ---------- */
let hashTimer = null;
function stateParams(){
    const p = new URLSearchParams();
    if (frame != null) p.set('f', frame);
    if (!blindMode && varA) p.set('a', varA);
    if (!blindMode && varB) p.set('b', varB);
    if (dividerPos !== 0.5) p.set('d', dividerPos.toFixed(3));
    if (zoom !== 1){ p.set('z', zoom.toFixed(3)); p.set('x', Math.round(pan.x)); p.set('y', Math.round(pan.y)); }
    if (diffMode){ p.set('diff', 1); if (gainIdx !== AMPLIFY_DEFAULT_IDX) p.set('g', gainIdx); if (heat) p.set('heat', 1); }
    if (blinkMode) p.set('blink', 1);
    if (solarMode) p.set('solar', 1);
    p.set('smooth', smoothScale ? '1' : '0');
    if (cropMode) p.set('crops', 1);
    if (cropUV){
      const {nw, nh} = naturalDims();
      p.set('crop', (cropUV.u/nw).toFixed(4)+','+(cropUV.v/nh).toFixed(4));
    }
    return p;
}
const stateStorageKey = 'gatosState:' + location.pathname;
function writeHash(){
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    try { history.replaceState(null, '', '#'+stateParams()); } catch(e){}
    try {
      if (blindMode) return; // Never persist the anonymous-to-real assignment.
      localStorage.setItem(stateStorageKey, JSON.stringify({f:frame, a:varA, b:varB, d:dividerPos, g:gainIdx, h:heat}));
    } catch(e){}
  }, 150);
}
function readState(){
  let saved = {};
  const h = new URLSearchParams(location.hash.slice(1));
  // .size llego en Safari 17.4: en navegadores viejos es undefined y el estado
  // local siempre ganaba; la vacuidad se mide sin depender de esa propiedad
  if (h.toString() === '') try { saved = JSON.parse(localStorage.getItem(stateStorageKey)) || {}; } catch(e){}
  const num = s => { const n = parseFloat(s); return isFinite(n) ? n : null; };
  const findFrame = value => value == null ? undefined : FRAMES.find(f => String(f) === String(value));
  frame = findFrame(h.get('f')) ?? findFrame(saved.f) ?? FRAMES[0];
  const hv = (k, fb) => VARIANTS.some(v=>v.id===h.get(k)) ? h.get(k) : (VARIANTS.some(v=>v.id===fb) ? fb : null);
  varA = hv('a', saved.a) || (VARIANTS[0] && VARIANTS[0].id);
  varB = hv('b', saved.b) || (VARIANTS[Math.min(1, VARIANTS.length-1)] || VARIANTS[0] || {}).id;
  const hd = num(h.get('d'));
  dividerPos = clamp(hd != null ? hd : (isFinite(saved.d) ? saved.d : 0.5), 0, 1);
  const hg = parseInt(h.get('g'));
  gainIdx = clamp(Number.isInteger(hg) ? hg : (Number.isInteger(saved.g) ? saved.g : AMPLIFY_DEFAULT_IDX), 0, GAINS.length-1);
  heat = h.get('heat') === '1' || saved.h === true;
  const hz = num(h.get('z'));
  if (hz != null && hz > 0){
    zoom = hz;
    pan.x = num(h.get('x')) || 0;
    pan.y = num(h.get('y')) || 0;
  }
  return h;
}

/* ---------- UI ---------- */
// metricas de un .cmp abierto a mano o exportado: el import del creador y el
// servicio las sanean, pero el visor local no tiene a nadie detras (#103).
// Solo se pinta un numero finito; objetos/cadenas hostiles se omiten sin tirar.
function metricNum(v){ return typeof v === 'number' && isFinite(v) ? v : null; }
function variantStats(id){
  if (blindMode) return '';
  const m = variant(id).metrics;
  if (!m) return '';
  const lines = [];
  const pf = m.per_frame && m.per_frame[String(frame)];
  if (pf){
    const l = [];
    const pfS2 = metricNum(pf.ssimulacra2), pfPsnr = metricNum(pf.psnr_avg), pfSsim = metricNum(pf.ssim_all);
    if (pfS2 != null) l.push('S2 '+pfS2.toFixed(1));
    if (pfPsnr != null) l.push('PSNR '+pfPsnr.toFixed(2)+' dB');
    if (pfSsim != null) l.push('SSIM '+pfSsim.toFixed(4));
    if (l.length) lines.push(l.join(' \u00B7 ')+' · '+(FRAME_LABELS[frame] || 'frame '+frame));
  }
  const l2 = [];
  if (m.custom_note) l2.push(m.custom_note);
  const mS2 = metricNum(m.ssimulacra2), mPsnr = metricNum(m.psnr_avg), mSsim = metricNum(m.ssim_all);
  const mBytes = metricNum(m.size_bytes), mKbps = metricNum(m.kbps);
  if (mS2 != null) l2.push(T`S2 media ${mS2.toFixed(1)}`);
  if (mPsnr != null) l2.push('clip PSNR '+mPsnr.toFixed(2));
  if (mSsim != null) l2.push('SSIM '+mSsim.toFixed(4));
  if (mBytes) l2.push((mBytes/1048576).toFixed(1)+' MB');
  if (mKbps) l2.push(Math.round(mKbps)+' kbps');
  if (l2.length) lines.push(l2.join(' \u00B7 '));
  return lines.join('\n');
}
function updateMeta(){
  // variante parcial: qué lado no tiene el cuadro (vacío en las páginas completas)
  const gaps = [missA ? T('izq.') : '', missB ? T('der.') : ''].filter(Boolean);
  const noFrame = gaps.length ? T` · sin este cuadro: ${gaps.join(T(' y '))}` : '';
  if (blindMode){
    metaLine.textContent = T`Frame ${FRAMES.indexOf(frame)+1} · izquierda: ${variantName(varA)} · derecha: ${variantName(varB)} · CIEGO${noFrame}`;
    return;
  }
  const lbl = FRAME_LABELS[frame] || String(frame);
  const m = FRAME_META[frame] || {};
  const clipS = metricNum(m.clip_s);
  const where = clipS != null ? ` \u00B7 clip +${clipS.toFixed(1)}s` : '';
  const origin = CLIP.start_label ? T`Inicio del clip ${CLIP.start_label} · ` : '';
  const modes = [diffMode ? 'DIFF' : '', blinkMode ? 'BLINK' : '', blindMode ? T('CIEGO') : '', solarMode ? 'SOLAR' : ''].filter(Boolean).join('+');
  metaLine.textContent =
    T`${origin}Frame ${lbl} (#${frame}${where}) · izq. ${blindMode ? '?' : varA} · der. ${blindMode ? '?' : varB}${modes ? ' · '+modes : ''}${noFrame}`;
}
function preload(){
  const i = FRAMES.indexOf(frame);
  [i-1, i+1].forEach(j => {
    if (j >= 0 && j < FRAMES.length){
      for (const id of [varA, varB]) if (hasFrame(id, FRAMES[j])) srcFor(id, FRAMES[j]).then(u => { new Image().src = u; });
    }
  });
}
// repinta la etiqueta de un lado desde el par asentado (reversion en error)
function paintSide(side){
  const id = side === 'A' ? shownA : shownB;
  if (id == null) return;   // primer par sin carga exitosa: etiqueta inicial
  $('label'+side+'Name').textContent = variantName(id);
  $('stats'+side).textContent = variantStats(id);
  $('label'+side).style.color = blindMode ? '#e8e8f0' : variant(id).color;
}
function loadImg(){
  loadFailA = loadFailB = false;   // arranca un intento nuevo del par actual
  setSideSrc('A', varA);
  setSideSrc('B', varB);
  labelAName.textContent = variantName(varA);
  labelBName.textContent = variantName(varB);
  statsA.textContent = variantStats(varA);
  statsB.textContent = variantStats(varB);
  labelA.style.color = blindMode ? '#e8e8f0' : variant(varA).color;
  labelB.style.color = blindMode ? '#e8e8f0' : variant(varB).color;

  refreshFrameButtons(); refreshVariantButtons(); syncVariantOverflow();
  updateMeta();
  updateBadge();
  preload();
  if (cropMode) [varA, varB].forEach(v => cropImg(v));
  if (cropUV && cropPanel.style.display !== 'none') openCropPanel();
  writeHash();
}
function makeButtons(containerId, items, activeId, onPick){
  const c = $(containerId);
  c.innerHTML = '';
  items.forEach(item => {
    const b = document.createElement('button');
    if (item.sub != null){
      b.className = 'vbtn' + (item.id === activeId ? ' active' : '');
      if (item.cmd) b.dataset.cmd = item.cmd;
      const main = document.createElement('span'); main.className = 'main'; main.textContent = item.main;
      const sub = document.createElement('span'); sub.className = 'sub'; sub.textContent = item.sub;
      b.append(main, sub);
    } else {
      b.textContent = item.label;
      b.className = item.id === activeId ? 'active' : '';
    }
    // variante parcial sin este cuadro: atenuada pero elegible (verla es ver el aviso)
    if (item.dim){ b.classList.add('nofr'); b.title = T('Esta variante no tiene este cuadro'); }
    b.addEventListener('click', () => onPick(item.id));
    b.setAttribute('aria-pressed', String(item.id === activeId));
    c.appendChild(b);
  });
}
const cmdTip = document.createElement('div');
cmdTip.id = 'cmdTip'; document.body.appendChild(cmdTip);
let cmdPinned = false, cmdFor = null, cmdTimer = null, cmdText = '';
function cmdKey(t){
  // a line starting with '|' is the second stage of a piped command
  return t.startsWith('|') ? '|piped' : t.split(/\s+/)[0];
}
function showTip(b){
  if (blindMode) return;
  cmdText = b.dataset.cmd;
  // el botón cmd del teléfono declara su lado; los vbtn lo heredan de su tira
  const pane = b.dataset.pane || (b.closest('.variants') ? b.closest('.variants').id : null);
  const otherId = pane === 'varA' ? varB : (pane === 'varB' ? varA : null);
  const other = otherId ? variant(otherId) : null;
  const hlOk = {'--crf':1, '--preset':1, '--film-grain':1, '--film-grain-denoise':1};
  const omap = {};
  if (other && other.cmd){
    other.cmd.split('\n').forEach(l => {
      const t = l.trim().replace(/\\$/,'').trim();
      if (t) omap[cmdKey(t)] = t;
    });
  }
  const esc = x => x.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  let body;
  if (other && other.cmd){
    body = cmdText.split('\n').map(l => {
      const t = l.trim().replace(/\\$/,'').trim();
      if (!t) return esc(l);
      const key = cmdKey(t);
      const differs = !!hlOk[key] && (!(key in omap) || omap[key] !== t);
      return differs ? '<span class="dline">' + esc(l) + '</span>' : esc(l);
    }).join('\n');
  } else {
    body = esc(cmdText);
  }
  const legend = other && other.cmd ? T`en ámbar lo que difiere de <b>${esc(other.name)}</b>`
                                     : T('comando');
  cmdTip.innerHTML = '<div class="tiphead"><span class="tt">' + legend + '</span>'
    + '<button data-act="copy">' + T('Copiar') + '</button><button data-act="close">\u00d7</button></div>'
    + '<div class="cmdtext">' + body + '</div>';
  cmdTip.style.display = 'block';
  if (PHONE_MQ.matches){ cmdTip.style.left = ''; cmdTip.style.top = ''; return; }   // hoja desde abajo (CSS)
  const r = b.getBoundingClientRect();
  cmdTip.style.left = Math.min(window.innerWidth - cmdTip.offsetWidth - 8, Math.max(8, r.left)) + 'px';
  const below = r.bottom + 6;
  cmdTip.style.top = (below + cmdTip.offsetHeight > window.innerHeight - 8
    ? Math.max(8, r.top - cmdTip.offsetHeight - 6) : below) + 'px';
}
// teléfono: sin hover no hay tooltip; el botón cmd junto al selector lo fija
document.querySelectorAll('.vcmd').forEach(b => b.addEventListener('click', () => {
  if (cmdPinned && cmdFor === b){ hideTip(); return; }
  showTip(b); cmdPinned = true; cmdFor = b;
}));
function hideTip(){
  cmdPinned = false; cmdFor = null; clearTimeout(cmdTimer);
  cmdTip.style.display = 'none';
}
document.addEventListener('mouseover', e => {
  const b = e.target.closest('button.vbtn');
  if (cmdPinned) return;
  if (!b || !b.dataset.cmd){ clearTimeout(cmdTimer); cmdFor = null; cmdTip.style.display = 'none'; return; }
  if (cmdFor === b) return;
  clearTimeout(cmdTimer); cmdFor = b; cmdTip.style.display = 'none';
  cmdTimer = setTimeout(() => { showTip(b); cmdPinned = true; }, 2000);
});
document.addEventListener('click', e => {
  const act = e.target.closest('#cmdTip [data-act]');
  if (act && act.dataset.act === 'copy'){
    const done = ok => { const b = act; b.textContent = ok ? T('Copiado ✓') : T('Falló la copia');
      setTimeout(() => { b.textContent = T('Copiar'); }, 1200); };
    if (navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(cmdText).then(() => done(true), () => done(false));
    } else {
      const ta = document.createElement('textarea');
      ta.value = cmdText; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(true); } catch (err) { done(false); }
      ta.remove();
    }
    return;
  }
  if (act && act.dataset.act === 'close'){ hideTip(); return; }
  if (cmdPinned && !e.target.closest('#cmdTip') && !e.target.closest('.vcmd')) hideTip();
});
// Escape pertenece al modal abierto (compartir/reportar): no cierra a la vez
// el tooltip de comandos fijado detras del overlay
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sharePanel.style.display !== 'flex' && reportPanel.style.display !== 'flex') hideTip();
});
function refreshFrameButtons(){
  makeButtons('frames', FRAMES.map((f,i)=>({id:f, label: blindMode ? 'Frame '+(i+1) : FRAME_LABELS[f] || String(f)})), frame, f => { frame = f; loadImg(); });
}
function variantButtonItems(){
  // en modo ciego no se atenúa: no delata qué variante es la parcial antes de elegirla
  return orderedVariants().map((v, vi) => ({...variantItem(v, vi), dim: !blindMode && !hasFrame(v.id, frame)}));
}
function variantItem(v, vi){
  if (blindMode) return {id: v.id, main: 'Variante '+(vi+1), sub: '', cmd: null};
  const cmd = v.cmd || null;
  if (v.id === 'src') return {id: v.id, main: v.name || 'Source', sub: (v.note || '').replace(/Source \u00B7 /, ''), cmd: null};
  const m = v.id.match(/^crf(\d+)_p(\d)(?:_fg(\d+))?$/);
  if (!m) return {id: v.id, main: v.name, sub: v.note || '', cmd: cmd};
  const parts = (v.note || '').split(' \u00B7 ');
  const mbps = (parts[1] || '').replace(' Mbps', ' Mb/s');
  const s2 = (parts[2] || '');
  const main = `CRF ${m[1]}` + (m[3] ? ` \u00B7 FG ${m[3]}` : '');
  return {id: v.id, main: main, sub: `P${m[2]} \u00B7 ${mbps}${s2 ? ' \u00B7 ' + s2 : ''}`, cmd: cmd};
}
function fillSelect(selId, items, activeId, onPick){
  const s = $(selId);
  s.innerHTML = '';
  items.forEach((it,i) => {
    const o = document.createElement('option');
    o.value = blindMode ? 'blind-'+i : it.id;
    o.textContent = [it.main, it.sub, it.dim ? T('sin este cuadro') : ''].filter(Boolean).join(' · ');
    s.appendChild(o);
  });
  s.selectedIndex = items.findIndex(it=>it.id === activeId);
  s.onchange = () => onPick(items[s.selectedIndex].id);
}
function refreshVariantButtons(){
  const items = variantButtonItems();
  makeButtons('varA', items, varA, v => { varA = v; loadImg(); });
  makeButtons('varB', items, varB, v => { varB = v; loadImg(); });
  fillSelect('selA', items, varA, v => { varA = v; loadImg(); });
  fillSelect('selB', items, varB, v => { varB = v; loadImg(); });
  [['varA', varA], ['varB', varB]].forEach(([pane, id]) => {
    const b = document.querySelector('.vcmd[data-pane="'+pane+'"]');
    const cmd = !blindMode && variant(id).cmd;
    b.hidden = !cmd;
    if (cmd) b.dataset.cmd = cmd; else delete b.dataset.cmd;
  });
  if (cmdPinned && cmdFor && cmdFor.classList.contains('vcmd')) hideTip();
}
function stepFrame(d){
  const i = FRAMES.indexOf(frame)+d;
  if (i >= 0 && i < FRAMES.length){ frame = FRAMES[i]; loadImg(); }
}
document.querySelectorAll('.fnav').forEach(b => b.addEventListener('click', () => stepFrame(Number(b.dataset.fdir))));
function swapAB(){ [varA, varB] = [varB, varA]; loadImg(); }
function nudgeDivider(delta){ dividerPos = clamp(dividerPos+delta, 0, 1); applyTransform(); writeHash(); }

$('oneBtn').addEventListener('click', oneToOne);
$('resetBtn').addEventListener('click', fitView);
$('swapBtn').addEventListener('click', swapAB);

const helpDialog = $('helpDialog');
$('helpBtn').addEventListener('click', () => helpDialog.showModal());
$('helpClose').addEventListener('click', () => helpDialog.close());
helpDialog.addEventListener('close', () => $('helpBtn').focus());

window.addEventListener('keydown', e => {
  const t = e.target;
  // reportar es un modal: bloquea los atajos y Escape lo cierra (ops#5)
  if (reportPanel.style.display === 'flex'){
    if (e.key === 'Escape') closeReport();
    return;
  }
  if (helpDialog.open){
    if (e.key === 'Escape'){ e.preventDefault(); helpDialog.close(); }
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey || t?.isContentEditable) return;
  if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT')){
    if (e.key === 'Escape'){ t.blur(); closeShareIfOpen(); }
    return;   // escribiendo/seleccionando: los atajos esperan
  }
  if (e.key === '?'){ e.preventDefault(); helpDialog.showModal(); return; }
  if (sharePanel.style.display === 'flex'){
    if (e.key === 'Escape') closeShareIfOpen();
    return;
  }
  const CROP_ARROWS = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]};
  if (CROP_ARROWS[e.key] && (cropMode || cropUV)){
    // con el modo recortes activo las flechas son del punto (gatolocoses/gatos.pics#10):
    // siembran el centro si aún no hay punto; para cambiar frame, cierra el modo (C o Esc)
    e.preventDefault();
    const s = e.shiftKey ? 10 : 1;
    moveCrop(CROP_ARROWS[e.key][0]*s, CROP_ARROWS[e.key][1]*s);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight'){
    e.preventDefault();
    stepFrame(e.key === 'ArrowRight' ? 1 : -1);
  } else if (e.key === ' ' && !e.repeat && t?.tagName !== 'BUTTON'){
    e.preventDefault();   // no hacer scroll de página
    const ids = orderedVariants().map(v => v.id);
    varB = ids[(ids.indexOf(varB)+1) % ids.length];
    loadImg();
  } else if (!e.repeat && (e.key === 'n' || e.key === 'N')){ setSmooth(!smoothScale);
  } else if (/^[1-9]$/.test(e.key) || /^Digit[1-9]$/.test(e.code)){
    const idx = Number(/^Digit/.test(e.code) ? e.code.slice(-1) : e.key)-1;
    if (idx >= VARIANTS.length) return;
    if (e.shiftKey) varA = orderedVariants()[idx].id; else varB = orderedVariants()[idx].id;
    loadImg();
  } else if (!e.repeat && (e.key === 'd' || e.key === 'D')){ setDiff(!diffMode); }
  else if (!e.repeat && (e.key === 'b' || e.key === 'B')){ setBlink(!blinkMode); }
  else if (!e.repeat && (e.key === 'g' || e.key === 'G')){ setBlind(!blindMode); }
  else if (!e.repeat && (e.key === 'r' || e.key === 'R') && blindMode){ setBlind(false); }
  else if (!e.repeat && (e.key === 'l' || e.key === 'L')){ setSolar(!solarMode); }
  else if (!e.repeat && (e.key === 'c' || e.key === 'C')){ setCropMode(!cropMode); }
  else if (!e.repeat && (e.key === 's' || e.key === 'S')){ swapAB(); }
  else if (!e.repeat && (e.key === 'o' || e.key === 'O')){ oneToOne(); }
  else if (!e.repeat && (e.key === 'f' || e.key === 'F')){ fitView(); }
  else if (!e.repeat && (e.key === 'h' || e.key === 'H')){ setHeat(!heat); }
  else if (e.key === '+' || e.key === '='){ setGain(gainIdx+1); }
  else if (e.key === '-' || e.key === '_'){ setGain(gainIdx-1); }
  else if (e.key === ',' || e.code === 'Comma'){ nudgeDivider(e.shiftKey ? -0.05 : -0.01); }
  else if (e.key === '.' || e.code === 'Period'){ nudgeDivider(e.shiftKey ? 0.05 : 0.01); }
  else if (e.key === 'Escape'){ if (cropMode || cropUV){ setCropMode(false); closeCrop(); } }
});
