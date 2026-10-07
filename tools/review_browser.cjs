/* Regression checks for the review fixes. Playwright is a development tool only.
   GATOS_PLAYWRIGHT_MODULE=/path/to/playwright node tools/review_browser.cjs
   Spins the service from the gatos-ops subtree (service/) — override with
   GATOS_SERVICE for an external checkout. All uploads use a temporary local server. */
const {chromium} = require(process.env.GATOS_PLAYWRIGHT_MODULE || 'playwright');
const {spawn,spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const SERVICE = process.env.GATOS_SERVICE || path.join(ROOT, '..', 'service');
const OUT = process.env.GATOS_REVIEW_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'gatos-review-'));
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'gatos-review-server-'));
const BASE = 'http://127.0.0.1:8987';
let browser, server;
const checks = [];
function ok(name, actual, expected = true){ assert.deepEqual(actual, expected, name); checks.push(name); console.log('PASS '+name); }
async function loaded(page){ await page.waitForFunction(() => ['imgA','imgB'].every(id=>{const i=document.getElementById(id);return i?.complete && i.naturalWidth;})); }
(async () => {
  fs.mkdirSync(OUT, {recursive:true});
  server = spawn(process.execPath, [path.join(SERVICE,'server.mjs')], {
    env:{...process.env, PORT:'8987', HOST:'127.0.0.1', BASE_URL:BASE, DATA_DIR:DATA, GATOS_API_KEY:'test-key-123'}, stdio:['ignore','pipe','pipe']
  });
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('Local service did not start')),10000);
    server.stdout.on('data',d=>{if(String(d).includes('gatos.pics servicio')){clearTimeout(timeout);resolve();}});
    server.stderr.on('data',d=>process.stderr.write(d));
    server.once('exit',code=>{clearTimeout(timeout);reject(Error('Local service exited '+code));});
  });
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[], network=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER',e.message);});
  page.on('console',m=>{if(m.type()==='error')console.error('CONSOLE',m.text());});
  page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  // gatos.pics#25: importCmp pregunta al importar sobre trabajo abierto. La
  // suite responde los diálogos desde una cola (determinista); sin respuesta
  // encolada, dismiss — el default de Playwright, como antes de este cambio.
  // beforeunload va aparte: con listener registrado Playwright ya no lo
  // auto-acepta, y dismiss abortaría toda navegación con trabajo abierto.
  const dialogLog=[], dialogAnswers=[];
  page.on('dialog',d=>{
    if (d.type()==='beforeunload'){ d.accept(); return; }
    dialogLog.push({type:d.type(),message:d.message()});
    (dialogAnswers.shift()||(x=>x.dismiss()))(d);
  });
  await page.goto('file://'+ROOT+'/dist/gatos.html');
  await page.screenshot({path:path.join(OUT,'onboarding-desktop.png')});
  await page.locator('#obStart').click();
  ok('onboarding can be dismissed', await page.locator('#onboard').isVisible(), false);
  await page.locator('#btnPreviewTop').click();
  ok('empty project cannot open a broken preview', await page.locator('#builderStatus').textContent().then(s=>s.includes('dos imágenes')));
  ok('empty preview stays closed', await page.locator('#pvFrame').isVisible(), false);

  const fixture = await page.evaluate(() => {
    const images={};
    for (const id of ['source','encode','third']) for (const f of ['intro','cut_2']){
      const c=document.createElement('canvas');c.width=640;c.height=360;
      const x=c.getContext('2d'), data=x.createImageData(640,360);
      for(let y=0;y<360;y++)for(let px=0;px<640;px++){
        const i=(y*640+px)*4;data.data[i]=Math.floor(px/3);data.data[i+1]=Math.floor(y/2)+(id==='source'?0:16);data.data[i+2]=f==='intro'?64:128;data.data[i+3]=255;
      }
      x.putImageData(data,0,0);
      images[id+'_'+f]=c.toDataURL(id==='third' && f==='cut_2'?'image/jpeg':'image/png',.95);
    }
    return {format:'gatos.pics/cmp@1',manifest:{title:'Prueba de comparación con un título largo',version:1,frames:['intro','cut_2'],frame_labels:{intro:'Inicio',cut_2:'Escena oscura'},variants:[
      {id:'source',name:'Fuente',color:'#7bd389'},
      {id:'encode',name:'Encode con un nombre largo',color:'#ffb454',cmd:'SvtAv1EncApp --crf 30 --preset 4',metrics:{ssimulacra2:84.2,per_frame:{intro:{ssimulacra2:84.2}}}},
      {id:'third',name:'Tercera variante',color:'#7bb3ff'}]},images};
  });
  const fpath=path.join(OUT,'fixture.cmp');fs.writeFileSync(fpath,JSON.stringify(fixture));
  const png=Buffer.from(fixture.images.source_intro.split(',')[1],'base64');
  await page.locator('#basicFile').setInputFiles([{name:'b.png',mimeType:'image/png',buffer:png},{name:'a.png',mimeType:'image/png',buffer:png},{name:'c.png',mimeType:'image/png',buffer:png}]);
  ok('basic files use the documented filename order', await page.evaluate(()=>BUILDER.state.pairs.map(p=>p.map(f=>f?.name||null))), [['a.png','b.png'],['c.png',null]]);
  const draftDownload=page.waitForEvent('download');await page.locator('#btnSave').click();
  const draft=await draftDownload;const draftPath=path.join(OUT,'draft.cmp');await draft.saveAs(draftPath);
  ok('saving preserves an incomplete pair', Object.keys(JSON.parse(fs.readFileSync(draftPath)).images).length, 3);
  // gatos.pics#25: importar sobre un borrador abierto pregunta una sola vez
  // (confirm); cancelar preserva el proyecto tal como estaba
  dialogAnswers.push(d=>d.dismiss());
  await page.locator('#openFile').setInputFiles(fpath);
  await page.waitForFunction(()=>document.getElementById('builderStatus').textContent.includes('No se importó nada'));
  ok('import over an open project asks via confirm',dialogLog,[{type:'confirm',message:'Abrir este archivo reemplaza el proyecto que tienes abierto. ¿Continuar?'}]);
  ok('cancelling the import preserves the open project',await page.evaluate(()=>({mode:BUILDER.state.mode,pairs:BUILDER.state.pairs.map(p=>p.map(f=>f?.name||null))})),{mode:'basic',pairs:[['a.png','b.png'],['c.png',null]]});
  dialogAnswers.push(d=>d.accept());
  await page.locator('#openFile').setInputFiles(fpath);
  await page.waitForFunction(()=>BUILDER.state.mode==='advanced');
  const roundtrip=await page.evaluate(()=>BUILDER.currentPackage());
  ok('opening in Basic retains all variants', roundtrip.manifest.variants.length,3);
  ok('import retains saved metrics', roundtrip.manifest.variants[1].metrics, fixture.manifest.variants[1].metrics);
  ok('import retains underscore frame ids', roundtrip.manifest.frames,['intro','cut_2']);
  ok('optional metadata does not create warnings',await page.evaluate(()=>BUILDER.validateAdvanced().some(([,m])=>/se ve mejor|Sin título|sin codec/.test(m))),false);
  await page.locator('#stepNext').click();
  await page.screenshot({path:path.join(OUT,'builder-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  ok('codec fields remain available on mobile',await page.locator('[data-k=codec]').first().isVisible());
  await page.screenshot({path:path.join(OUT,'builder-mobile.png')});
  // gatolocoses/gatos.pics#32: creador en teléfono (contexto táctil desde file://):
  // cabecera de 44 px sin desborde, pares en dos columnas, campos de 16 px
  {
    const pctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    const ph=await pctx.newPage();ph.on('pageerror',e=>errors.push(e.message));
    await ph.goto('file://'+ROOT+'/dist/gatos.html');await ph.locator('#obStart').tap();
    await ph.locator('#basicFile').setInputFiles([{name:'b.png',mimeType:'image/png',buffer:png},{name:'a.png',mimeType:'image/png',buffer:png}]);
    const m=await ph.evaluate(()=>{const slots=[...document.querySelectorAll('.pair .slot')].map(s=>s.getBoundingClientRect());
      return {headerSmall:[...document.querySelectorAll('header button')].filter(b=>b.getBoundingClientRect().height<44).length,
        overflow:document.documentElement.scrollWidth>innerWidth, sideBySide:Math.abs(slots[0].top-slots[1].top)<1 && slots[1].left>slots[0].right,
        tools:[...document.querySelectorAll('.pair .tools button')].every(b=>b.getBoundingClientRect().height>=44)};});
    ok('creator phone: 44 px header, no overflow, pair slots side by side, 44 px pair tools',m,{headerSmall:0,overflow:false,sideBySide:true,tools:true});
    await ph.evaluate(()=>{BUILDER.setMode('advanced');document.querySelectorAll('#stepNav button')[1].click();});
    ok('creator phone: text fields are 16 px (no iOS focus zoom)',await ph.locator('[data-k=name]').first().evaluate(i=>getComputedStyle(i).fontSize),'16px');
    await ph.screenshot({path:path.join(OUT,'builder-phone-touch.png')});
    await pctx.close();
  }
  ok('offline builder made no HTTP requests',network.length,0);
  await page.locator('#btnPreviewTop').click();
  const preview=page.frameLocator('#pvBox');
  await page.waitForFunction(()=>{
    const d=document.getElementById('pvBox').contentDocument;
    return ['imgA','imgB'].every(id=>{const i=d?.getElementById(id);return i?.complete && i.naturalWidth;});
  });
  ok('offline preview loads',await preview.locator('#imgA').evaluate(i=>i.naturalWidth),640);
  await page.locator('#pvClose').click();
  await page.evaluate(()=>{BUILDER.setMode('advanced');document.querySelectorAll('#stepNav button')[4].click();});
  for (const [button,name] of [['btnExpHtml','comparison.html'],['btnExpZip','comparison.zip'],['btnExpCmp','comparison.cmp']]){
    const pending=page.waitForEvent('download');await page.locator('#'+button).click();await (await pending).saveAs(path.join(OUT,name));
  }
  const offline=await browser.newPage({viewport:{width:1200,height:900}});
  await offline.goto('file://'+path.join(OUT,'comparison.html'));await loaded(offline);
  ok('exported HTML works from file URL',await offline.locator('#imgA').evaluate(i=>i.naturalWidth),640);
  await offline.close();
  const clipPath=path.join(OUT,'capture.webm');
  const clip=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=320x180:rate=24:duration=1','-c:v','libvpx-vp9','-an','-y',clipPath]);
  assert.equal(clip.status,0,'ffmpeg must generate the video fixture');
  const capture=await page.evaluate(async bytes=>{
    const data=Uint8Array.from(atob(bytes),c=>c.charCodeAt(0)), url=URL.createObjectURL(new Blob([data],{type:'video/webm'}));
    const v=document.createElement('video');v.muted=true;v.preload='auto';
    await new Promise((resolve,reject)=>{v.onloadeddata=resolve;v.onerror=reject;v.src=url;});
    const first=await captureFrame(v,0),next=await captureFrame(v,.5),again=await captureFrame(v,0);
    let rejects=false;try{await captureFrame(v,2);}catch(e){rejects=true;}
    const result={size:[first.width,first.height],changes:first.toDataURL()!==next.toDataURL(),repeat:first.toDataURL()===again.toDataURL(),rejects};
    v.removeAttribute('src');v.load();URL.revokeObjectURL(url);return result;
  },fs.readFileSync(clipPath).toString('base64'));
  ok('video captures zero, repeated seeks, and rejects out-of-range time',capture,{size:[320,180],changes:true,repeat:true,rejects:true});

  const response=await fetch(BASE+'/api/upload',{method:'POST',headers:{'content-type':'application/json','x-api-key':'test-key-123'},body:JSON.stringify(fixture)});
  assert.equal(response.status,201);const publication=await response.json();
  await page.goto(publication.url+'#f=cut_2&a=encode&b=third&d=0.37&diff=1&g=3&smooth=0');await loaded(page);
  ok('hash restores string frame ids and gain',await page.evaluate(()=>({frame,gainIdx,smoothScale})),{frame:'cut_2',gainIdx:3,smoothScale:false});
  ok('mixed image formats load on the hosted page',await page.locator('#imgB').evaluate(i=>i.naturalWidth),640);

  // regresion ops#74: el creador HOSPEDADO carga con CSP real (hashes+script-src)
  // y su vista previa (blob:) debe prender; file:// no ejercita la CSP
  {
    const creator = await browser.newPage({viewport:{width:1200,height:900}});
    const viol=[]; creator.on('console',m=>{if(m.type()==='error'&&/Content Security Policy/.test(m.text()))viol.push(m.text());});
    await creator.goto(BASE+'/crear/');
    ok('hosted creator CSP allows blob scripts',/script-src 'self' blob:/.test((await (await creator.request.get(BASE+'/crear/')).headers())['content-security-policy']||''));
    await creator.locator('#obDemo').click();
    await creator.waitForFunction(()=>{const f=document.getElementById('pvBox');const d=f&&f.contentDocument;const i=d&&d.getElementById('imgA');return !!(i&&i.complete&&i.naturalWidth>0);},null,{timeout:20000});
    ok('hosted creator demo preview loads under CSP',await creator.evaluate(()=>{const d=document.getElementById('pvBox').contentDocument;return {pkg:!!d.defaultView.GATOS_PACKAGE,natA:d.getElementById('imgA').naturalWidth};}),{pkg:true,natA:960});
    ok('hosted creator preview has no CSP violations',viol,[]);
    // ops#76: Publicar SIN llave desde el creador hospedado (tier UI abierto)
    await creator.locator('#pvClose').click();
    await creator.evaluate(() => { localStorage.removeItem('gatosApiKey'); });
    const png2 = Buffer.from(fixture.images.source_intro.split(',')[1],'base64');
    await creator.locator('#basicFile').setInputFiles([{name:'b.png',mimeType:'image/png',buffer:png2},{name:'a.png',mimeType:'image/png',buffer:png2}]);
    await creator.locator('#btnPublish2, #btnPublish').first().click();
    await creator.waitForFunction(() => { const u=document.getElementById('pubUrl'); return u && u.value && document.getElementById('pubFrame').style.display === 'flex'; }, null, {timeout:25000});
    ok('hosted creator publishes keyless (UI tier)', /\/p\/[A-Za-z0-9_-]{10,}/.test(await creator.locator('#pubUrl').inputValue()));
    await creator.close();
    // gatos-ops#157: envío por partes. Con el corte casi en cero cada frame
    // viaja en su propio pedido (POST + PATCH + PATCH) y la página final debe
    // quedar igual que con un solo envío: tres frames, sus etiquetas, sus imágenes.
    const parts = await browser.newPage({viewport:{width:1200,height:900}});
    await parts.addInitScript(() => { window.GATOS_PART_MB = 0.000001; });
    const sentReqs=[]; parts.on('request',r=>{ if(/\/api\/(upload|page\/)/.test(r.url())&&r.method()!=='OPTIONS') sentReqs.push(r.method()); });
    await parts.goto(BASE+'/crear/');
    await parts.locator('#obStart').click();
    const mk = (n) => ['a','b'].flatMap(v => [1,2,3].map(f => ({name:`${v}_${f}.png`,mimeType:'image/png',buffer:png2}))).slice(0,n);
    await parts.locator('#basicFile').setInputFiles(mk(6));
    ok('partCore prunes labels and per-frame metrics to the frames already sent', await parts.evaluate(() => {
      const core = {format:'x', manifest:{frames:[1,2,3], frame_labels:{1:'a',2:'b',3:'c'}, variants:[{id:'s'},{id:'e',metrics:{ssimulacra2:80,per_frame:{1:{ssimulacra2:1},2:{ssimulacra2:2},3:{ssimulacra2:3}}}}]},
        entries:['s_1','e_1','s_2','e_2','s_3','e_3'].map(k => [k,{size:10}])};
      const sp = splitParts(core), p1 = partCore(core, sp, 1);
      return {parts:sp.length, frames:p1.manifest.frames, labels:Object.keys(p1.manifest.frame_labels), pf:Object.keys(p1.manifest.variants[1].metrics.per_frame), avg:p1.manifest.variants[1].metrics.ssimulacra2, keys:p1.entries.map(e=>e[0]), intact:core.manifest.frames.length};
    }), {parts:3, frames:[1,2], labels:['1','2'], pf:['1','2'], avg:80, keys:['s_2','e_2'], intact:3});
    await parts.locator('#btnPublish2, #btnPublish').first().click();
    await parts.waitForFunction(() => { const u=document.getElementById('pubUrl'); return u && u.value && document.getElementById('pubFrame').style.display === 'flex'; }, null, {timeout:40000});
    const partsUrl = await parts.locator('#pubUrl').inputValue();
    const pm = await (await parts.request.get(partsUrl+'manifest.json')).json();
    ok('multi-part publish sends one POST then one PATCH per extra frame', sentReqs, ['POST','PATCH','PATCH']);
    ok('multi-part publish ends with every frame, variant and image', {frames:pm.frames.length, variants:pm.variants.length,
      imgs:(await Promise.all(pm.variants.flatMap(v => pm.frames.map(f => parts.request.get(`${partsUrl}img/${v.id}_${f}.${(v.image_exts&&v.image_exts[f])||v.ext}`))))).every(r => r.status()===200),
      key:(await parts.locator('#pubKey').inputValue()).length >= 20}, {frames:3, variants:2, imgs:true, key:true});
    await parts.close();
  }
  await page.waitForFunction(()=>document.getElementById('diffCanvas').width===640);
  ok('diff canvas covers the full source dimensions',await page.locator('#diffCanvas').evaluate(c=>[c.width,c.height]),[640,360]);
  await page.locator('#diffGain').selectOption('2');
  await page.locator('#heatBtn').click();
  ok('touch-accessible diff controls change gain and heat',await page.evaluate(()=>({gainIdx,heat})),{gainIdx:2,heat:true});
  await page.locator('body').click({position:{x:1,y:1}});
  await page.keyboard.press('Shift+Digit1');
  ok('Shift plus a number selects the left variant',await page.evaluate(()=>varA),'source');
  await page.evaluate(()=>{setDiff(false);setSolar(true);});
  ok('solar table values are normalized',await page.evaluate(()=>Math.max(...document.querySelector('feFuncR').getAttribute('tableValues').split(' ').map(Number))),1);
  await page.evaluate(()=>{setSolar(false);setBlind(true);});
  ok('blind mode neutralizes identity colors',await page.locator('#labelA').evaluate(e=>getComputedStyle(e).color), 'rgb(232, 232, 240)');
  ok('blind mode hides the project title',await page.title(),'Comparación a ciegas');
  await page.evaluate(()=>setBlind(false));
  await page.goto(publication.url+'#f=intro&a=source&b=encode&crops=1&crop=0.5,0.5');
  await loaded(page);await page.locator('#cropPanel').waitFor({state:'visible'});
  ok('crop URL uses actual image dimensions',await page.evaluate(()=>cropUV),{u:320,v:180});
  await page.evaluate(()=>{setCropMode(false);fitView();});

  for(const width of [320,390,820,1024,1440,1920]){
    await page.setViewportSize({width,height:width<=820?844:1000});
    const geometry=await page.evaluate(()=>{
      const b=document.getElementById('brand').getBoundingClientRect();
      const overlap=[...document.querySelectorAll('header button,header select,.frame-tools h1,.frame-tools .group')].some(el=>{
        const r=el.getBoundingClientRect();return r.width && r.height && r.left<b.right && r.right>b.left && r.top<b.bottom && r.bottom>b.top;
      });
      return {height:b.height,width:b.width,overlap,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    // marca final del dueno: 78x16 (la version de 72 quedo obsoleta tras la ronda de marca)
    ok('brand fits without overlap at '+width,geometry,{height:16,width:78,overlap:false,overflow:false});
    if([390,1440].includes(width))await page.screenshot({path:path.join(OUT,'viewer-'+width+'.png')});
  }
  await page.setViewportSize({width:1000,height:1000});
  await page.evaluate(()=>{
    fitView();const r=comp.getBoundingClientRect();setZoomAt(r.left+200,r.top+350,2);
    dividerPos=.45;applyTransform();
  });
  const stage=await page.locator('#comp').boundingBox();
  await page.mouse.move(stage.x+750,stage.y+300);await page.mouse.down();await page.mouse.move(stage.x+790,stage.y+330);await page.mouse.up();
  const screen=await page.locator('#comp').screenshot();
  const comparison=await page.evaluate(async screenshot=>{
    const output=renderViewCanvas();const img=new Image();img.src=screenshot;await img.decode();
    const ref=document.createElement('canvas');ref.width=img.width;ref.height=img.height;ref.getContext('2d').drawImage(img,0,0);
    const r=imgA.getBoundingClientRect(), box=comp.getBoundingClientRect();
    const ix=Math.max(0,r.left-box.left),iy=Math.max(0,r.top-box.top);
    let worst=0;
    for(const px of [.2,.8])for(const py of [.3,.6,.75]){
      const sx=Math.floor(output.width*px),sy=Math.floor(output.height*py);
      const a=output.getContext('2d').getImageData(sx,sy,1,1).data;
      const b=ref.getContext('2d').getImageData(Math.round(ix)+sx,Math.round(iy)+sy,1,1).data;
      for(let i=0;i<3;i++)worst=Math.max(worst,Math.abs(a[i]-b[i]));
    }
    return {worst,png:output.toDataURL(),hash:stateParams().toString()};
  },'data:image/png;base64,'+screen.toString('base64'));
  ok('PNG matches the rendered zoom and pan (within 2 channel levels)',comparison.worst<=2);
  fs.writeFileSync(path.join(OUT,'share.png'),Buffer.from(comparison.png.split(',')[1],'base64'));
  await page.locator('#shareBtn').click();
  const url=await page.locator('#shareRows textarea').inputValue();
  ok('share URL retains the current view',url,publication.url+'#'+comparison.hash);
  await page.locator('#shareKey').fill(publication.delete_key);
  await page.locator('#shareUp').click();await page.locator('#shareCodes').waitFor({state:'visible'});
  const bb=await page.locator('#shareCodes textarea').first().inputValue();
  ok('forum link retains the current view',bb.includes(url));
  ok('canonical image uses the page token',bb.includes('/s/'+publication.token+'.png'));
  await page.locator('#shareClose').click();
  // ops#149: variante parcial. Una página real (servicio local) con 5 frames
  // y una variante `p` que solo tiene f2 y f4: en f1, f3 y f5 su panel muestra el
  // aviso, nada se pide a la red, y diff/parpadeo/recortes/compartir no fallan.
  {
    const pp=await browser.newPage({viewport:{width:1200,height:800}});
    const perrs=[],bad=[],reqs=[];
    pp.on('pageerror',e=>perrs.push(e.message));
    pp.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url());});
    pp.on('request',r=>reqs.push(r.url()));
    const frs=['f1','f2','f3','f4','f5'], have=['f2','f4'];
    const images=await pp.evaluate(({frs,have})=>{
      const out={};
      for(const [id,list] of [['a',frs],['b',frs],['p',have]]) for(const f of list){
        const c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d');
        const s=id.charCodeAt(0)*7+Number(f.slice(1))*31;
        x.fillStyle=`rgb(${s%200+30},${(s*3)%200+30},${(s*5)%200+30})`;x.fillRect(0,0,320,180);
        x.fillStyle='#fff';x.fillRect(20+(s%50),30,60,40);x.fillStyle='#000';x.fillRect(200,100+(s%30),80,20);
        out[id+'_'+f]=c.toDataURL('image/png');
      }
      return out;
    },{frs,have});
    const manifestP={title:'Prueba parcial',version:1,frames:frs,variants:[
      {id:'a',name:'Fuente',color:'#7bd389'},{id:'b',name:'Encode',color:'#ffb454'},
      {id:'p',name:'Tercero parcial',color:'#7bb3ff',frames:have}]};
    const upP=await fetch(BASE+'/api/upload',{method:'POST',headers:{'content-type':'application/json','x-api-key':'test-key-123','x-forwarded-for':'203.0.113.49'},
      body:JSON.stringify({format:'gatos.pics/cmp@1',manifest:manifestP,images})}).then(r=>r.json());
    ok('partial variant page publishes with only its own images',/\/p\/[A-Za-z0-9_-]{10,}/.test(upP.url||''));
    const waitA=()=>pp.waitForFunction(()=>loadedUrlA===imgA.src&&imgA.naturalWidth>0);   // la URL actual asentada, no pixeles viejos
    const waitB=()=>pp.waitForFunction(()=>{const i=document.getElementById('imgB');return i.complete&&i.naturalWidth>0&&getComputedStyle(i).visibility!=='hidden';});
    const vis=sel=>pp.locator(sel).isVisible();
    await pp.goto(upP.url+'#f=f1&a=a&b=p');await waitA();
    ok('missing frame: the right pane shows the placeholder, the left pane its image',await pp.evaluate(()=>({
      a:!document.getElementById('missA').hidden,b:!document.getElementById('missB').hidden,
      text:document.getElementById('missB').textContent,imgB:getComputedStyle(document.getElementById('imgB')).visibility,
      imgA:getComputedStyle(document.getElementById('imgA')).visibility,w:document.getElementById('imgA').naturalWidth})),
      {a:false,b:true,text:'Esta variante no tiene este cuadro',imgB:'hidden',imgA:'visible',w:320});
    ok('placeholder text sits in the visible half of its own pane',await pp.evaluate(()=>{
      const r=document.createRange();r.selectNodeContents(document.getElementById('missB'));
      const t=r.getBoundingClientRect(),c=document.getElementById('comp').getBoundingClientRect();
      return t.left+t.width/2>c.left+c.width/2;}));
    await pp.screenshot({path:path.join(OUT,'partial-missing-frame.png')});
    ok('footer says which side has no image',await pp.locator('#metaLine').textContent().then(t=>t.includes('sin este cuadro: der.')));
    ok('the variant is dimmed but still pressed and selectable on that frame',await pp.evaluate(()=>{
      const b=[...document.querySelectorAll('#varB button')].find(x=>x.textContent.includes('Tercero'));
      return {dim:b.classList.contains('nofr'),pressed:b.getAttribute('aria-pressed'),dis:b.disabled,others:document.querySelectorAll('#varA .nofr').length===1};}),
      {dim:true,pressed:'true',dis:false,others:true});
    ok('mobile selector marks the variant without this frame',await pp.locator('#selB option').allTextContents().then(l=>l.some(t=>t.includes('Tercero')&&t.includes('sin este cuadro'))));
    // el frame siguiente (teclado) trae la imagen y el aviso desaparece sin tocar el otro panel
    await pp.keyboard.press('ArrowRight');await waitB();
    ok('keyboard changes frame: the variant image replaces the placeholder',await pp.evaluate(()=>({frame,b:document.getElementById('missB').hidden,dim:document.querySelectorAll('.nofr').length,
      w:document.getElementById('imgB').naturalWidth,a:document.getElementById('imgA').naturalWidth})),{frame:'f2',b:true,dim:0,w:320,a:320});
    ok('footer line is clean on a frame where both sides have an image',await pp.locator('#metaLine').textContent().then(t=>!t.includes('sin este cuadro')));
    // diff: con imagen funciona; sin ella avisa y no calcula
    await pp.keyboard.press('d');
    await pp.waitForFunction(()=>document.getElementById('diffCanvas').width===320);
    ok('diff works on a frame both variants have',await pp.locator('#diffNote').textContent().then(t=>t.startsWith('Diff ×')));
    await pp.keyboard.press('ArrowRight');
    await pp.waitForFunction(()=>document.getElementById('missB').hidden===false);
    ok('diff on a frame without the image: short note, no canvas, no error',await pp.evaluate(()=>({
      note:document.getElementById('diffNote').textContent,canvas:getComputedStyle(document.getElementById('diffCanvas')).display,on:diffMode})),
      {note:'Diff no disponible: una variante no tiene este cuadro.',canvas:'none',on:true});
    await pp.keyboard.press('ArrowRight');await waitB();
    await pp.waitForFunction(()=>document.getElementById('diffNote').textContent.startsWith('Diff ×'));
    ok('diff comes back on the next frame that has the image',await pp.evaluate(()=>document.getElementById('missB').hidden&&document.getElementById('diffCanvas').width===320));
    await pp.keyboard.press('ArrowRight');
    await pp.waitForFunction(()=>document.getElementById('missB').hidden===false);await waitA();
    // el PNG de compartir dibuja el mismo aviso (con diff encendido, que no existe aquí)
    const shot=await pp.evaluate(()=>{const c=renderViewCanvas();const d=c.getContext('2d').getImageData(Math.floor(c.width*.9),Math.floor(c.height*.8),1,1).data;
      return {w:c.width,h:c.height,px:[...d]};});
    ok('share image on a missing frame renders (diff on) with the neutral placeholder color',shot.w>0&&shot.h>0&&shot.px.join()==='22,22,29,255');
    await pp.keyboard.press('d');
    // parpadeo
    await pp.keyboard.press('b');
    const ops=new Set();for(let i=0;i<5;i++){ops.add(await pp.evaluate(()=>document.getElementById('missB').style.opacity));await pp.waitForTimeout(260);}
    ok('blink alternates the left image and the right placeholder',ops.has('0')&&ops.has('1'));
    ok('share image in blink mode renders',await pp.evaluate(()=>{const c=renderViewCanvas();return c.width>0;}));
    await pp.keyboard.press('b');
    ok('blink off clears the placeholder opacity',await pp.evaluate(()=>document.getElementById('missB').style.opacity),'');
    // recortes: una fila por variante; la parcial sin imagen no pide nada
    await pp.keyboard.press('c');
    const box=await pp.locator('#comp').boundingBox();await pp.mouse.click(box.x+box.width*.25,box.y+box.height*.5);
    await pp.locator('#cropPanel').waitFor({state:'visible'});
    ok('crops panel lists the three variants without throwing',await pp.locator('#cropRows .cropRow').count(),3);
    await pp.keyboard.press('Escape');
    // el lado A tambien puede ser la parcial (p a la izquierda): ancho y medidas salen del otro lado
    await pp.goto(upP.url+'#f=f1&a=p&b=a');   // el cambio de hash recarga la página sola
    await pp.waitForFunction(()=>varA==='p'&&frame==='f1'&&loadedUrlPaneB===imgB.src&&imgB.naturalWidth>0);
    ok('partial variant on the left at a missing frame: placeholder on the left, geometry from the right image',await pp.evaluate(()=>({
      a:!document.getElementById('missA').hidden,b:document.getElementById('missB').hidden,nat:naturalDims().nw,fits:rw>0&&rw<=document.getElementById('comp').clientWidth})),{a:true,b:true,nat:320,fits:true});
    await pp.keyboard.press('Space');await waitB();   // B pasa a la siguiente variante
    ok('space cycles the right variant while the left shows a placeholder',await pp.evaluate(()=>varB!=='a'&&!document.getElementById('missA').hidden));
    // URL: el estado se escribe y se restaura, con el aviso incluido
    await pp.goto(upP.url+'#f=f3&a=a&b=p');await pp.waitForFunction(()=>frame==='f3'&&varB==='p');await waitA();await pp.waitForTimeout(400);
    await pp.reload();await waitA();
    ok('hash state restores a frame where the variant has no image',await pp.evaluate(()=>({frame,b:varB,miss:!document.getElementById('missB').hidden,hash:location.hash.includes('f=f3')&&location.hash.includes('b=p')})),{frame:'f3',b:'p',miss:true,hash:true});
    ok('no image was requested for a frame the variant does not have, and no 4xx/5xx',{img:reqs.filter(u=>/\/img\/p_f[135]\./.test(u)),bad},{img:[],bad:[]});
    ok('partial variant viewer: no uncaught browser errors',perrs,[]);
    await pp.close();
    // fuente embebida (el creador y las exportaciones): mismo comportamiento sin red
    const pe=await browser.newPage({viewport:{width:1200,height:800}});
    const eerrs=[];pe.on('pageerror',e=>eerrs.push(e.message));
    await pe.addInitScript(pkg=>{window.GATOS_PACKAGE=pkg;},{format:'gatos.pics/cmp@1',manifest:manifestP,images});
    await pe.goto(upP.url+'#f=f1&a=a&b=p');
    await pe.waitForFunction(()=>{const i=document.getElementById('imgA');return i.complete&&i.naturalWidth>0;});
    ok('embedded source: placeholder on a missing frame',await pe.evaluate(()=>({b:!document.getElementById('missB').hidden,a:document.getElementById('missA').hidden})),{b:true,a:true});
    await pe.keyboard.press('ArrowRight');
    await pe.waitForFunction(()=>{const i=document.getElementById('imgB');return i.complete&&i.naturalWidth>0&&getComputedStyle(i).visibility!=='hidden';});
    ok('embedded source: the next frame shows the image',await pe.evaluate(()=>document.getElementById('missB').hidden),true);
    ok('embedded source: no uncaught browser errors',eerrs,[]);
    await pe.close();
  }
  // gatolocoses/gatos.pics#31: modo teléfono con toque real (contexto táctil,
  // eventos por CDP): barra inferior, arranque ajustado, deslizar, pellizco,
  // divisor, PNG exacto con zoom táctil, botón cmd y apaisado
  {
    const pctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
    const phone=await pctx.newPage();
    phone.on('pageerror',e=>errors.push(e.message));
    await phone.goto(publication.url+'#f=intro&a=source&b=encode');await loaded(phone);
    const layout=await phone.evaluate(()=>({zoom,footer:getComputedStyle(document.querySelector('footer')).display,
      small:[...document.querySelectorAll('.view-tools button,.vsel,#swapBtn,.fnav,#frames button')].filter(b=>b.offsetParent!==null).map(b=>Math.round(b.getBoundingClientRect().height)).filter(h=>h<44).length,
      compShare:comp.clientHeight/innerHeight,overflow:document.documentElement.scrollWidth>innerWidth}));
    ok('phone: starts fitted, 44 px controls, keyboard footer hidden, no overflow',{zoom:layout.zoom,footer:layout.footer,small:layout.small,overflow:layout.overflow},{zoom:1,footer:'none',small:0,overflow:false});
    ok('phone: comparison area is at least 70% of the viewport height',layout.compShare>=0.7);
    const cdp=await pctx.newCDPSession(phone);
    const touch=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map((p,i)=>({x:p[0],y:p[1],id:i}))});
    // el dedo se detiene antes de levantarse, como uno real: un gesto sintético
    // que termina a toda velocidad es un "fling" y Chromium suprime el click del
    // toque siguiente
    const lift=async(pts)=>{await phone.waitForTimeout(80);await touch('touchMove',pts);await phone.waitForTimeout(80);await touch('touchEnd',[]);};
    const box=await phone.locator('#comp').boundingBox(), cy=box.y+box.height/2, mx=box.x+box.width/2;
    await touch('touchStart',[[box.x+box.width*0.8,cy+60]]);
    for(let i=1;i<=8;i++)await touch('touchMove',[[box.x+box.width*0.8-i*20,cy+60]]);
    await lift([[box.x+box.width*0.8-160,cy+60]]);await loaded(phone);
    ok('phone: swipe left on the fitted view goes to the next frame',await phone.evaluate(()=>frame),'cut_2');
    await touch('touchStart',[[mx-30,cy],[mx+30,cy]]);
    for(let i=1;i<=8;i++)await touch('touchMove',[[mx-30-i*10,cy],[mx+30+i*10,cy]]);
    await lift([[mx-110,cy],[mx+110,cy]]);
    ok('phone: pinch zooms in',await phone.evaluate(()=>zoom>1.5));
    const d0=await phone.evaluate(()=>dividerPos), dx=box.x+box.width*d0;
    await touch('touchStart',[[dx,cy]]);for(let i=1;i<=6;i++)await touch('touchMove',[[dx+i*10,cy]]);await lift([[dx+60,cy]]);
    ok('phone: one-finger drag moves the divider',await phone.evaluate(d=>dividerPos>d+0.1,d0));
    const shotPhone=await phone.locator('#comp').screenshot();
    const cmpPhone=await phone.evaluate(async screenshot=>{
      const output=renderViewCanvas();const img=new Image();img.src=screenshot;await img.decode();
      const ref=document.createElement('canvas');ref.width=img.width;ref.height=img.height;ref.getContext('2d').drawImage(img,0,0);
      const d=devicePixelRatio, r=imgA.getBoundingClientRect(), b=comp.getBoundingClientRect();
      const ix=Math.round(Math.max(0,r.left-b.left)*d),iy=Math.round(Math.max(0,r.top-b.top)*d);
      let worst=0;
      for(const px of [.2,.8])for(const py of [.3,.6,.75]){
        const sx=Math.floor(output.width*px),sy=Math.floor(output.height*py);
        const a=output.getContext('2d').getImageData(sx,sy,1,1).data, c=ref.getContext('2d').getImageData(ix+sx,iy+sy,1,1).data;
        for(let i=0;i<3;i++)worst=Math.max(worst,Math.abs(a[i]-c[i]));
      }
      return worst;
    },'data:image/png;base64,'+shotPhone.toString('base64'));
    ok('phone: PNG matches the rendered pinch zoom (within 2 channel levels)',cmpPhone<=2);
    await phone.evaluate(()=>fitView());
    await phone.locator('.vcmd[data-pane="varB"]').tap();
    // el click de un toque lo sintetiza el reconocedor de gestos de Chromium (asíncrono): se espera al panel
    await phone.waitForFunction(()=>getComputedStyle(cmdTip).display==='block',null,{timeout:5000}).catch(()=>{});
    const cmdInfo=await phone.evaluate(()=>({shown:getComputedStyle(cmdTip).display==='block',text:cmdTip.textContent.includes('--crf 30'),button:!document.querySelector('.vcmd[data-pane="varB"]').hidden,varB,blind:blindMode}));
    ok('phone: cmd button shows the encoder command without hover',cmdInfo,{shown:true,text:true,button:true,varB:'encode',blind:false});
    await phone.screenshot({path:path.join(OUT,'viewer-phone-390.png')});
    await phone.setViewportSize({width:844,height:390});await phone.evaluate(()=>{hideTip();fitView();});
    ok('phone landscape: comparison area is at least 60% of the viewport height',await phone.evaluate(()=>comp.clientHeight/innerHeight>=0.6));
    await phone.screenshot({path:path.join(OUT,'viewer-phone-844x390.png')});
    await pctx.close();
  }
  await page.goto(BASE+'/');await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:path.join(OUT,'landing-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(OUT,'landing-mobile.png'),fullPage:true});
  ok('landing fits mobile',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('a', {hasText:'Ver un ejemplo'}).click();
  await page.locator('#pvFrame.show').waitFor();
  ok('landing demo opens above onboarding',await page.locator('#onboard').isVisible(),false);
  ok('no uncaught browser errors',errors,[]);
  fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({checks,errors},null,2));
  console.log('Artifacts: '+OUT);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();
  if(server)server.kill();
  fs.rmSync(DATA,{recursive:true,force:true});
});
