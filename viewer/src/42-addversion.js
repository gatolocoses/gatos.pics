/* ---------- sumar una versión a una página publicada (gatos-ops#342) ----------
   Quien publicó, con su llave de borrado, sube una imagen por frame y la página
   la suma al final como versión nueva (PATCH /api/page/<código>): solo viajan
   esas imágenes, lo demás queda igual. Las imágenes se ordenan por nombre de
   archivo y van a los frames en el orden de la página (la lista lo muestra antes
   de enviar); se comprueba que sean una por frame y que midan lo mismo que las
   de la página. Reintentar es seguro: el mismo id reemplaza a la misma versión. */
let addVerUploader = null, addVerFiles = [], addVerGen = 0;
const ADDVER_MAX = 12;   // el servicio acepta páginas de 2 a 12 versiones
const ADDVER_MIME = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', avif: 'image/avif', gif: 'image/gif', bmp: 'image/bmp' };
// id desde el nombre: [a-z0-9-], nunca uno reservado ni uno que la página ya tenga
function addVerId(name){
  let base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
  if (!base || base === 'constructor' || base === 'prototype') base = 'v' + (VARIANTS.length + 1);
  const taken = new Set(VARIANTS.map(v => String(v.id)));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = base.slice(0, 20) + '-' + n;
  return id;
}
function addVerDims(file){
  return new Promise(resolve => {
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => { URL.revokeObjectURL(u); resolve([im.naturalWidth, im.naturalHeight]); };
    im.onerror = () => { URL.revokeObjectURL(u); resolve(null); };
    im.src = u;
  });
}
function addVerRead(file){
  const ext = (file.name.match(/\.([a-z0-9]+)$/i) || [])[1];
  const typed = new Blob([file], { type: file.type || ADDVER_MIME[String(ext).toLowerCase()] || 'application/octet-stream' });
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error(T`No se pudo leer ${file.name}.`));
    r.readAsDataURL(typed);
  });
}
function addVerRender(){
  const list = $('addVerFrames');
  list.replaceChildren(...FRAMES.map((f, i) => {
    const li = document.createElement('li');
    li.textContent = (FRAME_LABELS[f] || String(f)) + ' ← ' + (addVerFiles[i] ? addVerFiles[i].name : '—');
    return li;
  }));
}
// true si se puede enviar; si no, la nota dice qué falta
async function addVerCheck(){
  const gen = ++addVerGen, note = $('addVerNote'), send = $('addVerSend');
  send.disabled = true;
  addVerRender();
  const say = (t) => { if (gen === addVerGen) note.textContent = t; return false; };
  if (VARIANTS.length >= ADDVER_MAX) return say(T`La página ya tiene ${ADDVER_MAX} versiones, el máximo.`);
  if (!addVerFiles.length) return say(T`Elige ${FRAMES.length} imágenes, una por frame.`);
  if (addVerFiles.length !== FRAMES.length) return say(T`Elegiste ${addVerFiles.length} imágenes y la página tiene ${FRAMES.length} frames.`);
  const want = imgA.naturalWidth ? [imgA.naturalWidth, imgA.naturalHeight] : null;   // sin medida a mano, la controla el servicio
  for (const f of addVerFiles){
    const d = await addVerDims(f);
    if (gen !== addVerGen) return false;
    if (!d) return say(T`No se pudo leer ${f.name} como imagen.`);
    if (want && (d[0] !== want[0] || d[1] !== want[1])) return say(T`${f.name} mide ${d[0]}x${d[1]} y las imágenes de la página ${want[0]}x${want[1]}.`);
  }
  if (!$('addVerName').value.trim()) return say(T('Ponle un nombre a la versión.'));
  const mib = (addVerFiles.reduce((a, f) => a + f.size, 0) / 1048576).toFixed(1);
  say(T`Listo para enviar: ${addVerFiles.length} imágenes, ${mib} MiB.`);
  if (gen === addVerGen) send.disabled = false;
  return gen === addVerGen;
}
function addVerSetup(token){
  $('addVer').hidden = false;
  if (addVerUploader) return;
  $('addVerOpen').onclick = () => {
    const form = $('addVerForm'), open = form.hidden;
    form.hidden = !open; $('addVerOpen').setAttribute('aria-expanded', String(open));
    if (open){ addVerCheck(); $('addVerName').focus(); }
  };
  $('addVerFiles').onchange = () => {
    addVerFiles = [...$('addVerFiles').files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    addVerCheck();
  };
  $('addVerName').oninput = () => addVerCheck();
  addVerUploader = new GatosUpload({
    panel: $('addVerUpload'), progress: $('addVerProgress'), status: $('addVerStatus'),
    cancel: $('addVerCancel'), retry: $('addVerRetry'),
    retryCaution: T('Reintentar es seguro: vuelve a sumar la misma versión.'),
    onBusy: busy => { for (const id of ['addVerSend', 'addVerName', 'addVerFiles', 'shareKey']) $(id).disabled = busy; if (!busy) addVerCheck(); },
    onSuccess: () => { $('addVerStatus').textContent = T('Versión añadida. Recargando la página…'); setTimeout(() => location.reload(), 900); },
  });
  $('addVerSend').onclick = async () => {
    const key = $('shareKey').value.trim();
    if (!key){ $('shareHint').textContent = T('Ingresa la llave que recibiste al publicar.'); $('shareKey').focus(); return; }
    if (!(await addVerCheck())) return;
    const name = $('addVerName').value.trim(), id = addVerId(name), files = addVerFiles.slice(), frames = FRAMES.slice();
    addVerUploader.start(async (cancelled) => {
      const images = {};
      for (let i = 0; i < frames.length; i++){
        if (cancelled()) return null;
        images[`${id}_${frames[i]}`] = await addVerRead(files[i]);
      }
      const body = new Blob([JSON.stringify({ format: 'gatos.pics/cmp@1', manifest: { variants: [{ id, name }] }, images })], { type: 'application/json' });
      return { url: '/api/page/' + token, method: 'PATCH', headers: { 'content-type': 'application/json', 'x-delete-key': key }, body };
    });
  };
}
