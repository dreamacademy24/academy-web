const {chromium}=require('C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve('public');
 const server=http.createServer((req,res)=>{
  const p=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
  if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(p,(e,b)=>{if(e){res.writeHead(404).end();return;}
   const types={'.mp3':'audio/mpeg','.html':'text/html; charset=utf-8','.pdf':'application/pdf','.png':'image/png','.js':'text/javascript','.webmanifest':'application/manifest+json','.json':'application/json'};
   res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');res.end(b);
  });
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=process.argv[2]||'http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1024,height:768}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/mandarin/index.html');
  assert.equal(await page.locator('.profile-option').count(),2);
  await page.screenshot({path:'tmp/chinese-review/profile-tablet.png'});
  await page.getByRole('button',{name:'Enter Jia mode'}).click();
  assert.equal(await page.locator('.tile').count(),84);
  await page.locator('[data-action=speak][data-id="014"]').click();
  await page.waitForFunction(()=>audio&&!audio.paused&&audio.duration>0);
  await page.locator('#search').fill('014');assert.equal(await page.locator('.tile').count(),1);
  await page.getByRole('button',{name:'Flip apple card'}).click();assert.equal(await page.locator('.card .zh').textContent(),'苹果');
  await page.getByRole('button',{name:'Mark apple as practiced'}).click();
  await page.locator('#switchProfile').click();await page.getByRole('button',{name:'Enter Jiwoo mode'}).click();
  assert.match(await page.locator('#stars').textContent(),/0/);
  await page.locator('[data-action=star][data-id="001"]').click();
  await page.reload();await page.getByRole('button',{name:'Enter Jia mode'}).click();
  assert.match(await page.locator('#stars').textContent(),/1/);
  assert.equal(await page.locator('[data-action=star][data-id="014"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-action=star][data-id="001"]').getAttribute('aria-pressed'),'false');
  await page.locator('#group').selectOption('7');assert.equal(await page.locator('.tile').count(),6);
  await page.locator('#quizBtn').click();assert.equal(await page.locator('[data-choice]').count(),3);
  const correct=await page.evaluate(()=>question.id);await page.locator('[data-choice="'+correct+'"]').click();
  assert.match(await page.locator('#quizFeedback').textContent(),/Yes!/);
  await page.locator('#quizBtn').click();await page.locator('#group').selectOption('all');
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'tmp/chinese-review/app-tablet.png'});
  for(const [w,h] of [[768,1024],[390,844],[1180,820]]){
   await page.setViewportSize({width:w,height:h});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow at '+w);
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'tmp/chinese-review/app-phone.png'});
  for(const name of ['cards-duplex','starter-workbook','printing-guide']){
   const r=await page.request.get(base+'/mandarin/'+name+'.pdf');assert.equal(r.status(),200);assert((await r.body()).subarray(0,4).equals(Buffer.from('%PDF')));
  }
  const manifest=await (await page.request.get(base+'/mandarin/manifest.webmanifest')).json();
  assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'/mandarin/');
  await page.locator('#installApp').click();
  if(await page.locator('#installHelp').isVisible())await page.getByRole('button',{name:'Got it'}).click();
  await page.locator('#saveOffline').click();
  await page.waitForFunction(()=>document.getElementById('offlineStatus').textContent.includes('Offline ready'),{},{timeout:120000});
  await page.waitForFunction(()=>navigator.serviceWorker.controller&&navigator.serviceWorker.controller.scriptURL.includes('/mandarin/sw.js'));
  await context.setOffline(true);
  await page.reload();await page.getByRole('button',{name:'Enter Jiwoo mode'}).click();
  assert.equal(await page.locator('.tile').count(),84);
  const offline=await page.evaluate(async()=>{
   const results=[];
   for(let i=1;i<=84;i++){const r=await fetch('audio/'+String(i).padStart(3,'0')+'.mp3');results.push(r.ok&&(await r.arrayBuffer()).byteLength>1000);}
   const range=await fetch('audio/001.mp3',{headers:{Range:'bytes=0-99'}});
   const pdf=await fetch('cards-duplex.pdf');return {all:results.every(Boolean),rangeStatus:range.status,rangeBytes:(await range.arrayBuffer()).byteLength,pdf:pdf.ok};
  });
  assert.deepEqual(offline,{all:true,rangeStatus:206,rangeBytes:100,pdf:true});
  await page.locator('[data-action=speak][data-id="014"]').click();
  await page.waitForFunction(()=>audio&&!audio.paused&&audio.duration>0);
  assert.equal(await page.locator('[data-action=star][data-id="001"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-action=star][data-id="014"]').getAttribute('aria-pressed'),'false');
  assert.deepEqual(errors,[]);
  console.log('PASS: separate Jia/Jiwoo profiles; 84 cards/audio; flip/search/quiz; tablet/mobile; manifest; install help; offline reload, ALL voices, PDF and byte ranges.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1)});
