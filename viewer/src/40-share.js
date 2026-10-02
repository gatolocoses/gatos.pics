/* ---------- compartir: imagen PNG sin pérdida de la vista actual ---------- */
const sharePanel = $('sharePanel'), shareRows = $('shareRows');
const reportPanel = $('reportPanel');
let shareBlobUrl = null, shareName = 'gatos.pics.png';
function escq(x){ return String(x).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

function drawBrand(ctx, x, y){
  // espejo en miniatura: verde/amarillo fijos, el circulito cruza las palabras
  const W = 78, H = 16, cy = y + H/2;
  ctx.save();
  ctx.globalAlpha = .9;
  ctx.fillStyle = '#7bd389';
  ctx.beginPath(); ctx.roundRect(x, y, 44, H, [3,0,0,3]); ctx.fill();
  ctx.fillStyle = '#ffb454';
  ctx.beginPath(); ctx.roundRect(x+44, y, 34, H, [0,3,3,0]); ctx.fill();
  const cx = x + 8 + (W - 16) * (blinkMode ? .5 : dividerPos);
  ctx.fillStyle = '#fff'; ctx.shadowColor = '#000c'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
  ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI*2); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx-1.8, cy-3.2); ctx.lineTo(cx-4.4, cy); ctx.lineTo(cx-1.8, cy+3.2);
  ctx.moveTo(cx+1.8, cy-3.2); ctx.lineTo(cx+4.4, cy); ctx.lineTo(cx+1.8, cy+3.2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '700 9px system-ui, sans-serif'; ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText('gatos', x+22, cy);
  ctx.fillText('pics', x+61, cy);
  ctx.restore();
}

// curva solar aplicada píxel a píxel en una copia offscreen (motores sin
// ctx.filter: el PNG debe mostrar lo mismo que la pantalla)
function solarizedCopy(img){
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const cx = c.getContext('2d', {willReadFrequently:true});
  cx.drawImage(img, 0, 0);
  const id = cx.getImageData(0, 0, c.width, c.height), d = id.data;
  for (let i=0;i<d.length;i+=4){ d[i]=SOLAR_LUT[d[i]]; d[i+1]=SOLAR_LUT[d[i+1]]; d[i+2]=SOLAR_LUT[d[i+2]]; }
  cx.putImageData(id, 0, 0);
  return c;
}

function renderViewCanvas(){
  if (loadFailA || loadFailB) throw new Error('No se puede compartir: una imagen no carg\u00f3.');
  // autoridad de URL asentada (misma clase de carrera que el diff): complete
  // puede seguir en true con pixeles de la generacion anterior; el PNG exige
  // el par actual asentado en ambos lados (en diff realB es la autoridad)
  const bSettled = diffMode ? loadedUrlB === realB.src : loadedUrlPaneB === imgB.src;
  if (loadedUrlA !== imgA.src || !bSettled || !imgA.naturalWidth || !imgB.naturalWidth)
    throw new Error('Espera a que terminen de cargar las dos imágenes.');
  if (diffMode && !ensureDiffBase()) throw new Error('No se puede compartir el diff: revisa las dimensiones de las imágenes.');
  const comp2 = $('comp');
  const w = comp2.clientWidth, h = comp2.clientHeight, d = dpr();
  // region visible del contenido, sin barras negras: el lienzo es exactamente
  // la interseccion del cuadro de contenido (con zoom/pan) con la ventana
  const cx = ox + pan.x, cy = oy + pan.y, cw = rw * zoom, chh = rh * zoom;
  const ix = Math.max(0, cx), iy = Math.max(0, cy);
  const ir = Math.min(w, cx + cw), ib = Math.min(h, cy + chh);
  const vw = Math.max(1, ir - ix), vh = Math.max(1, ib - iy);
  const c = document.createElement('canvas');
  c.width = Math.round(vw * d); c.height = Math.round(vh * d);
  const x = c.getContext('2d');
  x.scale(d, d);
  x.translate(-ix, -iy);
  x.fillStyle = '#000';
  x.fillRect(ix, iy, vw, vh);
  x.imageSmoothingEnabled = smoothScale;
  const drawImg = (img) => {
    x.save();
    if (solarMode && img !== diffCanvas){
      if (CTX_FILTER_OK) x.filter = 'url(#solarCurve)';
      else img = solarizedCopy(img);   // Safari: LUT sobre copia offscreen
    }
    // CSS left/top are outside the transform. Scaling them shifts the export.
    x.drawImage(img, ox + pan.x, oy + pan.y, rw * zoom, rh * zoom);
    x.restore();
  };
  drawImg(imgA);
  const divX = dividerPos * w;
  if (!blinkMode){
    x.save();
    x.beginPath();
    const split = clamp(divX, ix, ir);
    x.rect(split, iy, ir - split, vh);
    x.clip();
    drawImg(diffMode ? diffCanvas : imgB);
    x.restore();
    // linea del divisor, solo dentro del contenido
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.fillRect(divX - 1, iy, 2, vh);
  } else if (imgB.style.opacity !== '0') {
    drawImg(imgB);
  }
  x.filter = 'none';
  // etiquetas DENTRO del area de contenido, pegadas a sus esquinas
  const ellipsis = (text, max) => {
    let s = text;
    if (x.measureText(s).width <= max) return s;
    while (s.length && x.measureText(s+'…').width > max) s = s.slice(0, -1);
    return s+'…';
  };
  const pill = (right, id) => {
    const name = variantName(id), stats = variantStats(id).split('\n').filter(Boolean);
    const maxWidth = Math.max(20, (vw-36)/2);
    x.font = '600 13px system-ui, sans-serif';
    const wName = x.measureText(name).width;
    x.font = '400 10px system-ui, sans-serif';
    const wStats = Math.max(0, ...stats.map(s => x.measureText(s).width));
    x.font = '600 13px system-ui, sans-serif';
    const pw = Math.min(maxWidth, Math.max(wName, wStats) + 20);
    const px2 = right ? ir-pw-12 : ix+12, py2 = iy+10;
    x.fillStyle = 'rgba(0,0,0,.75)';
    x.beginPath();
    x.roundRect(px2, py2, pw, 24+stats.length*14, 6);
    x.fill();
    x.fillStyle = blindMode ? '#e8e8f0' : variant(id).color || '#e8e8f0';
    x.fillText(ellipsis(name, pw-20), px2 + 10, py2 + 17);
    if (stats.length){
      x.font = '400 10px system-ui, sans-serif';
      x.fillStyle = '#c8c8d4';
      stats.forEach((s, i) => x.fillText(ellipsis(s, pw-20), px2+10, py2+31+i*14));
    }
  };
  if (vw >= 160 && vh >= 80){ pill(false, varA); pill(true, varB); }
  if (vw >= 108 && vh >= 60) drawBrand(x, ix+(vw-78)/2, ib-24);
  // el chip resume los modos activos: sin las entradas de parpadeo y Δ media,
  // un PNG congelado no indicaba su origen ni cuánto difiere el par
  const modes = [
    diffMode ? `Diff ×${GAINS[gainIdx]}${heat ? ' · calor' : ''} · Δ media ${diffData.mean.toFixed(2)}/255` : '',
    blinkMode ? 'Parpadeo A/B' : '',
    solarMode ? 'Solar' : '',
    blindMode ? 'Ciego' : '',
  ].filter(Boolean).join(' · ');
  if (modes && vw >= 160 && vh >= 100){
    x.font = '600 11px system-ui, sans-serif';
    const mw = Math.min(vw-16, x.measureText(modes).width+16);
    x.fillStyle = '#101014e6'; x.fillRect(ix+8, ib-54, mw, 18);
    x.fillStyle = '#ffb454'; x.fillText(ellipsis(modes, mw-16), ix+16, ib-41);
  }
  return c;
}

let shotUploader = null;
async function openShare(){
  if (shotUploader?.busy){ sharePanel.style.display = 'flex'; return; }
  let c;
  try { c = renderViewCanvas(); } catch(e){ alert(e.message); return; }
  const url = location.href.split('#')[0]+'#'+stateParams();
  const title = document.title || 'Comparación';
  const snapshotNames = [variantName(varA),variantName(varB)];
  const snapshotFrame = blindMode ? FRAMES.indexOf(frame)+1 : frame;
  $('shotUpload').hidden = true;
  $('shareUp').disabled = true;
  const rows = location.protocol === 'file:' || location.href === 'about:srcdoc' ? [] : [['Enlace a esta vista', url]];
  $('shareBlindNote').hidden = !blindMode;
  $('shareCodes').replaceChildren(); $('shareCodes').style.display = 'none';
  $('shareOwner').hidden = true;
  shareRows.innerHTML = '';
  for (const [label, text] of rows){
    const l = document.createElement('div');
    l.style.cssText = 'font-size:11px; color:var(--dim); margin:6px 0 3px;';
    l.textContent = label;
    const box = document.createElement('textarea');
    box.readOnly = true;
    box.value = text;
    box.style.cssText = 'width:100%; height:36px; background:#23232e; color:#e8e8f0; border:1px solid #333; border-radius:6px; padding:5px 8px; font:11px ui-monospace,Menlo,Consolas,monospace; resize:none;';
    box.onclick = async () => {
      box.select();
      let ok = false;
      if (navigator.clipboard && window.isSecureContext){
        try { await navigator.clipboard.writeText(text); ok = true; } catch(e){}
      }
      if (!ok){ try { ok = document.execCommand('copy'); } catch(e){} }
      const hint = $('shareHint');
      hint.textContent = ok ? 'copiado \u2713' : 'seleccionado: Ctrl+C';
      box.style.borderColor = ok ? '#7bd389' : '#ffb454';
      setTimeout(() => { hint.textContent = ''; box.style.borderColor = '#333'; }, 1500);
    };
    shareRows.appendChild(l);
    shareRows.appendChild(box);
  }
  sharePanel.style.display = 'flex';
  // generar la imagen de la vista actual
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  if (!blob){ $('shareHint').textContent = 'No se pudo generar el PNG.'; return; }
  if (shareBlobUrl) URL.revokeObjectURL(shareBlobUrl);
  shareBlobUrl = URL.createObjectURL(blob);
  const prev = $('sharePreview');
  prev.src = shareBlobUrl;
  prev.style.display = 'block';
  const dl = $('shareDl');
  dl.style.display = 'inline-block';
  const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'x';
  shareName = `gatos-${slug(snapshotNames[0])}-vs-${slug(snapshotNames[1])}-${snapshotFrame}.png`;
  dl.onclick = () => {
    const a = document.createElement('a');
    a.href = shareBlobUrl;
    a.download = shareName;
    a.click();
  };
  // subir la imagen exacta y armar los formatos para compartir
  // una sola imagen por pagina: el link es siempre el mismo y no se rompe
  const m = location.pathname.match(/^\/p\/([A-Za-z0-9_-]{10,64})/);
  const up = $('shareUp');
  if (!m){ up.style.display = 'none'; $('shareDel').style.display = 'none'; return; }
  $('shareDel').style.display = 'block';
  $('pageDelete').onclick = async () => {
    const key = ($('shareKey').value || '').trim();
    if (!key){
      $('shareHint').textContent = 'pega la llave de borrado para poder eliminar la página';
      $('shareKey').focus();
      return;
    }
    if (!confirm('¿Borrar esta página y su imagen compartida? No se puede deshacer.')) return;
    const btn = $('pageDelete');
    btn.disabled = true; btn.textContent = 'Borrando…';
    try {
      const resp = await fetch('/api/page/' + m[1], { method: 'DELETE', headers: { 'x-delete-key': key } });
      if (!resp.ok){
        let j = null; try { j = await resp.json(); } catch(e){}
        throw new Error((j && j.error) || ('HTTP ' + resp.status));
      }
      alert('Página borrada.');
      location.href = '/';
    } catch (e) {
      alert('No se pudo borrar: ' + e.message);
      btn.disabled = false; btn.textContent = 'Borrar esta página…';
    }
  };
  $('shareUseKey').onclick = () => {
    try { $('shareKey').value = sessionStorage.getItem('gatosOwner:'+m[1]) || ''; } catch(e){}
    $('shareUseKey').hidden = true;
  };
  up.style.display = 'inline-block';
  up.disabled = false;
  $('shareOwner').hidden = false;
  // la llave de borrado ya no se autocompleta ni persiste para siempre: migra
  // a sessionStorage (vive una sesion) y se pega explicitamente (ops#97/#100 —
  // un marco hostil no hereda la llave lista para un solo clic)
  try {
    const lk = 'gatosOwner:'+m[1];
    const oldKey = localStorage.getItem(lk);
    if (oldKey !== null){ sessionStorage.setItem(lk, oldKey); localStorage.removeItem(lk); }
    if (sessionStorage.getItem(lk)) $('shareUseKey').hidden = false;
  } catch(e){}
  shotUploader = new GatosUpload({
    panel:$('shotUpload'), progress:$('shotProgress'), status:$('shotStatus'),
    cancel:$('shotCancel'), retry:$('shotRetry'),
    retryCaution:'La imagen pudo actualizarse. Reintentar reemplaza la misma URL.',
    onBusy:busy => { up.disabled = busy; $('shareKey').disabled = busy; },
    onSuccess:j => {
      const page = url;
      const codes = [
        ['BBCode (foros, la vista exacta clicable)', '[url=' + page + '][img]' + j.url + '[/img][/url]'],
        ['Markdown', '[![' + title.replace(/[\[\]\\]/g, '\\$&') + '](' + j.url + ')](' + page + ')'],
        ['HTML', '<a href="' + escq(page) + '"><img src="' + escq(j.url) + '" alt="' + escq(title) + '" loading="lazy"></a>'],
        ['Imagen directa', j.url],
      ];
      const host2 = $('shareCodes');
      host2.innerHTML = '';
      for (const [label, text] of codes){
        const l = document.createElement('div');
        l.style.cssText = 'font-size:11px; color:var(--dim); margin:10px 0 3px;';
        l.textContent = label;
        const box = document.createElement('textarea');
        box.readOnly = true;
        box.value = text;
        box.style.cssText = 'width:100%; height:40px; background:#23232e; color:#e8e8f0; border:1px solid #333; border-radius:6px; padding:5px 8px; font:11px ui-monospace,Menlo,Consolas,monospace; resize:none;';
        box.onclick = async () => {
          box.select();
          let ok2 = false;
          if (navigator.clipboard && window.isSecureContext){ try { await navigator.clipboard.writeText(text); ok2 = true; } catch(e){} }
          if (!ok2){ try { ok2 = document.execCommand('copy'); } catch(e){} }
          $('shareHint').textContent = ok2 ? 'copiado \u2713' : 'seleccionado: Ctrl+C';
          box.style.borderColor = ok2 ? '#7bd389' : '#ffb454';
          setTimeout(() => { $('shareHint').textContent = ''; box.style.borderColor = '#333'; }, 1500);
        };
        host2.appendChild(l);
        host2.appendChild(box);
      }
      host2.style.display = 'block';
    }
  });
  up.onclick = () => {
    const key = $('shareKey').value.trim();
    if (!key){ $('shareHint').textContent = 'Ingresa la llave que recibiste al publicar.'; $('shareKey').focus(); return; }
    shotUploader.start(async () => ({url:'/api/shot/'+m[1],
      headers:{'content-type':'image/png','x-delete-key':key}, body:blob}));
  };
}
$('shareBtn').addEventListener('click', openShare);
/* ---------- reporte de pagina (solo paginas /p/) ---------- */
function closeReport(){
  if (reportPanel.style.display === 'flex'){ reportPanel.style.display = 'none'; $('reportBtn').focus(); }
}
{
  const rm = location.pathname.match(/^\/p\/([A-Za-z0-9_-]{10,64})/);
  const rBtn = $('reportBtn');
  if (rm){
    rBtn.style.display = '';
    rBtn.onclick = () => { reportPanel.style.display = 'flex'; $('reportReason').focus(); };
    $('reportClose').onclick = closeReport;
    $('reportSend').onclick = async () => {
      const send = $('reportSend');
      send.disabled = true; send.textContent = 'Enviando…';
      try {
        const resp = await fetch('/api/report/' + rm[1], {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reason: $('reportReason').value, note: $('reportNote').value }),
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        $('reportStatus').textContent = 'Reporte enviado. Gracias.';
        setTimeout(() => { closeReport(); $('reportStatus').textContent = ''; }, 1400);
      } catch (e) {
        $('reportStatus').textContent = 'No se pudo enviar: ' + e.message;
      } finally {
        send.disabled = false; send.textContent = 'Enviar reporte';
      }
    };
    for (const ev of ['pointerdown','mousedown','touchstart'])
      reportPanel.addEventListener(ev, e => e.stopPropagation());
  }
}
$('shareClose').addEventListener('click', closeShareIfOpen);
function closeShareIfOpen(){ if (sharePanel.style.display === 'flex'){ sharePanel.style.display = 'none'; $('shareBtn').focus(); } }
for (const ev of ['pointerdown','mousedown','touchstart','wheel'])
  sharePanel.addEventListener(ev, e => e.stopPropagation());
