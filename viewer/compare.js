/* i18n: español (fuente) e inglés. El idioma sale del navegador, sin red y sin
   guardar nada de quien visita; el interruptor manual vive en localStorage.

   El español ES el código. Cada texto visible lleva su traducción en un
   diccionario español → inglés:
   - HTML fijo: el elemento lleva `data-t`; su clave es su texto (sin etiquetas)
     y la traducción es su innerHTML en inglés. title, placeholder, aria-label
     y alt se buscan por su valor.
   - JS: T`Texto con ${valor}` (clave: 'Texto con {}') o T('Texto').
   Sin entrada, queda el español. tools/check_i18n.mjs (gate de push) exige
   que cada clave tenga traducción y que ningún texto quede sin marcar. */
'use strict';
const I18N = (() => {
  const dict = Object.create(null), miss = new Set();
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  const ok = l => l === 'es' || l === 'en';
  const lang = (() => {
    if (ok(globalThis.GATOS_LANG)) return globalThis.GATOS_LANG;
    try { const q = new URLSearchParams(location.search).get('lang'); if (ok(q)) return q; } catch (e){}
    try { const s = localStorage.getItem('gatos.lang'); if (ok(s)) return s; } catch (e){}
    const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    for (const l of list){ const p = String(l).toLowerCase().slice(0, 2); if (ok(p)) return p; }
    return 'en';
  })();
  const norm = s => String(s).replace(/\s+/g, ' ').trim();
  const find = key => {
    if (lang === 'es') return undefined;
    const v = dict[key];
    if (v === undefined) miss.add(key);
    return v;
  };
  function t(strings, ...vals){
    if (typeof strings === 'string'){ const v = find(strings); return v === undefined ? strings : v; }
    const tpl = find(strings.join('{}'));
    if (tpl === undefined) return strings.reduce((out, s, i) => out + vals[i - 1] + s);
    let n = 0;
    return tpl.replace(/\{(\d*)\}/g, (m, d) => vals[d === '' ? n++ : +d]);
  }
  function apply(root = document){
    document.documentElement.lang = lang === 'es' ? 'es-419' : 'en';
    if (lang === 'es') return;
    for (const el of root.querySelectorAll('[data-t]')){ const v = find(norm(el.textContent)); if (v !== undefined) el.innerHTML = v; }
    for (const a of ATTRS) for (const el of root.querySelectorAll('[' + a + ']')){ const v = dict[norm(el.getAttribute(a))]; if (v !== undefined) el.setAttribute(a, v); }
    if (root === document){ const v = dict[norm(document.title)]; if (v !== undefined) document.title = v; }
  }
  // el interruptor: recuerda la elección en este navegador y recarga
  function set(l){
    if (!ok(l) || l === lang) return;
    try { localStorage.setItem('gatos.lang', l); } catch (e){}
    try { const u = new URL(location.href); if (u.searchParams.has('lang')){ u.searchParams.delete('lang'); location.replace(u.href); return; } } catch (e){}
    location.reload();
  }
  // enlaces [data-lang="es|en"]: se marca el idioma actual y el otro lo cambia
  function wire(root = document){
    for (const el of root.querySelectorAll('[data-lang]')){
      const l = el.dataset.lang;
      if (l === lang) el.setAttribute('aria-current', 'true');
      el.addEventListener('click', e => { e.preventDefault(); set(l); });
    }
  }
  return { lang, dict, miss, t, apply, set, wire, add: o => Object.assign(dict, o) };
})();
const T = I18N.t;

/* Inglés de viewer/upload.js: lo comparten el visor y el creador. */
I18N.add({
  'Preparación cancelada. No se inició el envío.': 'Preparation cancelled. Nothing was sent.',
  'Preparando el envío…': 'Preparing the upload…',
  'Iniciando el envío…': 'Starting the upload…',
  'No se pudo confirmar el resultado.': 'The result could not be confirmed.',
  'Enviando: {} de {} ({} %).': 'Uploading: {} of {} ({}%).',
  'Enviando: {}.': 'Uploading: {}.',
  'Envío completo. Esperando confirmación del servidor…': 'Upload complete. Waiting for the server to confirm…',
  'Envío cancelado.': 'Upload cancelled.',
  'Se agotó el tiempo de espera.': 'The request timed out.',
  'El servidor confirmó el envío.': 'The server confirmed the upload.',
  'No se pudo enviar (HTTP {}).': 'Could not send (HTTP {}).',
  'Espera antes de reintentar.': 'Wait before retrying.',
  'No se pudo iniciar el envío: {}': 'Could not start the upload: {}',
});

/* Inglés del visor: el HTML de viewer/index.html y los textos de las partes
   10 a 50. Al final se traduce la página, antes de que el motor tome sus
   elementos. */
I18N.add({
  // barra de herramientas
  'Frame anterior': 'Previous frame',
  'Frame siguiente': 'Next frame',
  'Herramientas de comparación': 'Comparison tools',
  'Diferencia amplificada por canal (D)': 'Per-channel amplified difference (D)',
  'Curva solar: revela banding y degradados (L)': 'Solar curve: reveals banding and gradients (L)',
  'Intensidad': 'Gain',
  'Resaltar diferencias en rojo (H)': 'Highlight differences in red (H)',
  'Calor': 'Heat',
  'Parpadeo izquierda/derecha (B)': 'Blink left/right (B)',
  'Parpadeo': 'Blink',
  'Modo ciego: oculta qué variante es cuál (G)': 'Blind mode: hides which variant is which (G)',
  'Ciego': 'Blind',
  'Mostrar las identidades de esta asignación (R)': 'Show which variant is which (R)',
  'Revelar': 'Reveal',
  'Elige un punto e inspecciona recortes 1:1 de todas las variantes (C)': 'Pick a point and inspect 1:1 crops of every variant (C)',
  'Recortes': 'Crops',
  '1:1 real en píxeles del dispositivo (O)': 'True 1:1 in device pixels (O)',
  'Escala con píxeles nítidos al hacer zoom (N)': 'Scale with sharp pixels when zooming (N)',
  'Nítido': 'Sharp',
  'Reiniciar zoom (F)': 'Reset zoom (F)',
  'Ajustar': 'Fit',
  'Compartir: link, BBCode para foros, Markdown y HTML': 'Share: link, BBCode for forums, Markdown and HTML',
  'Compartir': 'Share',
  'Atajos y controles (?)': 'Shortcuts and controls (?)',
  'Ayuda y atajos': 'Help and shortcuts',
  'Reportar esta página': 'Report this page',
  'Reportar': 'Report',
  'Izquierda': 'Left',
  'Derecha': 'Right',
  'Desplazar la lista': 'Scroll the list',
  'Variante izquierda': 'Left variant',
  'Variante derecha': 'Right variant',
  'Comando del encoder': 'Encoder command',
  'Ver el comando de la variante izquierda': 'Show the left variant\'s command',
  'Ver el comando de la variante derecha': 'Show the right variant\'s command',
  'Intercambiar izquierda y derecha (S)': 'Swap left and right (S)',
  // la comparación
  'Esta variante no tiene este cuadro': 'This variant does not have this frame',
  'ajustar': 'fit',
  'PARPADEO A/B': 'BLINK A/B',
  'haz clic en un punto (o muévelo con las flechas) para ver recortes 1:1': 'click a point (or move it with the arrow keys) to see 1:1 crops',
  'Recortes 1:1': '1:1 crops',
  'cerrar (Esc)': 'close (Esc)',
  // pie: atajos
  '←→ frame': '<kbd>←</kbd><kbd>→</kbd> frame',
  '1–9 variante (Shift = izquierda)': '<kbd>1</kbd>–<kbd>9</kbd> variant (<kbd>Shift</kbd> = left)',
  'S intercambiar': '<kbd>S</kbd> swap',
  'D diff': '<kbd>D</kbd> diff',
  'B parpadeo': '<kbd>B</kbd> blink',
  'C recortes': '<kbd>C</kbd> crops',
  'F ajustar': '<kbd>F</kbd> fit',
  '+/- ganancia': '<kbd>+</kbd>/<kbd>-</kbd> gain',
  'H calor': '<kbd>H</kbd> heat',
  'Espacio siguiente variante': '<kbd>Space</kbd> next variant',
  'N nítido': '<kbd>N</kbd> sharp',
  'G ciego': '<kbd>G</kbd> blind',
  'L solar': '<kbd>L</kbd> solar',
  ',/. divisor': '<kbd>,</kbd>/<kbd>.</kbd> divider',
  'zoom con rueda/pellizco · arrastra para mover · doble clic ajusta': 'wheel or pinch to zoom · drag to move · double click to fit',
  // ayuda
  'Atajos y controles': 'Shortcuts and controls',
  'Cerrar (Esc)': 'Close (Esc)',
  'Frame anterior o siguiente.': 'Previous or next frame.',
  'Espacio': 'Space',
  'Siguiente variante a la derecha.': 'Next variant on the right.',
  '1 a 9': '<kbd>1</kbd> to <kbd>9</kbd>',
  'Elegir variante a la derecha. Con Shift, a la izquierda.': 'Pick the variant on the right. With Shift, on the left.',
  'Intercambiar izquierda y derecha.': 'Swap left and right.',
  'Activar o desactivar la diferencia amplificada.': 'Turn the amplified difference on or off.',
  'Aumentar o reducir la intensidad del diff.': 'Raise or lower the diff gain.',
  'Activar o desactivar el mapa de calor del diff.': 'Turn the diff heat map on or off.',
  'Activar o desactivar el parpadeo A/B.': 'Turn A/B blink on or off.',
  'Entrar al modo ciego o revelar las identidades.': 'Enter blind mode, or reveal which variant is which.',
  'Revelar las identidades en modo ciego.': 'Reveal which variant is which in blind mode.',
  'Activar o desactivar la curva solar.': 'Turn the solar curve on or off.',
  'Elegir un punto para ver recortes 1:1. Con el modo activo, las flechas siembran y mueven el punto; con Shift, en pasos de 10 px.': 'Pick a point to see 1:1 crops. While the mode is on, the arrow keys place and move the point; with Shift, in 10 px steps.',
  'Ver un píxel de imagen por píxel del dispositivo.': 'Show one image pixel per device pixel.',
  'Ajustar la imagen al área disponible.': 'Fit the image to the available area.',
  'Alternar escala suave y píxeles nítidos.': 'Switch between smooth scaling and sharp pixels.',
  'Mover el divisor. Con Shift, moverlo en pasos mayores.': 'Move the divider. With Shift, in larger steps.',
  'Abrir esta ayuda.': 'Open this help.',
  'Cerrar ayuda, Compartir, comandos o recortes.': 'Close help, Share, commands or crops.',
  'Rueda o pellizco: zoom. Arrastra la imagen ampliada para moverla. Doble clic: ajustar. Mantén el cursor sobre una variante para consultar su comando, si tiene uno.': 'Wheel or pinch: zoom. Drag the zoomed image to move it. Double click: fit. Hover over a variant to see its command, if it has one.',
  'Teléfono: desliza para cambiar de frame, pellizca para acercar, cmd muestra el comando.': 'Phone: swipe to change frame, pinch to zoom, <b>cmd</b> shows the command.',
  'Los atajos no cambian la comparación mientras escribes en un campo.': 'Shortcuts do not change the comparison while you type in a field.',
  // reportar
  'Reportar página': 'Report page',
  'Contenido inapropiado': 'Inappropriate content',
  'Material ajeno / derechos': 'Someone else\'s material / copyright',
  'Spam o engaño': 'Spam or scam',
  'Otro': 'Other',
  'detalle (opcional)': 'details (optional)',
  'Enviar reporte': 'Send report',
  'Cerrar': 'Close',
  'Enviando…': 'Sending…',
  'Reporte enviado. Gracias.': 'Report sent. Thank you.',
  'No se pudo enviar: {}': 'Could not send: {}',
  // compartir
  'Compartir comparación': 'Share comparison',
  'Guarda la comparación visible como PNG sin pérdida. El enlace conserva el frame, las variantes y los ajustes.': 'Saves the visible comparison as a lossless PNG. The link keeps the frame, the variants and the settings.',
  'La imagen conserva el modo ciego. El enlace abre la comparación sin la asignación privada de esta sesión.': 'The image keeps blind mode. The link opens the comparison without this session\'s private assignment.',
  'vista a compartir': 'view to share',
  'Llave de borrado del autor': 'Author\'s delete key',
  'La recibiste al publicar': 'You received it when you published',
  'usar la llave guardada (esta sesión)': 'use the saved key (this session)',
  'Solo el autor puede reemplazar la imagen compartida. La nueva imagen aparecerá también en los enlaces que ya publicaste.': 'Only the author can replace the shared image. The new image will also show in the links you already posted.',
  'Descargar PNG': 'Download PNG',
  'sube esta imagen exacta a gatos.pics y arma el BBCode para foros': 'uploads this exact image to gatos.pics and builds the BBCode for forums',
  'Subir y obtener BBCode': 'Upload and get BBCode',
  'Progreso del envío de la imagen': 'Image upload progress',
  'Cancelar envío': 'Cancel upload',
  'Reintentar esta imagen': 'Retry this image',
  'Borrar esta página…': 'Delete this page…',
  'Enlace a esta vista': 'Link to this view',
  'copiado ✓': 'copied ✓',
  'seleccionado: Ctrl+C': 'selected: Ctrl+C',
  'No se pudo generar el PNG.': 'Could not create the PNG.',
  'pega la llave de borrado para poder eliminar la página': 'paste the delete key to remove the page',
  '¿Borrar esta página y su imagen compartida? No se puede deshacer.': 'Delete this page and its shared image? This cannot be undone.',
  'Borrando…': 'Deleting…',
  'Página borrada.': 'Page deleted.',
  'No se pudo borrar: {}': 'Could not delete: {}',
  'La imagen pudo actualizarse. Reintentar reemplaza la misma URL.': 'The image may have been updated. Retrying replaces the same URL.',
  'BBCode (foros, la vista exacta clicable)': 'BBCode (forums, the exact view, clickable)',
  'Imagen directa': 'Direct image',
  'Ingresa la llave que recibiste al publicar.': 'Enter the key you received when you published.',
  'No se puede compartir: una imagen no cargó.': 'Cannot share: an image did not load.',
  'Espera a que terminen de cargar las dos imágenes.': 'Wait for both images to finish loading.',
  'No se puede compartir el diff: revisa las dimensiones de las imágenes.': 'Cannot share the diff: check the image dimensions.',
  // estado y modos
  'Comparación': 'Comparison',
  'Comparación a ciegas': 'Blind comparison',
  'manifest inválido: JSON truncado o malformado': 'invalid manifest: truncated or malformed JSON',
  'manifest inválido: faltan frames o hay menos de 2 variantes': 'invalid manifest: frames are missing or there are fewer than 2 variants',
  'no se encontraron datos de comparación (sin paquete embebido, sin manifest.json)': 'no comparison data found (no embedded package, no manifest.json)',
  'la imagen no cargó': 'the image did not load',
  'la imagen derecha no cargó': 'the right image did not load',
  'cargando…': 'loading…',
  'Diff no disponible: una variante no tiene este cuadro.': 'Diff unavailable: a variant does not have this frame.',
  'Diff no disponible: una imagen no cargó.': 'Diff unavailable: an image did not load.',
  'Diff no disponible: las imágenes tienen dimensiones distintas.': 'Diff unavailable: the images have different dimensions.',
  'Diff: cargando…': 'Diff: loading…',
  ' · calor (Δ≥{} en rojo)': ' · heat (Δ≥{} in red)',
  ' · calor': ' · heat',
  'Diff ×{}{} · color = canal que difiere · Δ media {}/255': 'Diff ×{}{} · color = channel that differs · mean Δ {}/255',
  'Diff ×{}{} · Δ media {}/255': 'Diff ×{}{} · mean Δ {}/255',
  'Diff ×{} · calculando…': 'Diff ×{} · computing…',
  'Parpadeo A/B': 'Blink A/B',
  'sin este cuadro': 'no such frame',
  'S2 media {}': 'S2 mean {}',
  'Recortes 1:1 @ {},{} (px nativos)': '1:1 crops @ {},{} (native px)',
  'izq.': 'left',
  'der.': 'right',
  ' y ': ' and ',
  ' · sin este cuadro: {}': ' · missing this frame: {}',
  'Frame {} · izquierda: {} · derecha: {} · CIEGO{}': 'Frame {} · left: {} · right: {} · BLIND{}',
  'Inicio del clip {} · ': 'Clip start {} · ',
  'CIEGO': 'BLIND',
  '{}Frame {} (#{}{}) · izq. {} · der. {}{}{}': '{}Frame {} (#{}{}) · left {} · right {}{}{}',
  'en ámbar lo que difiere de <b>{}</b>': 'in amber, what differs from <b>{}</b>',
  'comando': 'command',
  'Copiar': 'Copy',
  'Copiado ✓': 'Copied ✓',
  'Falló la copia': 'Copy failed',
});
I18N.apply();
I18N.wire();

/* gatos.pics compare engine (after the i18n parts 05-07).
   Two data sources, picked at boot:
   - Embedded: window.GATOS_PACKAGE = {format, manifest, images:{"<id>_<frame>": dataURL}}
     Set by a self-contained export or by the builder preview. Works from file://
     with zero network: images become object URLs (canvas-safe, so diff and
     1:1 crops keep working).
   - Http: manifest.json + img/<id>_<frame>.<ext> next to this page (classic
     static hosting). version -> ?v= cache busting for immutable image caches. */
const $ = id => document.getElementById(id);
const comp = $('comp'), imgA = $('imgA'), imgB = $('imgB'), diffCanvas = $('diffCanvas');
const paneA = $('paneA'), paneB = $('paneB');
const labelA = $('labelA'), labelB = $('labelB');
const labelAName = $('labelAName'), labelBName = $('labelBName');
const statsA = $('statsA'), statsB = $('statsB');
const divider = $('divider'), zoomBadge = $('zoomBadge'), diffNote = $('diffNote');
const modeBadge = $('modeBadge'), cropHint = $('cropHint'), cropPanel = $('cropPanel');
const cropRows = $('cropRows'), cropTitle = $('cropTitle');
const diffBtn = $('diffBtn'), blinkBtn = $('blinkBtn'), cropBtn = $('cropBtn');
const pixBtn = $('pixBtn');
const blindBtn = $('blindBtn');
const solarBtn = $('solarBtn');
const metaLine = $('metaLine'), pageTitle = $('pageTitle');
let originalTitle = T('Comparación');
const diffCtx = diffCanvas.getContext('2d', {willReadFrequently:true});

let FRAMES = [], VARIANTS = [];
let FRAME_LABELS = {}, FRAME_META = {};
let VERSION = '', CLIP = {};
const AMPLIFY_DEFAULT_IDX = 1;
const GAINS = [5, 10, 20, 40];
const HEAT_T = 4;

/* ---------- data sources ---------- */
function makeHttpSource(){
  return {
    async init(){
      const r = await fetch('manifest.json?t='+Date.now(), {cache:'no-store'});
      if (!r.ok) throw new Error('manifest.json HTTP '+r.status);
      let m;
      try { m = await r.json(); }
      catch(e){ throw Object.assign(new Error(T('manifest inválido: JSON truncado o malformado')), {manifestInvalid:true}); }
      VERSION = String(m?.version || '');
      return m;
    },
    srcFor(id, f){
      const ext = variant(id).image_exts?.[f] || variant(id).ext || 'webp';
      return `img/${id}_${f}.${ext}${VERSION ? '?v='+VERSION : ''}`;
    }
  };
}
function makeEmbeddedSource(pkg){
  const urls = new Map();   // "<id>_<frame>" -> Promise<objectURL>
  function toObjectURL(dataurl){
    const parts = dataurl.split(',');
    const mime = (parts[0].match(/^data:([^;]+)/) || [,'image/png'])[1];
    const bin = atob(parts[1] || '');
    const buf = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) buf[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([buf], {type:mime}));
  }
  // gatolocoses/gatos.pics#7: fetch(dataURL).blob() decodifica base64 en
  // código nativo y asíncrono (el bucle atob+byte a byte congelaba cada
  // interacción) y soltar la dataURL tras convertir evita que un paquete viva
  // dos veces en RAM. En about:srcdoc (vista previa del creador hospedado) la
  // CSP heredada bloquea connect-src data: y el intento ensuciaría consola:
  // ahí y ante cualquier fallo de fetch se decodifica síncrono como antes.
  async function convert(d, key){
    if (location.href !== 'about:srcdoc'){
      try {
        const u = URL.createObjectURL(await (await fetch(d)).blob());
        pkg.images[key] = null;
        return u;
      } catch(e){ /* sin fetch de data:: decodificador de respaldo síncrono */ }
    }
    try { const u = toObjectURL(d); pkg.images[key] = null; return u; } catch(e){ return ''; }
  }
  return {
    async init(){ return pkg.manifest; },
    srcFor(id, f){
      const key = id+'_'+f;
      if (!urls.has(key)){
        const d = pkg.images && pkg.images[key];
        urls.set(key, d ? convert(d, key) : Promise.resolve(''));
      }
      return urls.get(key);
    }
  };
}
const SOURCE = (typeof window !== 'undefined' && window.GATOS_PACKAGE)
  ? makeEmbeddedSource(window.GATOS_PACKAGE)
  : makeHttpSource();
// Opening another saved fragment in the same tab restores the complete view.
// Internal state writes use replaceState, which does not fire hashchange.
window.addEventListener('hashchange', () => location.reload());

let frame = null, varA = null, varB = null;
// modo teléfono del shell (misma consulta que su CSS): decide dónde se abre el
// panel de comando; la geometría no depende de esto
const PHONE_MQ = matchMedia('(max-width:820px), (pointer:coarse) and (max-height:520px)');
let diffMode = false, blinkMode = false, heat = false, gainIdx = AMPLIFY_DEFAULT_IDX;
let cropMode = false, cropUV = null;
let pendingCropFraction = null;
let dividerPos = 0.5;
let zoom = 1;                       // 1 = fit
let pan = {x:0, y:0};               // viewport-space px offset of the content rect
let fitScale = 1, rw = 0, rh = 0, ox = 0, oy = 0;
let drag = null, pinch = null;
let swipe = null;   // un dedo sobre la vista ajustada: deslizar a los lados cambia de frame
const pointers = new Map();
const realB = new Image();          // offscreen holder for B's true pixels (diff)
let diffData = null;                // cached abs-diff planes for current pair
// Carrera de generaciones: al cambiar de par, .src ya apunta a lo NUEVO
// mientras los pixeles siguen siendo los VIEJOS (complete=true), y el primer
// load que llega difunde A_nuevo−B_viejo y lo cachea bajo la clave nueva.
// La autoridad es la URL que cada lado TERMINO de cargar (la registra su
// handler de load); el diff solo se calcula cuando ambos lados coinciden
// con la URL actual del par.
let loadedUrlA = null, loadedUrlB = null;   // URLs que cada lado termino de cargar (A: imgA, B: realB)
let loadedUrlPaneB = null;                 // imgB carga sola fuera de diff: asentamiento propio (ops#24)
// Fallo de carga del par actual (ops#2): el panel afectado se vacia con
// estado de error visible y las etiquetas revierten al par asentado.
let loadFailA = false, loadFailB = false;
let shownA = null, shownB = null;   // ids del par cuyos pixeles hay en pantalla
// Variante parcial (ops#149): `frames` en la variante lista
// los cuadros que SÍ tiene. Si el lado no tiene el cuadro actual, no se pide
// ninguna imagen y su panel muestra un aviso neutro (miss*): nunca una imagen rota.
let missA = false, missB = false;
const cropImgs = new Map();         // variant id -> Image for current frame

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function variant(id){ return VARIANTS.find(v=>v.id===id) || {id, name:id, color:'#ccc'}; }
function variantName(id){
  const v = variant(id);
  if (blindMode) return 'Variante '+(blindOrder.findIndex(x => x.id === id)+1);
  return v.name;
}
function orderedVariants(){ return blindMode ? blindOrder : VARIANTS; }
// sin `frames` (todas las páginas anteriores) la variante tiene todos los cuadros
function hasFrame(id, f){
  const fr = variant(id).frames;
  return !Array.isArray(fr) || fr.some(x => String(x) === String(f));
}
function setSideMissing(side, on){
  if (side === 'A') missA = on; else missB = on;
  $('miss'+side).hidden = !on;
  if (on){
    (side === 'A' ? imgA : imgB).style.visibility = 'hidden';
    if (diffMode) renderDiff();   // sin cuadro no hay diff: nota corta en vez de calcular
  }
}
// la fuente embebida convierte dataURLs de forma asíncrona (#7): se normaliza
// a promesa para que ambas fuentes se consuman igual. Memoizada por clave:
// la misma petición devuelve siempre el MISMO promesa (los consumidores
// comparan identidad para descartar carreras) y la fuente http, que no
// cachea, no genera promesas nuevos en cada llamada.
const srcCache = new Map();
function srcFor(id, f){
  const key = id+'_'+f;
  if (!srcCache.has(key)) srcCache.set(key, Promise.resolve(SOURCE.srcFor(id, f)));
  return srcCache.get(key);
}
// gana la última petición de cada lado: la resolución tardía de una petición
// vieja no puede sobreescribir el par que el usuario ya pidió
const sideReq = {A:0, B:0};
function setSideSrc(side, id){
  const gen = ++sideReq[side];
  const miss = !hasFrame(id, frame);
  const was = side === 'A' ? missA : missB;
  setSideMissing(side, miss);
  if (miss) return;
  srcFor(id, frame).then(url => {
    if (gen !== sideReq[side]) return;
    if (side === 'A') imgA.src = url;
    else if (diffMode){ realB.src = url; imgB.src = url; }
    else imgB.src = url;
    // la misma URL que ya estaba cargada: el load llega igual, pero no se espera
    // a ver el cuadro de vuelta tras un aviso (un src nuevo deja complete=false)
    const el = side === 'A' ? imgA : imgB;
    if (was && el.complete && el.naturalWidth) el.style.visibility = '';
  });
}
function naturalDims(){
  // el lado A sin cuadro todavía no cargó nada: las medidas son las del lado B (misma medida en toda la página)
  if (missA && !imgA.naturalWidth && imgB.naturalWidth) return {nw: imgB.naturalWidth, nh: imgB.naturalHeight};
  return {nw: imgA.naturalWidth || 1920, nh: imgA.naturalHeight || 1080};
}
function dpr(){ return window.devicePixelRatio || 1; }

/* ---------- fit geometry: the content rect is sized/positioned explicitly,
   so zoom/pan/1:1 math is exact regardless of window aspect ---------- */
function computeFit(){
  const w = comp.clientWidth, h = comp.clientHeight;
  const {nw, nh} = naturalDims();
  fitScale = Math.min(w/nw, h/nh);
  rw = nw*fitScale; rh = nh*fitScale;
  ox = (w-rw)/2; oy = (h-rh)/2;
  for (const el of [imgA, imgB, diffCanvas]){
    el.style.width = rw+'px'; el.style.height = rh+'px';
    el.style.left = ox+'px'; el.style.top = oy+'px';
  }
}
function zmax(){ return Math.max(1, 8/(fitScale*dpr())); }
function zmin(){ return Math.min(1, 1/(fitScale*dpr())); }
function clampPan(){
  const w = comp.clientWidth, h = comp.clientHeight;
  // ramificar por cobertura: si el contenido cubre el eje, sus bordes deben
  // poder llegar a 0 y al borde contrario (sin franjas muertas); si no cubre,
  // no hay pan posible y queda centrado por ox/oy (contenido letterbox)
  if (rw*zoom >= w) pan.x = clamp(pan.x, w-ox-rw*zoom, -ox); else pan.x = 0;
  if (rh*zoom >= h) pan.y = clamp(pan.y, h-oy-rh*zoom, -oy); else pan.y = 0;
}
function updateBadge(){
  if (loadFailA){ zoomBadge.textContent = T('la imagen no cargó'); return; }
  if (!imgA.complete || !imgB.complete){ zoomBadge.textContent = T('cargando…'); return; }
  zoomBadge.textContent = zoom === 1 ? T('ajustar') : Math.round(fitScale*zoom*dpr()*100)+'%';
}
/* la marca del encabezado es un espejo del visor: el circulito cruza las
   palabras siguiendo al divisor real, como el divisor cruza la imagen */
function syncBrandSlider(){
  const dot = document.querySelector('.brand-dot');
  const brand = document.getElementById('brand');
  if (dot && brand){
    const t = blinkMode ? .5 : dividerPos;
    dot.style.left = (8 + t * (brand.clientWidth - 16)) + 'px';
  }
}
function applyTransform(){
  const t = `translate(${pan.x}px,${pan.y}px) scale(${zoom})`;
  imgA.style.transform = t;
  imgB.style.transform = t;
  diffCanvas.style.transform = t;
  paneB.style.clipPath = blinkMode ? 'inset(0 0 0 0)' : `inset(0 0 0 ${dividerPos*100}%)`;
  divider.style.display = blinkMode ? 'none' : '';
  divider.style.left = `${dividerPos*100}%`;
  // los avisos de "sin este cuadro" se centran en la mitad visible de su lado
  comp.style.setProperty('--da', (blinkMode ? 100 : dividerPos*100)+'%');
  comp.style.setProperty('--db', (blinkMode ? 0 : dividerPos*100)+'%');
  syncBrandSlider();
  updateBadge();
}
function setZoomAt(cx, cy, Z2){
  const r = comp.getBoundingClientRect();
  const x = cx-r.left, y = cy-r.top;
  const u = (x-ox-pan.x)/zoom, v = (y-oy-pan.y)/zoom;
  zoom = clamp(Z2, zmin(), zmax());
  if (zoom === 1){ pan = {x:0, y:0}; }
  else { pan.x = x-ox-u*zoom; pan.y = y-oy-v*zoom; clampPan(); }
  applyTransform(); writeHash();
}
function oneToOne(){
  const r = comp.getBoundingClientRect();
  setZoomAt(r.left+comp.clientWidth/2, r.top+comp.clientHeight/2, 1/(fitScale*dpr()));
}
function fitView(){ zoom = 1; pan = {x:0, y:0}; applyTransform(); writeHash(); }

comp.addEventListener('wheel', e => {
  e.preventDefault();
  setZoomAt(e.clientX, e.clientY, zoom * (e.deltaY < 0 ? 1.15 : 1/1.15));
}, {passive:false});

/* ---------- pointer input: mouse + touch unified, pinch zoom ---------- */
const pdist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
comp.addEventListener('pointerdown', e => {
  comp.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if (pointers.size === 2){
    const [p1, p2] = [...pointers.values()];
    const r = comp.getBoundingClientRect();
    pinch = {d0: pdist(p1,p2) || 1, z0: zoom,
      u: ((p1.x+p2.x)/2-r.left-ox-pan.x)/zoom,
      v: ((p1.y+p2.y)/2-r.top-oy-pan.y)/zoom};
    drag = null; swipe = null;
  } else if (pointers.size === 1){
    const r = comp.getBoundingClientRect();
    const x = e.clientX-r.left, w = comp.clientWidth;
    if (Math.abs(x - dividerPos*w) < (matchMedia('(pointer:coarse)').matches ? 34 : 18) && !blinkMode){ drag = {mode:'divider', sx:e.clientX, start:dividerPos}; }
    else if (cropMode){ pickCrop(e.clientX, e.clientY); }
    else if (zoom > 1){ drag = {mode:'pan', sx:e.clientX, sy:e.clientY, px:pan.x, py:pan.y}; }
    // capa de gestos (gatolocoses/gatos.pics#31): con la vista ajustada no hay
    // pan, así que un deslizamiento táctil franco queda libre para cambiar de
    // frame; el divisor (zona de arriba) y el pellizco conservan su prioridad
    if (!drag && !cropMode && zoom === 1 && e.pointerType === 'touch') swipe = {id:e.pointerId, sx:e.clientX, sy:e.clientY};
  }
  e.preventDefault();
});
comp.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if (pointers.size === 2 && pinch){
    const [p1, p2] = [...pointers.values()];
    const mx = (p1.x+p2.x)/2, my = (p1.y+p2.y)/2;
    const r = comp.getBoundingClientRect();
    zoom = clamp(pinch.z0 * pdist(p1,p2)/pinch.d0, zmin(), zmax());
    pan.x = mx-r.left-ox-pinch.u*zoom;
    pan.y = my-r.top-oy-pinch.v*zoom;
    clampPan(); applyTransform(); writeHash();
  } else if (drag){
    const w = comp.clientWidth, h = comp.clientHeight;
    if (drag.mode === 'divider'){
      dividerPos = clamp(drag.start + (e.clientX-drag.sx)/w, 0, 1);
      applyTransform(); writeHash();
    } else {
      pan.x = drag.px + (e.clientX-drag.sx);
      pan.y = drag.py + (e.clientY-drag.sy);
      clampPan(); applyTransform(); writeHash();
    }
  }
});
function pointerEnd(e){
  if (swipe && swipe.id === e.pointerId){
    const dx = e.clientX-swipe.sx, dy = e.clientY-swipe.sy;
    swipe = null;
    if (e.type === 'pointerup' && pointers.size === 1 && Math.abs(dx) > 60 && Math.abs(dx) > 2*Math.abs(dy)) stepFrame(dx < 0 ? 1 : -1);
  }
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pointers.size === 0) drag = null;
}
comp.addEventListener('pointerup', pointerEnd);
comp.addEventListener('pointercancel', pointerEnd);
comp.addEventListener('dblclick', fitView);
window.addEventListener('resize', () => { computeFit(); clampPan(); applyTransform(); syncVariantOverflow(); });
new ResizeObserver(() => { computeFit(); clampPan(); applyTransform(); }).observe(comp);

/* ---------- pane strips: bounded, horizontally scrollable ---------- */
function syncVariantOverflow(){
  ['varA','varB'].forEach(id => {
    const s = $(id); if (!s) return;
    const g = s.closest('.group');
    const over = s.scrollWidth - s.clientWidth > 2;
    if (g) g.classList.toggle('overflowing', over);
    // keep the selected pane visible when the list is longer than its strip
    const act = s.querySelector('button.active') || s.querySelector('.on') || s.querySelector('button[aria-pressed="true"]');
    if (over && act) act.scrollIntoView({inline:'nearest', block:'nearest'});
  });
}
document.querySelectorAll('.vscroll').forEach(b => {
  b.addEventListener('click', () => {
    const s = $(b.dataset.scroll); if (!s) return;
    s.scrollBy({left: Number(b.dataset.dir) * 220, behavior:'smooth'});
  });
});
['varA','varB'].forEach(id => {
  const s = $(id); if (!s) return;
  s.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { s.scrollLeft += e.deltaY; e.preventDefault(); }
  }, {passive:false});
});

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
    diffNote.textContent = T('Diff no disponible: una variante no tiene este cuadro.');
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
      ? T('Diff no disponible: una imagen no cargó.')
      : mismatch ? T('Diff no disponible: las imágenes tienen dimensiones distintas.') : T('Diff: cargando…');
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
  diffNote.textContent = T`Diff ×${A}${heat ? T` · calor (Δ≥${HEAT_T} en rojo)` : ''} · color = canal que difiere · Δ media ${d.mean.toFixed(2)}/255`;
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
    diffNote.textContent = T`Diff ×${GAINS[gainIdx]} · calculando…`;
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
  else { diffNote.style.display = 'block'; diffNote.textContent = T('la imagen derecha no cargó'); }
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
  pageTitle.textContent = on ? T('Comparación a ciegas') : originalTitle;
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
    ctx.fillStyle = '#9a9aa8'; ctx.fillText(T('sin este cuadro'), 10, 20);
    return;
  }
  const im = cropImg(id);
  if (!im || !im.complete || !im.naturalWidth){
    ctx.fillStyle = '#1a1a22'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9a9aa8'; ctx.fillText(T('cargando…'), 10, 20);
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
  cropTitle.textContent = T`Recortes 1:1 @ ${cropUV.u},${cropUV.v} (px nativos)`;
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
  if (loadFailA || loadFailB) throw new Error(T('No se puede compartir: una imagen no cargó.'));
  // autoridad de URL asentada (misma clase de carrera que el diff): complete
  // puede seguir en true con pixeles de la generacion anterior; el PNG exige
  // el par actual asentado en ambos lados (en diff realB es la autoridad)
  // variante parcial: un lado sin cuadro no carga nada; la pantalla muestra su aviso
  // (y el diff no existe), así que el PNG dibuja lo mismo en vez de esperar o fallar
  const diffLive = diffMode && !missA && !missB;
  const bSettled = diffLive ? loadedUrlB === realB.src : loadedUrlPaneB === imgB.src;
  if ((!missA && (loadedUrlA !== imgA.src || !imgA.naturalWidth)) || (!missB && (!bSettled || !imgB.naturalWidth)))
    throw Object.assign(new Error(T('Espera a que terminen de cargar las dos imágenes.')), {wait:true});
  if (diffLive && !ensureDiffBase()) throw new Error(T('No se puede compartir el diff: revisa las dimensiones de las imágenes.'));
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
  // aviso neutro de "sin este cuadro", el mismo texto y tono que el panel de la pantalla
  const drawMissing = (x0, x1) => {
    x.save();
    x.fillStyle = '#16161d'; x.fillRect(x0, iy, x1 - x0, vh);
    x.fillStyle = '#b4b4c2'; x.font = '600 13px system-ui, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(T('Esta variante no tiene este cuadro'), (x0 + x1) / 2, iy + vh / 2, Math.max(20, x1 - x0 - 24));
    x.restore();
  };
  const divX = dividerPos * w;
  const split = clamp(divX, ix, ir);
  if (missA) drawMissing(ix, blinkMode ? ir : split); else drawImg(imgA);
  if (!blinkMode){
    x.save();
    x.beginPath();
    x.rect(split, iy, ir - split, vh);
    x.clip();
    if (missB) drawMissing(split, ir); else drawImg(diffLive ? diffCanvas : imgB);
    x.restore();
    // linea del divisor, solo dentro del contenido
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.fillRect(divX - 1, iy, 2, vh);
  } else if (imgB.style.opacity !== '0') {
    if (missB) drawMissing(ix, ir); else drawImg(imgB);
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
    diffLive ? T`Diff ×${GAINS[gainIdx]}${heat ? T(' · calor') : ''} · Δ media ${diffData.mean.toFixed(2)}/255` : '',
    blinkMode ? T('Parpadeo A/B') : '',
    solarMode ? 'Solar' : '',
    blindMode ? T('Ciego') : '',
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
  const title = document.title || T('Comparación');
  const snapshotNames = [variantName(varA),variantName(varB)];
  const snapshotFrame = blindMode ? FRAMES.indexOf(frame)+1 : frame;
  $('shotUpload').hidden = true;
  $('shareUp').disabled = true;
  const rows = location.protocol === 'file:' || location.href === 'about:srcdoc' ? [] : [[T('Enlace a esta vista'), url]];
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
      hint.textContent = ok ? T('copiado ✓') : T('seleccionado: Ctrl+C');
      box.style.borderColor = ok ? '#7bd389' : '#ffb454';
      setTimeout(() => { hint.textContent = ''; box.style.borderColor = '#333'; }, 1500);
    };
    shareRows.appendChild(l);
    shareRows.appendChild(box);
  }
  sharePanel.style.display = 'flex';
  // generar la imagen de la vista actual
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  if (!blob){ $('shareHint').textContent = T('No se pudo generar el PNG.'); return; }
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
      $('shareHint').textContent = T('pega la llave de borrado para poder eliminar la página');
      $('shareKey').focus();
      return;
    }
    if (!confirm(T('¿Borrar esta página y su imagen compartida? No se puede deshacer.'))) return;
    const btn = $('pageDelete');
    btn.disabled = true; btn.textContent = T('Borrando…');
    try {
      const resp = await fetch('/api/page/' + m[1], { method: 'DELETE', headers: { 'x-delete-key': key, 'accept-language': I18N.lang } });
      if (!resp.ok){
        let j = null; try { j = await resp.json(); } catch(e){}
        throw new Error((j && j.error) || ('HTTP ' + resp.status));
      }
      alert(T('Página borrada.'));
      location.href = '/';
    } catch (e) {
      alert(T`No se pudo borrar: ${e.message}`);
      btn.disabled = false; btn.textContent = T('Borrar esta página…');
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
    retryCaution:T('La imagen pudo actualizarse. Reintentar reemplaza la misma URL.'),
    onBusy:busy => { up.disabled = busy; $('shareKey').disabled = busy; },
    onSuccess:j => {
      const page = url;
      const codes = [
        [T('BBCode (foros, la vista exacta clicable)'), '[url=' + page + '][img]' + j.url + '[/img][/url]'],
        ['Markdown', '[![' + title.replace(/[\[\]\\]/g, '\\$&') + '](' + j.url + ')](' + page + ')'],
        ['HTML', '<a href="' + escq(page) + '"><img src="' + escq(j.url) + '" alt="' + escq(title) + '" loading="lazy"></a>'],
        [T('Imagen directa'), j.url],
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
          $('shareHint').textContent = ok2 ? T('copiado ✓') : T('seleccionado: Ctrl+C');
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
    if (!key){ $('shareHint').textContent = T('Ingresa la llave que recibiste al publicar.'); $('shareKey').focus(); return; }
    shotUploader.start(async () => ({url:'/api/shot/'+m[1],
      headers:{'content-type':'image/png','x-delete-key':key,'accept-language':I18N.lang}, body:blob}));
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
      send.disabled = true; send.textContent = T('Enviando…');
      try {
        const resp = await fetch('/api/report/' + rm[1], {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reason: $('reportReason').value, note: $('reportNote').value }),
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        $('reportStatus').textContent = T('Reporte enviado. Gracias.');
        setTimeout(() => { closeReport(); $('reportStatus').textContent = ''; }, 1400);
      } catch (e) {
        $('reportStatus').textContent = T`No se pudo enviar: ${e.message}`;
      } finally {
        send.disabled = false; send.textContent = T('Enviar reporte');
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

/* ---------- init ---------- */
function applyManifest(m){
  // un manifest truncado o mano-editado no es un fallo de transporte: sin
  // esto, readState revienta en .find/.some y el init culpa al transportista
  if (!m || !Array.isArray(m.frames) || !m.frames.length ||
      !Array.isArray(m.variants) || m.variants.length < 2)
    throw Object.assign(new Error(T('manifest inválido: faltan frames o hay menos de 2 variantes')), {manifestInvalid:true});
  FRAMES = m.frames;
  VARIANTS = m.variants;
  FRAME_LABELS = m.frame_labels || {};
  FRAME_META = m.frame_meta || {};
  CLIP = m.clip || {};
  originalTitle = m.title || T('Comparación');
  document.title = originalTitle; pageTitle.textContent = originalTitle;
  const h = readState();
  $('diffGain').value = String(gainIdx);
  $('heatBtn').setAttribute('aria-pressed', String(heat));
  computeFit();
  loadImg();
  applyTransform();
  // arranca ajustada en todas las pantallas (gatolocoses/gatos.pics#31): el
  // salto a 1:1 en móvil dejaba la imagen más chica que la pantalla con
  // dpr ≥ 2 y recortada con capturas 1080p; 1:1 queda a un toque
  if (h.get('diff') === '1') setDiff(true);
  if (h.get('blink') === '1') setBlink(true);
  if (h.get('solar') === '1') setSolar(true);
  if (h.has('smooth')) setSmooth(h.get('smooth') !== '0');
  if (h.get('crops') === '1') setCropMode(true);
  if (h.get('crop')){
    const [cu, cv] = h.get('crop').split(',').map(Number);
    if (isFinite(cu) && isFinite(cv)){
      pendingCropFraction = [clamp(cu,0,1),clamp(cv,0,1)];
    }
  }
}
(async () => {
  computeFit();
  applyTransform();
  try {
    const m = await SOURCE.init();
    applyManifest(m);
  } catch (err) {
    console.error('comparison data unavailable', err);
    metaLine.textContent = err?.manifestInvalid ? err.message
      : T('no se encontraron datos de comparación (sin paquete embebido, sin manifest.json)');
  }
})();
