import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,createHmac} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const base=process.env.LEARNING_TEST_URL||'https://www.dreamacademyph.com';
assert.ok(['https://www.dreamacademyph.com','http://localhost:3118'].includes(base),'Untrusted verification host');
const checks=[];
for(const file of ['dreamy-intro.mp4','dreamy-intro-poster.webp','dreamy-intro.ko.vtt','dreamy-wave.webp','dreamy-happy.webp']){
 const local=await readFile(new URL('../public/learning/tree-house/'+file,import.meta.url));
 const r=await fetch(base+'/learning/tree-house/'+file,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);
 const remote=Buffer.from(await r.arrayBuffer());const hash=b=>createHash('sha256').update(b).digest('hex');
 assert.equal(hash(remote),hash(local),file);checks.push({asset:file,bytes:local.length,matches:true});
}
const range=await fetch(base+'/learning/tree-house/dreamy-intro.mp4',{headers:{Range:'bytes=0-1023'},signal:AbortSignal.timeout(15000)});assert.equal(range.status,206);assert.equal((await range.arrayBuffer()).byteLength,1024);
for(const [route,method] of [['/api/learning/children','GET'],['/api/staff/learning-assignment','GET'],['/api/staff/learning-assignment','POST']]){
 const r=await fetch(base+route,{method,signal:AbortSignal.timeout(15000)});assert.equal(r.status,401);assert.match(r.headers.get('cache-control')||'',/no-store/);
}
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const admin=await db.from('staff_accounts').select('username').eq('role','korean_admin').eq('is_active',true).order('id').limit(1).single();assert.ifError(admin.error);
const visit=await db.from('care_visits').select('id').order('id').limit(1).single();assert.ifError(visit.error);
const payload=Buffer.from(JSON.stringify({username:admin.data.username,expires:Date.now()+60000})).toString('base64url');
const signature=createHmac('sha256',process.env.STAFF_SESSION_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY).update('portal-staff-v1:'+payload).digest('base64url');
const r=await fetch(base+'/api/staff/learning-assignment?visitId='+visit.data.id,{headers:{Cookie:'portal_staff_session='+payload+'.'+signature},signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);
const data=await r.json();assert.equal(data.canEdit,true);assert.ok(Array.isArray(data.history));assert.ok(data.assignment===null||data.assignment.levelCode);
console.log(JSON.stringify({checks,videoRange:true,anonymousDenied:true,cachePrivate:true,signedStaffRead:true,realStudentWrites:0}));
