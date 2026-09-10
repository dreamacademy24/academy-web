const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
let count=0;
function fixture() {
 const rows={bookings:[{id:A,portal_user_id:'user-A',final_price:100,paid_amount:0}],staff_accounts:[{username:'admin',role:'korean_admin',is_active:true}],portal_payment_orders:[],push_subscriptions:[{endpoint:'mock-only',booking_id:A}]};
 const state={rows,sent:0,writes:0,failSave:false,authCalls:0,fetchCalls:0};
 state.db={auth:{getUser:async token=>{state.authCalls++;return {data:{user:token==='good'?{id:'user-A'}:token==='other'?{id:'user-B'}:null},error:null}}},
  rpc:async()=>state.failSave?{data:null,error:{message:'simulated failure'}}:{data:{ok:true},error:null},
  from(table){let filters=[],single=false,op='select',value;
   const q={select(){return q},order(){return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},maybeSingle(){single=true;return q},single(){single=true;return q},insert(v){op='insert';value=v;return q},update(v){op='update';value=v;return q},
    then(resolve,reject){return Promise.resolve().then(()=>{let data=(rows[table]||[]).filter(r=>filters.every(f=>f(r)));if(op==='insert'){state.writes++;(rows[table]||=[]).push(value)}if(op==='update'){state.writes++;data.forEach(r=>Object.assign(r,value))}return {data:single?data[0]||null:data,error:null}}).then(resolve,reject)}};return q}
 };
 const cache={}; state.load=function(file){if(cache[file])return cache[file];const exports={};cache[file]=exports;
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 vm.runInNewContext(js,{exports,URL,Buffer,Date,process:{env:{SUPABASE_SERVICE_ROLE_KEY:'test-secret',NEXT_PUBLIC_VAPID_PUBLIC_KEY:'test',VAPID_PRIVATE_KEY:'test'}},
 require(n){if(n==='@supabase/supabase-js')return {createClient:()=>state.db};if(n==='next/server')return {NextResponse:{json:(body,o)=>({status:o?.status||200,body})}};if(n==='web-push')return {setVapidDetails(){},async sendNotification(){state.sent++}};if(n.startsWith('@/'))return state.load(n.slice(2)+'.ts');if(n==='node:crypto')return require(n);throw Error(n)},
 fetch:async()=>{state.fetchCalls++;return {ok:true,json:async()=>({id:'order-A',status:'PAID',currency:'KRW',amount:{total:100}})}}},{filename:file});return exports};
 return state;
}
function req(body={},token,query='',cookie){return new Request('https://example.test/api'+query,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...(cookie?{cookie}: {})},body:JSON.stringify(body)})}
async function check(name,fn){await fn();count++;console.log('PASS '+name)}
(async()=>{
 await check('anonymous booking request rejected',async()=>{const f=fixture();assert.equal((await f.load('app/api/portal/booking/route.ts').GET(req({},null,'?booking_id='+A))).status,401);assert.equal(f.writes,0)});
 await check('another authenticated user cannot read booking',async()=>{const f=fixture();assert.equal((await f.load('app/api/portal/booking/route.ts').GET(req({},'other','?booking_id='+A))).status,403)});
 await check('owner can read linked booking',async()=>{const f=fixture();assert.equal((await f.load('app/api/portal/booking/route.ts').GET(req({},'good','?booking_id='+A))).status,200)});
 await check('unsigned administrator cannot send push',async()=>{const f=fixture();assert.equal((await f.load('app/api/portal/push/send/route.ts').POST(req({title:'test',audience:'all'}))).status,401);assert.equal(f.sent,0)});
 await check('signed active administrator can send; empty selected recipients rejected',async()=>{const f=fixture(), auth=f.load('lib/portalAuth.ts');const c=auth.staffCookie('admin');const cookie=c.name+'='+c.value;const h=f.load('app/api/portal/push/send/route.ts');assert.equal((await h.POST(req({title:'test',audience:'selected',target_ids:[]},null,'',cookie))).status,400);assert.equal(f.sent,0);assert.equal((await h.POST(req({title:'test',audience:'all'},null,'',cookie))).status,200);assert.equal(f.sent,1)});
 await check('tampered and cross-origin administrator cookie rejected',async()=>{const f=fixture(),a=f.load('lib/portalAuth.ts'),c=a.staffCookie('admin');assert.equal(await a.isPortalAdmin(req({},null,'',c.name+'='+c.value+'bad')),false);const r=req({},null,'',c.name+'='+c.value);r.headers.set('origin','https://other.invalid');assert.equal(await a.isPortalAdmin(r),false)});
 await check('server creates an order from current balance',async()=>{const f=fixture();const r=await f.load('app/api/portal/payment/route.ts').PUT(req({booking_id:A,amount:1},'good'));assert.equal(r.status,200);assert.equal(r.body.amount,100);assert.equal(f.rows.portal_payment_orders[0].booking_id,A)});
 await check('payment for a different booking rejected before provider lookup',async()=>{const f=fixture();f.rows.portal_payment_orders.push({payment_id:'order-A',booking_id:B,amount_krw:100});const r=await f.load('app/api/portal/payment/route.ts').POST(req({booking_id:A,payment_id:'order-A'},'good'));assert.equal(r.status,400);assert.equal(f.fetchCalls,0)});
 await check('transaction failure returns error, never success',async()=>{const f=fixture();f.rows.portal_payment_orders.push({payment_id:'order-A',booking_id:A,amount_krw:100});f.failSave=true;assert.equal((await f.load('app/api/portal/payment/route.ts').POST(req({booking_id:A,payment_id:'order-A'},'good'))).status,503)});
 await check('already processed order is idempotent',async()=>{const f=fixture();f.rows.portal_payment_orders.push({payment_id:'order-A',booking_id:A,amount_krw:100,status:'paid'});assert.equal((await f.load('app/api/portal/payment/route.ts').POST(req({booking_id:A,payment_id:'order-A'},'good'))).body.already_processed,true);assert.equal(f.fetchCalls,0)});
 console.log(`${count} regression tests passed. No real network, DB writes, payments or push.`);
})().catch(e=>{console.error(e);process.exitCode=1});
