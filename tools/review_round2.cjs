/* Development-only browser checks. No requests leave localhost.
   GATOS_PLAYWRIGHT_MODULE may point to an existing Playwright installation. */
const {chromium}=require(process.env.GATOS_PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'), path=require('node:path'), os=require('node:os');
const http=require('node:http'), assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const OUT=process.env.GATOS_REVIEW2_OUT || fs.mkdtempSync(path.join(os.tmpdir(),'gatos-review2-'));
const TOKEN='localreviewtoken1234567';
let browser, server, base, viewerHTML='', completedPublications=0, completedShots=0;
const requests=[],checks=[],errors=[];
const ok=(name,actual,expected=true)=>{assert.deepEqual(actual,expected,name);checks.push(name);console.log('PASS '+name);};
const loaded=page=>page.waitForFunction(()=>['imgA','imgB'].every(id=>document.getElementById(id)?.naturalWidth));
const hash=buf=>createHash('sha256').update(buf).digest('hex');
(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  server=http.createServer((req,res)=>{
    if(req.method==='POST'){
      const chunks=[],record={url:req.url,complete:false};requests.push(record);
      req.on('data',chunk=>chunks.push(chunk));
      req.on('end',()=>{
        const data=Buffer.concat(chunks);record.complete=true;record.bytes=data.length;record.hash=hash(data);
        const shot=req.url.startsWith('/api/shot/');
        const n=shot?++completedShots:++completedPublications;
        const status=n===1?(shot?403:503):201;
        const response=status===201 ? {url:shot?base+'/s/'+TOKEN+'.png':base+'/p/'+TOKEN+'/',
          token:TOKEN,delete_key:'local-test-author-key',delete_url:base+'/api/delete/'+TOKEN} : {error:shot?'Llave incorrecta.':'Servicio temporalmente ocupado.'};
        setTimeout(()=>{if(!res.destroyed){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(response));}},900);
      });
      req.on('error',()=>{});return;
    }
    res.setHeader('content-type','text/html; charset=utf-8');
    res.end(req.url.startsWith('/crear')?fs.readFileSync(path.join(ROOT,'dist/gatos.html')):viewerHTML);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/crear/');await page.locator('#obStart').click();
  const fixture=await page.evaluate(()=>{
    const images={};let seed=4141;
    for(const id of ['src','enc','third']) for(const f of ['first','next']){
      const c=document.createElement('canvas');c.width=320;c.height=180;
      const x=c.getContext('2d'),p=x.createImageData(c.width,c.height);
      for(let i=0;i<p.data.length;i+=4){
        for(let k=0;k<3;k++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;p.data[i+k]=seed>>>24;}
        p.data[i+3]=255;
      }
      x.putImageData(p,0,0);images[id+'_'+f]=c.toDataURL();
    }
    return {format:'gatos.pics/cmp@1',manifest:{title:'Proyecto secreto',version:1,frames:['first','next'],
      frame_labels:{first:'Marca privada',next:'Otra marca'},clip:{source:'Fuente privada'},
      variants:[{id:'src',name:'Original secreto',color:'#7bd389',cmd:'private-command',metrics:{custom_note:'dato privado'}},
        {id:'enc',name:'Encode secreto',color:'#ffb454',metrics:{ssimulacra2:83}},
        {id:'third',name:'Tercero secreto',color:'#7bb3ff'}]},images};
  });
  viewerHTML=await page.evaluate(pkg=>buildStandaloneHTML(pkg),fixture);
  const a=Buffer.from(fixture.images.src_first.split(',')[1],'base64');
  const b=Buffer.from(fixture.images.enc_first.split(',')[1],'base64');
  await page.locator('#basicFile').setInputFiles([{name:'a.png',mimeType:'image/png',buffer:a},{name:'b.png',mimeType:'image/png',buffer:b}]);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:20,downloadThroughput:-1,uploadThroughput:131072});
  await page.locator('#btnPublish').click();
  await page.waitForFunction(()=>{const p=document.getElementById('publishProgress');return p.value>0 && p.value<1;});
  ok('publication exposes actual intermediate byte progress',await page.locator('#publishStatus').textContent().then(t=>t.includes('MiB de')));
  ok('both publish entry points disabled during upload',await page.evaluate(()=>['btnPublish','btnPublish2'].every(id=>document.getElementById(id).disabled)));
  await page.locator('#publishCancel').click();
  ok('cancel warns that publication may already exist',await page.locator('#publishStatus').textContent().then(t=>t.includes('Reintentar puede crear otra página')));
  await page.locator('#publishRetry').click();
  await page.waitForFunction(()=>document.getElementById('publishStatus').textContent.includes('Esperando confirmación'));
  ok('transmitted bytes do not claim server success',await page.locator('#pubFrame').isVisible(),false);
  await page.waitForFunction(()=>document.getElementById('publishStatus').textContent.includes('temporalmente ocupado'));
  ok('503 has a manual retry and honest duplicate warning',await page.locator('#publishStatus').textContent().then(t=>t.includes('otra página')) && await page.locator('#publishRetry').isVisible());
  const before=requests.length;await page.waitForTimeout(250);
  ok('no automatic publication retries',requests.length,before);
  await page.locator('#publishRetry').click();await page.locator('#pubFrame').waitFor();
  ok('retry preserves the exact package bytes',requests.filter(r=>r.url==='/api/upload'&&r.complete).map(r=>r.hash).every(h=>h===requests.find(r=>r.url==='/api/upload'&&r.complete).hash));
  await page.locator('#pubClose').click();
  // A cancelled preparation must never publish after another operation starts.
  const race=await page.evaluate(async()=>{
    let resolve,lateSent=false;
    const elements=Array.from({length:5},()=>document.createElement('div'));
    const u=new GatosUpload({panel:elements[0],progress:document.createElement('progress'),status:elements[1],cancel:elements[2],retry:elements[3],onSuccess:()=>{},retryCaution:'prueba'});
    const pending=u.start(()=>new Promise(r=>resolve=r));
    elements[2].click();
    u.send=()=>{lateSent=true;};
    await u.start(async()=>{throw Error('segunda preparación');});
    resolve({url:'/should-never-send',body:new Blob(['old'])});await pending;
    return !lateSent;
  });
  ok('cancelled preparation cannot revive after a new attempt',race);
  // Bulk creation and incremental matrix edits, including an ambiguous prefix.
  const matrix=await page.evaluate(async bytes=>{
    setMode('advanced');state.variants=[];state.frames=[];state.cells.clear();nextVar=1;
    const buf=Uint8Array.from(atob(bytes),c=>c.charCodeAt(0));
    const files=['bluray_1001.png','encode-one_1001.png','encode-two_1001.png'].map(name=>new File([buf],name,{type:'image/png'}));
    bulkAdd(files);const pkg=await currentPackage({complete:true});
    const untouched=document.querySelectorAll('#matrix .cell')[1];
    document.querySelector('#matrix .rm').click();
    const same=untouched===document.querySelectorAll('#matrix .cell')[1];
    const ambiguous=bulkAdd([new File([buf],'enc_1001.png',{type:'image/png'})]);
    return {exportable:pkg.manifest.variants.length===3,unchangedCell:same,ambiguous:ambiguous.misses===1};
  },a.toString('base64'));
  ok('bulk variants export, cell edits preserve neighbors, ambiguous prefixes stay unassigned',matrix,{exportable:true,unchangedCell:true,ambiguous:true});
  // Capture reports a success and an out-of-range error for EACH variant.
  const clip=path.join(OUT,'capture.webm');
  assert.equal(spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=320x180:rate=24:duration=1','-c:v','libvpx-vp9','-an','-y',clip]).status,0);
  await page.evaluate(()=>{setMode('video');state.cells.clear();state.frames=[{key:'1',label:''}];});
  await page.locator('#vidFile').setInputFiles([{name:'master.webm',mimeType:'video/webm',buffer:fs.readFileSync(clip)},{name:'encode.webm',mimeType:'video/webm',buffer:fs.readFileSync(clip)}]);
  await page.evaluate(()=>{vidState.marks=[0,2];renderVidMarks();});await page.locator('#vidGo').click();
  await page.waitForFunction(()=>!document.getElementById('vidGo').disabled);
  ok('video results identify both failing marks and variants',await page.locator('#vidResults [data-status=error]').allTextContents().then(a=>a.length===2&&a.every(t=>t.includes('Marca 2')&&t.includes('fuera de este video'))&&a[0].includes('master.webm')&&a[1].includes('encode.webm')));
  ok('video keeps successful captures and exports metadata without crashing',await page.evaluate(async()=>{const p=await currentPackage();return Object.keys(p.images).length===2&&p.manifest.frames.length===2;}));
  // Fixed seed yields a reproducible, nonidentity permutation for this fixture.
  await page.goto(base+'/p/'+TOKEN+'/');await loaded(page);
  await page.evaluate(()=>sessionStorage.setItem('gatosBlind:'+location.pathname+':'+originalTitle+':'+VARIANTS.map(v=>v.id).join(','),'1'));
  await page.locator('#blindBtn').click();await loaded(page);
  const order=await page.evaluate(()=>blindOrder.map(v=>v.id));
  ok('blind mode shuffles actual pane contents',await page.evaluate(()=>[varA,varB]),[order[0],order[1]]);
  ok('known seed changes original order',order.join(',')!=='src,enc,third');
  await page.waitForTimeout(180);
  ok('blind hash contains no identities or shuffle state',await page.evaluate(()=>!['a','b','blind','seed','order'].some(k=>new URLSearchParams(location.hash.slice(1)).has(k))));
  ok('blind metadata and statistics contain no identity',await page.evaluate(()=>['pageTitle','metaLine','statsA','statsB','labelA','labelB'].every(id=>!/(secreto|privad|S2|src|enc)/i.test(document.getElementById(id).textContent))));
  await page.evaluate(()=>{cropUV={u:160,v:90};setCropMode(true);openCropPanel();});
  ok('crop labels are anonymous and follow the shuffled order',await page.locator('#cropPanel').textContent().then(t=>t.includes('Variante 1')&&!/secreto|privad/.test(t)));
  await page.evaluate(()=>document.activeElement.blur());await page.keyboard.press('Shift+Digit3');await page.keyboard.press('Digit1');
  ok('blind numeric shortcuts follow anonymous order',await page.evaluate(()=>[varA,varB]),[order[2],order[0]]);
  await page.keyboard.press('Space');ok('blind Space follows anonymous order',await page.evaluate(()=>varB),order[1]);
  await page.evaluate(()=>{setCropMode(false);closeCrop();});
  await page.locator('#shareBtn').click();
  ok('blind share explains its session-only mapping',await page.locator('#shareBlindNote').isVisible());
  const drawn=await page.evaluate(()=>{
    const proto=CanvasRenderingContext2D.prototype,old=proto.fillText,text=[];
    proto.fillText=function(s,...rest){text.push(s);return old.call(this,s,...rest);};
    try{renderViewCanvas();}finally{proto.fillText=old;}return text;
  });
  ok('share PNG pills contain anonymous labels and no stats',drawn.some(s=>s.startsWith('Variante '))&&!drawn.some(s=>/secreto|privad|S2/.test(s)));
  await page.locator('#shareKey').fill('wrong-test-key');await page.locator('#shareUp').click();
  await page.waitForFunction(()=>document.getElementById('shotStatus').textContent.includes('Llave incorrecta'));
  ok('shot authorization error does not offer a futile same-key retry',await page.locator('#shotRetry').isVisible(),false);
  await page.locator('#shareKey').fill('local-test-author-key');await page.locator('#shareUp').click();
  await page.waitForFunction(()=>{const p=document.getElementById('shotProgress');return p.value>0&&p.value<1;});
  ok('share image upload exposes intermediate byte progress',await page.locator('#shotStatus').textContent().then(t=>t.includes('MiB de')));
  await page.locator('#shotCancel').click();
  ok('shot cancel describes replacement of the same URL',await page.locator('#shotStatus').textContent().then(t=>t.includes('misma URL')));
  await page.locator('#shotRetry').click();await page.locator('#shareCodes').waitFor();
  ok('shot retry resolves to canonical URL',await page.locator('#shareCodes textarea').last().inputValue(),base+'/s/'+TOKEN+'.png');
  await page.locator('#shareClose').click();
  const panes=await page.evaluate(()=>[varA,varB]);await page.locator('#revealBtn').click();
  ok('Reveal preserves selected pane contents and restores names',await page.evaluate(()=>({panes:[varA,varB],blind:blindMode,title:document.title})),{panes,blind:false,title:'Proyecto secreto'});
  await page.reload();await loaded(page);ok('blind is not enabled by a shared URL',await page.evaluate(()=>blindMode),false);
  await page.locator('#blindBtn').click();ok('session assignment survives reload',await page.evaluate(()=>blindOrder.map(v=>v.id)),order);
  for(const width of [320,390,820,1440]){
    await page.setViewportSize({width,height:844});
    ok('mobile-visible help trigger at '+width,await page.locator('#helpBtn').isVisible());
    await page.locator('#helpBtn').click();
    ok('help opens modally without horizontal overflow at '+width,await page.evaluate(()=>document.getElementById('helpDialog').open&&document.documentElement.scrollWidth<=innerWidth));
    const f=await page.evaluate(()=>frame);await page.keyboard.press('ArrowRight');ok('help prevents background shortcuts at '+width,await page.evaluate(()=>frame),f);
    if(width===390)await page.screenshot({path:path.join(OUT,'help-mobile.png')});
    await page.keyboard.press('Escape');
    ok('Esc closes help and restores trigger focus at '+width,await page.evaluate(()=>!document.getElementById('helpDialog').open&&document.activeElement.id==='helpBtn'));
  }
  await page.keyboard.press('?');ok('? opens shortcut help',await page.locator('#helpDialog').evaluate(d=>d.open));await page.keyboard.press('Escape');
  ok('no uncaught browser errors',errors,[]);
  fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify({checks,errors,requests},null,2)+'\n');console.log('Artifacts: '+OUT);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
});
