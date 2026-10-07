/* ---------- diff mode: cached abs-diff planes, canvas overlay ---------- */
function ensureDiffBase(){
  const keyA = imgA.src, keyB = realB.src;
  // pixeles asentados de ESTE par: el complete=true de pixeles previos no
  // prueba nada mientras la URL actual no haya terminado de cargar
  if (loadedUrlA !== keyA || loadedUrlB !== keyB) return null;
  if (loadFailA || loadFailB) return null;
  if (!imgA.naturalWidth || !realB.naturalWidth) return null;
  const w = imgA.naturalWidth, h = imgA.naturalHeight;
  if (realB.naturalWidth !== w || realB.naturalHeight !== h) return null;
  if (diffData && diffData.keyA === keyA && diffData.keyB === keyB) return diffData;
  const ca = document.createElement('canvas');
  ca.width = w; ca.height = h;
  const ctx = ca.getContext('2d', {willReadFrequently:true});
  ctx.drawImage(imgA, 0, 0);
  const a = ctx.getImageData(0,0,w,h).data;
  ctx.drawImage(realB, 0, 0);
  const b = ctx.getImageData(0,0,w,h).data;
  const n = w*h;
  const dr = new Uint8Array(n), dg = new Uint8Array(n), db = new Uint8Array(n);
  let sum = 0;
  for (let i=0, j=0; j<n; i+=4, j++){
    dr[j] = Math.abs(a[i]-b[i]); dg[j] = Math.abs(a[i+1]-b[i+1]); db[j] = Math.abs(a[i+2]-b[i+2]);
    sum += dr[j]+dg[j]+db[j];
  }
  diffData = {keyA, keyB, w, h, dr, dg, db, mean: sum/(n*3)};
  return diffData;
}
function renderDiff(){
  if (!diffMode) return;
  if (missA || missB){
    diffCanvas.style.display = 'none';
    imgB.style.display = '';
    diffNote.style.display = 'block';
    diffNote.textContent = 'Diff no disponible: una variante no tiene este cuadro.';
    return;
  }
  const d = ensureDiffBase();
  if (!d){
    diffCanvas.style.display = 'none';
    imgB.style.display = '';
    const mismatch = loadedUrlA === imgA.src && loadedUrlB === realB.src &&
      imgA.naturalWidth && realB.naturalWidth &&
      (imgA.naturalWidth !== realB.naturalWidth || imgA.naturalHeight !== realB.naturalHeight);
    diffNote.textContent = loadFailA || loadFailB
      ? 'Diff no disponible: una imagen no carg\u00f3.'
      : mismatch ? 'Diff no disponible: las imágenes tienen dimensiones distintas.' : 'Diff: cargando…';
    return;
  }
  diffCanvas.width = d.w; diffCanvas.height = d.h;
  diffCanvas.style.display = 'block'; imgB.style.display = 'none';
  const A = GAINS[gainIdx];
  const out = diffCtx.createImageData(d.w, d.h);
  const o = out.data;
  for (let j=0, i=0; j<d.dr.length; j++, i+=4){
    if (heat && (d.dr[j] >= HEAT_T || d.dg[j] >= HEAT_T || d.db[j] >= HEAT_T)){
      o[i] = 255;
    } else {
      o[i] = Math.min(255, d.dr[j]*A);
      o[i+1] = Math.min(255, d.dg[j]*A);
      o[i+2] = Math.min(255, d.db[j]*A);
    }
    o[i+3] = 255;
  }
  diffCtx.putImageData(out, 0, 0);
  diffNote.textContent = `Diff \u00D7${A}${heat ? ` \u00B7 calor (\u0394\u2265${HEAT_T} en rojo)` : ''} \u00B7 color = canal que difiere \u00B7 \u0394 media ${d.mean.toFixed(2)}/255`;
}
function setDiff(on){
  diffMode = on;
  if (on) setBlink(false, true);
  diffBtn.classList.toggle('diff-on', on);
  diffBtn.setAttribute('aria-pressed', String(on));
  $('diffTools').hidden = !on;
  diffCanvas.style.display = on ? 'block' : 'none';
  imgB.style.display = on ? 'none' : '';
  diffNote.style.display = on ? 'block' : 'none';
  if (on){
    diffNote.textContent = 'Diff \u00D7'+GAINS[gainIdx]+' \u00B7 calculando\u2026';
    setSideSrc('B', varB);
    renderDiff();
  } else {
    diffData = null;
    setSideSrc('B', varB);
  }
  applyTransform(); updateMeta(); writeHash();
}
function setGain(i){
  gainIdx = clamp(i, 0, GAINS.length-1);
  $('diffGain').value = String(gainIdx);
  if (diffMode) renderDiff();
  writeHash();
}
function setHeat(on){
  heat = on;
  $('heatBtn').setAttribute('aria-pressed', String(on));
  if (diffMode) renderDiff();
  writeHash();
}
imgA.addEventListener('load', () => {
  loadedUrlA = imgA.src; loadFailA = false;
  imgA.style.visibility = missA ? 'hidden' : ''; if (!missA) shownA = varA;
  computeFit();
  zoom = clamp(zoom, zmin(), zmax()); clampPan();
  if (pendingCropFraction){
    cropUV = {u:Math.round(pendingCropFraction[0]*imgA.naturalWidth),v:Math.round(pendingCropFraction[1]*imgA.naturalHeight)};
    pendingCropFraction = null; openCropPanel();
  }
  applyTransform(); renderDiff(); updateBadge();
});
imgA.addEventListener('error', () => {
  if (missA) return;   // el error de una petición vieja no mancha un lado que ya no pide imagen
  loadFailA = true; imgA.style.visibility = 'hidden';
  paintSide('A'); updateBadge(); renderDiff();
});

/* ---------- escala: suave o píxeles nítidos (inspección de píxel) ---------- */
let smoothScale = true;
try { smoothScale = localStorage.getItem('gatosSmooth') !== '0'; } catch(e){}
function setSmooth(on){
  smoothScale = on;
  for (const el of [imgA, imgB, diffCanvas]) el.style.imageRendering = on ? 'auto' : 'pixelated';
  pixBtn.classList.toggle('active', !on);
  pixBtn.setAttribute('aria-pressed', String(!on));
  try { localStorage.setItem('gatosSmooth', on ? '1' : '0'); } catch(e){}
  if (FRAMES.length) writeHash();
}
pixBtn.addEventListener('click', () => setSmooth(!smoothScale));
setSmooth(smoothScale);
imgB.addEventListener('load', () => {
  loadedUrlPaneB = imgB.src; loadFailB = false; imgB.style.visibility = missB ? 'hidden' : ''; if (!missB) shownB = varB;
  if (!diffMode) diffNote.style.display = 'none';
  if (missA && !imgA.naturalWidth){ computeFit(); clampPan(); applyTransform(); }   // A sin cuadro: B da la medida
  updateBadge();
});
realB.addEventListener('load', () => { loadedUrlB = realB.src; loadFailB = false; if (!missB) shownB = varB; renderDiff(); });
// el lado B no deja pixeles viejos bajo etiquetas nuevas: panel vacio y
// etiquetas revertidas al par asentado hasta que un load exitoso las avance
function onBError(){
  if (missB) return;
  loadFailB = true; imgB.style.visibility = 'hidden';
  paintSide('B');
  if (diffMode) renderDiff();
  else { diffNote.style.display = 'block'; diffNote.textContent = 'la imagen derecha no carg\u00f3'; }
}
imgB.addEventListener('error', onBError);
realB.addEventListener('error', onBError);
diffBtn.addEventListener('click', () => setDiff(!diffMode));
$('diffGain').addEventListener('change', () => setGain(Number($('diffGain').value)));
$('heatBtn').addEventListener('click', () => setHeat(!heat));

/* ---------- blink mode ---------- */
let blinkTimer = null;
// el aviso de B parpadea con su imagen: si B no tiene el cuadro, A y el aviso se alternan
const setBOpacity = v => { imgB.style.opacity = v; $('missB').style.opacity = v; };
function setBlink(on, quiet){
  blinkMode = on;
  if (on) setDiff(false);
  blinkBtn.classList.toggle('blink-on', on);
  blinkBtn.setAttribute('aria-pressed', String(on));
  clearInterval(blinkTimer);
  modeBadge.style.display = on ? 'block' : 'none';
  if (on){
    setBOpacity('1');
    blinkTimer = setInterval(() => { setBOpacity(imgB.style.opacity === '1' ? '0' : '1'); }, 500);
  } else {
    clearInterval(blinkTimer);
    setBOpacity('');
  }
  if (!quiet){ applyTransform(); updateMeta(); writeHash(); }
}
blinkBtn.addEventListener('click', () => setBlink(!blinkMode));

/* ---------- modo ciego: oculta qué variante es cuál (anti-sesgo) ---------- */
let blindMode = false;
let blindOrder = null;
function sessionBlindOrder(){
  if (blindOrder) return blindOrder;
  const key = 'gatosBlind:'+location.pathname+':'+originalTitle+':'+VARIANTS.map(v=>v.id).join(',');
  let seed;
  try { seed = Number(sessionStorage.getItem(key)) || 0; } catch(e){}
  if (!seed){
    seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    try { sessionStorage.setItem(key, String(seed)); } catch(e){}
  }
  const random = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  // Allow every permutation. Forcing a swap would reveal two-variant tests.
  const order = [...VARIANTS];
  for (let i=order.length-1; i>0; i--){
    const j = Math.floor(random()*(i+1)); [order[i],order[j]] = [order[j],order[i]];
  }
  return order;
}
function setBlind(on){
  if (on && !blindMode){
    blindOrder = sessionBlindOrder();
    varA = blindOrder[0]?.id; varB = blindOrder[1]?.id || varA;
  }
  blindMode = on;
  blindBtn.classList.toggle('blind-on', on);
  blindBtn.setAttribute('aria-pressed', String(on));
  $('revealBtn').hidden = !on;
  pageTitle.textContent = on ? 'Comparación a ciegas' : originalTitle;
  document.title = pageTitle.textContent;
  if (on) hideTip();
  refreshVariantButtons();
  loadImg();
  updateMeta();
  writeHash();
}
blindBtn.addEventListener('click', () => setBlind(!blindMode));
$('revealBtn').addEventListener('click', () => setBlind(false));

/* ---------- curva solar: revela banding ---------- */
let solarMode = false;
// SVG transfer tables use normalized channel values, not byte values.
document.querySelectorAll('#solarCurve feFuncR, #solarCurve feFuncG, #solarCurve feFuncB').forEach(el => {
  const values = el.getAttribute('tableValues').trim().split(/\s+/).map(Number);
  el.setAttribute('tableValues', values.map(v => v/255).join(' '));
});
// Safari nunca implemento CanvasRenderingContext2D.filter: la asignacion se
// ignora en silencio y el PNG compartido salia sin curva. Deteccion de feature
// + LUT de 256 entradas desde la misma tabla normalizada (ops#4).
const CTX_FILTER_OK = (() => {
  try { return typeof document.createElement('canvas').getContext('2d').filter === 'string'; } catch(e){ return false; }
})();
const SOLAR_LUT = (() => {
  const el = document.querySelector('#solarCurve feFuncR');
  const v = el ? el.getAttribute('tableValues').trim().split(/\s+/).map(Number) : [];
  const lut = new Uint8Array(256);
  for (let i=0;i<256;i++){
    if (v.length < 2){ lut[i] = i; continue; }   // sin tabla: identidad
    const t = i/255*(v.length-1), j = Math.min(v.length-2, Math.floor(t)), f = t-j;
    lut[i] = Math.round(255*(v[j]*(1-f) + v[j+1]*f));
  }
  return lut;
})();
function setSolar(on){
  solarMode = on;
  solarBtn.classList.toggle('solar-on', on);
  solarBtn.setAttribute('aria-pressed', String(on));
  const f = on ? 'url(#solarCurve)' : '';
  imgA.style.filter = f;
  imgB.style.filter = f;
  updateMeta();
  writeHash();
}
solarBtn.addEventListener('click', () => setSolar(!solarMode));

/* ---------- crops N-up: 1:1 crops of every variant at a picked point ---------- */
function pickCrop(cx, cy){
  const r = comp.getBoundingClientRect();
  const {nw, nh} = naturalDims();
  const u = clamp(((cx-r.left)-ox-pan.x)/zoom/fitScale, 0, nw);
  const v = clamp(((cy-r.top)-oy-pan.y)/zoom/fitScale, 0, nh);
  cropUV = {u: Math.round(u), v: Math.round(v)};
  openCropPanel();
  writeHash();
}
// teclado (gatolocoses/gatos.pics#10): sin puntero no había forma de elegir
// punto; las flechas siembran el centro y luego lo mueven en px nativos
// (Shift = pasos de 10). writeHash conserva el punto en el enlace compartido.
function moveCrop(dx, dy){
  const {nw, nh} = naturalDims();
  if (!cropUV) cropUV = {u: Math.round(nw/2), v: Math.round(nh/2)};
  cropUV = {u: clamp(cropUV.u+dx, 0, nw), v: clamp(cropUV.v+dy, 0, nh)};
  openCropPanel();
  writeHash();
}
const cropSrcReq = new Map();       // variant id -> promesa src en curso (carrera de frame)
function cropImg(id){
  if (!hasFrame(id, frame)){ cropSrcReq.delete(id); cropImgs.delete(id); return null; }   // parcial: sin cuadro no hay recorte
  const p = srcFor(id, frame);
  if (cropSrcReq.get(id) !== p){
    cropSrcReq.set(id, p);
    cropImgs.delete(id);            // en tránsito: no pintar píxeles del frame viejo
    p.then(url => {
      if (cropSrcReq.get(id) !== p) return;   // una petición más nueva ganó
      const im = new Image();
      im.decoding = 'async';
      im.src = url;
      cropImgs.set(id, im);
      if (cropPanel.style.display === 'block') openCropPanel();   // repinta filas en cargando
    });
  }
  return cropImgs.get(id);
}
function drawCropRow(id, canvas){
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (!hasFrame(id, frame)){
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9a9aa8'; ctx.fillText('sin este cuadro', 10, 20);
    return;
  }
  const im = cropImg(id);
  if (!im || !im.complete || !im.naturalWidth){
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9a9aa8'; ctx.fillText('cargando\u2026', 10, 20);
    if (im) im.addEventListener('load', () => { if (cropPanel.style.display !== 'none') drawCropRow(id, canvas); }, {once:true});
    return;
  }
  const sw = Math.min(canvas.width, im.naturalWidth), sh = Math.min(canvas.height, im.naturalHeight);
  const sx = clamp(Math.round(cropUV.u - sw/2), 0, im.naturalWidth - sw);
  const sy = clamp(Math.round(cropUV.v - sh/2), 0, im.naturalHeight - sh);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(im, sx, sy, sw, sh, Math.floor((canvas.width-sw)/2), Math.floor((canvas.height-sh)/2), sw, sh);
}
function openCropPanel(){
  const wasHidden = cropPanel.style.display !== 'block';
  cropPanel.style.display = 'block';
  cropHint.style.display = 'none';
  const d = dpr();
  let CW = Math.max(64, Math.min(480, comp.clientWidth - (innerWidth <= 820 ? 64 : 220))), CH = Math.round(CW*9/16);
  // hoja inferior del teléfono (apaisado sobre todo): un recorte más alto que
  // media vista taparía la comparación entera; se acota por alto
  if (PHONE_MQ.matches && CH > comp.clientHeight*0.45){ CH = Math.round(comp.clientHeight*0.45); CW = Math.max(64, Math.round(CH*16/9)); }
  cropTitle.textContent = `Recortes 1:1 @ ${cropUV.u},${cropUV.v} (px nativos)`;
  cropRows.innerHTML = '';
  orderedVariants().forEach(v => {
    const row = document.createElement('div');
    row.className = 'cropRow';
    const name = document.createElement('span');
    name.className = 'cname';
    name.textContent = variantName(v.id);
    name.style.color = blindMode ? '#e8e8f0' : v.color;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(CW*d); canvas.height = Math.round(CH*d);
    canvas.style.width = CW+'px'; canvas.style.height = CH+'px';
    row.appendChild(name); row.appendChild(canvas);
    cropRows.appendChild(row);
    drawCropRow(v.id, canvas);
  });
  // el panel entra al orden de foco al abrirse (no en repintados del mismo
  // panel): sin esto, un usuario de teclado quedaba fuera del diálogo
  if (wasHidden) $('cropClose').focus();
}
function closeCrop(){
  cropPanel.style.display = 'none';
  cropUV = null;
  if (cropMode) cropHint.style.display = 'block';
  else cropBtn.focus();   // retorno de foco al botón que abre el modo (gatolocoses/gatos.pics#10)
  writeHash();
}
function setCropMode(on){
  cropMode = on;
  cropBtn.classList.toggle('crop-on', on);
  cropBtn.setAttribute('aria-pressed', String(on));
  cropHint.style.display = on ? 'block' : 'none';
  // calentado incremental (#7): solo el par visible; el resto de variantes se
  // pide al abrir el panel, así entrar a Recortes no calienta todo de golpe
  if (on){ [varA, varB].forEach(v => cropImg(v)); }
  else if (cropUV) closeCrop();
  writeHash();
}
cropBtn.addEventListener('click', () => setCropMode(!cropMode));
$('cropClose').addEventListener('click', () => { setCropMode(false); closeCrop(); });
