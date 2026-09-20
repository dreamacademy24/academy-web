const {createClient}=require('@supabase/supabase-js');
const {randomUUID}=require('crypto'),assert=require('assert/strict');
const {chromium}=require('C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
const base=process.argv[2]||'http://localhost:4212', users=[],ids=[];
const ok=r=>{if(r.error)throw r.error;return r.data;};
(async()=>{let browser;try{
 for(let i=0;i<2;i++){
  const username='admin-testtheme-'+randomUUID().slice(0,8),password=randomUUID();users.push(username);
  ok(await db.rpc('exec_sql',{sql:`insert into staff_accounts(username,password_hash,role,name,is_active) values ('${username}',crypt('${password}',gen_salt('bf')),'korean_admin','[TEST] Theme',true)`}));
  ids.push(ok(await db.from('staff_accounts').select('id').eq('username',username).single()).id);
  const r=await fetch(base+'/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert.equal(r.status,200);users[i]={username,cookie:r.headers.get('set-cookie').split(';')[0]};
 }
 const request=(index,body)=>fetch(base+'/api/staff/home-theme',{method:body?'PUT':'GET',headers:{Cookie:users[index].cookie,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await fetch(base+'/api/staff/home-theme')).status,403);
 for(const theme of ['purple','teal','blue','orange']){assert.equal((await request(0,{theme})).status,200);assert.equal((await (await request(0)).json()).theme,theme);}
 assert.equal((await (await request(1)).json()).theme,'purple');
 assert.equal((await request(0,{theme:'invalid'})).status,400);
 assert.equal((await request(0,{theme:'teal',username:users[1].username})).status,400);
 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1200,height:900}});
 const cookie=users[0].cookie;await context.addCookies([{name:cookie.split('=')[0],value:cookie.slice(cookie.indexOf('=')+1),url:base}]);
 const page=await context.newPage();
 // Isolate profile controls while using the real authenticated persistence API and deployed assets.
 await page.goto(base+'/staff-home-theme.js');
 await page.setContent('<link rel="stylesheet" href="/staff-home-theme.css"><div id="staffHomeThemePicker"></div><div class="swh"><h1>내 업무 홈</h1><div class="swh-metrics"><button>오늘 할 일</button></div></div>');
 await page.evaluate(()=>{window.CU={id:'test'};});await page.addScriptTag({url:base+'/staff-home-theme.js'});
 await page.evaluate(()=>staffLoadHomeTheme());assert.equal(await page.locator('input:checked').inputValue(),'orange');
 await page.locator('input[value=teal]').check();await page.getByRole('button',{name:'홈 색상 저장'}).click();await page.getByRole('status').filter({hasText:'저장했습니다'}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.staffHomeTheme),'teal');
 await page.evaluate(()=>{staffApplyHomeTheme('purple');return staffLoadHomeTheme();});assert.equal(await page.locator('input:checked').inputValue(),'teal');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 console.log('PASS four palettes, account isolation, unauthenticated/invalid writes, profile selection, saved reload, mobile layout');
 }finally{if(browser)await browser.close();for(const id of ids)ok(await db.from('app_settings').delete().eq('key','staff_home_theme:'+id));for(const user of users)ok(await db.from('staff_accounts').delete().eq('username',user.username||user));}
})().catch(e=>{console.error(e);process.exitCode=1;});
