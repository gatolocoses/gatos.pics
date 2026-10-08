#!/usr/bin/env node
// Guías de Ayuda: que ningún paso señale algo que ya no existe (gatos-ops#175).
// Cada paso de app/guide.js nombra su elemento con `target`; ese nombre tiene
// que estar como marca data-guide en app/index.html, o ponerse por código en
// app/builder.js (`dataset.guide = 'nombre'`, o `'prefijo-' + n` para las que
// llevan número). Corre en el gate de push, sin navegador. La comprobación con
// navegador (que cada paso encuentre su elemento VISIBLE) está en review_browser.cjs.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app');
const guide = readFileSync(path.join(APP, 'guide.js'), 'utf8');
const html = readFileSync(path.join(APP, 'index.html'), 'utf8'), js = readFileSync(path.join(APP, 'builder.js'), 'utf8');
const targets = [...new Set([...guide.matchAll(/target:\s*'([^']+)'/g)].map(m => m[1]))];
if (!targets.length){ console.error('guías: no se encontró ningún paso en app/guide.js'); process.exit(1); }
const missing = targets.filter(t => {
  const prefix = t.replace(/\d+$/, '');
  return !(html.includes(`data-guide="${t}"`) || js.includes(`dataset.guide = '${t}'`) || (prefix !== t && js.includes(`dataset.guide = '${prefix}' +`)));
});
// y al revés: los botones del panel que el código de la guía usa por id
const ids = [...new Set([...guide.matchAll(/\$\('([A-Za-z0-9]+)'\)/g)].map(m => m[1]))].filter(id => !html.includes(`id="${id}"`));
if (missing.length || ids.length){
  if (missing.length) console.error('guías: pasos que señalan algo que ya no existe: ' + missing.join(', '));
  if (ids.length) console.error('guías: ids que guide.js usa y no están en index.html: ' + ids.join(', '));
  process.exit(1);
}
console.log(`guías: ${targets.length} elementos señalados, todos existen`);
