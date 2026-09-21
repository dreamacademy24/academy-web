const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict');
let staff={role:'korean_admin'};const rows=new Map(),ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'];
function db(){return {from(table){return {select(){return {eq(_,key){return {async maybeSingle(){return {data:table==='bookings'?(ids.includes(key)?{id:key}:null):rows.has(key)?{value:structuredClone(rows.get(key))}:null};}};}};},insert(row){return {async select(){if(rows.has(row.key))return {error:{code:'23505'}};rows.set(row.key,row.value);return {data:[{key:row.key}]};}};},update(row){let key,previous;const q={eq(col,val){if(col==='key')key=val;else previous=val;return q;},async select(){if(JSON.stringify(rows.get(key))!==previous)return {data:[]};rows.set(key,row.value);return {data:[{key}]};}};return q;}};}};}
function compile(path,require){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require,URL,Date});return exports;}
const lib=compile('lib/dreamhouseChecklist.ts',()=>{}),api=compile('app/api/dreamhouse/checklist/route.ts',name=>name==='next/server'?{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}}:name.includes('portalAuth')?{getStaffIdentity:async()=>staff,portalDb:db}:lib);
const req=(query='',body)=>({url:'https://example.com/api/dreamhouse/checklist'+query,json:async()=>body});
(async()=>{
 const original=(await api.GET(req())).body.template;
 assert.equal((await api.PUT(req('',original))).status,400);
 assert.equal((await api.PUT(req('?scope=shared',original))).status,200);
 const a=(await api.GET(req('?bookingId='+ids[0]))).body.template;assert.equal(a.revision,0);
 a.common[0].title='Only A';const payload={...a,fields:{guest:'TEST',date:'',house:'',beds:'',inspector:'',notes:'Reservation note'},variant:'daon'};
 assert.equal((await api.PUT(req('?bookingId='+ids[0],payload))).status,200);
 assert.equal((await api.PUT(req('?bookingId='+ids[0],payload))).status,409);
 assert.equal((await api.GET(req('?bookingId='+ids[0]))).body.fields.notes,'Reservation note');
 assert.notEqual((await api.GET(req('?bookingId='+ids[1]))).body.template.common[0].title,'Only A');
 assert.notEqual((await api.GET(req())).body.template.common[0].title,'Only A');
 const shared=(await api.GET(req())).body.template;shared.common[0].title='New shared';await api.PUT(req('?scope=shared',shared));
 assert.equal((await api.GET(req('?bookingId='+ids[0]))).body.template.common[0].title,'Only A');
 assert.equal((await api.GET(req('?bookingId='+ids[1]))).body.template.common[0].title,'New shared');
 assert.equal((await api.GET(req('?bookingId=invalid'))).status,404);staff=null;assert.equal((await api.PUT(req('?scope=shared',shared))).status,401);
 console.log('PASS shared/booking isolation, inherited defaults, saved fields, stale revision conflict, invalid booking and anonymous denial');
})().catch(e=>{console.error(e);process.exitCode=1;});
