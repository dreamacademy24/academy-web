const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const {randomUUID}=require('node:crypto'),{createClient}=require('@supabase/supabase-js');
const {chromium}=require('C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.argv[2]||'http://localhost:4198',out=path.resolve('tmp/dreamhouse-checklist-qa');fs.mkdirSync(out,{recursive:true});
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/dreamhouseChecklist.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:mod.exports});
const {DEFAULT_CHECKLIST,validateChecklist}=mod.exports;
assert.equal(DEFAULT_CHECKLIST.common.reduce((n,s)=>n+s.items.length,0),62);assert.equal(DEFAULT_CHECKLIST.daon[0].items.length,3);
assert.equal(validateChecklist({...DEFAULT_CHECKLIST,common:[{title:'',items:[]}]}),null);
assert.equal(validateChecklist({...DEFAULT_CHECKLIST,revision:-1}),null);
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:1000},serviceWorkers:'block'});let template=structuredClone(DEFAULT_CHECKLIST),conflict=false,failed=false;
  await page.route('**/api/dreamhouse/checklist',async route=>{
   if(route.request().method()==='PUT'){
    if(conflict)return route.fulfill({status:409,json:{error:'Another employee saved first. Your edits are still here.'}});
    if(failed)return route.fulfill({status:503,json:{error:'Could not save. Your edits are still here.'}});
    template={...route.request().postDataJSON(),revision:template.revision+1};
   }
   await route.fulfill({json:{template}});
  });
  await page.goto(base+'/dreamhouse-checklist');await page.getByRole('button',{name:'Print / Save PDF'}).waitFor();
  await page.locator('#dreamhouse-print-sheet').waitFor();
  assert.equal(await page.locator('#dreamhouse-print-sheet li').count(),62);
  await page.getByLabel('Block and lot / House',{exact:true}).fill('B17 L10');
  await page.getByLabel('Guest / Reservation',{exact:true}).fill('Sample family');
  await page.getByRole('tab',{name:'Daon Mom'}).click();assert.equal(await page.locator('#dreamhouse-print-sheet li').count(),65);
  await page.screenshot({path:path.join(out,'screen.png'),fullPage:true});
  await page.pdf({path:path.join(out,'daon-mom.pdf'),preferCSSPageSize:true,printBackground:true});
  await page.getByRole('tab',{name:'Standard',exact:true}).click();assert.equal(await page.getByText('Cup noodles for children',{exact:true}).count(),0);
  await page.pdf({path:path.join(out,'standard.pdf'),preferCSSPageSize:true,printBackground:true});
  await page.getByRole('button',{name:'Edit checklist',exact:true}).click();
  await page.getByLabel('Kitchen and dining items',{exact:true}).fill('Updated kitchen item\nSecond item');
  conflict=true;await page.getByRole('button',{name:'Save template for all staff'}).click();await page.locator('main [role="alert"]').waitFor();assert.match(await page.getByLabel('Kitchen and dining items',{exact:true}).inputValue(),/Updated kitchen item/);
  conflict=false;failed=true;await page.getByRole('button',{name:'Save template for all staff'}).click();await page.getByText('Could not save. Your edits are still here.',{exact:false}).waitFor();
  failed=false;await page.getByRole('button',{name:'Save template for all staff'}).click();await page.getByText('Template saved for all staff.',{exact:true}).waitFor();
  await page.reload();await page.getByText('Updated kitchen item',{exact:true}).waitFor();await page.getByRole('tab',{name:'Daon Mom'}).click();await page.getByText('Cup noodles for children',{exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  console.log('PASS screen, both tabs, shared editing/reload, failed and conflicting save preservation, mobile width, A4 PDFs');
 }finally{await browser.close();}
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return;
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}),username='test-checklist-'+randomUUID().slice(0,8),password=randomUUID()+'Ab9!';
 const ok=r=>{if(r.error)throw Error(r.error.message);return r.data;};
 try{
  ok(await db.rpc('exec_sql',{sql:`insert into staff_accounts(username,password_hash,role,name,is_active) values ('${username}',crypt('${password}',gen_salt('bf')),'korean_admin','[Test] Checklist',true)`}));
  const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
  const call=(method,body,headers={Cookie:cookie})=>fetch(base+'/api/dreamhouse/checklist',{method,headers:{...headers,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await call('GET',null,{})).status,401);assert.equal((await call('PUT',DEFAULT_CHECKLIST,{})).status,401);
  assert.equal((await call('PUT',DEFAULT_CHECKLIST,{Cookie:cookie,Origin:'https://other.invalid'})).status,401);
  assert.equal((await call('PUT',{revision:0,common:[],daon:[]})).status,400);
  const initial=await (await call('GET')).json();assert.ok(initial.template);
  // Save the current content unchanged to verify persistence without modifying staff wording.
  const saved=await call('PUT',initial.template);assert.equal(saved.status,200);const updated=(await saved.json()).template;
  const after=(await (await call('GET')).json()).template;assert.deepEqual(after,updated);
  assert.equal((await call('PUT',initial.template)).status,409);
  console.log('PASS employee login, anonymous/cross-origin denial, input validation, real database save/reload, stale update rejection');
 }finally{ok(await db.from('staff_accounts').delete().eq('username',username));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
