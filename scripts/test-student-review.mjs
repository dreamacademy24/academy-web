import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {signStaffSession,resolveStaffSession,canReviewStudents} from '../lib/staffSession.ts';
import {issueConfirmation} from '../lib/student-care/confirmation.ts';
import {reconcileStudents} from '../lib/student-care/reconcile.ts';
const require=createRequire(import.meta.url),ts=require('typescript');
const key='test-only-key-not-used-in-production',now=1900000000000;
const admin={id:'a',username:'test',role:'korean_admin',name:'Test'};
const request=(value,origin)=>new Request('http://localhost/api/staff/student-review',{headers:{...(value?{cookie:`portal_staff_session=${value}`} :{}),...(origin?{origin}:{})}});
test('valid signature resolves current server identity and teacher is not an admin',async()=>{
 const token=signStaffSession('test',key,now);
 const teacher=await resolveStaffSession(request(token),key,async()=>({...admin,role:'local_teacher'}),now);
 assert.equal(teacher.role,'local_teacher');assert.equal(canReviewStudents(teacher),false);
 assert.equal(canReviewStudents(await resolveStaffSession(request(token),key,async()=>admin,now)),true);
});
test('missing, tampered, expired, wrong origin and deactivated sessions are rejected',async()=>{
 const token=signStaffSession('test',key,now);
 for(const req of [request(),request(token+'x'),request(token+'.extra'),request(token,'https://other.example')])assert.equal(await resolveStaffSession(req,key,async()=>admin,now),null);
 assert.equal(await resolveStaffSession(request(token),key,async()=>admin,now+8*3600000),null);
 assert.equal(await resolveStaffSession(request(token),key,async()=>null,now),null);
 assert.equal(await resolveStaffSession(request(token),'',async()=>admin,now),null);
});
function route(identity,fail=false){
 let reads=0;
 const code=ts.transpileModule(readFileSync(new URL('../app/api/staff/student-review/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const modules={
  'next/server':{NextResponse:{json:(body,init)=>({body,...init})}},
  '@/lib/portalAuth':{getStaffIdentity:async()=>identity,portalDb:()=>({from:table=>({select:()=>({order:()=>({range:async(start)=>{
   reads++;if(table.startsWith('care_'))return {data:[]};if(fail)return {error:new Error('private db detail')};
   if(table==='bookings')return {data:[{id:'b',students:[{id:'s',korName:'샘플'}],reservation_no:'TEST'}]};
   if(start===0)return {data:Array.from({length:500},(_,i)=>({id:i===0?'s':`s${i}`,booking_id:'b',name_kr:'샘플'}))};
   return {data:[{id:'last',booking_id:'b',name_kr:'추가'}]};
  }})})})})},
  '@/lib/staffSession':{canReviewStudents},
  '@/lib/student-care/confirmation':{issueConfirmation},
  '@/lib/student-care/reconcile':{reconcileStudents},
 };
 const exports={};vm.runInNewContext(code,{exports,process:{env:{STAFF_SESSION_SECRET:key}},require:n=>{if(!(n in modules))throw Error(n);return modules[n];},Map,Date,Error});
 return {get:exports.GET,reads:()=>reads};
}
test('unauthenticated and teacher requests never read student data',async()=>{
 for(const [identity,status] of [[null,401],[{...admin,role:'local_teacher'},403]]){
  const r=route(identity);const res=await r.get(request());assert.equal(res.status,status);assert.equal(r.reads(),0);
 }
});
test('admin review paginates and returns no-store result without mutation',async()=>{
 const r=route(admin);const res=await r.get(request());assert.equal(res.status,200);assert.equal(res.body.studentRowCount,501);
 assert.equal(r.reads(),6);assert.match(res.headers['Cache-Control'],/no-store/);assert.equal(res.body.items[0].status,'id_candidate');
});
test('data failure returns an error, never partial counts or internal messages',async()=>{
 const res=await route(admin,true).get(request());assert.equal(res.status,503);assert.equal(res.body.items,undefined);assert.ok(!res.body.error.includes('private db detail'));
});

test('local login issues a server cookie only after successful credentials',async()=>{
 for(const row of [admin,null]){
  const code=ts.transpileModule(readFileSync(new URL('../app/api/admineng/login/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const cookies=[];const exports={};
  vm.runInNewContext(code,{exports,process:{env:{}},require:n=>({
   '@supabase/supabase-js':{createClient:()=>({rpc:async()=>({data:row?[row]:[],error:null})})},
   'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status||200,cookies:{set:v=>cookies.push(v)}})}},
   '@/lib/portalAuth':{staffCookie:username=>({name:'portal_staff_session',username,httpOnly:true})},
  })[n]});
  const response=await exports.POST({json:async()=>({username:'test',password:'test-fixture'})});
  assert.equal(response.status,row?200:401);assert.equal(cookies.length,row?1:0);
 }
});

test('both staff login routes distinguish service failure from invalid credentials and hide internal errors',async()=>{
 for(const kind of ['admin','admineng'])for(const failure of ['rpc','throw']){
  const code=ts.transpileModule(readFileSync(new URL(`../app/api/${kind}/login/route.ts`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={},cookies=[];
  vm.runInNewContext(code,{exports,process:{env:{}},require:n=>({
   '@supabase/supabase-js':{createClient:()=>({rpc:async()=>{if(failure==='throw')throw new Error('private connection detail');return {data:null,error:{message:'private connection detail'}};}})},
   'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status||200,cookies:{set:v=>cookies.push(v)}})}},
   '@/lib/portalAuth':{staffCookie:username=>({username})},
  })[n]});
  const result=await exports.POST({json:async()=>({username:'test',password:'test-fixture'})});
  assert.equal(result.status,503);assert.equal(cookies.length,0);assert.ok(!JSON.stringify(result.body).includes('private connection detail'));
 }
});
