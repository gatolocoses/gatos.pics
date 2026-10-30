'use strict';
/* demo.js — el ejemplo sintético del creador: una escena por cuadro y una
   versión por defecto típico de los encodes, exagerado para que se vea fácil
   (gatos-ops#394). Todo sale de canvas: sin archivos externos ni nada real.
   Extraído de builder.js (pasado de su presupuesto de tamaño); builder.js lo
   usa en «Ver un ejemplo» y «Cargar el ejemplo».

   El paquete lleva en la raíz `lesson: 'defectos'`: el visor (47-lesson.js)
   abre con eso la lección que recorre las versiones por su id. Si se cambia un
   id o una escena aquí, revisar los pasos y los recuadros de allá. */
const DEMO_W = 960, DEMO_H = 540;
function demoRng(seed){ let s = seed >>> 0; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; }
function demoCanvas(){ const c = document.createElement('canvas'); c.width = DEMO_W; c.height = DEMO_H; return c; }
const demoData = c => c.getContext('2d').getImageData(0, 0, DEMO_W, DEMO_H);
const demoPut = id => { const c = demoCanvas(); c.getContext('2d').putImageData(id, 0, 0); return c; };
const demoClamp = v => v < 0 ? 0 : v > 255 ? 255 : v;

/* escena limpia (sin grano): cielo en degradado arriba (banding), figuras de
   bordes duros (halos), una sombra con detalle tenue abajo a la izquierda
   (bloques, sombras aplastadas) y tela a rayas finas abajo a la derecha (desenfoque) */
function demoScene(seed){
  const r = demoRng(seed), W = DEMO_W, H = DEMO_H, c = demoCanvas(), x = c.getContext('2d');
  const hue = Math.round(r() * 360);
  const sky = x.createLinearGradient(0, 0, 0, H * .62);
  sky.addColorStop(0, `hsl(${hue}, 45%, 22%)`);
  sky.addColorStop(1, `hsl(${(hue + 25) % 360}, 50%, 62%)`);
  x.fillStyle = sky; x.fillRect(0, 0, W, H);
  const ground = x.createLinearGradient(0, H * .62, 0, H);
  ground.addColorStop(0, `hsl(${(hue + 180) % 360}, 25%, 40%)`);
  ground.addColorStop(1, `hsl(${(hue + 180) % 360}, 25%, 24%)`);
  x.fillStyle = ground; x.fillRect(0, H * .62, W, H * .38);
  x.fillStyle = 'rgb(14,14,16)'; x.fillRect(30, H * .66, 330, H * .3);
  for (let i = 0; i < 9; i++){
    const v = 20 + Math.round(r() * 22);
    x.fillStyle = `rgb(${v},${v},${v + 3})`;
    const bx = 45 + r() * 270, by = H * .68 + r() * 120, bw = 20 + r() * 60, bh = 12 + r() * 40;
    if (r() < .5){ x.beginPath(); x.ellipse(bx, by, bw / 2, bh / 2, 0, 0, Math.PI * 2); x.fill(); }
    else x.fillRect(bx, by, bw, bh);
  }
  x.save(); x.beginPath(); x.rect(600, H * .68, 330, H * .28); x.clip();
  for (let i = -40; i < 120; i++){
    x.strokeStyle = i % 2 ? '#d8cfc0' : '#5a4f45'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(600 + i * 4, H * .68); x.lineTo(600 + i * 4 + 150, H); x.stroke();
  }
  x.restore();
  for (let i = 0; i < 4; i++){
    x.strokeStyle = `hsl(${Math.round(r() * 360)}, 85%, ${r() < .5 ? 85 : 15}%)`;
    x.lineWidth = 4 + r() * 6;
    const cx = 380 + r() * 420, cy = 60 + r() * 200, rad = 28 + r() * 50;
    x.beginPath();
    if (r() < .5) x.arc(cx, cy, rad, 0, Math.PI * 2); else x.rect(cx - rad, cy - rad / 2, rad * 2, rad);
    x.stroke();
  }
  x.font = '700 34px system-ui, sans-serif'; x.fillStyle = '#fff';
  x.fillText(T('ejemplo sintético · nada real'), 26, 50);
  return c;
}
function demoGrain(id, seed, amp){
  const r = demoRng(seed), d = id.data;
  for (let i = 0; i < d.length; i += 4){
    const n = (r() + r() + r() - 1.5) * amp;   // casi gaussiano
    d[i] = demoClamp(d[i] + n); d[i + 1] = demoClamp(d[i + 1] + n); d[i + 2] = demoClamp(d[i + 2] + n);
  }
  return id;
}
function demoBlurred(c, px){
  const o = demoCanvas(), x = o.getContext('2d');
  x.filter = `blur(${px}px)`; x.drawImage(c, 0, 0); x.filter = 'none';
  return o;
}
/* cada defecto parte de la escena limpia o de la fuente (con grano) y devuelve ImageData */
const DEMO_DEFECTS = {
  blur(clean, src, seed){ return demoGrain(demoData(demoBlurred(src, 1.4)), seed + 5, 10); },
  band(clean){   // el encoder se come el grano y el degradado queda en escalones
    const id = demoData(clean), d = id.data, step = 9;
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = Math.round(d[i + k] / step) * step;
    return id;
  },
  halo(clean, src){   // enfoque de más: contornos claros y oscuros alrededor de los bordes
    const a = demoData(src), e = demoData(demoBlurred(src, 3)).data, d = a.data;
    for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = demoClamp(d[i + k] + 1.8 * (d[i + k] - e[i + k]));
    return a;
  },
  dirty(clean, src){   // las filas y columnas del borde con otro brillo
    const id = demoData(src), d = id.data, W = DEMO_W, H = DEMO_H;
    const scale = (i, f) => { d[i] = demoClamp(d[i] * f); d[i + 1] = demoClamp(d[i + 1] * f); d[i + 2] = demoClamp(d[i + 2] * f); };
    const row = (y, f) => { for (let x = 0; x < W; x++) scale((y * W + x) * 4, f); };
    const col = (x, f) => { for (let y = 0; y < H; y++) scale((y * W + x) * 4, f); };
    row(0, .3); row(1, .5); row(2, .7); row(3, .88); row(H - 1, 1.7); row(H - 2, 1.35);
    col(0, .4); col(1, .65); col(2, .85);
    return id;
  },
  dnr(clean){ return demoData(demoBlurred(clean, .7)); },   // grano borrado: superficies de cera
  block(clean, src){   // las zonas planas, promediadas en cuadros de 16
    const id = demoData(src), d = id.data, cl = demoData(clean).data, B = 16, W = DEMO_W, H = DEMO_H;
    for (let by = 0; by < H; by += B) for (let bx = 0; bx < W; bx += B){
      const s = [0, 0, 0]; let s2 = 0, n = 0;
      for (let y = by; y < Math.min(H, by + B); y++) for (let x = bx; x < Math.min(W, bx + B); x++){
        const i = (y * W + x) * 4, l = cl[i] * .3 + cl[i + 1] * .59 + cl[i + 2] * .11;
        s[0] += cl[i]; s[1] += cl[i + 1]; s[2] += cl[i + 2]; s2 += l * l; n++;
      }
      const m = s.map(v => v / n), lm = m[0] * .3 + m[1] * .59 + m[2] * .11;
      if (s2 / n - lm * lm > 60) continue;   // con detalle: se deja
      for (let y = by; y < Math.min(H, by + B); y++) for (let x = bx; x < Math.min(W, bx + B); x++){
        const i = (y * W + x) * 4; d[i] = m[0]; d[i + 1] = m[1]; d[i + 2] = m[2];
      }
    }
    return id;
  },
  crush(clean, src){   // lo oscuro pasa a negro
    const id = demoData(src), d = id.data, k = 30;
    for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) d[i + j] = demoClamp((d[i + j] - k) * 255 / (255 - k));
    return id;
  },
};
function demoVariants(){
  return [
    {id: 'src', name: T('Fuente'), color: '#7bd389', note: T('referencia')},
    {id: 'blur', name: T('Desenfoque + ruido'), color: '#7bb3ff', note: T('detalle perdido')},
    {id: 'band', name: 'Banding', color: '#ffb86b', note: T('degradado en escalones')},
    {id: 'halo', name: T('Halos'), color: '#ff7b9c', note: T('enfoque de más')},
    {id: 'dirty', name: T('Líneas sucias'), color: '#c3a6ff', note: T('bordes con otro brillo')},
    {id: 'dnr', name: T('Grano borrado'), color: '#6be0d0', note: T('superficies de cera')},
    {id: 'block', name: T('Bloques'), color: '#f2e26b', note: T('cuadros en zonas planas')},
    {id: 'crush', name: T('Sombras aplastadas'), color: '#b0b0b8', note: T('lo oscuro pasa a negro')},
  ];
}
function makeDemoPackage(){
  const variants = demoVariants(), frames = [1, 2, 3], images = {};
  for (const f of frames){
    const seed = 100 + f * 7, clean = demoScene(seed), src = demoPut(demoGrain(demoData(clean), seed + 1, 9));
    images['src_' + f] = src.toDataURL('image/png');
    for (const v of variants.slice(1)) images[v.id + '_' + f] = demoPut(DEMO_DEFECTS[v.id](clean, src, seed)).toDataURL('image/png');
  }
  return {
    format: FORMAT,
    lesson: 'defectos',
    manifest: {
      title: T('gatos.pics · ejemplo'),
      version: 1,
      frames,
      frame_labels: {1: T`ejemplo ${1}`, 2: T`ejemplo ${2}`, 3: T`ejemplo ${3}`},
      variants,
    },
    images,
  };
}
