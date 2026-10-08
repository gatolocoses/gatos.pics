#!/usr/bin/env node
/* Imagen compartida de una página publicada por la API (ops#162).

   Una página creada con POST /api/upload nace sin /s/<token>.png. Esta
   herramienta abre la página en un navegador sin ventana, le pide al visor la
   MISMA imagen que dibuja el botón "Compartir" (vista partida, etiquetas,
   insignia) y la sube con la llave de borrado de la página.

   Uso:
     GATOS_DELETE_KEY=<llave> node tools/share_image.cjs <url de la página>
     node tools/share_image.cjs <url> --out vista.png        (solo guardar, no sube)

   La URL puede traer el #... de una vista concreta (frame, variantes, divisor):
   es el enlace que da el visor en "Compartir". Sin él: la vista inicial.
   Opciones: --width 1280 --height 720 (ventana del visor), --out <archivo>.
   La llave va por entorno (GATOS_DELETE_KEY), nunca por argumento: los
   argumentos se ven en la lista de procesos.
   Requiere Playwright: GATOS_PLAYWRIGHT_MODULE=/ruta/a/playwright si no está instalado aquí. */
'use strict';
const fs = require('node:fs');

function fail(msg){ console.error('share_image: ' + msg); process.exit(1); }
const args = process.argv.slice(2);
const opt = { width: 1280, height: 720, out: null };
let pageUrl = null;
for (let i = 0; i < args.length; i++){
  const a = args[i];
  if (a === '--out') opt.out = args[++i];
  else if (a === '--width' || a === '--height'){
    const n = parseInt(args[++i], 10);
    if (!(n >= 320 && n <= 4000)) fail(`${a}: se espera un número entre 320 y 4000`);
    opt[a.slice(2)] = n;
  }
  else if (!pageUrl && /^https?:\/\//.test(a)) pageUrl = a;
  else fail(`argumento no reconocido: ${a}`);
}
const m = pageUrl && new URL(pageUrl).pathname.match(/^\/p\/([A-Za-z0-9_-]{10,64})\/?$/);
if (!m) fail('se espera la URL de una página: https://gatos.pics/p/<token>/');
const token = m[1], origin = new URL(pageUrl).origin;
const key = process.env.GATOS_DELETE_KEY || '';
if (!key && !opt.out) fail('falta GATOS_DELETE_KEY (o usa --out <archivo> para solo guardar la imagen)');

(async () => {
  let chromium;
  try { ({ chromium } = require(process.env.GATOS_PLAYWRIGHT_MODULE || 'playwright')); }
  catch { fail('no se encontró Playwright: instálalo o apunta GATOS_PLAYWRIGHT_MODULE a su carpeta'); }
  const browser = await chromium.launch({ headless: true });
  let png;
  try {
    const page = await browser.newPage({ locale: 'es-MX', viewport: { width: opt.width, height: opt.height } });
    const resp = await page.goto(pageUrl, { waitUntil: 'load', timeout: 120000 });
    if (!resp || !resp.ok()) fail(`la página respondió ${resp ? resp.status() : 'sin respuesta'}`);
    // el visor rechaza dibujar mientras el par no terminó de cargar: se reintenta
    // hasta que acepta (las imágenes grandes tardan), y un fallo real se informa
    const b64 = await page.evaluate(async () => {
      const until = Date.now() + 300000;
      for (;;){
        try {
          const c = renderViewCanvas();
          const blob = await new Promise(r => c.toBlob(r, 'image/png'));
          if (!blob) throw new Error('No se pudo generar el PNG.');
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let s = '';
          for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
          return btoa(s);
        } catch (e){
          if (!(e.wait || /^(Espera|Wait)/.test(e.message)) || Date.now() > until) throw e;
          await new Promise(r => setTimeout(r, 250));
        }
      }
    });
    png = Buffer.from(b64, 'base64');
  } catch (e){ await browser.close(); fail(String(e.message || e).split('\n')[0]); }
  await browser.close();

  if (opt.out){ fs.writeFileSync(opt.out, png); console.log(`guardada: ${opt.out} (${png.length} bytes)`); }
  if (!key) return;
  const r = await fetch(`${origin}/api/shot/${token}`, { method: 'POST', headers: { 'content-type': 'image/png', 'x-delete-key': key }, body: png });
  let j = null; try { j = await r.json(); } catch {}
  if (r.status !== 201) fail(`el servidor respondió ${r.status}: ${(j && j.error) || ''}`);
  console.log(j.url);
  console.log(`[url=${origin}/p/${token}/][img]${j.url}[/img][/url]`);
})();
