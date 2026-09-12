import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {PGlite} from '../artifacts/care-db/node_modules/@electric-sql/pglite/dist/index.js';

const ts=createRequire(import.meta.url)('typescript');
const admin={id:'fixture-admin',username:'fixture-korean',role:'korean_admin',name:'Fixture'};
const sharedIds=['student-care-release-20260912','student-care-auto-directory-20260912','student-care-session-menu-20260912'];
const row={id:'notice-fixture',title:'Team update',text:'<p>Shared update</p>',files:[],date:'2026-09-12',done:false,require_read:false,teacher_shared:true};
const code=ts.transpileModule(readFileSync(new URL('../app/api/staff/notices/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function route({identity=admin,lookupError=false,dbError=false,failRangeAt=null,rows=[row,{...row,id:'private-fixture',teacher_shared:false,done:true}]}={}){
 const calls=[],exports={};
 const db={from:table=>{
  calls.push({operation:'from',table});assert.equal(table,'staff_notices');
  let operation='get',payload=null;const filters=[];
  const query={
   select:fields=>{calls.push({operation:'select',fields});return query;},
   order:()=>query,
   eq:(field,value)=>{filters.push([field,value]);calls.push({operation:'filter',field,value});return query;},
   range:async(start,end)=>{calls.push({operation:'range',start,end});return dbError||failRangeAt===start?{data:null,error:{message:'private SQL detail'}}:{data:rows.filter(item=>filters.every(([field,value])=>item[field]===value)).slice(start,end+1),error:null};},
   upsert:(value,options)=>{operation='upsert';payload=value;calls.push({operation,payload,options});return query;},
   single:async()=>({data:dbError?null:payload,error:dbError?{message:'private SQL detail'}:null}),
   delete:()=>{operation='delete';calls.push({operation});return query;},
   then:(resolve,reject)=>Promise.resolve({error:dbError?{message:'private SQL detail'}:null}).then(resolve,reject),
  };
  return query;
 }};
 vm.runInNewContext(code,{exports,Buffer,URL,require:name=>({
  'next/server':{NextResponse:{json:(body,init={})=>({body,status:init.status||200,headers:init.headers||{}})}},
  '@/lib/portalAuth':{getStaffIdentity:async()=>{if(lookupError)throw Error('private account lookup');return identity;},portalDb:()=>db},
 })[name]});
 return {...exports,calls};
}
function request(method='GET',body=row,search=''){
 return new Request('https://staff.example/api/staff/notices'+search,{method,...(method==='POST'?{headers:{'content-type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)}:{})});
}
function privateResponse(result){assert.match(result.headers['Cache-Control'],/private.*no-store/);assert.equal(result.headers.Vary,'Cookie');}

test('anonymous and unrelated roles cannot read or mutate notices',async()=>{
 for(const identity of [null,{...admin,role:'driver'}])for(const method of ['GET','POST','DELETE']){
  const api=route({identity}),result=await api[method](request(method,row,'?id=notice-fixture'));
  assert.equal(result.status,identity?403:401);assert.equal(api.calls.length,0);privateResponse(result);
 }
});

test('local teachers receive only explicitly shared notices, including archived notices',async()=>{
 const archived={...row,id:'archived-shared',done:true};
 const api=route({identity:{...admin,role:'local_teacher'},rows:[row,{...row,id:'private',teacher_shared:false},archived]});
 const result=await api.GET(request('GET',null,'?role=korean_admin&teacher_shared=false'));
 assert.equal(result.status,200);assert.equal(result.body.isAdmin,false);privateResponse(result);
 assert.deepEqual(Array.from(result.body.notices,n=>n.id),[row.id,archived.id]);
 assert.ok(api.calls.some(c=>c.operation==='filter'&&c.field==='teacher_shared'&&c.value===true));
});

test('admin read includes private and archived notices and loads all result pages',async()=>{
 const rows=Array.from({length:105},(_,i)=>({...row,id:`notice-${i}`,teacher_shared:i%2===0,done:i%3===0}));
 const api=route({rows}),result=await api.GET(request());
 assert.equal(result.status,200);assert.equal(result.body.isAdmin,true);assert.equal(result.body.notices.length,105);
 assert.deepEqual(api.calls.filter(c=>c.operation==='range').map(c=>c.start),[0,100]);
 assert.equal(api.calls.filter(c=>c.operation==='filter').length,0);
 assert.ok(api.calls.filter(c=>c.operation==='select').every(c=>!c.fields.includes('*')));
});

test('local teacher cannot change audience, content, completion, or delete by forging administrator identity',async()=>{
 for(const method of ['POST','DELETE']){
  const api=route({identity:{...admin,role:'local_teacher'}});
  const result=await api[method](request(method,{...row,username:'admin-ceo',role:'korean_admin',actorId:'admin'},'?id=notice-fixture&role=korean_admin'));
  assert.equal(result.status,403);assert.equal(api.calls.length,0);
 }
});

test('admin upsert preserves explicit completion, required-read and sharing fields without touching read records',async()=>{
 const expected={...row,done:true,require_read:true,teacher_shared:false};
 const api=route(),result=await api.POST(request('POST',{...expected,role:'driver',actorId:'someone-else',notice_reads:{secret:['other']}}));
 assert.equal(result.status,200);privateResponse(result);
 assert.deepEqual(JSON.parse(JSON.stringify(result.body.notice)),expected);
 const write=api.calls.find(c=>c.operation==='upsert');
 assert.deepEqual(JSON.parse(JSON.stringify(write.payload)),expected);assert.equal(write.options.onConflict,'id');
 assert.deepEqual(api.calls.filter(c=>c.operation==='from').map(c=>c.table),['staff_notices']);
});

test('malformed, overlong and unsafe notice attachments are rejected before database writes',async()=>{
 const invalid=[null,[],{...row,id:'../../other'},{...row,teacher_shared:undefined},{...row,teacher_shared:'true'},{...row,require_read:'false'},{...row,done:0},{...row,title:'x'.repeat(501)},{...row,text:'x'.repeat(200001)},{...row,files:Array(21).fill({})},{...row,files:[{name:'bad',type:'image/png',url:'javascript:alert(1)'}]},{...row,files:[{name:'bad',type:'image/png',url:'//external.example/file'}]},{...row,files:[{name:'bad',type:'image/svg+xml',data:'data:image/svg+xml;base64,PHN2Zz4='}]},{...row,files:[{name:'bad',type:'image/png',size:-1,url:'https://files.example/file.png'}]}];
 for(const input of invalid){const api=route(),result=await api.POST(request('POST',input));assert.equal(result.status,400);assert.equal(api.calls.length,0);}
 const malformed=route();assert.equal((await malformed.POST(request('POST','{'))).status,400);
 const tooLarge=route();assert.equal((await tooLarge.POST(request('POST',{...row,text:'x'.repeat(1024*1024)}))).status,413);assert.equal(tooLarge.calls.length,0);
});

test('existing inline JPEG and uploaded attachments survive updates without losing data',async()=>{
 const files=[{name:'existing.jpg',type:'image/jpeg',data:'data:image/jpeg;base64,AA=='},{name:'new.pdf',type:'application/pdf',size:120,url:'https://files.example/new.pdf'}];
 const api=route(),result=await api.POST(request('POST',{...row,files}));
 assert.equal(result.status,200);assert.equal(JSON.stringify(result.body.notice.files),JSON.stringify(files));
});

test('admin delete targets one validated id and does not clear reading or task histories',async()=>{
 const api=route(),result=await api.DELETE(request('DELETE',null,'?id=notice-fixture'));
 assert.equal(result.status,200);privateResponse(result);assert.equal(result.body.deleted,true);
 assert.deepEqual(api.calls.filter(c=>c.operation==='filter'),[{operation:'filter',field:'id',value:'notice-fixture'}]);
 assert.deepEqual(api.calls.filter(c=>c.operation==='from').map(c=>c.table),['staff_notices']);
 for(const search of ['', '?id=..%2Fother']){const invalid=route();assert.equal((await invalid.DELETE(request('DELETE',null,search))).status,400);assert.equal(invalid.calls.length,0);}
});

test('lookup and database failures are private 503 responses with no internal details or partial list',async()=>{
 for(const failure of [{lookupError:true},{dbError:true}])for(const method of ['GET','POST','DELETE']){
  const api=route(failure),result=await api[method](request(method,row,'?id=notice-fixture'));
  assert.equal(result.status,503);privateResponse(result);assert.ok(!JSON.stringify(result.body).includes('private'));
  if(failure.lookupError)assert.equal(api.calls.length,0);
 }
 const api=route({rows:Array.from({length:101},(_,i)=>({...row,id:`n-${i}`})),failRangeAt:100});
 const result=await api.GET(request());assert.equal(result.status,503);assert.equal(result.body.notices,undefined);
});

test('migration shares only approved notices, preserves histories and removes anonymous table access',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
   create table public.staff_notices(id text primary key,title text,text text,files jsonb default '[]',date text,done boolean default false,require_read boolean default false);
   alter table public.staff_notices enable row level security;
   create policy "all" on public.staff_notices for all to public using(true) with check(true);
   grant all on public.staff_notices to anon,authenticated,service_role;
   create table public.app_settings(key text primary key,value jsonb);
   insert into public.app_settings values('notice_reads','{"old-notice":["fixture-staff"]}');
   create table public.staff_tasks(id text primary key,done boolean);
   insert into public.staff_tasks values('old-task',true);`);
  for(const id of [...sharedIds,'korean-private','student-care-unreviewed-future'])await db.query('insert into public.staff_notices(id,title,text,date,done,require_read) values($1,$2,$3,$4,$5,$6)',[id,'Existing title','Existing body','2026-09-11',true,true]);
  const before=(await db.query('select id,title,text,files,date,done,require_read from public.staff_notices order by id')).rows;
  const dir=new URL('../supabase/migrations/',import.meta.url),migration=readdirSync(dir).find(name=>name.endsWith('_staff_notices_teacher_sharing.sql'));
  assert.ok(migration);await db.exec(readFileSync(new URL(migration,dir),'utf8'));
  assert.deepEqual((await db.query('select id,title,text,files,date,done,require_read from public.staff_notices order by id')).rows,before);
  assert.deepEqual((await db.query('select id from public.staff_notices where teacher_shared order by id')).rows.map(r=>r.id),[...sharedIds].sort());
  assert.deepEqual((await db.query('select value from public.app_settings where key=$1',['notice_reads'])).rows[0].value,{'old-notice':['fixture-staff']});
  assert.equal((await db.query('select done from public.staff_tasks')).rows[0].done,true);
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`);
   for(const sql of ['select * from public.staff_notices',"insert into public.staff_notices(id) values('unauthorized')","update public.staff_notices set teacher_shared=true","delete from public.staff_notices"]){await assert.rejects(db.query(sql),/permission denied/);}
   await db.exec('reset role');
  }
  await db.exec('set role service_role');
  await db.query("insert into public.staff_notices(id,text) values('new-private','New body')");
  assert.equal((await db.query("select teacher_shared from public.staff_notices where id='new-private'")).rows[0].teacher_shared,false);
  await db.query("update public.staff_notices set teacher_shared=true where id='new-private'");
  await db.query("delete from public.staff_notices where id='new-private'");
 }finally{await db.close();}
});
