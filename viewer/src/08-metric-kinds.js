/* ---------- nombres de métricas (gatos-ops#395) ----------
   Las métricas por cuadro (`metrics.per_frame[cuadro]`) pueden traer cualquier
   nombre [a-z0-9_]: las conocidas tienen un rótulo corto (la etiqueta de la
   versión), uno largo (la tarjeta) y una dirección: 1 = más alto es mejor,
   -1 = más bajo es mejor. Un sufijo (butteraugli_3norm) se muestra al lado;
   los que solo repiten la unidad o la media (_avg, _all, _jod…) no. Las
   desconocidas se muestran como vienen, sin dirección (ninguna sale en verde).
   El creador carga este mismo archivo (app/index.html, tools/build_app.py)
   para la lista de las insignias: sin T() aquí, los nombres no se traducen. */
const METRIC_KINDS = [
  [/^(ssimulacra2|ssimu2|s2)(_|$)/, 'S2', 'SSIMULACRA2', 1, 1],
  [/^butteraugli(_|$)/, 'BA', 'Butteraugli', -1, 2],
  [/^cvvdp(_|$)/, 'CVVDP', 'CVVDP (JOD)', 1, 2],
  [/^vmaf(_|$)/, 'VMAF', 'VMAF', 1, 1],
  [/^xpsnr(_|$)/, 'XPSNR', 'XPSNR (dB)', 1, 2],
  [/^psnr(_|$)/, 'PSNR', 'PSNR (dB)', 1, 2],
  [/^ms_ssim(_|$)/, 'MS-SSIM', 'MS-SSIM', 1, 4],
  [/^ssim(_|$)/, 'SSIM', 'SSIM', 1, 4],
];
const METRIC_QUIET = new Set(['avg', 'all', 'mean', 'score', 'jod', 'db']);
function metricKind(name){
  for (let i = 0; i < METRIC_KINDS.length; i++){
    const [re, short, long, dir, digits] = METRIC_KINDS[i], m = re.exec(name);
    if (!m) continue;
    const rest = name.slice(m[0].length).replace(/_/g, ' ').trim();
    const tail = rest && !METRIC_QUIET.has(rest) ? ' ' + rest : '';
    return {rank: i, short: short + tail, long: long + tail, dir, digits};
  }
  return {rank: METRIC_KINDS.length, short: name, long: name, dir: 0, digits: null};
}
function metricFmt(v, digits){
  if (digits != null) return v.toFixed(digits);
  return Math.abs(v) >= 1000 ? String(Math.round(v)) : String(+v.toPrecision(4));
}
// [[nombre, número]…] de un objeto de métricas: solo claves válidas y números
// finitos, las conocidas primero en el orden de la tabla
function metricList(obj){
  if (!obj || typeof obj !== 'object') return [];
  const out = Object.entries(obj).filter(([k, v]) => /^[a-z0-9_]{1,32}$/.test(k) && k !== '__proto__' && typeof v === 'number' && isFinite(v)).slice(0, 16);
  return out.map((e, i) => [e, metricKind(e[0]).rank, i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(x => x[0]);
}
