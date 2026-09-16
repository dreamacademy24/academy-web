const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const names=['ptFindNode','ptChildren','ptDescendants','ptProgress','ptIsPast','ptRenderList','ptRenderProject','ptRenderTree','ptTreeNodes','ptDueShort','ptDueClass','_ptUnreadSet','_ptUnreadDesc','_ptBang'];
(async()=>{
 const base=process.argv[2];
 const html=base?await(await fetch(base+'/team_manager3.html',{signal:AbortSignal.timeout(20000)})).text():fs.readFileSync('public/team_manager3.html','utf8');
 for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(m[1].trim())new vm.Script(m[1]);
 const funcs=names.map(name=>{const start=html.indexOf('function '+name+'(');assert.ok(start>=0,name);const end=html.indexOf('\n}',start)+2;assert.ok(end>start,name);return html.slice(start,end);}).join('\n');
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{const page=await browser.newPage({viewport:{width:1280,height:900}});await page.setContent('<main id="ptRoot"></main>');
 await page.addScriptTag({content:`var PT={nodes:[],cur:null,sel:null,listMode:'active',openMap:{}};var myNotifs=[];function esc(s){return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}function getP(){return null;}function ptRenderDetail(id){document.getElementById('ptDetail').textContent=id||'';}\n${funcs}`});
 await page.evaluate(()=>{const projects=['ongoing','complete','empty','almost'];PT.nodes=projects.map(id=>({id,project_id:id,kind:'project',title:id}));PT.nodes.push({id:'one',project_id:'ongoing',kind:'task',done:false,title:'unfinished'},{id:'done',project_id:'complete',kind:'task',done:true,title:'preserved result',body:'unchanged'});for(let i=0;i<200;i++)PT.nodes.push({id:'a'+i,project_id:'almost',kind:'task',done:i!==199,title:'task'});window.before=JSON.stringify(PT.nodes);ptRenderList();});
 assert.equal(await page.locator('.proj-card').count(),3);assert.equal(await page.evaluate(()=>ptProgress('almost')),99);assert.equal(await page.evaluate(()=>ptIsPast('empty')),false);
 await page.getByRole('button',{name:'과거 프로젝트 (1)',exact:true}).click();assert.equal(await page.locator('.proj-card').count(),1);await page.locator('.proj-card').click();assert.match(await page.locator('#ptTree').textContent(),/preserved result/);await page.getByRole('button',{name:'← 과거 프로젝트 목록'}).click();assert.equal(await page.locator('.proj-card').count(),1);
 assert.equal(await page.evaluate(()=>JSON.stringify(PT.nodes)===before),true,'browsing must not modify records');
 await page.evaluate(()=>{ptFindNode('done').done=false;ptRenderList();});assert.equal(await page.locator('.proj-card').count(),0);await page.getByRole('button',{name:'진행 중 프로젝트 (4)',exact:true}).click();assert.equal(await page.locator('.proj-card').count(),4);
 await page.evaluate(()=>{ptFindNode('done').done=true;ptFindNode('one').done=true;ptRenderList();});assert.equal(await page.locator('.proj-card').count(),2);await page.getByRole('button',{name:'과거 프로젝트 (2)',exact:true}).click();assert.equal(await page.locator('.proj-card').count(),2);
 await page.setViewportSize({width:360,height:740});assert.ok(await page.evaluate(()=>document.body.scrollWidth<=360));console.log('PASS '+(base||'local')+': completed/active grouping, reopen, newly completed, empty/rounding edge cases, preserved records, detail/back and 360px controls; inline JS syntax.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
