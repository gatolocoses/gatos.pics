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
      {id:'encode',name:'Encode con un nombre largo',color:'#ffb454',metrics:{ssimulacra2:84.2,per_frame:{intro:{ssimulacra2:84.2}}}},
      {id:'third',name:'Tercera variante',color:'#7bb3ff'}]},images};
  });
  const fpath=path.join(OUT,'fixture.cmp');fs.writeFileSync(fpath,JSON.stringify(fixture));
  const png=Buffer.from(fixture.images.source_intro.split(',')[1],'base64');
  await page.locator('#basicFile').setInputFiles([{name:'b.png',mimeType:'image/png',buffer:png},{name:'a.png',mimeType:'image/png',buffer:png},{name:'c.png',mimeType:'image/png',buffer:png}]);
  ok('basic files use the documented filename order', await page.evaluate(()=>BUILDER.state.pairs.map(p=>p.map(f=>f?.name||null))), [['a.png','b.png'],['c.png',null]]);
  const draftDownload=page.waitForEvent('download');await page.locator('#btnSave').click();
  const draft=await draftDownload;const draftPath=path.join(OUT,'draft.cmp');await draft.saveAs(draftPath);
  ok('saving preserves an incomplete pair', Object.keys(JSON.parse(fs.readFileSync(draftPath)).images).length, 3);
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
    await creator.close();
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
      const overlap=[...document.querySelectorAll('header button,header select,.frame-tools')].some(el=>{
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
