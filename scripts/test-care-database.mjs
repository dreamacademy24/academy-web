// Isolated PostgreSQL/WASM only. No network, credentials or production data.
import {PGlite} from '../artifacts/care-db/node_modules/@electric-sql/pglite/dist/index.js';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create table public.staff_accounts(id uuid primary key,role text,is_active boolean);
create table public.bookings(id uuid primary key,students jsonb,reservation_no text);
create table public.students(id uuid primary key,booking_id uuid,name_kr text,name_en text,level text);
grant select,insert,update on public.bookings,public.students to service_role;
grant select on public.staff_accounts to service_role;`);
await db.exec(readFileSync(new URL('../supabase/migrations/20260912055458_student_care_confirmed_visits.sql',import.meta.url),'utf8'));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor=id(1),local=id(2);
await db.query('insert into public.staff_accounts values ($1,$2,true),($3,$4,true)',[actor,'korean_admin',local,'local_teacher']);
async function source(n){
 const bookingId=id(100+n),studentId=id(200+n),students=[{id:studentId,korName:'테스트학생'}];
 const student={id:studentId,booking_id:bookingId,name_kr:'테스트학생',name_en:null};
 await db.query('insert into public.bookings values($1,$2,$3)',[bookingId,JSON.stringify(students),'TEST']);
 await db.query('insert into public.students values($1,$2,$3,null,$4)',[studentId,bookingId,'테스트학생','junior']);
 return {bookingId,studentId,students,student};
}
async function confirm(s,request=900,target=null,who=actor){
 const result=await db.query('select public.confirm_care_student_link($1,$2,$3,0,$4,$5,$6,$7,$8,$9) as result',[id(request),who,s.bookingId,s.studentId,JSON.stringify(s.students),JSON.stringify(s.student),'2026-09-01','2026-09-30',target]);
 return result.rows[0].result;
}
const counts=async()=> (await db.query('select (select count(*)::int from care_learners) learners,(select count(*)::int from care_visits) visits,(select count(*)::int from care_links) links,(select count(*)::int from care_audit) audits')).rows[0];
test('anonymous and authenticated roles cannot read registry or call confirmation',async()=>{
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  await assert.rejects(db.query('select * from public.care_learners'),/permission denied/);
  await assert.rejects(db.query('select public.confirm_care_student_link(null,null,null,0,null,null,null,null,null,null)'),/permission denied/);
  await db.exec('reset role');
 }
});
let first;
test('service call creates learner, visit, link, audit; retry is idempotent',async()=>{
 const s=await source(1);await db.exec('set role service_role');first=await confirm(s);
 const retry=await confirm(s);assert.equal(retry.alreadyConfirmed,true);assert.equal(first.learnerId,retry.learnerId);
 assert.deepEqual(await counts(),{learners:1,visits:1,links:1,audits:1});
 await assert.rejects(confirm(s,901),/CARE_ALREADY_LINKED/);await db.exec('reset role');
});
test('return visit keeps same learner and adds a separate period',async()=>{
 const s=await source(2);await db.exec('set role service_role');const r=await confirm(s,902,first.learnerId);
 assert.equal(r.learnerId,first.learnerId);assert.notEqual(r.visitId,first.visitId);
 assert.deepEqual(await counts(),{learners:1,visits:2,links:2,audits:2});await db.exec('reset role');
});
test('stale source, non-admin actor, and conflicting request reuse are rejected',async()=>{
 const s=await source(3);await db.query('update bookings set students=$1 where id=$2',[JSON.stringify([{...s.students[0],korName:'변경'}]),s.bookingId]);
 await db.exec('set role service_role');
 await assert.rejects(confirm(s,903),/CARE_SOURCE_CHANGED/);
 await assert.rejects(confirm(s,904,null,local),/CARE_FORBIDDEN/);
 await assert.rejects(confirm(s,900),/CARE_REQUEST_CONFLICT/);
 assert.deepEqual(await counts(),{learners:1,visits:2,links:2,audits:2});await db.exec('reset role');
});
test('audit insertion failure rolls back every preceding registry insert',async()=>{
 const s=await source(4);
 await db.exec(`create function public.test_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'TEST_AUDIT_FAILURE';end;$$;
 create trigger test_fail before insert on public.care_audit for each row execute function public.test_fail_audit();set role service_role;`);
 await assert.rejects(confirm(s,905),/TEST_AUDIT_FAILURE/);
 assert.deepEqual(await counts(),{learners:1,visits:2,links:2,audits:2});await db.exec('reset role');
});
test.after(async()=>{await db.close();});
