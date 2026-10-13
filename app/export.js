'use strict';
/* export.js — vista previa y exportaciones: el HTML autónomo, el .cmp, el
   .zip, y guardar/abrir proyecto.
   Extraído de builder.js (gatos.pics#30, serie de extracción sancionada por
   AGENTS.md: builder.js pasó el presupuesto blando). Cargado después de
   builder.js y basic.js, antes de advanced.js: consume sus globales ($, state,
   busy, slug, runAction, packageCore, packageJSONBlob, importCmp) y los de
   assets.js y zip.js; publish.js, que carga después, usa download y fileBase
   de aquí. */
function buildStandaloneHTML(pkg, opts){
  // camino eager con el paquete YA armado (demo sintética y consola/pruebas;
  // quien llama espera antes VIEWER_ASSETS): los botones de exportar usan
  // standaloneParts y los dataURL nunca se sostienen todos a la vez (gatos.pics#29).
  // export: inline (portatil, file:// sin CSP). preview: URLs blob: — el srcdoc
  // hereda la CSP del creador hospedado y bloquea scripts inline generados en
  // runtime; los blob: solo pueden mintearlos nuestros scripts (inadivinables)
  const json = JSON.stringify(pkg).replace(/</g, '\\u003c');
  if (opts && opts.blob){
    for (const u of previewUrls) URL.revokeObjectURL(u);
    previewUrls.length = 0;
    const blobSrc = (code) => { const u = URL.createObjectURL(new Blob([code], {type:'text/javascript'})); previewUrls.push(u); return u; };
    return SHELL_HTML
      .replace('<script src="upload.js"><\/script>', () => '<script src="' + blobSrc(UPLOAD_SRC) + '"><\/script>')
      .replace('<script src="compare.js"><\/script>', () => '<script src="' + blobSrc('window.GATOS_LANG = "' + I18N.lang + '";window.GATOS_PACKAGE = ' + json + ';') + '"><\/script>\n<script src="' + blobSrc(ENGINE_SRC) + '"><\/script>');
  }
  const injection = '<script>window.GATOS_PACKAGE = ' + json + ';<\/script>\n';
  const engineTag = '<script>\n' + ENGINE_SRC + '\n<\/script>';
  return SHELL_HTML
    .replace('<script src="upload.js"><\/script>', () => '<script>\n'+UPLOAD_SRC+'\n<\/script>')
    .replace('<script src="compare.js"><\/script>', () => injection + engineTag);
}
const previewUrls = [];
/* vista previa: el paquete entra al iframe como Blob por imagen (gatos.pics#29).
   El srcdoc queda del tamaño del shell y el creador nunca sostiene el paquete
   serializado: solo un dataURL a la vez, dentro de packageJSONBlob. */
async function buildPreviewSrcdoc(core){
  for (const u of previewUrls) URL.revokeObjectURL(u);
  previewUrls.length = 0;
  const blobURL = blob => { const u = URL.createObjectURL(blob); previewUrls.push(u); return u; };
  const pkg = await packageJSONBlob(core, {htmlSafe:true});
  await VIEWER_ASSETS;
  return SHELL_HTML
    .replace('<script src="upload.js"><\/script>', () => '<script src="' + blobURL(new Blob([UPLOAD_SRC], {type:'text/javascript'})) + '"><\/script>')
    .replace('<script src="compare.js"><\/script>', () => '<script src="' + blobURL(new Blob(['window.GATOS_LANG = "' + I18N.lang + '";window.GATOS_PACKAGE = ', pkg, ';'], {type:'text/javascript'})) + '"><\/script>\n<script src="' + blobURL(new Blob([ENGINE_SRC], {type:'text/javascript'})) + '"><\/script>');
}
async function openPreviewOverlay(){
  if (busy){ $('builderStatus').textContent = T('La captura de video está en curso; espera a que termine para abrir la vista previa.'); return; }
  const core = await packageCore({complete:true});
  $('pvFrame').classList.add('show');
  $('pvBox').srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{background:#000;color:#9a9aa8;font:14px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}</style></head><body>' + T('Generando vista previa…') + '</body></html>';
  $('pvBox').srcdoc = await buildPreviewSrcdoc(core);
}
$('pvClose').addEventListener('click', () => { $('pvFrame').classList.remove('show'); $('pvBox').srcdoc = ''; for (const u of previewUrls) URL.revokeObjectURL(u); previewUrls.length = 0; });
$('btnPreviewTop').addEventListener('click', () => runAction(openPreviewOverlay));
$('btnPreview').addEventListener('click', () => runAction(openPreviewOverlay));

function download(name, blob){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
function fileBase(){
  return slug(state.title || 'comparacion') || 'comparacion';
}

/* ---------- bytes y zip: ver app/zip.js (extraído, gatos.pics#26) ---------- */
/* dataURLtoBytes, dataURLMime, strBytes, crc32 y makeZip (streaming por
   entradas) se cargan desde zip.js, antes que este archivo. */

/* ---------- export: HTML / .cmp / .zip ---------- */
/* HTML por partes (gatos.pics#29): el JSON del paquete es un Blob diferido y
   el archivo final se arma cortando el shell en sus dos etiquetas <script>.
   Bytes idénticos a buildStandaloneHTML(pkg): mismos marcadores (únicos en el
   shell), mismo orden de reemplazo, mismo escapado \u003c. */
const UP_TAG = '<script src="upload.js"><\/script>';
const CMP_TAG = '<script src="compare.js"><\/script>';
async function standaloneParts(core){
  const pkg = await packageJSONBlob(core, {htmlSafe:true});
  await VIEWER_ASSETS;
  const shell = SHELL_HTML;
  const i1 = shell.indexOf(UP_TAG), i2 = shell.indexOf(CMP_TAG);
  if (i1 < 0 || i2 < 0 || i2 < i1) throw new Error(T('El shell del visor no tiene las etiquetas esperadas.'));
  return [
    new Blob([shell.slice(0, i1)]),
    '<script>\n' + UPLOAD_SRC + '\n<\/script>',
    shell.slice(i1 + UP_TAG.length, i2),
    new Blob(['<script>window.GATOS_PACKAGE = ', pkg, ';<\/script>\n<script>\n' + ENGINE_SRC + '\n<\/script>']),
    new Blob([shell.slice(i2 + CMP_TAG.length)]),
  ];
}
$('btnExpHtml').addEventListener('click', () => runAction(async () => {
  const core = await packageCore({complete:true});
  download(fileBase()+'.html', new Blob(await standaloneParts(core), {type:'text/html'}));
}));
$('btnExpCmp').addEventListener('click', () => runAction(async () => {
  const core = await packageCore();
  download(fileBase()+'.cmp', await packageJSONBlob(core));
}));

/* ---------- publicar en gatos.pics: ver app/publish.js (extraído, gatos.pics#28) ---------- */
/* El cableado del publisher (GatosUpload), el recibo de publicación y los
   manejadores del panel viven en publish.js, cargado tras este archivo. */

/* guardar / abrir proyecto (.cmp) */
async function saveProject(){
  if (busy){ $('builderStatus').textContent = T('La captura de video está en curso; espera a que termine para guardar.'); return; }
  const core = await packageCore();
  download(fileBase()+'.cmp', await packageJSONBlob(core));
}
$('btnSave').addEventListener('click', () => runAction(saveProject));
$('btnOpen').addEventListener('click', () => $('openFile').click());
$('openFile').addEventListener('change', () => {
  if ($('openFile').files[0]) importCmp($('openFile').files[0]);
  $('openFile').value = '';
});
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')){ e.preventDefault(); runAction(saveProject); }
});
$('btnExpZip').addEventListener('click', () => runAction(async () => {
  const core = await packageCore({complete:true});
  await VIEWER_ASSETS;
  // el visor hospedado resuelve img/<id>_<frame>.<ext>: la extensión va en el
  // manifest por variante, derivada del tipo de los archivos reales
  const fileOf = new Map(core.entries);
  const exts = {};
  for (const v of core.manifest.variants){
    v.image_exts = {};
    for (const f of core.manifest.frames){
      const key = v.id+'_'+f;
      const ext = ((fileOf.get(key) || {type:'image/png'}).type.split('/')[1] || 'png').replace('jpeg','jpg');
      exts[key] = ext; v.image_exts[f] = ext;
    }
    exts[v.id] = v.image_exts[core.manifest.frames[0]];
    v.ext = exts[v.id];
  }
  // entradas diferidas para makeZip: los bytes salen DIRECTO del File
  // (gatos.pics#29): el zip ya no pasa por dataURL en absoluto, cada imagen
  // se lee recién cuando entra al zip y nunca está el paquete en cadenas
  const makers = [
    () => ({name:'index.html', data: strBytes(SHELL_HTML)}),
    () => ({name:'compare.js', data: strBytes(ENGINE_SRC)}),
    () => ({name:'upload.js', data: strBytes(UPLOAD_SRC)}),
    () => ({name:'manifest.json', data: strBytes(JSON.stringify(core.manifest, null, 2))}),
  ];
  for (const [key, f] of core.entries){
    makers.push(async () => ({name:'img/'+key+'.'+exts[key], data: new Uint8Array(await f.arrayBuffer())}));
  }
  let next = 0;
  download(fileBase()+'.zip', await makeZip(async () => next < makers.length ? await makers[next++]() : null));
}));
