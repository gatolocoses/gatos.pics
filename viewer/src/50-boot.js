/* ---------- init ---------- */
function applyManifest(m){
  // un manifest truncado o mano-editado no es un fallo de transporte: sin
  // esto, readState revienta en .find/.some y el init culpa al transportista
  if (!m || !Array.isArray(m.frames) || !m.frames.length ||
      !Array.isArray(m.variants) || m.variants.length < 2)
    throw Object.assign(new Error(T('manifest inválido: faltan frames o hay menos de 2 variantes')), {manifestInvalid:true});
  FRAMES = m.frames;
  VARIANTS = m.variants;
  // sin prototipo: FRAME_LABELS['constructor'] no devuelve la función heredada (ops#251)
  FRAME_LABELS = Object.assign(Object.create(null), m.frame_labels);
  FRAME_META = Object.assign(Object.create(null), m.frame_meta);
  FRAME_AREAS = Object.assign(Object.create(null), m.frame_areas);
  BLIND_CFG = m.blind && typeof m.blind === 'object' ? m.blind : {};
  CLIP = m.clip || {};
  originalTitle = m.title || T('Comparación');
  document.title = originalTitle; pageTitle.textContent = originalTitle;
  const h = readState();
  $('diffGain').value = String(gainIdx);
  $('heatBtn').setAttribute('aria-pressed', String(heat));
  $('testBtn').hidden = !testOk();   // prueba ciega: con 2 a 12 versiones
  computeFit();
  loadImg();
  applyTransform();
  // arranca ajustada en todas las pantallas (gatolocoses/gatos.pics#31): el
  // salto a 1:1 en móvil dejaba la imagen más chica que la pantalla con
  // dpr ≥ 2 y recortada con capturas 1080p; 1:1 queda a un toque
  // enlace muerto (gatos-ops#307): se llegó aquí porque la página pedida ya no existe
  if (h.get('gone') === '1'){ $('goneNote').hidden = false; $('goneClose').onclick = () => { $('goneNote').hidden = true; }; }
  if (h.get('diff') === '1') setDiff(true);
  if (h.get('blink') === '1') setBlink(true);
  if (h.get('solar') === '1') setSolar(true);
  if (h.has('smooth')) setSmooth(h.get('smooth') !== '0', false);
  if (h.get('crops') === '1') setCropMode(true);
  if (h.get('crop')){
    const [cu, cv] = h.get('crop').split(',').map(Number);
    if (isFinite(cu) && isFinite(cv)){
      pendingCropFraction = [clamp(cu,0,1),clamp(cv,0,1)];
    }
  }
  // una prueba ciega que quedó a medias (gatos-ops#222) se ofrece seguirla; el
  // enlace directo (#test=1, gatos-ops#223) abre la introducción sobre fondo opaco
  if (!$('testBtn').hidden){
    const link = h.get('test') === '1';
    if (link) testPanel.classList.add('solid');
    if (link || testSaved()) testEnter();
  }
}
// ?test=1 (gatos-ops#336) es la forma del enlace a la prueba que el servidor ve, para darle su
// tarjeta; adentro vale #test=1, como siempre, y ningún otro enlace de la página lo arrastra
try {
  const u = new URL(location.href);
  if (u.searchParams.get('test') === '1'){
    u.searchParams.delete('test');
    const h = new URLSearchParams(u.hash.slice(1)); h.set('test', '1'); u.hash = h.toString();
    history.replaceState(history.state, '', u.href);
  }
} catch (e){}
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
