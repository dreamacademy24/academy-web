import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import * as sessions from '../lib/staffSession.ts';
import {staffDestination} from '../lib/staffNavigation.ts';

const ts=createRequire(import.meta.url)('typescript');
const key='session-refresh-fixture-key-never-used-in-production';
const issuedAt=1900000000000,now=issuedAt+3600000;
const staff={id:'fixture-staff-id',username:'fixture-staff',name:'Fixture Staff',role:'korean_admin'};
const token=sessions.signStaffSession(staff.username,key,issuedAt);
function request(value=token,options={}){
 return new Request('https://staff.example/api/staff/session',{
  method:'POST',headers:{'Content-Type':'application/json',...(value?{cookie:`${sessions.STAFF_COOKIE}=${value}`} :{}),...(options.origin?{origin:options.origin}:{})},
  body:JSON.stringify(options.body||{}),
 });
}
function loadModule(path,modules,extras={}){
 const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(code,{exports,require:name=>{assert.ok(name in modules,`unexpected module ${name}`);return modules[name];},...extras});
 return exports;
}
function endpoint({identity=staff,lookupError=null,at=now}={}){
 const cookies=[],lookups=[],renewals=[];
 const portal=loadModule('../lib/portalAuth.ts',{
  '@supabase/supabase-js':{createClient:()=>{throw Error('Unexpected database access');}},
  'next/server':{},
  './staffSession':sessions,
 },{process:{env:{STAFF_SESSION_SECRET:key,NODE_ENV:'production'}}});
 const route=loadModule('../app/api/staff/session/route.ts',{
  'next/server':{NextResponse:{json:(body,init={})=>({body,status:init.status||200,headers:init.headers||{},cookies:{set:cookie=>cookies.push(cookie)}})}},
  '@/lib/portalAuth':{
   getStaffIdentity:req=>sessions.resolveStaffSession(req,key,async username=>{lookups.push(username);if(lookupError)throw lookupError;return identity;},at),
   staffCookie:username=>{renewals.push(username);return portal.staffCookie(username);},
  },
 });
 return {...route,cookies,lookups,renewals};
}
function assertPrivate(result){
 assert.match(result.headers['Cache-Control'],/private/);
 assert.match(result.headers['Cache-Control'],/no-store/);
 assert.equal(result.headers.Vary,'Cookie');
}

test('invalid, expired and cross-origin signatures are denied without looking up or renewing a session',async()=>{
 const cases=[request(null),request(`${token}x`),request(`${token}.extra`),request(sessions.signStaffSession(staff.username,'another-fixture-key',issuedAt)),request(token,{origin:'https://external.example'})];
 for(const req of cases){
  const api=endpoint();const result=await api.POST(req);
  assert.equal(result.status,401);assertPrivate(result);
  assert.equal(api.lookups.length,0);assert.equal(api.cookies.length,0);assert.equal(api.renewals.length,0);
 }
 const expired=endpoint({at:issuedAt+8*3600000});
 assert.equal((await expired.POST(request())).status,401);
 assert.equal(expired.lookups.length,0);assert.equal(expired.cookies.length,0);
});

test('valid current admin and teacher sessions renew the server cookie and return current identity only',async()=>{
 for(const role of ['korean_admin','local_teacher']){
  const identity={...staff,role,privateField:'must-not-leak'},api=endpoint({identity});
  const result=await api.POST(request(token,{origin:'https://staff.example'}));
  assert.equal(result.status,200);assertPrivate(result);
  assert.equal(JSON.stringify(result.body),JSON.stringify({staff:{username:staff.username,name:staff.name,role}}));
  assert.deepEqual(api.lookups,[staff.username]);assert.deepEqual(api.renewals,[staff.username]);
  assert.equal(api.cookies.length,1);
  const cookie=api.cookies[0];
  assert.equal(cookie.name,sessions.STAFF_COOKIE);assert.equal(cookie.httpOnly,true);assert.equal(cookie.secure,true);assert.equal(cookie.sameSite,'strict');assert.equal(cookie.path,'/');assert.ok(cookie.maxAge>0);
  const resolved=await sessions.resolveStaffSession(request(cookie.value),key,async username=>({...staff,username}),Date.now());
  assert.equal(resolved.username,staff.username);
 }
});

test('inactive accounts and current disallowed roles cannot renew an otherwise correctly signed session',async()=>{
 for(const [identity,status] of [[null,401],[{...staff,role:'driver'},403]]){
  const api=endpoint({identity}),result=await api.POST(request());
  assert.equal(result.status,status);assertPrivate(result);assert.deepEqual(api.lookups,[staff.username]);
  assert.equal(api.cookies.length,0);assert.equal(api.renewals.length,0);
 }
});

test('client-supplied identity cannot create a missing session or elevate the current server role',async()=>{
 const payload={username:'admin-ceo',role:'korean_admin',adminToken:'da-admin-forged',staff:{username:'admin-ceo',role:'korean_admin'}};
 const missing=endpoint();assert.equal((await missing.POST(request(null,{body:payload}))).status,401);
 assert.equal(missing.cookies.length,0);assert.equal(missing.lookups.length,0);
 const teacher=endpoint({identity:{...staff,role:'local_teacher'}}),req=request(token,{body:payload});
 req.json=async()=>{throw Error('Refresh must not inspect client identity');};
 const result=await teacher.POST(req);
 assert.equal(result.status,200);assert.equal(result.body.staff.role,'local_teacher');assert.equal(result.body.staff.username,staff.username);
 assert.deepEqual(teacher.renewals,[staff.username]);
});

test('directory lookup outages propagate from session verification and become private 503 without cookie changes',async()=>{
 const failure=new Error('private database connection detail');
 await assert.rejects(sessions.resolveStaffSession(request(),key,async()=>{throw failure;},now),error=>error===failure);
 const api=endpoint({lookupError:failure}),result=await api.POST(request());
 assert.equal(result.status,503);assertPrivate(result);assert.equal(api.cookies.length,0);assert.equal(api.renewals.length,0);
 assert.ok(!JSON.stringify(result.body).includes(failure.message));
});

test('staff return navigation preserves the correct student page and admin iframe query',()=>{
 const frame='/admin/view?src=%2Fstaff%2Fstudents';
 assert.equal(staffDestination('korean_admin',frame),frame);
 assert.equal(staffDestination('korean_admin','/staff/student-review?filter=conflict#list'),'/staff/student-review?filter=conflict#list');
 assert.equal(staffDestination('local_teacher','/staff/students'),'/staff/students');
 assert.equal(staffDestination('local_teacher','/admineng/hub'),'/admineng/hub');
});

test('return navigation enforces role boundaries and rejects login loops and external destinations',()=>{
 const unsafe=[undefined,null,123,'https://external.example/','//external.example/path','/\\external.example/path','/admin/\nview','/login','/api/admin/login','/admin/../login'];
 for(const role of ['korean_admin','local_teacher'])for(const next of unsafe){
  assert.equal(staffDestination(role,next),role==='korean_admin'?'/admin/hub':'/admineng/hub',`${role}: ${String(next)}`);
 }
 assert.equal(staffDestination('local_teacher','/admin/bookings'),'/admineng/hub');
 assert.equal(staffDestination('local_teacher','/staff/student-review'),'/admineng/hub');
 assert.equal(staffDestination('local_teacher','/admin/view?src=%2Fstaff%2Fstudents'),'/admineng/hub');
});

test('admin iframe return navigation rejects external and malformed embedded sources',()=>{
 for(const src of ['https://external.example/','//external.example/path','/\\external.example/path','/staff\u0000/students']){
  assert.equal(staffDestination('korean_admin',`/admin/view?src=${encodeURIComponent(src)}`),'/admin/hub',src);
 }
});

test('admin return navigation cannot re-enter a nested iframe that points to an external site',()=>{
 for(const src of ['/admin/view?src=https%3A%2F%2Fexternal.example','/admin/view?src=%2Fstaff%2Fstudents','/admin/other/../view?src=https%3A%2F%2Fexternal.example']){
  assert.equal(staffDestination('korean_admin',`/admin/view?src=${encodeURIComponent(src)}`),'/admin/hub',src);
 }
});

function sessionClient(window,initial={}){
 const values=new Map(Object.entries(initial)),networkCalls=[],adminChanges=[];
 const exports=loadModule('../lib/staffSessionClient.ts',{
  './adminAuth':{setAdminAuthed:(...args)=>adminChanges.push(args)},
 },{
  window,localStorage:{removeItem:key=>values.delete(key),setItem:(key,value)=>values.set(key,value),getItem:key=>values.get(key)||null},
  fetch:(...args)=>{networkCalls.push(args);throw Error('Metadata cleanup must not log out the server');},
 });
 return {...exports,values,networkCalls,adminChanges};
}
function location(path,origin='https://staff.example'){
 const parsed=new URL(path,origin),assignments=[];
 return {origin:parsed.origin,pathname:parsed.pathname,search:parsed.search,hash:parsed.hash,assignments,assign:url=>assignments.push(url)};
}

test('sign-in leaves the same-origin iframe and preserves the complete top-level student return URL',()=>{
 const top={location:location('/admin/view?src=%2Fstaff%2Fstudents#visit-list')};
 const frame={location:location('/staff/students'),top};
 sessionClient(frame).openStaffSignIn();
 assert.equal(frame.location.assignments.length,0);
 assert.equal(top.location.assignments.length,1);
 const navigation=new URL(top.location.assignments[0],top.location.origin);
 assert.equal(navigation.pathname,'/login');
 assert.equal(navigation.searchParams.get('next'),'/admin/view?src=%2Fstaff%2Fstudents#visit-list');
});

test('standalone and inaccessible cross-origin frames preserve their own safe return page',()=>{
 const standalone={location:location('/staff/student-review?filter=conflict#records')};standalone.top=standalone;
 const foreign={location:location('/staff/students?name=fixture#visits'),top:{location:location('/outside','https://external.example')}};
 const inaccessible={location:location('/staff/students#list'),top:{get location(){throw Error('Cross-origin frame access');}}};
 for(const frame of [standalone,foreign,inaccessible]){
  sessionClient(frame).openStaffSignIn();
  assert.equal(frame.location.assignments.length,1);
  const navigation=new URL(frame.location.assignments[0],frame.location.origin);
  assert.equal(navigation.pathname,'/login');
  assert.equal(navigation.searchParams.get('next'),frame.location.pathname+frame.location.search+frame.location.hash);
 }
 assert.equal(foreign.top.location.assignments.length,0);
});

test('clearing stale staff metadata does not log out the server or remove unrelated browser data',()=>{
 const client=sessionClient({}, {adminToken:'stale-token',adminInfo:'stale-admin',teacherSession:'stale-teacher','learning-progress':'preserve-learning','sb-user-session':'preserve-guest-login'});
 client.clearStoredStaffIdentity();
 assert.equal(client.networkCalls.length,0);assert.equal(client.adminChanges.length,0);
 assert.deepEqual(Object.fromEntries(client.values),{'learning-progress':'preserve-learning','sb-user-session':'preserve-guest-login'});
 client.clearStoredStaffIdentity();
 assert.equal(client.networkCalls.length,0);assert.equal(client.values.size,2);
});
