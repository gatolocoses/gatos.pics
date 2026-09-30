/* Regresión permanente de la carrera de generaciones mezcladas
   (gatolocoses/gatos.pics#1 y #24, fixes ops#40 y PRs de la oleada 1).
   El camino venenoso: un cómputo (renderDiff / renderViewCanvas) corrido en la
   misma tarea de evaluate entre la asignación de nuevos src y su carga. La
   precarga solo toca frames VECINOS, así que un salto forzado f1->f3 (3 frames)
   garantiza que ambos lados siguen mostrando pixeles de f1 cuando el cómputo
   corre síncrono. Además se fijan complete=true y currentSrc=src vía
   defineProperty (estado que el spec permite: navegador con complete rezagado),
   que es lo que el guardia VIEJO (bandera complete) confiaba. El guardia NUEVO
   (autoridad de URL asentada) debe rehusarse durante la ventana y servir el
   dato cierto tras la carga. Colores: par f1 delta 10 -> media 3.33 | par f3
   delta 40 -> media 13.33; el PNG exportado no puede mezclar generaciones.
   Convenciones de las suites: GATOS_PLAYWRIGHT_MODULE apunta a una instalación
   de Playwright; GATOS_SERVICE (default: service/ hermano de product/, como
   review_browser.cjs). Sube fixtures de color sólido con la llave de prueba al
   servicio local; nada sale de localhost. Salida: 0 verde, 1 rojo.
   NOTA CSP: la página hospedada tiene CSP estricto — waitForFunction/evaluate
   usan predicados FUNCIÓN siempre; los de cadena violan la política. */
const {chromium} = require(process.env.GATOS_PLAYWRIGHT_MODULE || 'playwright');
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ROOT = path.resolve(__dirname, '..');
const SERVICE = process.env.GATOS_SERVICE || path.join(ROOT, '..', 'service');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'gatos-race-server-'));
const BASE = 'http://127.0.0.1:8995';
const D1 = 10/3, D3 = 40/3;
let failed = 0, browser, server;
const step = (name, ok, why) => { console.log((ok?'PASS ':'FAIL ')+name+(ok?'':' — '+why)); if(!ok) failed=1; };
const MEAN = () => { const t=document.getElementById('diffNote').textContent.match(/\u0394 media ([0-9.]+)/); return t?Number(t[1]):null; };
(async () => {
  server = spawn(process.execPath, [path.join(SERVICE,'server.mjs')], {
    env:{...process.env, PORT:'8995', HOST:'127.0.0.1', BASE_URL:BASE, DATA_DIR:DATA, GATOS_API_KEY:'test-key-123'}, stdio:['ignore','pipe','pipe']
  });
  await new Promise((res,rej)=>{ const t=setTimeout(()=>rej(Error('no server')),10000);
    server.stdout.on('data',d=>{if(String(d).includes('gatos.pics')){clearTimeout(t);res();}});
    server.stderr.on('data',d=>process.stderr.write(d));
    server.once('exit',c=>{clearTimeout(t);rej(Error('server exit '+c));}); });
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1200,height:900}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('about:blank');
  const pkg = await page.evaluate(() => {
    const solid=(r,g,b)=>{const c=document.createElement('canvas');c.width=32;c.height=32;
      const x=c.getContext('2d');x.fillStyle=`rgb(${r},${g},${b})`;x.fillRect(0,0,32,32);
      return c.toDataURL('image/png');};
    return {format:'gatos.pics/cmp@1',manifest:{title:'race',version:1,frames:['f1','f2','f3'],
      frame_labels:{f1:'uno',f2:'dos',f3:'tres'},variants:[{id:'source',name:'Fuente',color:'#7bd389'},{id:'encode',name:'Encode',color:'#ffb454'}]},
      images:{'source_f1':solid(200,60,60),'encode_f1':solid(190,60,60),
              'source_f2':solid(60,200,60),'encode_f2':solid(60,190,60),
              'source_f3':solid(60,60,200),'encode_f3':solid(60,60,160)}};
  });
  const r = await fetch(BASE+'/api/upload',{method:'POST',headers:{'content-type':'application/json','x-api-key':'test-key-123'},body:JSON.stringify(pkg)});
  if (r.status !== 201) throw new Error('upload '+r.status);
  const pub = await r.json();

  /* ===== chequeo #1: el diff nunca sirve la generación anterior ===== */
  await page.goto(pub.url+'#f=f1&a=source&b=encode&diff=1');
  await page.waitForFunction(() => document.getElementById('diffNote').textContent.includes('media'));
  let v = await page.evaluate(MEAN);
  step('f1 asentado = '+D1.toFixed(2), Math.abs(v-D1)<=1, 'v='+v);
  // LA VENTANA VENENOSA: una sola tarea de evaluate — salta ambos src a f3 (no
  // precargado) y computa síncrono. Los pixeles son f1; complete fijado en true
  // emula el navegador rezagado que el guardia viejo confiaba (delete restaura
  // el getter nativo).
  const early = await page.evaluate(async () => {
    for (const im of [imgA, realB]) Object.defineProperty(im, 'complete', {get: () => true, configurable: true});
    for (const im of [imgA, realB]) Object.defineProperty(im, 'currentSrc', {get: () => im.getAttribute('src'), configurable: true});
    // srcFor devuelve Promise desde el fix de la fuente embebida (public#7)
    imgA.src = await srcFor('source','f3');
    realB.src = await srcFor('encode','f3');
    imgB.src = realB.src;
    renderDiff();
    const t=document.getElementById('diffNote').textContent.match(/Δ media ([0-9.]+)/);
    return t ? Number(t[1]) : null;
  });
  step('durante la ventana no hay número (cargando)', early===null, 'cómputo instantáneo Δ='+early+' con pixeles f1');
  await page.waitForFunction(() => { const i = document.getElementById('imgA'); return i.src.includes('f3') && i.complete && i.naturalWidth; });
  await page.waitForTimeout(500);
  await page.evaluate(() => { delete imgA.complete; delete realB.complete; delete imgA.currentSrc; delete realB.currentSrc; });
  v = await page.evaluate(MEAN);
  step('tras cargar: diff del par f3 = '+D3.toFixed(2)+' (no el 3.33 de f1 pegado)', Math.abs(v-D3)<=1, 'v='+v);
  await page.evaluate(() => document.querySelector('#frames button').click());
  await page.waitForTimeout(500);
  v = await page.evaluate(MEAN);
  step('vuelta a f1 = '+D1.toFixed(2), Math.abs(v-D1)<=1, 'v='+v);

  /* ===== chequeo #24: el PNG compartido no mezcla generaciones ===== */
  await page.goto(pub.url+'#f=f1&a=source&b=encode');
  await page.waitForFunction(() => ['imgA','imgB'].every(id=>{const i=document.getElementById(id);return i?.complete && i.naturalWidth;}));
  // sin diff: cada img tiene su propio registro de URL asentada
  const poisonSplit = await page.evaluate(async () => {
    for (const im of [imgA, imgB]) Object.defineProperty(im, 'complete', {get: () => true, configurable: true});
    imgA.src = await srcFor('source','f3');   // vecino lejano: no está precargado
    imgB.src = await srcFor('encode','f3');
    try { renderViewCanvas(); return 'rendered'; } catch(e){ return 'throw:'+e.message; }
  });
  step('sin diff, ventana venenosa: se niega (sin PNG mezclado)', /^throw:/.test(poisonSplit), 'resultado='+poisonSplit);
  await page.waitForFunction(() => { const i = document.getElementById('imgB'); return i.src.includes('f3') && i.complete && i.naturalWidth; });
  const afterSplit = await page.evaluate(() => { try { return renderViewCanvas().width > 0 ? 'ok' : 'empty'; } catch(e){ return 'throw:'+e.message; } });
  step('sin diff, tras cargar: el PNG sale', afterSplit === 'ok', 'resultado='+afterSplit);
  // modo diff: realB es la autoridad (misma URL que imgB)
  await page.evaluate(() => setDiff(true));
  await page.waitForFunction(() => document.getElementById('diffNote').textContent.includes('media'));
  const poisonDiff = await page.evaluate(async () => {
    for (const im of [imgA, realB]) Object.defineProperty(im, 'complete', {get: () => true, configurable: true});
    imgA.src = await srcFor('source','f3');
    realB.src = await srcFor('encode','f3');
    imgB.src = realB.src;
    renderDiff();
    try { renderViewCanvas(); return 'rendered'; } catch(e){ return 'throw:'+e.message; }
  });
  step('diff, ventana venenosa: se niega (sin PNG con diff viejo)', /^throw:/.test(poisonDiff), 'resultado='+poisonDiff);
  await page.waitForFunction(() => { const i = document.getElementById('imgA'); return i.src.includes('f3') && i.complete && i.naturalWidth; });
  await page.waitForTimeout(300);
  await page.evaluate(() => { delete imgA.complete; delete realB.complete; });
  const afterDiff = await page.evaluate(() => { try { return renderViewCanvas().width > 0 ? 'ok' : 'empty'; } catch(e){ return 'throw:'+e.message; } });
  step('diff, tras cargar: el PNG sale', afterDiff === 'ok', 'resultado='+afterDiff);
  step('sin errores de página', !errors.length, errors.join(' | '));
  console.log(failed ? 'RACE REGRESSION ROJO' : 'RACE REGRESSION VERDE');
  process.exit(failed);
})().catch(e=>{ console.error('FATAL', e); process.exit(1); }).finally(async()=>{
  if(browser)await browser.close();
  if(server)server.kill();
  fs.rmSync(DATA,{recursive:true,force:true});
});
