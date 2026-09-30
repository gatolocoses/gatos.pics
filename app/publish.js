/* publish.js — flujo de compartir: publicar en gatos.pics y su recibo.
   Extraído de builder.js (gatos.pics#28, serie de extracción sancionada por
   AGENTS.md: builder.js pasó el presupuesto blando). Cargado después de
   builder.js: consume sus globales ($, esc, busy, currentPackage, download)
   y GatosUpload, de viewer/upload.js. Nada aquí toca el estado del proyecto
   más allá de leerlo para serializar el envío. */
const serviceHere = location.hostname === 'gatos.pics' ||
  (['localhost','127.0.0.1'].includes(location.hostname) && location.pathname.startsWith('/crear'));
const PUBLISH_URL = serviceHere ? '/api/upload' : 'https://gatos.pics/api/upload';
let publicationReceipt = null;
const publisher = new GatosUpload({
  panel:$('publishUpload'), progress:$('publishProgress'), status:$('publishStatus'),
  cancel:$('publishCancel'), retry:$('publishRetry'),
  retryCaution:'El servidor pudo recibir el paquete. Reintentar puede crear otra página.',
  onApiKeyRequired: () => { setTimeout(askApiKeyAndRetry, 400); },
  onBusy:busy => { for (const id of ['btnPublish','btnPublish2']) $(id).disabled = busy; },
  onSuccess:(j, meta) => {
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
function publishPage(){
  if (busy){ $('builderStatus').textContent = 'La captura de video está en curso; espera a que termine para publicar.'; return; }
  publisher.start(async cancelled => {
    const pkg = await currentPackage({complete:true, cancelled});
    if (cancelled()) return;
    const v = pkg.manifest.variants[0], f = pkg.manifest.frames[0];
    const ext = pkg.images[v.id+'_'+f].slice(0,40).match(/^data:image\/([^;]+)/)[1].replace('jpeg','jpg');
    let apiKey = '';
    try { apiKey = localStorage.getItem('gatosApiKey') || ''; } catch(e){}
    return {url:PUBLISH_URL, headers:{'content-type':'application/json', ...(apiKey ? { 'x-api-key': apiKey } : {})},
      body:new Blob([JSON.stringify(pkg)], {type:'application/json'}),
      meta:{title:pkg.manifest.title || 'Comparación', image:'img/'+v.id+'_'+f+'.'+ext}};
  });
  $('publishUpload').scrollIntoView({block:'nearest'});
}
$('btnPublish').addEventListener('click', publishPage);
$('btnPublish2').addEventListener('click', publishPage);
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
