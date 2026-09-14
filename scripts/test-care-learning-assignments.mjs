import { PGlite } from '../artifacts/care-db/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create table staff_accounts(id uuid primary key,role text,is_active boolean,name text);
create table bookings(id uuid primary key,students jsonb,reservation_no text);
create table students(id uuid primary key,booking_id uuid,name_kr text,name_en text,level text);
grant select on staff_accounts to service_role;`);
const migrationDir = new URL('../supabase/migrations/', import.meta.url);
const learningMigration = readdirSync(migrationDir).find(file => file.endsWith('_care_learning_assignments.sql'));
const allLevelsMigration = readdirSync(migrationDir).find(file => file.endsWith('_care_learning_all_official_levels.sql'));
assert.ok(learningMigration);
assert.ok(allLevelsMigration);
for (const file of ['20260912055458_student_care_confirmed_visits.sql', '20260912105728_student_care_teacher_assignments.sql', learningMigration, allLevelsMigration]) {
  if (file === learningMigration) await db.exec('alter default privileges in schema public grant all on tables to service_role');
  await db.exec(readFileSync(new URL(file, migrationDir), 'utf8'));
}
await db.query(`insert into staff_accounts values($1,'korean_admin',true,'Admin'),($2,'local_teacher',true,'Teacher'),($3,'local_teacher',true,'Unassigned'),($4,'korean_admin',false,'Disabled'),($5,'driver',true,'Other')`, [id(1), id(2), id(3), id(4), id(5)]);
await db.query(`insert into care_learners(id,name_kr,created_by) values($1,'Fixture child',$2)`, [id(10), id(1)]);
for (const n of [11, 12]) await db.query(`insert into care_visits(id,learner_id,booking_id,start_date,end_date,level_snapshot,created_by) values($1,$2,$3,'2026-09-01','2026-09-30','junior',$4)`, [id(n), id(10), id(n + 100), id(1)]);
await db.query('select set_care_assignment($1,$2,$3,$4,true,null)', [id(1), id(50), id(11), id(2)]);
const read = async (actor = 1, visit = 11) => (await db.query('select get_care_learning_assignment($1,$2) result', [id(actor), id(visit)])).rows[0].result;
const save = async ({ request = 100, actor = 1, visit = 11, previous = null, level = 'DSL-F2', unit = 'dsl-f2-w1-d1' } = {}) => (await db.query('select set_care_learning_assignment($1,$2,$3,$4,$5,$6) result', [id(actor), id(request), id(visit), previous === null ? null : id(previous), level, unit])).rows[0].result;

test('new tables and functions are service-only with no direct modification rights', async () => {
  for (const table of ['care_learning_assignments', 'care_learning_assignment_audit']) assert.equal((await db.query('select relrowsecurity from pg_class where relname=$1', [table])).rows[0].relrowsecurity, true);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select * from care_learning_assignments'), /permission denied/);
    await assert.rejects(db.query('select * from care_learning_assignment_audit'), /permission denied/);
    await assert.rejects(read(), /permission denied/); await assert.rejects(save(), /permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  await assert.rejects(db.query('update care_learning_assignments set level_code=\'DR-S\''), /permission denied/);
  await assert.rejects(db.query('delete from care_learning_assignments'), /permission denied/);
  await assert.rejects(db.query('delete from care_learning_assignment_audit'), /permission denied/);
});

test('unassigned is genuinely null and source level is not treated as a learning assignment', async () => {
  assert.deepEqual(await read(), { assignment: null, history: [], canEdit: true });
  assert.deepEqual(await read(2), { assignment: null, history: [], canEdit: false });
  assert.equal((await db.query('select level_snapshot from care_visits where id=$1', [id(11)])).rows[0].level_snapshot, 'junior');
  await assert.rejects(read(3), /CARE_FORBIDDEN/);
  await assert.rejects(read(2, 12), /CARE_FORBIDDEN/);
  await assert.rejects(read(4), /CARE_FORBIDDEN/);
  await assert.rejects(read(5), /CARE_FORBIDDEN/);
});

test('only active administrator saves official matching level/unit combinations', async () => {
  await assert.rejects(save({ actor: 2 }), /CARE_FORBIDDEN/);
  await assert.rejects(save({ actor: 4 }), /CARE_FORBIDDEN/);
  await assert.rejects(save({ level: 'BR40' }), /CARE_INVALID_INPUT/);
  await assert.rejects(save({ level: 'junior' }), /CARE_INVALID_INPUT/);
  await assert.rejects(save({ level: 'DR-F1' }), /CARE_INVALID_INPUT/);
  await assert.rejects(save({ unit: 'missing' }), /CARE_INVALID_INPUT/);
  await assert.rejects(save({ visit: 999 }), /CARE_VISIT_MISSING/);
  const result = await save();
  assert.equal(result.assignment.level_code, 'DSL-F2'); assert.equal(result.assignment.unit_id, 'dsl-f2-w1-d1');
  assert.equal(result.assignment.version, 1); assert.equal(result.history.length, 1); assert.equal(result.alreadySaved, false);
  assert.equal((await db.query('select count(*) from care_learning_assignment_audit')).rows[0].count, 1);
  assert.equal((await read(2)).assignment.id, id(100));
});

test('idempotent retry and required compare-and-set avoid duplicate or lost changes', async () => {
  assert.equal((await save()).alreadySaved, true);
  await assert.rejects(save({ level: 'DR-F1', unit: null }), /CARE_REQUEST_CONFLICT/);
  await assert.rejects(save({ request: 101, level: 'DR-F1', unit: null }), /CARE_ASSIGNMENT_CHANGED/);
  const changed = await save({ request: 101, previous: 100, level: 'DR-F1', unit: null });
  assert.equal(changed.assignment.version, 2); assert.equal(changed.assignment.unit_id, null);
  assert.deepEqual(changed.history.map(row => row.level_code), ['DR-F1', 'DSL-F2']);
  assert.equal((await db.query('select count(*) from care_learning_assignment_audit')).rows[0].count, 2);
  await assert.rejects(save({ request: 102, previous: 100 }), /CARE_ASSIGNMENT_CHANGED/);
  await assert.rejects(save({ request: 102, previous: 101, level: 'DR-F1', unit: null }), /CARE_NO_CHANGE/);
});

test('return visits retain independent assignments and original source snapshots', async () => {
  await save({ request: 200, visit: 12, level: 'DR-S', unit: null });
  assert.equal((await read()).assignment.level_code, 'DR-F1');
  assert.equal((await read(1, 12)).assignment.level_code, 'DR-S');
  assert.deepEqual((await db.query('select level_snapshot from care_visits order by id')).rows.map(row => row.level_snapshot), ['junior', 'junior']);
  await assert.rejects(read(2, 12), /CARE_FORBIDDEN/);
});

test('audit failure rolls back the assignment so the same request can safely retry', async () => {
  await db.exec('reset role');
  await db.exec(`create function fail_learning_audit() returns trigger language plpgsql as $$begin raise exception 'fixture audit failure';end;$$;
create trigger fail_learning_audit before insert on care_learning_assignment_audit for each row execute function fail_learning_audit();`);
  await db.exec('set role service_role');
  await assert.rejects(save({ request: 102, previous: 101 }), /fixture audit failure/);
  assert.equal((await read()).assignment.id, id(101));
  assert.equal((await db.query('select count(*) from care_learning_assignments where id=$1', [id(102)])).rows[0].count, 0);
  await db.exec('reset role;drop trigger fail_learning_audit on care_learning_assignment_audit;set role service_role');
  assert.equal((await save({ request: 102, previous: 101 })).assignment.version, 3);
});

test('teacher unassignment and disabled accounts immediately lose read access', async () => {
  await db.query('select set_care_assignment($1,$2,$3,$4,false,$5)', [id(1), id(51), id(11), id(2), id(50)]);
  await assert.rejects(read(2), /CARE_FORBIDDEN/);
  await db.query('select set_care_assignment($1,$2,$3,$4,true,$5)', [id(1), id(52), id(11), id(2), id(51)]);
  assert.equal((await read(2)).history.length, 3);
  await db.exec('reset role'); await db.query('update staff_accounts set is_active=false where id=$1', [id(2)]); await db.exec('set role service_role');
  await assert.rejects(read(2), /CARE_FORBIDDEN/);
});

test('all fifteen official levels save without publishing another level\'s app unit', async () => {
  const levels = ['DSL-F1', 'DSL-F2', 'DSL-S1', 'DSL-S2', 'DSL-T1', 'DSL-T2', 'DR-F1', 'DR-F2', 'DR-S', 'DR-T', 'DW-F', 'DW-S1', 'DW-S2', 'DW-T', 'DW-M'];
  const originalVisit = await read();
  await db.exec('reset role');
  for (const [index] of levels.entries()) {
    await db.query(`insert into care_visits(id,learner_id,booking_id,start_date,end_date,level_snapshot,created_by) values($1,$2,$3,'2026-09-01','2026-09-30','junior',$4)`, [id(300 + index), id(10), id(600 + index), id(1)]);
  }
  await db.exec('set role service_role');
  for (const [index, level] of levels.entries()) {
    const input = { request: 400 + index, visit: 300 + index, level, unit: null };
    const result = await save(input);
    assert.equal(result.assignment.level_code, level);
    assert.equal(result.assignment.unit_id, null);
    assert.equal(result.assignment.version, 1);
    assert.equal(result.history.length, 1);
    assert.equal((await save(input)).alreadySaved, true);
    if (level !== 'DSL-F2') await assert.rejects(save({ ...input, request: 500 + index, previous: 400 + index, unit: 'dsl-f2-w1-d1' }), /CARE_INVALID_INPUT/);
  }
  assert.deepEqual(await read(), originalVisit);
  assert.equal((await db.query('select count(*) from care_learning_assignment_audit where assignment_id=any($1::uuid[])', [levels.map((_, index) => id(400 + index))])).rows[0].count, 15);
  const changed = await save({ request: 700, visit: 300, previous: 400, level: 'DW-M', unit: null });
  assert.deepEqual(changed.history.map(row => row.level_code), ['DW-M', 'DSL-F1']);
  assert.equal(changed.assignment.version, 2);
  await assert.rejects(save({ request: 701, visit: 300, previous: 400, level: 'DSL-F1', unit: null }), /CARE_ASSIGNMENT_CHANGED/);
});

test.after(async () => { await db.close(); });
