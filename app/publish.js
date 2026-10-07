/* publish.js — flujo de compartir: publicar en gatos.pics y su recibo.
   Extraído de builder.js (gatos.pics#28, serie de extracción sancionada por
   AGENTS.md: builder.js pasó el presupuesto blando). Cargado después de
   builder.js: consume sus globales ($, esc, busy, packageCore,
   packageJSONBlob, download) y GatosUpload, de viewer/upload.js. Nada aquí
   toca el estado del proyecto más allá de leerlo para serializar el envío. */
const serviceHere = location.hostname === 'gatos.pics' ||
  (['localhost','127.0.0.1'].includes(location.hostname) && location.pathname.startsWith('/crear'));
const PUBLISH_URL = serviceHere ? '/api/upload' : 'https://gatos.pics/api/upload';
const UPDATE_URL = token => PUBLISH_URL.replace(/\/api\/upload$/, '/api/page/' + token);
let publicationReceipt = null;
/* Envío por partes (gatos-ops#157). El servicio recibe hasta 300 MiB de
   imágenes por pedido, pero una página puede llegar a 1 GiB: la primera parte
   crea (o reemplaza) la página con sus primeros frames y cada parte siguiente
   suma frames con PATCH. Cada parte lleva el manifiesto recortado a los
   frames ya enviados, así la página es válida en todo momento y al final
   queda idéntica a la de un solo envío. */
const PART_BYTES = (window.GATOS_PART_MB || 200) * 1048576, PART_MAX = 280 * 1048576;
function splitParts(core){
  const m = core.manifest, size = new Map(core.entries.map(([k, f]) => [k, f.size]));
  const parts = [];
  let cur = [], bytes = 0, total = 0;
  for (const f of m.frames){
    let b = 0;
    for (const v of m.variants) b += size.get(v.id+'_'+f) || 0;
    if (b > PART_MAX) throw new Error(`El frame ${f} pesa ${(b/1048576).toFixed(0)} MiB entre todas sus variantes: el límite por frame es 280 MiB.`);
    if (cur.length && bytes + b > PART_BYTES){ parts.push(cur); cur = []; bytes = 0; }
    cur.push(f); bytes += b; total += b;
  }
  parts.push(cur);
  // las variantes parciales no se reparten: van en un solo pedido o no van
  if (parts.length > 1 && m.variants.some(v => v.frames)) throw new Error('Esta página pesa demasiado para un solo envío y tiene variantes parciales: reduce frames o imágenes.');
  return parts;
}
function partCore(core, parts, i){
  const sent = new Set(parts.slice(0, i+1).flat().map(String)), now = new Set();
  const m = JSON.parse(JSON.stringify(core.manifest));
  for (const f of parts[i]) for (const v of m.variants) now.add(v.id+'_'+f);
  m.frames = m.frames.filter(f => sent.has(String(f)));
  const prune = o => { if (o) for (const k of Object.keys(o)) if (!sent.has(k)) delete o[k]; };
  prune(m.frame_labels);
  for (const v of m.variants) prune(v.metrics && v.metrics.per_frame);
  return {...core, manifest:m, entries:core.entries.filter(([k]) => now.has(k))};
}
async function partRequest(core, parts, i, first, meta, cancelled){
  const many = parts.length > 1;
  const req = i === 0 ? first : {method:'PATCH', url:UPDATE_URL(meta.page.token), headers:{'content-type':'application/json', ...meta.keys},
    retryCaution:'El servidor pudo recibir esta parte. Reintentar la vuelve a mandar; no crea otra página.'};
  return {...req, body: await packageJSONBlob(many ? partCore(core, parts, i) : core, {cancelled}),
    label: many ? `Parte ${i+1} de ${parts.length}` + (i ? ` (la página ya existe, incompleta: ${meta.page.url})` : '') : '',
    meta:{...meta, core, parts, i}};
}
const publisher = new GatosUpload({
  panel:$('publishUpload'), progress:$('publishProgress'), status:$('publishStatus'),
  cancel:$('publishCancel'), retry:$('publishRetry'),
  retryCaution:'El servidor pudo recibir el paquete. Reintentar puede crear otra página.',
  onApiKeyRequired: () => { setTimeout(publisher.request?.meta?.update ? askUpdateKeyAndRetry : askApiKeyAndRetry, 400); },
  onBusy:busy => { for (const id of ['btnPublish','btnPublish2','btnUpdate','btnUpdate2']) $(id).disabled = busy; },
  onSuccess:(j, meta) => {
    if (meta.parts && meta.i + 1 < meta.parts.length){   // faltan partes: la siguiente suma sus frames
      const page = meta.page || j;
      const keys = meta.keys || {'x-delete-key': j.delete_key};
      if (j.delete_key) try { sessionStorage.setItem('gatosOwner:'+j.token, j.delete_key); } catch(e){}
      publisher.start(cancelled => partRequest(meta.core, meta.parts, meta.i + 1, null, {...meta, page, keys}, cancelled));
      return;
    }
    if (meta.page) j = {...meta.page, ...j, delete_key: meta.page.delete_key, delete_url: meta.page.delete_url};
    if (meta.update){   // actualización: mismo enlace y misma llave, no hay recibo nuevo
      $('publishStatus').textContent = 'Página actualizada. El enlace sigue siendo el mismo: ' + j.url + ' (si no ves el cambio, recarga la página).';
      return;
    }
    $('pubUrl').value = j.url;
    $('pubKey').value = j.delete_key;
    publicationReceipt = {url:j.url, delete_url:j.delete_url, delete_key:j.delete_key};
    try { sessionStorage.setItem('gatosOwner:'+j.token, j.delete_key); } catch(e){}
    $('pubDel').textContent = 'curl -X DELETE -H "x-delete-key: ' + j.delete_key + '" ' + j.delete_url;
    // formatos para compartir: vista previa clicable con la primera variante/frame
    const img = j.url + meta.image;
    const title = meta.title;
    $('pubBB').value = '[url=' + j.url + '][img]' + img + '[/img][/url]';
    $('pubMD').value = '[![' + title + '](' + img + ')](' + j.url + ')';
    $('pubHTML').value = '<a href="' + esc(j.url) + '"><img src="' + esc(img) + '" alt="' + esc(title) + '" loading="lazy"></a>';
    $('pubFrame').style.display = 'flex';
  }
});
function askApiKeyAndRetry(){
  // camino 403 (tier sin llave cerrado o agotado): pedir la llave una vez,
  // recordarla y reintentar el MISMO envio con el header puesto
  const k = (prompt('Publicar sin límite necesita tu llave API. Pégala aquí (el creador la recuerda para la próxima):') || '').trim();
  if (!k) return;
  try { localStorage.setItem('gatosApiKey', k); } catch(e){}
  const req = publisher.request;
  if (req){
    req.headers['x-api-key'] = k;
    publisher.send();
  }
}
function askUpdateKeyAndRetry(){
  // 403 al actualizar: esa llave (o ninguna) no sirvió para ESA página
  const k = (prompt('Esa llave no sirvió para esta página. Pega la llave de borrado de la página o tu llave API:') || '').trim();
  const req = publisher.request;
  if (!k || !req) return;
  req.headers['x-delete-key'] = k;
  req.headers['x-api-key'] = k;
  publisher.send();
}
// Actualizar una página ya publicada sin cambiar su enlace (PUT /api/page/<token>,
// gatos-ops#145): reemplaza TODO su contenido con el proyecto abierto. Usa la
// llave de borrado que este navegador guardó al publicar esa página, o la llave
// API recordada; si no hay ninguna, la pide.
function updatePage(){
  if (busy){ $('builderStatus').textContent = 'La captura de video está en curso; espera a que termine para actualizar.'; return; }
  const link = (prompt('Enlace de la página que quieres actualizar (el enlace no cambia):', publicationReceipt ? publicationReceipt.url : '') || '').trim();
  if (!link) return;
  const m = link.match(/\/p\/([A-Za-z0-9_-]{10,64})/) || link.match(/^([A-Za-z0-9_-]{10,64})$/);
  if (!m){ $('builderStatus').textContent = 'Ese enlace no es de una página de gatos.pics (debe contener /p/ y su código).'; return; }
  const token = m[1];
  let ownerKey = '', apiKey = '';
  try { ownerKey = sessionStorage.getItem('gatosOwner:'+token) || ''; } catch(e){}
  try { apiKey = localStorage.getItem('gatosApiKey') || ''; } catch(e){}
  if (!ownerKey && !apiKey){
    ownerKey = apiKey = (prompt('Pega la llave de borrado de esa página (o tu llave API):') || '').trim();
    if (!ownerKey) return;
  }
  if (!confirm('Esto reemplaza TODO el contenido de esa página con el proyecto abierto. El enlace y la llave siguen igual. ¿Continuar?')) return;
  publisher.start(async cancelled => {
    const core = await packageCore({complete:true, cancelled});
    if (cancelled()) return;
    const keys = {...(ownerKey ? {'x-delete-key':ownerKey} : {}), ...(apiKey ? {'x-api-key':apiKey} : {})};
    return partRequest(core, splitParts(core), 0, {method:'PUT', url:UPDATE_URL(token), headers:{'content-type':'application/json', ...keys},
      retryCaution:'El servidor pudo recibir el paquete. Reintentar vuelve a reemplazar la misma página, sin cambiar su enlace.'},
      {update:true, keys, page:{token, url:link}}, cancelled);
  });
  $('publishUpload').scrollIntoView({block:'nearest'});
}
function publishPage(){
  if (busy){ $('builderStatus').textContent = 'La captura de video está en curso; espera a que termine para publicar.'; return; }
  publisher.start(async cancelled => {
    const core = await packageCore({complete:true, cancelled});
    if (cancelled()) return;
    const v = core.manifest.variants[0], f = core.manifest.frames[0];
    const file = new Map(core.entries).get(v.id+'_'+f);
    const ext = ((file && file.type.split('/')[1]) || 'png').replace('jpeg','jpg');
    let apiKey = '';
    try { apiKey = localStorage.getItem('gatosApiKey') || ''; } catch(e){}
    // cuerpo por partes (gatos.pics#29): un dataURL a la vez dentro de
    // packageJSONBlob; publicar ya no sostiene el paquete Y su JSON a la vez
    return partRequest(core, splitParts(core), 0, {url:PUBLISH_URL, headers:{'content-type':'application/json', ...(apiKey ? { 'x-api-key': apiKey } : {})}},
      {title:core.manifest.title || 'Comparación', image:'img/'+v.id+'_'+f+'.'+ext}, cancelled);
  });
  $('publishUpload').scrollIntoView({block:'nearest'});
}
$('btnPublish').addEventListener('click', publishPage);
$('btnPublish2').addEventListener('click', publishPage);
$('btnUpdate').addEventListener('click', updatePage);
$('btnUpdate2').addEventListener('click', updatePage);
$('pubClose').addEventListener('click', () => { $('pubFrame').style.display = 'none'; });
$('pubOpen').addEventListener('click', () => { window.open($('pubUrl').value, '_blank'); });
$('pubReceipt').addEventListener('click', () => {
  if (publicationReceipt) download('gatos-publicacion.json', new Blob([JSON.stringify(publicationReceipt,null,2)], {type:'application/json'}));
});
$('pubCopy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('pubUrl').value);
    $('pubCopy').textContent = '✓';
    setTimeout(() => { $('pubCopy').textContent = 'Copiar'; }, 1200);
  } catch(e){}
});
