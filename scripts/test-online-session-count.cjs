const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path');
const root=path.join(__dirname,'..');
function load(file,req){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:req,process:{env:{}},Date,Set,URL,console});return exports;}
const dates=load('lib/onlineClassSchedule.ts',()=>({}));
const repair=load('lib/onlineSessionRepair.ts',()=>dates);
test('old attendance and stored usage both protect against a smaller renewal',()=>{
 assert.match(repair.onlineSessionCountIssue(15,31,17,33),/총 15회로 변경할 수 없습니다/);
 assert.match(repair.onlineSessionCountIssue(31,31,0,33),/사용 33회/);
 assert.match(repair.onlineSessionCountIssue(31,31,17,31),/예정 수업 17개/);
 assert.equal(repair.onlineSessionCountIssue(15,0,15,0),null);
 assert.equal(repair.onlineSessionCountIssue(31,31,0,31),null);
 for(const n of [0,-1,1.5,NaN,Infinity])assert.match(repair.onlineSessionCountIssue(n,0,0,0),/정수/);
});
test('fresh 15-session enrollment starts September 21 and ends October 23',()=>{
 const plan=repair.planOnlineSessions('2026-09-21',['월','수','금'],15,[],new Set(),[]);
 assert.equal(plan.length,15);assert.equal(plan[0].date,'2026-09-21');assert.equal(plan.at(-1).date,'2026-10-23');
});
test('future makeup preserves its date without pushing the first lessons past it',()=>{
 const history=[{session_number:8,scheduled_date:'2026-09-23'},{session_number:9,scheduled_date:'2026-09-25'}];
 const plan=repair.planOnlineSessions('2026-09-08',['화','수','금'],42,history,new Set(),[]);
 assert.equal(plan.length,40);assert.equal(plan[0].date,'2026-09-08');
 assert.ok(!plan.some(s=>history.some(h=>h.session_number===s.number||h.scheduled_date===s.date)));
});
function route({history=31,scheduled=17,total=48,used=33,authorized=true,failRead=false}={}){
 const writes=[];let enrollment={id:'e',total_sessions:total,used_sessions:used,tutor_id:null,start_date:'2026-09-07',days_of_week:['월','수','금'],class_time_kr:'21:00',class_time_ph:'20:00'};
 let sessions=[...Array.from({length:history},(_,i)=>({id:`h${i}`,enrollment_id:'e',status:'attended',session_number:i+1,scheduled_date:`2026-04-${String(i%20+1).padStart(2,'0')}`})),...Array.from({length:scheduled},(_,i)=>({id:`s${i}`,enrollment_id:'e',status:'scheduled',session_number:history+i+1,scheduled_date:'2026-09-07'}))];
 const db={from(table){let filters=[],op=null,payload,single=false;const q={};
  for(const method of ['select','order'])q[method]=()=>q;
  for(const method of ['eq','neq','gte','in'])q[method]=(field,value)=>{filters.push({method,field,value});return q;};
  for(const method of ['update','upsert','delete','insert'])q[method]=value=>{op=method;payload=value;return q;};
  q.single=()=>{single=true;return q;};q.maybeSingle=q.single;
  q.then=resolve=>{let data=table==='online_enrollments'?[enrollment]:table==='online_sessions'?sessions:[];
   for(const f of filters)data=data.filter(r=>f.method==='eq'?r[f.field]===f.value:f.method==='neq'?r[f.field]!==f.value:f.method==='in'?f.value.includes(r[f.field]):true);
   if(op){writes.push({table,op,payload});if(table==='online_enrollments'&&op==='update')Object.assign(enrollment,payload);if(table==='online_sessions'&&op==='upsert')sessions=[...sessions.filter(s=>s.status!=='scheduled'),...payload];}
   return Promise.resolve({data:single?data[0]||null:data,error:failRead&&!op&&table==='online_sessions'?{message:'unavailable'}:null}).then(resolve);
  };return q;}};
 const api=load('app/api/online-class/enrollments/route.ts',name=>name==='@supabase/supabase-js'?{createClient:()=>db}:name==='next/server'?{NextResponse:{json:(body,opt)=>({body,status:opt?.status||200})}}:name.endsWith('/portalAuth')?{isPortalAdmin:async()=>authorized}:name.endsWith('/onlineSessionRepair')?repair:dates);
 return {...api,writes,getEnrollment:()=>enrollment};
}
const request=body=>({json:async()=>body});
test('PATCH rejects inconsistent count before ANY database mutation',async()=>{
 const r=route();const res=await r.PATCH(request({id:'e',start_date:'2026-09-21',total_sessions:15,regenerate_sessions:true}));
 assert.equal(res.status,409);assert.equal(res.body.code,'SESSION_COUNT_CONFLICT');assert.equal(r.writes.length,0);assert.equal(r.getEnrollment().start_date,'2026-09-07');
});
test('count edits without a regenerate flag are protected too',async()=>{const r=route();assert.equal((await r.PATCH(request({id:'e',total_sessions:15}))).status,409);assert.equal(r.writes.length,0);});
test('an already inconsistent enrollment cannot silently report zero regenerated',async()=>{const r=route({total:15});assert.equal((await r.PATCH(request({id:'e',regenerate_sessions:true}))).status,409);assert.equal(r.writes.length,0);});
test('read failures and expired authentication do not write',async()=>{for(const opt of [{failRead:true},{authorized:false}]){const r=route(opt);assert.ok((await r.PATCH(request({id:'e',regenerate_sessions:true}))).status>=400);assert.equal(r.writes.length,0);}});
test('valid fresh course updates dates and keeps all 15 planned lessons',async()=>{
 const r=route({history:0,scheduled:15,total:15,used:0});const res=await r.PATCH(request({id:'e',start_date:'2026-09-21',total_sessions:15,regenerate_sessions:true}));
 assert.equal(res.status,200,JSON.stringify(res.body));assert.equal(res.body.sessions_regenerated,15);assert.equal(r.getEnrollment().end_date,'2026-10-23');
 const rows=r.writes.find(w=>w.op==='upsert').payload;assert.equal(rows[0].scheduled_date,'2026-09-21');assert.ok(rows.every(s=>s.scheduled_time_kr==='21:00'));
});
test('existing history remains untouched while valid total and start date update scheduled lessons',async()=>{
 const r=route({used:31});const res=await r.PATCH(request({id:'e',start_date:'2026-09-21',total_sessions:46,regenerate_sessions:true}));
 assert.equal(res.status,200,JSON.stringify(res.body));assert.equal(res.body.sessions_regenerated,15);
 const rows=r.writes.find(w=>w.op==='upsert').payload;
 assert.equal(rows[0].scheduled_date,'2026-09-21');assert.equal(rows[0].session_number,32);
 assert.ok(rows.every(s=>s.id.startsWith('s')&&s.status==='scheduled'));
 assert.equal(r.getEnrollment().used_sessions,31);
});
test('legacy usage above visible history is preserved and does not grant extra sessions',async()=>{
 const r=route({history:31,used:33,total:48});const res=await r.PATCH(request({id:'e',start_date:'2026-09-21',regenerate_sessions:true}));
 assert.equal(res.status,200);assert.equal(res.body.sessions_regenerated,15);assert.equal(r.getEnrollment().used_sessions,33);
 assert.match(repair.onlineSessionCountIssue(33,31,17,33),/모두 채워져/);
});
function pageFunction(name,scope){
 const source=fs.readFileSync(path.join(root,'app/admin/online-class/[id]/page.tsx'),'utf8');
 const sf=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found;
 function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)found=node.getText(sf);ts.forEachChild(node,visit);}visit(sf);
 assert.ok(found);const code=ts.transpileModule(found,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return vm.runInNewContext(code+`;${name}`,scope);
}
test('forced recovery sends the unsaved form including weekday times; failure preserves draft',async()=>{
 let sent,error,loads=0;const form={start_date:'2026-09-21',total_sessions:'15',days_of_week:['월','수','금'],class_time_kr:'21:00',duration_weeks:'',class_duration_weeks:''};
 const scope={form,saving:false,id:'e',enr:{...form,start_date:'2026-09-07'},dayTimesOn:true,dayTimes:{월:'20:00',수:'21:00',금:'21:00'},subHour:t=>t==='21:00'?'20:00':'19:00',setSaving:()=>{},setSaveError:x=>error=x,show:()=>{},load:async()=>loads++,fetch:async(url,options)=>{sent=JSON.parse(options.body);return {ok:false,json:async()=>({error:'count conflict'})};}};
 await pageFunction('save',scope)(true);assert.equal(sent.start_date,'2026-09-21');assert.equal(sent.total_sessions,15);assert.equal(sent.regenerate_sessions,true);assert.equal(sent.day_times.월,'20:00');assert.equal(error,'count conflict');assert.equal(loads,0);assert.equal(form.total_sessions,'15');
});
