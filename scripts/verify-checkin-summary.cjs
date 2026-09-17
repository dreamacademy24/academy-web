const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),vm=require('vm'),ts=require('typescript');
const {chromium}=require('C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
function moduleFrom(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});return exports;}
const {dreamhouseStay,checkinSummary}=moduleFrom('lib/dreamhouseCheckinSummary.ts'),{DEFAULT_CHECKLIST}=moduleFrom('lib/dreamhouseChecklist.ts');
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const booking={id:a,booker_name:'원문 이름',booker_english:'Sample Guest',reservation_no:'TEST-001',accom_type:'드림하우스',house_no:'B17 L10',checkin_date:'2026-10-01',checkout_date:'2026-10-29',seg1_type:'jpark',seg2_type:'dreamhouse',seg2_checkin:'2026-10-08',seg2_checkout:'2026-10-29'};
const summary=checkinSummary(booking,{checkin_date:'2026-10-01',bed_setting:JSON.stringify({room1:'더블베드 2개 (3~4인 스테이)',room2:'사용하지 않음',room3:'더블베드 1개 (1~2인 스테이)'})});
assert.equal(summary.date,'2026-10-08');assert.equal(summary.house,'B17 L10');assert.match(summary.guest,/Sample Guest/);assert.doesNotMatch(summary.beds,/[가-힣]/);assert.equal(checkinSummary(booking,null).beds,'');assert.equal(dreamhouseStay({id:a,accom_type:'제이파크'}),null);
const base=process.argv[2]||'http://localhost:4198',out=path.resolve('tmp/checkin-summary-qa');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:1200,height:1000},serviceWorkers:'block'});let failed=false;
 await page.route('**/api/dreamhouse/checklist',r=>r.fulfill({json:{template:DEFAULT_CHECKLIST}}));
 await page.route('**/api/dreamhouse/checklist/bookings*',async r=>{
  assert.equal(r.request().method(),'GET');const id=new URL(r.request().url()).searchParams.get('bookingId');
  if(!id)return r.fulfill({json:{bookings:[{id:a,name:'Sample Guest',date:summary.date,house:summary.house,reservation:'TEST-001'},{id:b,name:'Second Guest',date:'2026-10-10',house:'B17 L11',reservation:'TEST-002'}]}});
  if(failed)return r.fulfill({status:503,json:{error:'Could not load check-in details.'}});
  return r.fulfill({json:{summary:id===a?summary:{guest:'Second Guest / TEST-002',date:'2026-10-10',house:'B17 L11',beds:''}}});
 });
 await page.goto(base+'/dreamhouse-checklist?bookingId='+a);await page.locator('#dreamhouse-print-sheet').waitFor();
 assert.equal(await page.getByLabel('Guest / Reservation',{exact:true}).inputValue(),summary.guest);assert.equal(await page.getByLabel('Check-in date',{exact:true}).inputValue(),summary.date);
 assert.match(await page.getByRole('link',{name:'Check-in Details',exact:true}).getAttribute('href'),new RegExp(a));
 await page.getByRole('tab',{name:'Daon Mom'}).click();await page.emulateMedia({media:'print'});
 assert.equal(await page.locator('#dreamhouse-print-sheet h2').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
 await page.pdf({path:path.join(out,'daon-summary.pdf'),preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});
 await page.getByRole('tab',{name:'Standard',exact:true}).click();await page.emulateMedia({media:'print'});await page.pdf({path:path.join(out,'standard-summary.pdf'),preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});
 failed=true;await page.getByLabel('Fill from Check-in Details').selectOption(b);await page.getByText('Could not load check-in details.',{exact:false}).waitFor();assert.equal(await page.locator('#dreamhouse-print-sheet').count(),0);assert.equal(await page.getByRole('button',{name:'Print / Save PDF'}).isDisabled(),true);
 failed=false;await page.getByRole('button',{name:'Retry',exact:true}).click();await page.locator('#dreamhouse-print-sheet').waitFor();assert.equal(await page.getByLabel('Block and lot / House',{exact:true}).inputValue(),'B17 L11');assert.equal(await page.getByLabel('Bed setup',{exact:true}).inputValue(),'');
 await page.getByLabel('Fill from Check-in Details').selectOption('');assert.equal(await page.getByLabel('Guest / Reservation',{exact:true}).inputValue(),'');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log('PASS linked booking, English bed summary, Dream House segment dates, low-ink print CSS, both PDFs, failed switch and retry, blank reset, mobile');
}finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
