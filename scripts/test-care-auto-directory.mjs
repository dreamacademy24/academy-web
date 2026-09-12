import {PGlite} from '../artifacts/care-db/node_modules/@electric-sql/pglite/dist/index.js';
import {readFileSync,readdirSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const db=new PGlite(),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create table staff_accounts(id uuid primary key,role text,is_active boolean,name text);
create table bookings(id uuid primary key,students jsonb,reservation_no text,academy_start text,academy_end text);
create table students(id uuid primary key,booking_id uuid,name_kr text,name_en text,level text);
grant select,update on bookings,students to service_role;grant select on staff_accounts to service_role;`);
const migrations=new URL('../supabase/migrations/',import.meta.url);
for(const name of ['20260912055458_student_care_confirmed_visits.sql','20260912105728_student_care_teacher_assignments.sql',readdirSync(migrations).find(x=>x.endsWith('_student_care_auto_directory.sql'))])await db.exec(readFileSync(new URL(name,migrations),'utf8'));
await db.query(`insert into staff_accounts values($1,'korean_admin',true,'Admin'),($2,'local_teacher',true,'Teacher'),($3,'korean_admin',false,'Inactive')`,[id(1),id(2),id(3)]);
async function source(n,change={}){
 const entry={id:id(n+200),korName:'Same name',engName:'Alex',...change.entry};
 let payload=change.repeat?[entry,entry]:[entry];if(change.encoded)payload=JSON.stringify(payload);if(change.invalid)payload='invalid JSON';
 await db.query('insert into bookings values($1,$2,$3,$4,$5)',[id(n+100),JSON.stringify(payload),'REF',change.start??'2026-09-01',change.end??'2026-09-30']);
 await db.query('insert into students values($1,$2,$3,$4,$5)',[id(n+200),change.booking??id(n+100),'Same name','Alex','DSL-F2']);
}
await source(1);await source(2);await source(3,{entry:{id:undefined}});await source(4,{entry:{korName:'Different'}});await source(5,{entry:{engName:'Different'}});await source(6,{repeat:true});await source(7,{start:'2026-02-30'});await source(8,{end:'2026-08-01'});await source(9,{encoded:true});await source(10,{invalid:true});await source(11,{booking:id(999)});await source(12,{entry:{student_id:id(999)}});
const directory=async(actor=1)=>(await db.query('select get_care_directory($1) r',[id(actor)])).rows[0].r;
const sync=async(actor=1)=>(await db.query('select sync_care_directory($1) r',[id(actor)])).rows[0].r;
const snapshot=async()=>JSON.stringify((await db.query('select to_jsonb(b) row from bookings b order by id')).rows);
const before=await snapshot();
test('existing source rows are visible before linking, only to an active administrator',async()=>{
 await db.exec('set role service_role');const r=await directory();assert.equal(r.sourceCount,12);assert.equal(r.pendingStudents.length,12);assert.equal(r.visits.length,0);
 const teacher=await directory(2);assert.equal(teacher.pendingStudents,undefined);assert.equal(teacher.sourceCount,undefined);assert.deepEqual(teacher.visits,[]);
 await assert.rejects(directory(3),/CARE_FORBIDDEN/);await assert.rejects(sync(2),/CARE_FORBIDDEN/);
});
test('only exact unique identity and valid periods auto-link; source data stays untouched',async()=>{
 const r=await sync();assert.equal(r.linked,3);assert.equal(await snapshot(),before);
 const d=await directory();assert.equal(d.visits.length,3);assert.equal(d.pendingStudents.length,9);assert.ok(d.visits.every(v=>v.linkMethod==='automatic'));assert.equal(new Set(d.visits.map(v=>v.learner_id)).size,3,'same-name students must not be merged');
 assert.equal((await db.query('select count(*)::int n from care_audit')).rows[0].n,3);
});
test('refresh does not duplicate links or replace manually confirmed visits',async()=>{
 assert.equal((await sync()).linked,0);
 await db.exec('reset role');await source(13);const existing=(await directory()).visits[0].learner_id;
 const s=(await db.query('select id,booking_id,name_kr,name_en from students where id=$1',[id(213)])).rows[0];const b=(await db.query('select students from bookings where id=$1',[id(113)])).rows[0];
 await db.exec('set role service_role');await db.query('select confirm_care_student_link($1,$2,$3,0,$4,$5,$6,$7,$8,$9)',[id(900),id(1),id(113),id(213),JSON.stringify(b.students),JSON.stringify(s),'2026-10-01','2026-10-31',existing]);
 assert.equal((await sync()).linked,0);const d=await directory();assert.equal(d.visits.length,4);assert.equal(d.visits.filter(v=>v.learner_id===existing).length,2);assert.equal(d.visits.find(v=>v.start_date==='2026-10-01').linkMethod,'manual');
});
test('teacher sees only assigned visits even after automatic linking',async()=>{
 const visit=(await directory()).visits[0];await db.query('select set_care_assignment($1,$2,$3,$4,true,null)',[id(1),id(901),visit.id,id(2)]);
 const r=await directory(2);assert.deepEqual(r.visits.map(v=>v.id),[visit.id]);assert.equal(r.pendingStudents,undefined);assert.equal(r.visits[0].linkMethod,undefined);assert.deepEqual(r.visits[0].history,[]);
});
test('anonymous roles cannot call either directory function',async()=>{
 await db.exec('reset role');for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(directory(),/permission denied/);await assert.rejects(sync(),/permission denied/);await db.exec('reset role');}
});
test.after(()=>db.close());
