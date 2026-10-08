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
