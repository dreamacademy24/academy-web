import {PGlite} from '../artifacts/care-db/node_modules/@electric-sql/pglite/dist/index.js';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create table staff_accounts(id uuid primary key,role text,is_active boolean,name text);
create table bookings(id uuid primary key,students jsonb,reservation_no text);
create table students(id uuid primary key,booking_id uuid,name_kr text,name_en text,level text);
grant select on staff_accounts to service_role;`);
for(const file of ['20260912055458_student_care_confirmed_visits','20260912105728_student_care_teacher_assignments'])await db.exec(readFileSync(new URL(`../supabase/migrations/${file}.sql`,import.meta.url),'utf8'));
await db.query(`insert into staff_accounts values($1,'korean_admin',true,'Admin'),($2,'local_teacher',true,'Teacher A'),($3,'local_teacher',true,'Teacher B'),($4,'local_teacher',false,'Disabled'),($5,'driver',true,'Other')`,[id(1),id(2),id(3),id(4),id(5)]);
await db.query(`insert into care_learners(id,name_kr,created_by) values($1,'Test child',$2)`,[id(10),id(1)]);
for(const n of [11,12])await db.query(`insert into care_visits(id,learner_id,booking_id,start_date,end_date,created_by) values($1,$2,$3,'2026-09-01','2026-09-30',$4)`,[id(n),id(10),id(n+100),id(1)]);
const assign=async(request,teacher=2,visit=11,active=true,previous=null,actor=1)=>(await db.query('select set_care_assignment($1,$2,$3,$4,$5,$6) result',[id(actor),id(request),id(visit),id(teacher),active,previous===null?null:id(previous)])).rows[0].result;
const roster=async(actor)=>(await db.query('select get_care_roster($1) result',[id(actor)])).rows[0].result;
test('direct public access and mutation are denied; new table has RLS',async()=>{
 assert.equal((await db.query("select relrowsecurity from pg_class where relname='care_assignment_events'")).rows[0].relrowsecurity,true);
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  await assert.rejects(db.query('select * from care_assignment_events'),/permission denied/);
  await assert.rejects(roster(1),/permission denied/);
  await assert.rejects(assign(20),/permission denied/);
  await db.exec('reset role');
 }
 await db.exec('set role service_role');
 await assert.rejects(db.query('delete from care_assignment_events'),/permission denied/);
 await assert.rejects(db.query('update care_assignment_events set active=false'),/permission denied/);
});
test('empty teacher roster and full administrator roster; no booking or finance fields',async()=>{
 assert.equal((await roster(2)).visits.length,0);
 const r=await roster(1);assert.equal(r.visits.length,2);assert.equal(r.teachers.length,2);
 assert.equal(r.visits[0].booking_id,undefined);assert.equal(r.visits[0].level_snapshot,undefined);
 await assert.rejects(roster(4),/CARE_FORBIDDEN/);await assert.rejects(roster(5),/CARE_FORBIDDEN/);
});
test('only admin assigns active teachers; retry produces one history entry',async()=>{
 await assert.rejects(assign(20,2,11,true,null,2),/CARE_FORBIDDEN/);
 await assert.rejects(assign(20,4),/CARE_TEACHER_INVALID/);
 await assign(20);assert.equal((await assign(20)).alreadySaved,true);
 const r=await roster(2);assert.equal(r.visits.length,1);assert.equal(r.visits[0].id,id(11));assert.deepEqual(r.teachers,[]);assert.deepEqual(r.visits[0].history,[]);
 assert.equal((await roster(1)).visits.find(v=>v.id===id(11)).history.length,1);
});
test('same child return visit does not grant access to another visit',async()=>{
 await assign(21,3,12);
 assert.deepEqual((await roster(2)).visits.map(v=>v.id),[id(11)]);
 assert.deepEqual((await roster(3)).visits.map(v=>v.id),[id(12)]);
});
test('stale changes and reused request identifiers cannot overwrite assignment',async()=>{
 await assert.rejects(assign(22,2,11,false),/CARE_ASSIGNMENT_CHANGED/);
 await assert.rejects(assign(20,3),/CARE_REQUEST_CONFLICT/);
 assert.equal((await roster(2)).visits.length,1);
});
test('revocation hides visit, preserves events, and restoration uses latest event',async()=>{
 await assign(22,2,11,false,20);assert.equal((await roster(2)).visits.length,0);
 await assert.rejects(assign(23,2,11,true,20),/CARE_ASSIGNMENT_CHANGED/);
 await assign(23,2,11,true,22);assert.equal((await roster(2)).visits.length,1);
 const h=(await roster(1)).visits.find(v=>v.id===id(11)).history;
 assert.deepEqual(h.map(e=>e.active),[true,false,true]);
});
test('disabled teacher loses access and admin can still remove assignment',async()=>{
 await db.exec('reset role');await db.query('update staff_accounts set is_active=false where id=$1',[id(2)]);await db.exec('set role service_role');
 await assert.rejects(roster(2),/CARE_FORBIDDEN/);
 await assign(24,2,11,false,23);
 assert.equal((await roster(1)).visits.find(v=>v.id===id(11)).assignments[0].active,false);
});
test.after(async()=>{await db.close();});
