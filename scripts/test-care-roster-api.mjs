import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {canReviewStudents} from '../lib/staffSession.ts';
const ts=createRequire(import.meta.url)('typescript');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor={id:id(1),role:'korean_admin'};
const payload={requestId:id(2),visitId:id(3),teacherId:id(4),active:true,previousId:null};
function route(file,identity=actor,error=null){
 const exports={},calls=[];
 const code=ts.transpileModule(readFileSync(new URL(`../app/api/staff/students/${file}route.ts`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const modules={'next/server':{NextResponse:{json:(body,init)=>({body,...init})}},'@/lib/staffSession':{canReviewStudents},'@/lib/portalAuth':{getStaffIdentity:async()=>identity,portalDb:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:{visits:[]},error};}})}};
 vm.runInNewContext(code,{exports,require:n=>modules[n]});return {exports,calls};
}
test('anonymous and unrelated roles are denied before any database access',async()=>{
 for(const [who,status] of [[null,401],[{...actor,role:'driver'},403]])for(const file of ['','assign/']){
  const r=route(file,who);const result=await(file?r.exports.POST({json:async()=>payload}):r.exports.GET({}));assert.equal(result.status,status);assert.equal(r.calls.length,0);
 }
});
test('local teacher can load scoped roster but cannot change assignments',async()=>{
 const who={...actor,role:'local_teacher'},get=route('',who),post=route('assign/',who);
 assert.equal((await get.exports.GET({})).status,200);assert.equal(get.calls[0].args.p_actor_id,who.id);
 assert.equal((await post.exports.POST({json:async()=>payload})).status,403);assert.equal(post.calls.length,0);
});
test('malformed assignment never reaches RPC; client cannot choose actor',async()=>{
 for(const change of [{active:'true'},{previousId:undefined},{teacherId:'bad'}]){
  const r=route('assign/');assert.equal((await r.exports.POST({json:async()=>({...payload,...change})})).status,400);assert.equal(r.calls.length,0);
 }
 const r=route('assign/');assert.equal((await r.exports.POST({json:async()=>({...payload,actorId:id(99)})})).status,200);assert.equal(r.calls[0].args.p_actor_id,actor.id);
});
test('stale writes return conflict; errors hide details and responses disable caching',async()=>{
 const r=route('assign/',actor,{code:'40001',message:'sensitive'});const res=await r.exports.POST({json:async()=>payload});assert.equal(res.status,409);assert.equal(res.headers['Cache-Control'],'private, no-store');assert.ok(!JSON.stringify(res).includes('sensitive'));
 const g=route('',actor,{code:'internal',message:'sensitive'});const out=await g.exports.GET({});assert.equal(out.status,503);assert.ok(!JSON.stringify(out).includes('sensitive'));
});
