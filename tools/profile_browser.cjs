/* Development-only profile. Set GATOS_PLAYWRIGHT_MODULE if not installed locally.
   Optional GATOS_PROFILE_HTML and GATOS_PROFILE_OUT select input/output artifacts. */
const {chromium} = require(process.env.GATOS_PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const input = process.env.GATOS_PROFILE_HTML || path.resolve(__dirname,'../dist/gatos.html');
const output = process.env.GATOS_PROFILE_OUT || path.join(os.tmpdir(),'gatos-profile.json');
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[], network=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(/^https?:/.test(r.url())) network.push(r.url());});
    await page.goto(pathToFileURL(input).href);
    const result = await page.evaluate(async () => {
      document.getElementById('onboard').hidden=true;
      setMode('advanced');
      state.variants=[]; state.frames=[]; state.cells.clear(); nextVar=1;
      const files=[], canvas=document.createElement('canvas');
      canvas.width=320; canvas.height=180;
      const x=canvas.getContext('2d'), pixels=x.createImageData(320,180);
      let seed=12345;
      const started=performance.now();
      for(let f=1000;f<1060;f++) for(let v=0;v<6;v++){
        for(let i=0;i<pixels.data.length;i+=4){
          for(let c=0;c<3;c++){ seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;pixels.data[i+c]=seed>>>24; }
          pixels.data[i+3]=255;
        }
        x.putImageData(pixels,0,0);
        const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
        files.push(new File([blob],`variant${v}_${f}.png`,{type:'image/png'}));
      }
      const generation_ms=performance.now()-started;
      const t=performance.now();bulkAdd(files);const bulk_ms=performance.now()-t;
      curStep=3;renderSteps();
      await new Promise(r=>setTimeout(r,100));
      const t2=performance.now();renderMatrix();const matrix_ms=performance.now()-t2;
      // Older versions omit metric on bulk-created variants. Record, then repair
      // only this fixture so the baseline export itself can still be profiled.
      const missing_metric=state.variants.filter(v=>typeof v.metric!=='string').length;
      for(const v of state.variants) if(v.metric===undefined)v.metric='';
      const t3=performance.now();const pkg=await currentPackage({complete:true});
      const package_ms=performance.now()-t3;
      const t4=performance.now();const html=buildStandaloneHTML(pkg);
      const html_ms=performance.now()-t4;
      const t5=performance.now();const blob=new Blob([html],{type:'text/html'});
      const blob_ms=performance.now()-t5;
      const source_bytes=files.reduce((n,f)=>n+f.size,0);
      const package_bytes=new Blob([JSON.stringify(pkg)]).size;
      const previewStart=performance.now();
      document.getElementById('pvFrame').classList.add('show');
      document.getElementById('pvBox').srcdoc=html;
      window.profileResult={frames:state.frames.length,variants:state.variants.length,images:state.cells.size,
        width:320,height:180,generation_ms,bulk_ms,matrix_ms,missing_metric,package_ms,html_ms,blob_ms,
        source_bytes,package_bytes,html_bytes:blob.size,previewStart};
      return window.profileResult;
    });
    await page.waitForFunction(()=>{
      const d=document.getElementById('pvBox').contentDocument;
      return ['imgA','imgB'].every(id=>d?.getElementById(id)?.naturalWidth===320);
    },null,{timeout:90000});
    result.preview_ms=await page.evaluate(()=>performance.now()-profileResult.previewStart);
    delete result.previewStart;
    result.browser=browser.version(); result.errors=errors;result.http_requests=network.length;
    fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
    if(errors.length || network.length)process.exitCode=1;
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
