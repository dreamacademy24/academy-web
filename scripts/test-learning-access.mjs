import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function load(path, modules = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, URL, Buffer, require: name => { assert.ok(name in modules, `Unexpected module: ${name}`); return modules[name]; } });
  return exports;
}
const catalog = load('../lib/learning/catalog.ts');
const children = load('../lib/learning/children.ts', { './catalog': catalog });
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const plain = value => JSON.parse(JSON.stringify(value));
const parent = id(1);
const b = (booking, owner = parent, student = booking + 100) => ({ id: id(booking), portal_user_id: owner, status: '확정', students: [{ id: id(student), korName: 'Fixture child', engName: 'Child' }] });
const l = (booking, learner = 50, visit = booking + 200, student = booking + 100, index = 0) => ({ booking_id: id(booking), learner_id: id(learner), visit_id: id(visit), legacy_student_id: id(student), source_index: index });
const v = (booking, learner = 50, visit = booking + 200) => ({ id: id(visit), learner_id: id(learner), booking_id: id(booking), start_date: `2026-${booking === 10 ? '09' : '08'}-01`, end_date: '2026-09-30' });
const assignment = (visit = 210, level = 'DSL-F2', unit = 'dsl-f2-w1-d1', version = 1) => ({ id: id(900 + version), visit_id: id(visit), level_code: level, unit_id: unit, version, effective_at: '2026-09-12T15:00:00Z', created_at: '2026-09-12T15:00:00Z' });

test('official stages are explicit and publication requires the correct level/unit pair', () => {
  assert.deepEqual(plain(catalog.officialLevels), ['DSL-F2', 'DSL-T1', 'DR-F1', 'DR-F2', 'DR-S', 'DR-T']);
  for (const level of ['BR40', 'BR-120', 'junior', 'kinder', 'DR-S1', '', null]) assert.equal(catalog.isLevelCode(level), false);
  assert.equal(catalog.validLearningAssignment('DR-F1', null), true);
  assert.equal(catalog.validLearningAssignment('DR-F1', 'dsl-f2-w1-d1'), false);
  assert.equal(catalog.validLearningAssignment('DSL-F2', '/learn/tree-house'), false);
  assert.equal(catalog.describeAssignment(assignment()).published, true);
  const pending = catalog.describeAssignment(assignment(210, 'DR-F1', null));
  assert.equal(pending.published, false); assert.equal(pending.href, null); assert.equal(pending.levelCode, 'DR-F1');
  assert.equal(catalog.describeAssignment(assignment(210, 'junior')), null);
});

test('same-name siblings stay separate and only verified owned visits are returned', () => {
  const booking = b(10); booking.students.push({ id: id(111), korName: 'Fixture child', engName: 'Child' });
  const result = children.assembleLearningChildren(parent, [booking], [l(10), l(10, 51, 211, 111, 1)], [v(10), v(10, 51, 211)], [assignment()]);
  assert.equal(result.pendingCount, 0); assert.equal(result.children.length, 2);
  assert.deepEqual(plain(result.children.map(child => child.learnerId)), [id(50), id(51)]);
  assert.equal(result.children[0].visits[0].assignment.unitId, 'dsl-f2-w1-d1');
  assert.equal(result.children[1].visits[0].assignment, null);
});

test('revisit records share one learner but foreign-owner visits never leak', () => {
  const result = children.assembleLearningChildren(parent, [b(11), b(10), b(12, id(2))], [l(11), l(10), l(12)], [v(11), v(10), v(12)], [assignment(), assignment(212)]);
  assert.equal(result.children.length, 1);
  assert.deepEqual(plain(result.children[0].visits.map(visit => visit.visitId)), [id(210), id(211)]);
  assert.equal(JSON.stringify(result).includes(id(212)), false);
});

test('missing, stale, moved and ambiguous source identities wait instead of granting a unit', () => {
  for (const [booking, links, visits] of [
    [b(10), [], [v(10)]],
    [b(10), [l(10, 50, 210, 999)], [v(10)]],
    [b(10), [l(10)], [v(11, 50, 210)]],
    [b(10), [l(10)], [v(10, 51, 210)]],
    [b(10), [l(10), l(10)], [v(10)]],
    [{ ...b(10), students: [{ id: null, korName: 'Fixture child' }] }, [l(10)], [v(10)]],
    [{ ...b(10), students: [{ id: id(110), student_id: id(111) }] }, [l(10)], [v(10)]],
  ]) {
    const result = children.assembleLearningChildren(parent, [booking], links, visits, [assignment()]);
    assert.deepEqual(plain(result), { children: [], pendingCount: 1 });
  }
});

test('cancelled bookings are omitted and malformed booking JSON does not masquerade as no children', () => {
  assert.deepEqual(plain(children.assembleLearningChildren(parent, [{ ...b(10), status: '취소' }], [l(10)], [v(10)], [])), { children: [], pendingCount: 0 });
  assert.throws(() => children.assembleLearningChildren(parent, [{ ...b(10), students: '{broken' }], [], [], []));
  const result = children.assembleLearningChildren(parent, [{ ...b(10), students: JSON.stringify(b(10).students) }], [l(10)], [v(10)], []);
  assert.equal(result.children.length, 1);
});

test('latest assignment wins without deriving a level from old source values', () => {
  const booking = b(10); booking.students[0].level = 'junior';
  const result = children.assembleLearningChildren(parent, [booking], [l(10)], [v(10)], [assignment(210, 'DR-F1', null, 2), assignment()]);
  const plan = result.children[0].visits[0].assignment;
  assert.equal(plan.levelCode, 'DR-F1'); assert.equal(plan.published, false); assert.equal(plan.href, null);
  assert.equal(result.children[0].level, undefined);
});

function database({ failTable = null, rows = {}, paginationFailure = false } = {}) {
  const calls = [];
  const all = { bookings: [b(10), b(11, id(2))], care_links: [l(10), l(11)], care_visits: [v(10), v(11)], care_learning_assignments: [assignment()], ...rows };
  return { calls, from(table) {
    const filters = []; const entry = { table, filters, fields: '' }; calls.push(entry);
    const query = {
      select(fields) { entry.fields = fields; return query; },
      eq(field, value) { filters.push([field, [value]]); return query; },
      in(field, values) { filters.push([field, values]); return query; },
      order() { return query; },
      async range(start, end) {
        entry.range = [start, end];
        if (failTable === table || (paginationFailure && table === 'bookings' && start > 0)) return { data: null, error: { message: 'private diagnostic' } };
        return { data: (all[table] || []).filter(row => filters.every(([field, values]) => values.includes(row[field]))).slice(start, end + 1), error: null };
      },
    };
    return query;
  } };
}

test('loader scopes each query, batches all pages and rejects partial read failures', async () => {
  const db = database(); const result = await children.loadLearningChildren(db, parent);
  assert.equal(result.children.length, 1);
  assert.deepEqual(db.calls[0].filters, [['portal_user_id', [parent]]]);
  assert.deepEqual(plain(db.calls.find(call => call.table === 'care_links').filters), [['booking_id', [id(10)]]]);
  assert.deepEqual(plain(db.calls.find(call => call.table === 'care_visits').filters), [['id', [id(210)]]]);
  for (const failTable of ['bookings', 'care_links', 'care_visits', 'care_learning_assignments']) await assert.rejects(children.loadLearningChildren(database({ failTable }), parent));
  const bookings = Array.from({ length: 101 }, (_, i) => ({ ...b(10 + i), students: [] }));
  const pages = database({ rows: { bookings } });
  await children.loadLearningChildren(pages, parent);
  assert.equal(pages.calls.filter(call => call.table === 'bookings').length, 2);
  await assert.rejects(children.loadLearningChildren(database({ rows: { bookings }, paginationFailure: true }), parent));
});

test('unlinked children do not require an assignment table lookup, and no bookings is an empty success', async () => {
  const empty = database({ rows: { bookings: [] } });
  assert.deepEqual(plain(await children.loadLearningChildren(empty, parent)), { children: [], pendingCount: 0 });
  assert.equal(empty.calls.length, 1);
  const pending = database({ rows: { care_links: [] } });
  assert.deepEqual(plain(await children.loadLearningChildren(pending, parent)), { children: [], pendingCount: 1 });
  assert.equal(pending.calls.some(call => call.table === 'care_learning_assignments'), false);
});

const nextModule = { NextResponse: { json: (body, init) => ({ body, ...init }) } };
test('children API accepts only verified parent identity, ignores supplied IDs and keeps errors private', async () => {
  for (const [user, expected] of [[null, 401], [{ id: parent, user_metadata: { booking_id: id(999) } }, 200]]) {
    const db = database();
    const api = load('../app/api/learning/children/route.ts', { 'next/server': nextModule, '@/lib/portalAuth': { portalUser: async () => user, portalDb: () => db }, '@/lib/learning/children': children });
    const response = await api.GET(new Request(`http://localhost/api/learning/children?userId=${id(2)}&booking_id=${id(999)}`));
    assert.equal(response.status, expected); assert.match(response.headers['Cache-Control'], /no-store/); assert.match(response.headers.Vary, /Authorization/);
    if (!user) assert.equal(db.calls.length, 0);
    else assert.equal(response.body.children.length, 1);
  }
  const api = load('../app/api/learning/children/route.ts', { 'next/server': nextModule, '@/lib/portalAuth': { portalUser: async () => { throw new Error('secret'); } }, '@/lib/learning/children': children });
  const failed = await api.GET(new Request('http://localhost/api/learning/children'));
  assert.equal(failed.status, 503); assert.equal(JSON.stringify(failed).includes('secret'), false);
});

function staffApi({ actor = { id: id(20), role: 'korean_admin' }, error = null, authFailure = false } = {}) {
  const calls = [];
  const api = load('../app/api/staff/learning-assignment/route.ts', {
    'next/server': nextModule,
    '@/lib/portalAuth': { getStaffIdentity: async () => { if (authFailure) throw new Error('secret'); return actor; }, portalDb: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return { data: { assignment: assignment(), history: [{ ...assignment(), actor_name: 'Fixture Admin' }], canEdit: actor.role === 'korean_admin' }, error }; } }) },
    '@/lib/learning/catalog': catalog,
  });
  return { ...api, calls };
}
const validBody = { visitId: id(210), requestId: id(901), expectedAssignmentId: null, levelCode: 'DSL-F2', unitId: 'dsl-f2-w1-d1' };
const post = body => new Request('http://localhost/api/staff/learning-assignment', { method: 'POST', body: JSON.stringify(body) });
test('staff API validates an explicit CAS input and passes only the signed actor to the database', async () => {
  const api = staffApi();
  const response = await api.POST(post({ ...validBody, actorId: id(999), effectiveAt: '2099-01-01' }));
  assert.equal(response.status, 200); assert.equal(response.body.assignment.published, true);
  assert.equal(api.calls[0].args.p_actor_id, id(20)); assert.equal(api.calls[0].args.p_previous_id, null);
  assert.equal(api.calls[0].args.p_effective_at, undefined);
  for (const patch of [{ expectedAssignmentId: undefined }, { visitId: 'bad' }, { requestId: '' }, { levelCode: 'junior' }, { unitId: undefined }, { unitId: 'unknown' }, { levelCode: 'DR-F1' }]) {
    const rejected = staffApi(); assert.equal((await rejected.POST(post({ ...validBody, ...patch }))).status, 400); assert.equal(rejected.calls.length, 0);
  }
  assert.equal((await staffApi().POST(post({ ...validBody, levelCode: 'DR-F1', unitId: null }))).status, 200);
});

test('teachers can read only through SQL authorization and cannot write; statuses are distinct', async () => {
  for (const [actor, status] of [[null, 401], [{ id: id(21), role: 'driver' }, 403], [{ id: id(21), role: 'local_teacher' }, 403]]) {
    const api = staffApi({ actor }); assert.equal((await api.POST(post(validBody))).status, status); assert.equal(api.calls.length, 0);
  }
  const teacher = staffApi({ actor: { id: id(21), role: 'local_teacher' } });
  const result = await teacher.GET(new Request(`http://localhost/api/staff/learning-assignment?visitId=${id(210)}`));
  assert.equal(result.status, 200); assert.equal(result.body.canEdit, false); assert.equal(teacher.calls[0].args.p_actor_id, id(21));
  for (const [code, status] of [['42501', 403], ['40001', 409], ['22023', 400], ['XX000', 503]]) {
    const api = staffApi({ error: { code, message: 'secret' } }); const response = await api.POST(post(validBody));
    assert.equal(response.status, status); assert.equal(JSON.stringify(response).includes('secret'), false);
  }
  assert.equal((await staffApi({ authFailure: true }).GET(new Request(`http://localhost/api/staff/learning-assignment?visitId=${id(210)}`))).status, 503);
});
