/* capture.js — modo video: lista de archivos, marcas, captura de frames.
   Extraído de builder.js (gatos.pics#28, serie de extracción sancionada por
   AGENTS.md: builder.js pasó el presupuesto blando). Cargado después de
   builder.js: siembra el estado avanzado (state.variants/state.cells) vía
   syncVideoToAdvanced y usa sus render* y busy; builder.js solo lee
   vidState.marks en beforeunload, ya con el archivo cargado. */
const vidDrop = $('vidDrop'), vidFile = $('vidFile'), vidPlayer = $('vidPlayer');
const vidState = { files: [], marks: [], cur: 0 };
vidDrop.addEventListener('click', () => vidFile.click());
vidFile.addEventListener('change', () => { addVideos([...vidFile.files]); vidFile.value=''; });
['dragover','dragenter'].forEach(ev => vidDrop.addEventListener(ev, e => { e.preventDefault(); vidDrop.classList.add('over'); }));
['dragleave','drop'].forEach(ev => vidDrop.addEventListener(ev, e => { e.preventDefault(); vidDrop.classList.remove('over'); }));
vidDrop.addEventListener('drop', e => addVideos([...e.dataTransfer.files]));

const vidURLs = new Map();
function vidURL(f){ if (!vidURLs.has(f)) vidURLs.set(f, URL.createObjectURL(f)); return vidURLs.get(f); }
const fmtT = t => {
  const m = Math.floor(t/60), s = t - m*60;
  return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2);
};

function addVideos(files){
  const vids = files.filter(f => f.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|m4v)$/i.test(f.name));
  vidState.files.push(...vids);
  renderVidList();
  syncVideoToAdvanced();
  if (vidState.files.length === vids.length && vids.length) showVid(0);
}
function renderVidList(){
  const host = $('vidList');
  host.innerHTML = '';
  vidState.files.forEach((f, i) => {
    const row = document.createElement('div');
    row.className = 'pair';
    const url = vidURL(f);
    row.innerHTML = `<span class="no">${i === 0 ? 'máster' : 'var '+(i)}</span>
      <span class="mono" style="min-width:0; overflow:hidden; text-overflow:ellipsis; max-width:420px;">${esc(f.name)}</span>
      <span class="hint">${(f.size/1048576).toFixed(1)} MB</span>
      <div class="tools">
        <button data-a="up" title="subir">↑</button>
        <button data-a="dn" title="bajar">↓</button>
        <button data-a="rm" title="quitar">×</button>
      </div>`;
    row.querySelector('[data-a=up]').onclick = () => { if (i>0){ [vidState.files[i-1], vidState.files[i]] = [vidState.files[i], vidState.files[i-1]]; renderVidList(); syncVideoToAdvanced(); } };
    row.querySelector('[data-a=dn]').onclick = () => { if (i<vidState.files.length-1){ [vidState.files[i+1], vidState.files[i]] = [vidState.files[i], vidState.files[i+1]]; renderVidList(); syncVideoToAdvanced(); } };
    row.querySelector('[data-a=rm]').onclick = () => {
      const f = vidState.files.splice(i,1)[0];
      const u = vidURLs.get(f);
      if (u){   // masters de GB no quedan anclados por un object URL vivo
        if (vidPlayer.src === u){ vidPlayer.removeAttribute('src'); vidPlayer.load(); }
        URL.revokeObjectURL(u); vidURLs.delete(f);
      }
      renderVidList(); syncVideoToAdvanced();
    };
    host.appendChild(row);
  });
  $('vidStage').style.display = vidState.files.length ? '' : 'none';
}
function showVid(i){
  vidState.cur = clampV(i);
  const f = vidState.files[vidState.cur];
  if (!f) return;
  vidPlayer.src = vidURL(f);
  $('vidWho').textContent = (vidState.cur === 0 ? 'máster · ' : 'variante '+vidState.cur+' · ') + f.name;
  vidPlayer.onloadedmetadata = () => {
    $('vidDur').textContent = `${vidPlayer.videoWidth}×${vidPlayer.videoHeight} · ${fmtT(vidPlayer.duration)}`;
  };
  vidPlayer.onerror = () => {
    $('vidDur').textContent = 'este navegador no puede abrir este archivo (¿códec o contenedor?) · pruébalo en otro navegador o usa capturas';
  };
}
const clampV = i => Math.max(0, Math.min(vidState.files.length-1, i));
$('vidPrev').addEventListener('click', () => showVid(vidState.cur-1));
$('vidNext').addEventListener('click', () => showVid(vidState.cur+1));

$('vidMark').addEventListener('click', () => {
  const t = vidPlayer.currentTime;
  if (!isFinite(t) || t < 0) return;
  vidState.marks.push(t);
  vidState.marks.sort((a,b) => a-b);
  renderVidMarks();
});
function renderVidMarks(){
  const host = $('vidMarks');
  if (!vidState.marks.length){ host.innerHTML = '<span class="hint">sin marcas · reproduce, pausa donde quieras comparar, y marca</span>'; return; }
  host.innerHTML = vidState.marks.map((t, i) =>
    `<span class="markchip" data-i="${i}" title="clic para saltar ahí">${fmtT(t)} <b data-rm="${i}" title="quitar">×</b></span>`
  ).join(' ');
  host.querySelectorAll('.markchip').forEach(chip => {
    chip.addEventListener('click', e => {
      if (e.target.dataset.rm !== undefined){
        vidState.marks.splice(+e.target.dataset.rm, 1);
        renderVidMarks();
        return;
      }
      vidPlayer.currentTime = vidState.marks[+chip.dataset.i];
    });
  });
}

/* el modo video siembra el estado avanzado: variantes = archivos, frames = marcas */
function syncVideoToAdvanced(){
  if (!vidState.files.length) return;
  const old = new Map(state.variants.map(v => [v.id, v]));
  state.variants = vidState.files.map((f, i) => {
    const id = 'v'+(i+1);
    const o = old.get(id);
    // fusión por id: si la variante ya existe se conserva entera (nombres,
    // notas, colores), no solo los campos técnicos
    return o || {id, name: i === 0 ? 'Máster' : f.name.replace(/\.[^.]+$/, '').slice(0, 24), codec:'', crf:'', bitrate:'', note:'', cmd:'', metric:'', color:PALETTE[i % PALETTE.length]};
  });
  // las variantes que desaparecen llevan sus celdas: sin esto quedan huérfanas
  const live = new Set(state.variants.map(v => v.id));
  for (const k of [...state.cells.keys()]) if (!live.has(k.split('|')[0])) state.cells.delete(k);
  while (state.variants.some(v => v.id === 'v'+nextVar)) nextVar++;   // monótono: nunca reutilizar un id
  renderVariants();
}

/* Seek to a timestamp. This does not establish frame alignment across videos. */
function captureFrame(video, t){
  return new Promise((res, rej) => {
    let finished = false, callback = null, fallback = null;
    const cleanup = () => {
      clearTimeout(timeout); clearTimeout(fallback);
      video.removeEventListener('seeked', seeked); video.removeEventListener('error', failed);
      if (callback != null) video.cancelVideoFrameCallback(callback);
    };
    const finish = error => {
      if (finished) return;
      finished = true; cleanup();
      if (error){ rej(error); return; }
      try {
        if (!video.videoWidth || video.readyState < 2) throw new Error('El video no tiene una imagen decodificada.');
        const c = document.createElement('canvas');
        c.width = video.videoWidth; c.height = video.videoHeight;
        c.getContext('2d').drawImage(video, 0, 0);
        res(c);
      } catch(e){ rej(e); }
    };
    const failed = () => finish(new Error('Error al decodificar el video.'));
    const seeked = () => {
      // Paused, detached videos may not submit another frame to the compositor.
      fallback = setTimeout(() => finish(), 120);
    };
    const timeout = setTimeout(() => finish(new Error('Se agotó el tiempo para buscar la captura.')), 15000);
    if (!Number.isFinite(t) || t < 0 || (Number.isFinite(video.duration) && t >= video.duration)){
      finish(new Error('El tiempo marcado queda fuera de este video.')); return;
    }
    video.addEventListener('error', failed);
    if (!video.seeking && Math.abs(video.currentTime-t) < 0.000001 && video.readyState >= 2){ finish(); return; }
    video.addEventListener('seeked', seeked, {once:true});
    if ('requestVideoFrameCallback' in video){
      callback = video.requestVideoFrameCallback(() => {
        if (!video.seeking && Math.abs(video.currentTime-t) < 0.001) finish();
      });
    }
    try { video.currentTime = t; } catch(e){ finish(e); }
  });
}
function canvasToBlob(c, fmt){
  return new Promise(res => {
    if (fmt === 'jpeg') c.toBlob(b => res(b), 'image/jpeg', 0.92);
    else c.toBlob(b => res(b), 'image/png');
  });
}

$('vidGo').addEventListener('click', async () => {
  if (!vidState.files.length){ $('vidProg').textContent = 'primero suelta los videos'; return; }
  if (!vidState.marks.length){ $('vidProg').textContent = 'primero marca al menos un momento'; return; }
  const fmt = 'png';   // evidencia sin pérdida, siempre
  syncVideoToAdvanced();
  const files = [...vidState.files], variants = [...state.variants];
  const marks = [...new Set(vidState.marks)].map(t => ({t,key:'t'+String(t).replace('.','_')}));
  // Drop only the unused starter frame, keep existing captures and manual rows.
  if (state.frames.length===1 && state.frames[0].key==='1' && !state.frames[0].label && !state.cells.size) state.frames=[];
  const frameKeys = new Set(state.frames.map(f=>f.key));
  for (const {t,key} of marks){
    if (!frameKeys.has(key)){ state.frames.push({key, label:fmtT(t)}); frameKeys.add(key); }
  }
  const btn = $('vidGo');
  btn.disabled = true;
  busy = true;   // gate único: guardar/publicar/importar/vista previa quedan fuera durante el lote
  // Freeze capture inputs while this batch owns the shared project state.
  const controls = [...document.querySelectorAll('#videoView button, #videoView input, #videoView select, #tabBasic, #tabAdv, #btnOpen, #btnSave, #btnPublish, #btnPreviewTop')];
  const disabled = controls.map(el=>el.disabled);
  controls.forEach(el=>el.disabled=true);
  $('vidDrop').style.pointerEvents='none'; $('vidMarks').style.pointerEvents='none';
  let n=0, failures=0;
  const total = files.length * marks.length, host=$('vidResults');
  host.replaceChildren(); $('vidDone').replaceChildren();
  const rows = files.map((file,vi)=>marks.map(({t},mi)=>{
    const row=document.createElement('li');
    row.textContent=`Marca ${mi+1} · ${t.toFixed(3)} s · ${variants[vi].name} (${file.name}): pendiente`;
    const prefix=row.textContent.replace(/pendiente$/,'');
    host.appendChild(row);
    return (message,status) => { row.textContent=prefix+message; row.dataset.status=status; };
  }));
  for (let vi=0;vi<files.length;vi++){
    const f=files[vi], vid=variants[vi];
    const v = document.createElement('video');
    v.muted = true; v.preload = 'auto';
    let loadError;
    $('vidProg').textContent = `Abriendo ${f.name}…`;
    try {
      await new Promise((resolve,reject) => {
        const finish = error => {
          clearTimeout(timer); v.onloadeddata=v.onerror=null;
          error ? reject(error) : resolve();
        };
        const timer=setTimeout(()=>finish(new Error('Se agotó el tiempo al abrir el video.')),15000);
        v.onloadeddata=()=>finish();
        v.onerror=()=>finish(new Error('El navegador no pudo abrir o decodificar este archivo (código '+(v.error?.code || 'desconocido')+').'));
        v.src=vidURL(f);
      });
    } catch(e){ loadError=e; }
    for (let mi=0;mi<marks.length;mi++){
      const {t,key}=marks[mi], result=rows[vi][mi];
      result('buscando el instante pedido…','working');
      try {
        if (loadError) throw loadError;
        const c = await captureFrame(v, t);
        const b = await canvasToBlob(c, fmt);
        if (!b) throw new Error('El navegador no pudo generar la imagen.');
        const ext = fmt === 'jpeg' ? 'jpg' : 'png';
        state.cells.set(vid.id+'|'+key, new File([b], `${vid.id}_${key}.${ext}`, {type: b.type}));
        probeDims(state.cells.get(vid.id+'|'+key));
        result('captura lista','ok');
      } catch (err) {
        failures++;
        const previous = state.cells.has(vid.id+'|'+key) ? ' Se conservó la captura anterior.' : '';
        result('Falló: '+err.message+previous,'error');
      }
      n++;
      $('vidProg').textContent = `Capturas procesadas: ${n}/${total}. Fallas: ${failures}.`;
      // Paint each result before proceeding, including consecutive decode errors.
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    v.removeAttribute('src'); v.load();
  }
  controls.forEach((el,i)=>el.disabled=disabled[i]); btn.disabled=false; busy = false;
  $('vidDrop').style.pointerEvents=''; $('vidMarks').style.pointerEvents='';
  renderFrames(); renderMatrix(); renderVariants();
  $('vidProg').textContent = failures
    ? `${n-failures}/${total} capturas listas. Revisa las ${failures} fallas indicadas abajo.`
    : `✓ ${total} capturas listas`;
  $('vidDone').innerHTML = `<button class="primary" id="vidToMatrix">Seguir en Avanzado → revisar imágenes</button>`;
  $('vidToMatrix').onclick = () => { setMode('advanced'); window.BUILDER.renderSteps(); [...document.querySelectorAll('#stepNav button')][3].click(); };
});

renderVidMarks();
