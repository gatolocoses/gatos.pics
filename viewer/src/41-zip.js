/* ---------- todas las imágenes en un .zip (gatos-ops#396) ----------
   Solo en una página publicada: el servidor arma el zip (GET /z/<token>.zip,
   service/lib/zipdl.mjs) con cada imagen en el formato en que se guardó y un
   nombre «NN - cuadro - versión» para que las versiones de un cuadro queden
   juntas. Un HTML descargado ya trae sus imágenes adentro: ahí no aparece.
   Tampoco en la prueba ciega: los nombres revelarían cuál es cuál. La lista
   que se muestra es la misma que arma el servidor (zipPlan); el tamaño sale
   de un HEAD, que no trae nada del almacenamiento frío. */
const zipClean = s => String(s).normalize('NFC').replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, '_')
  .replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 80).trim();
function zipEntryNames(){
  const pad = Math.max(2, String(FRAMES.length).length), used = new Set(), out = [];
  FRAMES.forEach((f, i) => {
    for (const v of VARIANTS){
      if (!hasFrame(v.id, f)) continue;
      const ext = own(v.image_exts, String(f)) || v.ext || 'webp';
      const base = `${String(i + 1).padStart(pad, '0')} - ${zipClean(own(FRAME_LABELS, String(f)) || f) || f} - ${zipClean(v.name || v.id) || v.id}`;
      let name = `${base}.${ext}`;
      for (let k = 2; used.has(name.toLowerCase()); k++) name = `${base} (${k}).${ext}`;
      used.add(name.toLowerCase());
      out.push(name);
    }
  });
  return out;
}
let zipSize = null;   // [token, «21.4 MB»]: el HEAD se hace una vez por página
function paintShareZip(){
  const box = $('shareZip'), token = (location.pathname.match(/^\/p\/([A-Za-z0-9_-]{10,64})/) || [])[1];
  box.hidden = !token || blindMode || !!testRun;
  if (box.hidden) return;
  const names = zipEntryNames(), url = `/z/${token}.zip`, info = $('zipInfo');
  $('zipBtn').href = url;
  const line = size => info.textContent = [names.length === 1 ? T('1 imagen') : T`${names.length} imágenes`, size,
    T`${FRAMES.length} cuadros × ${VARIANTS.length} versiones`].filter(Boolean).join(' · ');
  const list = names.length > 4 ? [...names.slice(0, 3), '…', names[names.length - 1]] : names;
  $('zipList').textContent = [(zipClean(originalTitle || '') || 'gatos.pics') + '.zip', ...list.map(n => '  ' + n)].join('\n');
  if (zipSize && zipSize[0] === token){ line(zipSize[1]); return; }
  line('');
  fetch(url, {method: 'HEAD'}).then(r => {
    const n = r.ok && Number(r.headers.get('content-length'));
    if (n){ zipSize = [token, (n / 1048576).toFixed(1) + ' MB']; line(zipSize[1]); }
  }).catch(() => {});
}
