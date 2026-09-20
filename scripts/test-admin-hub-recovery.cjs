const {chromium}=require('C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const scenario of ['recover','unauthorized','forbidden','outage']){
   const context=await browser.newContext();let calls=0;
   await context.route('**/api/**',route=>{
    if(new URL(route.request().url()).pathname!=='/api/staff/session')return route.fulfill({json:{counts:{tutor:0,online:0}}});
    calls++;const status=scenario==='unauthorized'?401:scenario==='forbidden'?403:scenario==='outage'||calls===1?503:200;
    return route.fulfill({status,json:status===200?{staff:{username:'test-admin',name:'TEST',role:'korean_admin'}}:{error:'test'}});
   });
   const page=await context.newPage();await page.goto('http://localhost:4213/admin/hub',{waitUntil:'domcontentloaded',timeout:120000});
   if(scenario==='recover'){await page.getByText('예약 관리',{exact:true}).last().waitFor({timeout:30000});assert.ok(calls>=2);assert.ok(!page.url().includes('/login'));}
   else {await page.getByRole('heading',{name:scenario==='unauthorized'?/로그인 연결이 필요/:scenario==='forbidden'?/접근 권한 확인/:/서버 연결 확인/}).waitFor();await page.waitForTimeout(10000);assert.equal(calls,scenario==='outage'?3:1);assert.equal(await page.getByText('자동생성 · PDF 출력',{exact:true}).count(),0);}
   console.log('PASS admin hub '+scenario);await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

