const assert=require('node:assert/strict');
const {randomUUID,createHmac}=require('node:crypto');
const {createClient}=require('@supabase/supabase-js');
const {chromium}=require('C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.argv[2]||'https://www.dreamacademyph.com';
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const staffId=randomUUID(),ids=[randomUUID(),randomUUID()],username='verify-checklist-'+Date.now(),key='dreamhouse_checkin_checklist_v1';
const check=({error})=>{if(error)throw Error(error.message);};
(async()=>{
 let browser;
 try{
  check(await db.from('staff_accounts').insert({id:staffId,username,name:'CHECKLIST VERIFICATION',role:'korean_admin',password_hash:randomUUID(),is_active:true}));
  check(await db.from('bookings').insert(ids.map((id,i)=>({id,booker_name:'CHECKLIST TEST '+i,booker_english:'CHECKLIST TEST '+i,status:'테스트',accom_type:'드림하우스',checkin_date:'2000-01-01',checkout_date:'2000-01-02',house_no:'TEST',pickup:'X',drop_off:'X',ssp:'X'}))));
  const payload=Buffer.from(JSON.stringify({username,expires:Date.now()+300000})).toString('base64url');
  const cookie=payload+'.'+createHmac('sha256',process.env.STAFF_SESSION_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY).update('portal-staff-v1:'+payload).digest('base64url');
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext();
  await context.addCookies([{name:'portal_staff_session',value:cookie,url:base,httpOnly:true,secure:true,sameSite:'Strict'}]);
  const api=context.request;
  const shared=await (await api.get(base+'/api/dreamhouse/checklist?scope=shared')).json();assert.ok(shared.template);
  const initial=await (await api.get(base+'/api/dreamhouse/checklist?bookingId='+ids[0])).json();assert.equal(initial.customized,false);
  const body={...initial.template,fields:{guest:'CHECKLIST TEST',date:'2000-01-01',house:'TEST',beds:'TEST BED',inspector:'TEST',notes:'Reservation-only saved note'},variant:'standard'};
  body.common[0].title='Reservation-only verification';
  const results=await Promise.all([1,2].map(()=>api.put(base+'/api/dreamhouse/checklist?bookingId='+ids[0],{data:body})));
  assert.deepEqual(results.map(r=>r.status()).sort(),[200,409]);
  const stored=await (await api.get(base+'/api/dreamhouse/checklist?bookingId='+ids[0])).json();assert.equal(stored.fields.notes,body.fields.notes);
  const other=await (await api.get(base+'/api/dreamhouse/checklist?bookingId='+ids[1])).json();assert.equal(other.customized,false);assert.equal(other.template.common[0].title,shared.template.common[0].title);
  const unchanged=await (await api.get(base+'/api/dreamhouse/checklist?scope=shared')).json();assert.deepEqual(unchanged.template,shared.template);
  const page=await context.newPage();await page.goto(base+'/admin/hub',{waitUntil:'domcontentloaded'});await page.getByText('예약 관리',{exact:true}).last().waitFor({timeout:30000});console.log('PASS production admin hub and signed staff session');
  await page.goto(base+'/admin/checkin-details',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'체크인 체크리스트',exact:true}).click();await page.getByRole('heading',{name:'체크인 체크리스트 · 공통 양식',exact:true}).waitFor();
  await page.goto(base+'/dreamhouse-checklist?bookingId='+ids[0],{waitUntil:'domcontentloaded'});await page.locator('#dreamhouse-print-sheet[data-booking-ready=true]').waitFor();await page.reload({waitUntil:'domcontentloaded'});await page.locator('#dreamhouse-print-sheet[data-booking-ready=true]').waitFor();assert.equal(await page.getByLabel('Issues / Follow-up notes').inputValue(),body.fields.notes);assert.ok((await page.locator('#dreamhouse-print-sheet').innerText()).includes(body.common[0].title));
  await page.screenshot({path:'tmp-checklist-live.png',fullPage:true});
  const anon=await browser.newContext();assert.equal((await anon.request.get(base+'/api/dreamhouse/checklist')).status(),401);await anon.close();
  console.log('PASS production shared tab, reservation save/reload/print source, isolation, concurrent 409 and anonymous 401');
 }finally{
  if(browser)await browser.close();
  check(await db.from('app_settings').delete().in('key',ids.map(id=>key+':booking:'+id)));
  check(await db.from('bookings').delete().in('id',ids));
  check(await db.from('staff_accounts').delete().eq('id',staffId));
  console.log('Temporary verification records removed');
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
