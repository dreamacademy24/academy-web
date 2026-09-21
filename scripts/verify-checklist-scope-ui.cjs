const {chromium}=require('C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const assert=require('assert/strict');
const base=process.argv[2]||'http://localhost:4213',id='00000000-0000-4000-8000-000000000001';
const b={id,booker_name:'TEST FAMILY',house_no:'TEST',accom_type:'드림하우스',checkin_date:'2026-09-20',checkout_date:'2026-10-20'};
let common={revision:0,common:[{title:'Room',items:['Check bed']}],daon:[{title:'Extras',items:['Water']}]},overrides={},sessions=0;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const ctx=await browser.newContext({viewport:{width:1400,height:1000}});await ctx.route('**/api/**',async route=>{
  const u=new URL(route.request().url());let data={};
  if(u.pathname==='/api/staff/session'){if(++sessions===1)return route.fulfill({status:503,json:{error:'Temporary test outage'}});data={staff:{username:'test',name:'TEST',role:'korean_admin'}};}
  else if(u.pathname==='/api/admin/checkin-details')data={bookings:[b],status:{}};
  else if(u.pathname==='/api/dreamhouse/checklist/bookings')data=u.search?{summary:{guest:'TEST FAMILY',date:b.checkin_date,house:'TEST',beds:'One bed'}}:{bookings:[{id,name:'TEST FAMILY',date:b.checkin_date,house:'TEST'}]};
  else if(u.pathname==='/api/dreamhouse/checklist'){
   const key=u.searchParams.get('bookingId');
   if(route.request().method()==='PUT'){const body=route.request().postDataJSON();body.revision++;if(key)overrides[key]=body;else {assert.equal(u.searchParams.get('scope'),'shared');common=body;}data={template:body};}
   else{const row=key?overrides[key]:common;data={template:row||{...common,revision:0},fields:row?.fields,variant:row?.variant||'standard',customized:!!(key&&row)};}
  }await route.fulfill({json:data});
 });
 const p=await ctx.newPage();await p.goto(base+'/admin/checkin-details',{waitUntil:'domcontentloaded',timeout:120000});await p.getByRole('heading',{name:'체크인 준비',exact:true}).waitFor({timeout:60000});assert.ok(sessions>=2);console.log('PASS transient session failure automatically recovers');
 await p.getByRole('button',{name:'체크인 체크리스트',exact:true}).click();await p.getByRole('button',{name:'공통 항목 편집',exact:true}).click();await p.getByRole('button',{name:'공통 구역 추가',exact:true}).click();await p.getByRole('button',{name:'전체 공통 양식 저장',exact:true}).click();await p.getByText('전체 공통 양식을 저장했습니다.',{exact:true}).waitFor();assert.equal(common.common.length,2);
 await p.goto(base+'/dreamhouse-checklist?bookingId='+id,{waitUntil:'domcontentloaded'});await p.locator('#dreamhouse-print-sheet[data-booking-ready=true]').waitFor();await p.getByRole('button',{name:'이 예약 항목 편집',exact:true}).click();await p.getByLabel('common section 1 title').fill('Only this reservation');await p.getByRole('button',{name:'이 예약에만 저장',exact:true}).first().click();await p.getByText('이 예약에만 저장했습니다. 세트 출력에도 반영됩니다.',{exact:true}).waitFor();assert.equal(common.common[0].title,'Room');assert.equal(overrides[id].common[0].title,'Only this reservation');
 await p.getByLabel('Issues / Follow-up notes').fill('Saved personal note');await p.getByRole('button',{name:'이 예약에만 저장',exact:true}).click();await p.getByRole('button',{name:'인쇄 / PDF 저장',exact:true}).waitFor();await p.reload({waitUntil:'domcontentloaded'});await p.locator('#dreamhouse-print-sheet[data-booking-ready=true]').waitFor();assert.equal(await p.getByLabel('Issues / Follow-up notes').inputValue(),'Saved personal note');assert.ok((await p.locator('#dreamhouse-print-sheet').innerText()).includes('Only this reservation'));
 await p.goto(base+'/dreamhouse-checklist?bookingId=00000000-0000-4000-8000-000000000002',{waitUntil:'domcontentloaded'});await p.locator('#dreamhouse-print-sheet[data-booking-ready=true]').waitFor();assert.ok(!(await p.locator('#dreamhouse-print-sheet').innerText()).includes('Only this reservation'));
 console.log('PASS shared tab, add section, individual edit/notes persistence, print source and other booking isolation');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

