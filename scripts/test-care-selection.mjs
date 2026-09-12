import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const ts=createRequire(import.meta.url)('typescript');
function load(path,modules={}){
 const exports={};
 const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,URL,Error,require:name=>{assert.ok(name in modules,`unexpected ${name}`);return modules[name];}});return exports;
}
const selection=load('../lib/student-care/selection.ts');
const bookingId='00000000-0000-4000-8000-000000000001';
const actor={id:'current-server-actor',role:'korean_admin'};
const entries=[{id:'sibling-a',korName:'Same name',engName:'First child'},{id:'sibling-b',korName:'Same name',engName:'Second child'}];
const roster={isAdmin:true,visits:[{id:'visit-a',learner_id:'learner-a',name_en:'First child'},{id:'visit-b',learner_id:'learner-b',name_en:'Second child'},{id:'previous-b',learner_id:'learner-b',name_en:'Second child'}],pendingStudents:[{id:'unrelated-source'}],sourceCount:4,teachers:[{id:'teacher',name:'Fixture teacher'}]};
const normalize=value=>JSON.parse(JSON.stringify(value));
function url(params={bookingId,sourceIndex:'1',sourceId:'sibling-b'}){return 'https://staff.example/api/staff/students?'+new URLSearchParams(params);}
function harness({staff=actor,staffFailure=false,booking={id:bookingId,students:entries,academy_start:'2026-09-01',academy_end:'2026-09-30'},link={learner_id:'learner-b',visit_id:'visit-b',legacy_student_id:'sibling-b'},directory=roster,failure=null}={}){
 const calls=[];
 const db={rpc:async(name,args)=>{calls.push({kind:'rpc',name,args});if(failure===name)return {data:null,error:{message:'private query detail'}};return {data:name==='sync_care_directory'?{linked:0}:directory,error:null};},from:table=>{
  const filters=[];calls.push({kind:'read',table,filters});
  const query={select:()=>query,eq:(field,value)=>{filters.push([field,value]);return query;},maybeSingle:async()=>{
   if(failure===table)return {data:null,error:new Error('private query detail')};
   if(table==='bookings')return {data:booking,error:null};if(table==='care_links')return {data:link,error:null};throw Error(`unexpected table ${table}`);
  }};return query;
 }};
 const api=load('../app/api/staff/students/route.ts',{
  'next/server':{NextResponse:{json:(body,init={})=>({body,status:init.status||200,headers:init.headers||{}})}},
  '@/lib/portalAuth':{getStaffIdentity:async()=>{if(staffFailure)throw Error('private sign-in detail');return staff;},portalDb:()=>db},
  '@/lib/student-care/selection':selection,
 });return {...api,db,calls};
}
function privateResponse(result){assert.match(result.headers['Cache-Control'],/no-store/);assert.equal(result.headers.Vary,'Cookie');}

test('parser preserves the full-directory default and optional source ID',()=>{
 assert.equal(selection.readCareSelection('https://staff.example/api/staff/students?query=fixture'),null);
 assert.deepEqual(normalize(selection.readCareSelection(url())),{bookingId,sourceIndex:1,sourceId:'sibling-b'});
 assert.deepEqual(normalize(selection.readCareSelection(url({bookingId,sourceIndex:'0'}))),{bookingId,sourceIndex:0,sourceId:null});
});
test('malformed selection fails before any source or roster query',async()=>{
 for(const params of [{sourceId:'sibling-b'},{bookingId},{bookingId:'bad',sourceIndex:'1'},{bookingId,sourceIndex:'-1'},{bookingId,sourceIndex:'1.0'},{bookingId,sourceIndex:'1e2'},{bookingId,sourceIndex:'1000'},{bookingId,sourceIndex:'1',sourceId:'x'.repeat(101)}])for(const method of ['GET','POST']){
  const api=harness(),result=await api[method]({url:url(params)});assert.equal(result.status,400);assert.equal(api.calls.length,0);privateResponse(result);
 }
});
test('anonymous, unrelated roles and teachers cannot access administrator selection even with forged query role',async()=>{
 for(const [staff,status] of [[null,401],[{...actor,role:'driver'},403],[{...actor,role:'local_teacher'},403]])for(const method of ['GET','POST']){
  const api=harness({staff}),result=await api[method]({url:url()+'&role=korean_admin'});assert.equal(result.status,status);assert.equal(api.calls.length,0);privateResponse(result);
 }
 const directory={isAdmin:false,visits:[{id:'assigned-visit',learner_id:'assigned-learner'}]},api=harness({staff:{...actor,role:'local_teacher'},directory});
 const result=await api.GET({url:'https://staff.example/api/staff/students'});assert.equal(result.status,200);assert.equal(result.body,directory);assert.deepEqual(api.calls.map(c=>c.kind),['rpc']);
});
test('same-name sibling selection returns only selected learner visits, including their previous visit',async()=>{
 const api=harness(),result=await api.GET({url:url()});assert.equal(result.status,200);privateResponse(result);
 assert.deepEqual(Array.from(result.body.visits,v=>v.id),['visit-b','previous-b']);assert.equal(result.body.pendingStudents.length,0);assert.equal(result.body.sourceCount,1);assert.equal(result.body.selection.visitId,'visit-b');assert.equal(result.body.teachers,roster.teachers);
 assert.deepEqual(api.calls.filter(c=>c.kind==='read').map(c=>({table:c.table,filters:c.filters})),[{table:'bookings',filters:[['id',bookingId]]},{table:'care_links',filters:[['booking_id',bookingId],['source_index',1]]}]);
 assert.deepEqual(api.calls.filter(c=>c.kind==='rpc').map(c=>c.name),['get_care_directory']);assert.equal(roster.visits.length,3);assert.equal(roster.pendingStudents.length,1);
});
test('JSON string student arrays and legacy student_id/name_kr fields select the same child',async()=>{
 const students=JSON.stringify([{id:'sibling-a',name_kr:'First child'},{student_id:'sibling-b',name_kr:'Second child',name_en:'Fixture B'}]);
 const result=await harness({booking:{id:bookingId,students}}).GET({url:url()});assert.equal(result.status,200);assert.equal(result.body.selection.name,'Second child');assert.equal(result.body.selection.visitId,'visit-b');
});
test('unlinked selection returns only its own pending student and original visit dates',async()=>{
 const result=await harness({link:null}).GET({url:url()});assert.equal(result.status,200);assert.equal(result.body.visits.length,0);assert.equal(result.body.pendingStudents.length,1);assert.equal(result.body.selection.visitId,null);
 const pending=result.body.pendingStudents[0];assert.equal(pending.id,`${bookingId}:1`);assert.equal(pending.name_en,'Second child');assert.equal(pending.start_date,'2026-09-01');assert.equal(pending.end_date,'2026-09-30');
 assert.ok(!JSON.stringify(result.body).includes('unrelated-source'));assert.ok(!JSON.stringify(result.body).includes('First child'));
 const booking={id:bookingId,students:[{name_kr:'Legacy child'}]},path=url({bookingId,sourceIndex:'0'});
 assert.equal((await harness({booking,link:null}).GET({url:path})).status,200);assert.equal((await harness({booking}).GET({url:path})).status,409);
});
test('changed IDs, conflicting source IDs and sibling links are rejected without returning another child',async()=>{
 const cases=[{config:{},path:url({bookingId,sourceIndex:'1',sourceId:'sibling-a'})},{config:{booking:{id:bookingId,students:[entries[0],{...entries[1],id:'changed-id'}]}},path:url()},{config:{booking:{id:bookingId,students:[entries[0],{...entries[1],student_id:'conflicting-id'}]}},path:url()},{config:{link:{learner_id:'learner-a',visit_id:'visit-a',legacy_student_id:'sibling-a'}},path:url()}];
 for(const {config,path} of cases){const result=await harness(config).GET({url:path});assert.equal(result.status,409);assert.equal(result.body.visits,undefined);assert.ok(!JSON.stringify(result.body).includes('First child'));privateResponse(result);}
});
test('missing booking, removed array slot and malformed source data never fall back to full roster',async()=>{
 const missing=await harness({booking:null}).GET({url:url()});assert.equal(missing.status,404);assert.equal(missing.body.visits,undefined);
 for(const students of ['{bad',{},[entries[0]],[entries[0],null],[entries[0],'unexpected'],[entries[0],[]]]){
  const api=harness({booking:{id:bookingId,students}}),result=await api.GET({url:url()});assert.equal(result.status,409);assert.equal(result.body.visits,undefined);assert.equal(api.calls.filter(c=>c.kind==='read'&&c.table==='care_links').length,0);
 }
});
test('a linked visit missing from the returned roster is a conflict and the selector also enforces admin role',async()=>{
 const directory={...roster,visits:roster.visits.filter(v=>v.id!=='visit-b')};assert.equal((await harness({directory}).GET({url:url()})).status,409);
 await assert.rejects(selection.selectCareStudent(harness().db,{...roster,isAdmin:false},selection.readCareSelection(url())),e=>e instanceof selection.SelectionError&&e.status===403);
});
test('scoped POST refresh returns only selected learner and performs no global synchronization',async()=>{
 const api=harness(),result=await api.POST({url:url()+'&actorId=forged'});assert.equal(result.status,200);assert.equal(result.body.sync.linked,0);assert.deepEqual(Array.from(result.body.roster.visits,v=>v.id),['visit-b','previous-b']);
 assert.deepEqual(api.calls.filter(c=>c.kind==='rpc').map(c=>c.name),['get_care_directory']);assert.ok(api.calls.filter(c=>c.kind==='rpc').every(c=>c.args.p_actor_id===actor.id));
 const stale=harness(),staleResult=await stale.POST({url:url({bookingId,sourceIndex:'1',sourceId:'old-id'})});assert.equal(staleResult.status,409);assert.ok(!stale.calls.some(c=>c.name==='sync_care_directory'));
});
test('session, roster and source DB errors return private 503 without internal details or partial data',async()=>{
 for(const config of [{staffFailure:true},{failure:'get_care_directory'},{failure:'bookings'},{failure:'care_links'}])for(const method of ['GET','POST']){
  const api=harness(config),result=await api[method]({url:url()});assert.equal(result.status,503);privateResponse(result);assert.equal(result.body.visits,undefined);assert.equal(result.body.roster,undefined);assert.ok(!JSON.stringify(result.body).includes('private'));if(config.staffFailure)assert.equal(api.calls.length,0);
 }
});
