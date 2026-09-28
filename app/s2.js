'use strict';
/* ============================================================
   SSIMULACRA2 en JS puro — puerto fiel del paquete ssimulacra2
   de PyPI (puerto numpy del C++ original). Misma escala:
   100 = idéntico, menor = peor.

   Entrada: dos ImageData (RGBA 8 bit, como salen de canvas);
   se usan los canales RGB (las capturas del creador no traen
   alfa con significado). El pipeline local de referencia también
   parte de PNG RGB 8 bit, así que los números son comparables
   entre herramientas 8-bit.
   ============================================================ */
const S2 = (() => {
  const kC2 = 0.0009;
  const NUM_SCALES = 6;

  // matriz de absorbancia opsin (jxl) + bias — idénticos al C++
  const M00 = 0.30, M01 = 1 - 0.078 - 0.30, M02 = 0.078;
  const M10 = 0.23, M11 = 1 - 0.078 - 0.23, M12 = 0.078;
  const M20 = 0.24342268924547819, M21 = 0.20476744424496821, M22 = 1 - M20 - M21;
  const kB = 0.0037930732552754493;
  const cbrtB = Math.cbrt(kB);

  const WEIGHTS = [
    0.0, 0.0007376606707406586, 0.0,
    0.0, 0.0007793481682867309, 0.0,
    0.0, 0.0004371155730107379, 0.0,
    1.1041726426657346, 0.00066284834129271, 0.00015231632783718752,
    0.0, 0.0016406437456599754, 0.0,
    1.8422455520539298, 11.441172603757666, 0.0,
    0.0007989109436015163, 0.000176816438078653, 0.0,
    1.8787594979546387, 10.94906990605142, 0.0,
    0.0007289346991508072, 0.9677937080626833, 0.0,
    0.00014003424285435884, 0.9981766977854967, 0.00031949755934435053,
    0.0004550992113792063, 0.0, 0.0,
    0.0013648766163243398, 0.0, 0.0,
    0.0, 0.0, 0.0,
    7.466890328078848, 0.0, 17.445833984131262,
    0.0006235601634041466, 0.0, 0.0,
    6.683678146179332, 0.00037724407979611296, 1.027889937768264,
    225.20515300849274, 0.0, 0.0,
    19.213238186143016, 0.0011401524586618361, 0.001237755635509985,
    176.39317598450694, 0.0, 0.0,
    24.43300999870476, 0.28520802612117757, 0.0004485436923833408,
    0.0, 0.0, 0.0,
    34.77906344483772, 44.835625328877896, 0.0,
    0.0, 0.0, 0.0,
    0.0, 0.0, 0.0,
    0.0, 0.0008680556573291698, 0.0,
    0.0, 0.0, 0.0,
    0.0, 0.0005313191874358747, 0.0,
    0.00016533814161379112, 0.0, 0.0,
    0.0, 0.0, 0.0,
    0.0004179171803251336, 0.0017290828234722833, 0.0,
    0.0020827005846636437, 0.0, 0.0,
    8.826982764996862, 23.19243343998926, 0.0,
    95.1080498811086, 0.9863978034400682, 0.9834382792465353,
    0.0012286405048278493, 171.2667255897307, 0.9807858872435379,
    0.0, 0.0, 0.0,
    0.0005130064588990679, 0.0, 0.00010854057858411537
  ];

  /* kernel gaussiano separable: sigma 1.5, radio 5 (truncate 3.33) */
  const SIGMA = 1.5, RAD = 5;
  const KERN = (() => {
    const k = new Float64Array(2*RAD+1);
    let s = 0;
    for (let i = -RAD; i <= RAD; i++){ const v = Math.exp(-(i*i)/(2*SIGMA*SIGMA)); k[i+RAD] = v; s += v; }
    for (let i = 0; i < k.length; i++) k[i] /= s;
    return k;
  })();

  /* blur separable con los bordes EXACTOS del paquete PyPI: sus arreglos XYB
     van transpuestos (W,H,C), asi que su cero-pad "vertical" cae en los bordes
     izquierdo/derecho y su reflect en superior/inferior.
     -> horizontal: cero-padding · vertical: reflexión con borde incluido */
  function blurPlane(src, w, h){
    const tmp = new Float64Array(w*h);
    for (let y = 0; y < h; y++){
      const row = y*w;
      for (let x = 0; x < w; x++){
        let acc = 0;
        for (let t = -RAD; t <= RAD; t++){
          const xx = x + t;
          if (xx >= 0 && xx < w) acc += KERN[t+RAD] * src[row+xx];
        }
        tmp[row+x] = acc;
      }
    }
    const out = new Float64Array(w*h);
    for (let y = 0; y < h; y++){
      for (let x = 0; x < w; x++){
        let acc = 0;
        for (let t = -RAD; t <= RAD; t++){
          let yy = y + t;
          if (yy < 0) yy = -yy - 1; else if (yy >= h) yy = 2*h - 1 - yy;
          acc += KERN[t+RAD] * tmp[yy*w+x];
        }
        out[y*w+x] = acc;
      }
    }
    return out;
  }

  /* ImageData RGBA -> 3 planos lineales */
  function toLinearPlanes(data, w, h){
    const p = [new Float64Array(w*h), new Float64Array(w*h), new Float64Array(w*h)];
    for (let i = 0, j = 0; j < w*h; i += 4, j++){
      for (let c = 0; c < 3; c++){
        let v = data[i+c] / 255;
        v = v <= 0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
        p[c][j] = v;
      }
    }
    return p;
  }

  /* RGB lineal -> XYB "positivo" (3 planos) */
  function toXYB(lin, w, h){
    const n = w*h;
    const out = [new Float64Array(n), new Float64Array(n), new Float64Array(n)];
    for (let j = 0; j < n; j++){
      const r = lin[0][j], g = lin[1][j], b = lin[2][j];
      let m0 = M00*r + M01*g + M02*b + kB;
      let m1 = M10*r + M11*g + M12*b + kB;
      let m2 = M20*r + M21*g + M22*b + kB;
      if (m0 < 0) m0 = 0;
      if (m1 < 0) m1 = 0;
      if (m2 < 0) m2 = 0;
      m0 = Math.cbrt(m0) - cbrtB;
      m1 = Math.cbrt(m1) - cbrtB;
      m2 = Math.cbrt(m2) - cbrtB;
      let x = 0.5*(m0 - m1);
      const y = 0.5*(m0 + m1);
      const by = m2;
      out[0][j] = x*14.0 + 0.42;
      out[1][j] = y + 0.01;
      out[2][j] = (by - y) + 0.55;
    }
    return out;
  }

  /* caja 2x2 con bordes parciales — igual que el numpy */
  function downsamplePlanes(p, w, h){
    const ow = Math.ceil(w/2), oh = Math.ceil(h/2);
    const out = [new Float64Array(ow*oh), new Float64Array(ow*oh), new Float64Array(ow*oh)];
    const cw = (w >> 1) << 1, ch = (h >> 1) << 1;   // parte divisible
    for (let oy = 0; oy < oh; oy++){
      const y0 = oy*2, y1 = Math.min(y0+2, h);
      const ny = y1 - y0;
      for (let ox = 0; ox < ow; ox++){
        const x0 = ox*2, x1 = Math.min(x0+2, w);
        const nx = x1 - x0;
        const inv = 1/(nx*ny);
        const j = oy*ow + ox;
        for (let c = 0; c < 3; c++){
          let s = 0;
          for (let y = y0; y < y1; y++)
            for (let x = x0; x < x1; x++) s += p[c][y*w+x];
          out[c][j] = s * inv;
        }
      }
    }
    return {planes: out, w: ow, h: oh, cw, ch};
  }

  /* un paso de escala: avg_ssim[6] + avg_edgediff[12] */
  function scaleMetrics(img1, img2, w, h){
    const n = w*h;
    const mus = [], sig = [[],[],[]], mus2 = [];
    for (let c = 0; c < 3; c++){
      const sq1 = new Float64Array(n), sq2 = new Float64Array(n), cross = new Float64Array(n);
      for (let j = 0; j < n; j++){
        const a = img1[c][j], b = img2[c][j];
        sq1[j] = a*a; sq2[j] = b*b; cross[j] = a*b;
      }
      mus.push(blurPlane(img1[c], w, h));
      mus2.push(blurPlane(img2[c], w, h));
      sig[0].push(blurPlane(sq1, w, h));
      sig[1].push(blurPlane(sq2, w, h));
      sig[2].push(blurPlane(cross, w, h));
    }
    const avgSsim = new Float64Array(6);
    const avgEdge = new Float64Array(12);
    for (let c = 0; c < 3; c++){
      const mu1 = mus[c], mu2 = mus2[c];
      const s11 = sig[0][c], s22 = sig[1][c], s12 = sig[2][c];
      let sumD = 0, sumD4 = 0;
      let sumArt = 0, sumArt4 = 0, sumLost = 0, sumLost4 = 0;
      for (let j = 0; j < n; j++){
        const m1 = mu1[j], m2 = mu2[j];
        const num_m = 1 - (m1-m2)*(m1-m2);
        const num_s = 2*(s12[j] - m1*m2) + kC2;
        const den = (s11[j] - m1*m1) + (s22[j] - m2*m2) + kC2;
        let d = 1 - num_m*num_s/den;
        if (d < 0) d = 0;
        sumD += d;
        const d2 = d*d, d4 = d2*d2;
        sumD4 += d4;
        // edge diff contra la imagen SIN blur
        const e1 = 1 + Math.abs(img1[c][j] - m1);
        const e2 = 1 + Math.abs(img2[c][j] - m2);
        const r = e2/e1 - 1;
        const art = r > 0 ? r : 0;
        const lost = r < 0 ? -r : 0;
        sumArt += art; const a2 = art*art, a4 = a2*a2; sumArt4 += a4;
        sumLost += lost; const l2 = lost*lost, l4 = l2*l2; sumLost4 += l4;
      }
      const inv = 1/n;
      avgSsim[c*2]   = sumD * inv;
      avgSsim[c*2+1] = Math.pow(sumD4 * inv, 0.25);
      avgEdge[c*4]   = sumArt * inv;
      avgEdge[c*4+1] = Math.pow(sumArt4 * inv, 0.25);
      avgEdge[c*4+2] = sumLost * inv;
      avgEdge[c*4+3] = Math.pow(sumLost4 * inv, 0.25);
    }
    return {avgSsim, avgEdge};
  }

  function finalScore(scales){
    let ssim = 0, i = 0;
    for (let c = 0; c < 3; c++){
      for (let s = 0; s < scales.length; s++){
        for (let n2 = 0; n2 < 2; n2++){
          ssim += WEIGHTS[i] * Math.abs(scales[s].avgSsim[c*2 + n2]); i++;
          ssim += WEIGHTS[i] * Math.abs(scales[s].avgEdge[c*4 + n2]); i++;
          ssim += WEIGHTS[i] * Math.abs(scales[s].avgEdge[c*4 + n2 + 2]); i++;
        }
      }
    }
    ssim *= 0.9562382616834844;
    ssim = 2.326765642916932*ssim
         - 0.020884521182843837*ssim*ssim
         + 6.248496625763138e-05*ssim*ssim*ssim;
    return ssim > 0 ? 100 - 10*Math.pow(ssim, 0.6276336467831387) : 100;
  }

  /* API: dos ImageData -> puntaje (100 = idéntico) */
  function computeScales(imgData1, imgData2){
    const w = imgData1.width, h = imgData1.height;
    if (imgData2.width !== w || imgData2.height !== h) throw new Error('S2: dimensiones distintas');
    let lin1 = toLinearPlanes(imgData1.data, w, h);
    let lin2 = toLinearPlanes(imgData2.data, w, h);
    let cw = w, ch = h;
    const scales = [];
    for (let s = 0; s < NUM_SCALES; s++){
      if (ch < 8 || cw < 8) break;
      const xyb1 = toXYB(lin1, cw, ch);
      const xyb2 = toXYB(lin2, cw, ch);
      scales.push(scaleMetrics(xyb1, xyb2, cw, ch));
      if (s < NUM_SCALES - 1){
        const d1 = downsamplePlanes(lin1, cw, ch);
        const d2 = downsamplePlanes(lin2, cw, ch);
        lin1 = d1.planes; lin2 = d2.planes; cw = d1.w; ch = d1.h;
      }
    }
    return scales;
  }
  function score(imgData1, imgData2){
    return finalScore(computeScales(imgData1, imgData2));
  }

  /* File/Blob -> ImageData (vía canvas, sRGB 8 bit como el pipeline de referencia) */
  async function imageDataFrom(blob){
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const x = c.getContext('2d', {willReadFrequently: true});
    x.drawImage(bmp, 0, 0);
    return x.getImageData(0, 0, bmp.width, bmp.height);
  }

  function debug(imgData1, imgData2){
    const checks = [];
    {
      let l1 = toLinearPlanes(imgData1.data, imgData1.width, imgData1.height);
      let cw = imgData1.width, ch = imgData1.height;
      for (let s = 0; s < NUM_SCALES && ch >= 8 && cw >= 8; s++){
        const xy = toXYB(l1, cw, ch);
        let sum = [0,0,0];
        for (let c = 0; c < 3; c++) for (let j = 0; j < cw*ch; j++) sum[c] += xy[c][j];
        checks.push(sum.map(v => Math.round(v/(cw*ch)*1e9)/1e9));
        if (s < NUM_SCALES-1){ const dd = downsamplePlanes(l1, cw, ch); l1 = dd.planes; cw = dd.w; ch = dd.h; }
      }
    }
    const scales = computeScales(imgData1, imgData2);
    let ssim = 0, i = 0;
    for (let c = 0; c < 3; c++)
      for (let s2i = 0; s2i < scales.length; s2i++)
        for (let n2 = 0; n2 < 2; n2++){
          ssim += WEIGHTS[i]*Math.abs(scales[s2i].avgSsim[c*2+n2]); i++;
          ssim += WEIGHTS[i]*Math.abs(scales[s2i].avgEdge[c*4+n2]); i++;
          ssim += WEIGHTS[i]*Math.abs(scales[s2i].avgEdge[c*4+n2+2]); i++;
        }
    return {
      nScales: scales.length,
      xybMeansA: checks,
      raw: ssim,
      scales: scales.map(s => ({
        avgSsim: Array.from(s.avgSsim).map(v => Math.round(v*1e6)/1e6),
        avgEdge: Array.from(s.avgEdge).map(v => Math.round(v*1e6)/1e6)
      }))
    };
  }

  return {score, imageDataFrom, debug, _internals: {blurPlane, toXYB, toLinearPlanes, downsamplePlanes}};
})();
