import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {issueConfirmation,verifyConfirmation,validVisitDates} from '../lib/student-care/confirmation.ts';
import {canReviewStudents} from '../lib/staffSession.ts';
import {reconcileStudents} from '../lib/student-care/reconcile.ts';
const ts=createRequire(import.meta.url)('typescript');
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor={id:uuid(1),username:'test',role:'korean_admin',name:'Test'},key='test-key';
const booking={id:uuid(2),students:[{id:uuid(3),korName:'테스트'}]};
const student={id:uuid(3),booking_id:uuid(2),name_kr:'테스트',name_en:null};
const token=issueConfirmation({bookingId:booking.id,index:0,students:booking.students,student},actor.id,key);
const body={bookingId:booking.id,index:0,studentId:student.id,token,requestId:uuid(4),start:'2026-09-01',end:'2026-09-30',learnerId:null,confirmed:true};
function route(identity=actor,rpcError=null){
 const calls=[];let reads=0;const exports={};
 const code=ts.transpileModule(readFileSync(new URL('../app/api/staff/student-review/confirm/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const modules={
  'next/server':{NextResponse:{json:(body,init)=>({body,...init})}},
  '@/lib/portalAuth':{getStaffIdentity:async()=>identity,portalDb:()=>({from:table=>({select:()=>({eq:()=>({maybeSingle:async()=>{reads++;return {data:table==='bookings'?booking:student};}})})}),rpc:async(name,args)=>{calls.push(args);return {data:{learnerId:uuid(5),visitId:uuid(6)},error:rpcError};}})},
  '@/lib/staffSession':{canReviewStudents},
  '@/lib/student-care/confirmation':{verifyConfirmation,validVisitDates},
  '@/lib/student-care/reconcile':{reconcileStudents},
 };
 vm.runInNewContext(code,{exports,process:{env:{STAFF_SESSION_SECRET:key}},require:n=>modules[n]});
 return {post:payload=>exports.POST({json:async()=>payload}),calls,reads:()=>reads};
}
test('confirm requires an admin before any source reads',async()=>{
 for(const [identity,status] of [[null,401],[{...actor,role:'local_teacher'},403]]){const r=route(identity);assert.equal((await r.post(body)).status,status);assert.equal(r.reads(),0);assert.equal(r.calls.length,0);}
});
test('invalid periods and unchecked confirmation never reach DB',async()=>{
 for(const change of [{end:'2026-08-01'},{confirmed:false},{studentId:'bad'}]){const r=route();assert.equal((await r.post({...body,...change})).status,400);assert.equal(r.reads(),0);}
});
test('proof rejection prevents mutation and server actor overrides client input',async()=>{
 const bad=route();assert.equal((await bad.post({...body,token:token+'x'})).status,409);assert.equal(bad.calls.length,0);
 const good=route();assert.equal((await good.post({...body,actorId:uuid(99)})).status,200);assert.equal(good.calls[0].p_actor_id,actor.id);assert.equal(good.calls[0].p_request_id,body.requestId);
});
test('source/uniqueness conflicts return retry guidance without leaking SQL',async()=>{
 for(const code of ['40001','23505']){const r=route(actor,{code,message:'private SQL detail'});const response=await r.post(body);assert.equal(response.status,409);assert.ok(!response.body.error.includes('private'));}
});
