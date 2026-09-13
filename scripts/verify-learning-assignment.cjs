const { chromium } = require('C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.LEARNING_TEST_URL || 'http://localhost:3118';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const visit = n => ({ id: id(n), learner_id: id(10), name_kr: '검증 학생', name_en: 'Fixture Child', start_date: '2026-09-01', end_date: '2026-09-30', assignments: [], history: [] });
const current = (n, level = 'DSL-F2', unit = 'dsl-f2-w1-d1', version = 1) => ({ id: typeof n === 'string' ? n : id(n), levelCode: level, unitId: unit, unitTitle: unit ? 'My Tree House' : null, href: unit ? '/learn/tree-house' : null, published: !!unit, effectiveAt: '2026-09-12T15:00:00Z', createdAt: '2026-09-12T15:00:00Z', version });

(async () => {
  assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/, 'Local test server only');
  fs.mkdirSync('artifacts/learning', { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  let activePage;
  async function scenario({ admin = true, selected = false, mutation = false, readFailure = false } = {}) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 950 }, serviceWorkers: 'block' });
    const reads = [], writes = [];
    let assigned = null, history = [];
    if (!admin) { assigned = current(90); history = [{ ...assigned, actorName: 'Fixture Admin' }]; }
    const roster = { isAdmin: admin, visits: [visit(11), visit(12)], sourceCount: 2, pendingStudents: [], teachers: [], ...(selected ? { selection: { name: '검증 학생', bookingId: id(100), sourceIndex: 0, visitId: id(11) } } : {}) };
    const page = await context.newPage();
    activePage = page;
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/staff/**', async route => {
      const request = route.request(); const url = new URL(request.url());
      const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.pathname === '/api/staff/session') return reply({ staff: { id: id(admin ? 1 : 2), username: 'fixture', name: 'Fixture Staff', role: admin ? 'korean_admin' : 'local_teacher' } });
      if (url.pathname === '/api/staff/students') return reply(request.method() === 'POST' ? { sync: { linked: 0, busy: false }, roster } : roster);
      if (url.pathname === '/api/staff/learning-assignment') {
        if (request.method() === 'GET') {
          reads.push(url.searchParams.get('visitId'));
          return readFailure ? reply({ error: 'Fixture read failed' }, 503) : reply({ assignment: assigned, history, canEdit: admin });
        }
        const body = request.postDataJSON(); writes.push(body);
        assert.ok(mutation && admin, 'Unexpected mutation');
        if (writes.length === 1) {
          // The server committed but the client only received a failure: retry must keep the original request.
          assigned = current(body.requestId); history = [{ ...assigned, actorName: 'Fixture Admin' }];
          return reply({ error: 'Temporary failure' }, 503);
        }
        if (writes.length === 2) {
          assert.deepEqual(body, writes[0]);
          return reply({ assignment: assigned, history, canEdit: true, alreadySaved: true });
        }
        if (writes.length === 3) {
          assigned = current(200, 'DSL-T1', null, 2); history.unshift({ ...assigned, actorName: 'Another Admin' });
          return reply({ error: 'Changed elsewhere' }, 409);
        }
        assert.equal(writes.length, 4);
        assert.equal(body.expectedAssignmentId, id(200)); assert.equal(body.levelCode, 'DR-F1'); assert.equal(body.unitId, null);
        assert.notEqual(body.requestId, writes[2].requestId);
        assigned = current(body.requestId, body.levelCode, body.unitId, 3); history.unshift({ ...assigned, actorName: 'Fixture Admin' });
        return reply({ assignment: assigned, history, canEdit: true });
      }
      return reply({ error: 'Unexpected test API' }, 500);
    });
    await page.goto(`${base}/staff/students${selected ? `?bookingId=${id(100)}&sourceIndex=0&embedded=1` : ''}`);
    await page.getByRole('heading', { name: selected ? '검증 학생 · 학생케어' : admin ? '학생케어' : 'My Students', exact: true }).waitFor();
    const summary = page.locator('summary').filter({ hasText: admin ? /^학습 레벨 · 교재/ : /^Learning level & book/ });
    await summary.first().waitFor();
    return { page, context, reads, writes, summary, panel: page.locator('details').filter({ has: page.locator('summary').filter({ hasText: admin ? /^학습 레벨 · 교재/ : /^Learning level & book/ }) }).first() };
  }
  try {
    const list = await scenario();
    assert.equal(await list.summary.count(), 2);
    await list.page.waitForTimeout(200);
    assert.equal(list.reads.length, 0, 'Collapsed rows must not load assignments');
    await list.summary.first().click();
    await list.panel.getByText('아직 배정하지 않았습니다', { exact: true }).waitFor();
    assert.equal(list.reads.length, 1); assert.equal(list.reads[0], id(11));
    assert.equal(await list.panel.getByLabel('공식 학습 레벨', { exact: true }).inputValue(), '');
    assert.equal(await list.panel.getByLabel('배정 교재', { exact: true }).inputValue(), '');
    assert.equal(await list.panel.getByRole('button', { name: '학습 배정 저장', exact: true }).isDisabled(), true);
    await list.context.close();
    console.log('PASS: existing list uses collapsed lazy learning fields; no N+1 loading or default assignment');

    const admin = await scenario({ selected: true, mutation: true });
    await admin.panel.getByText('아직 배정하지 않았습니다', { exact: true }).waitFor();
    assert.ok(admin.reads.every(visitId => visitId === id(11)), 'Only the selected visit opens automatically');
    const level = admin.panel.getByLabel('공식 학습 레벨', { exact: true });
    const unit = admin.panel.getByLabel('배정 교재', { exact: true });
    await level.selectOption('DSL-F2');
    assert.equal(await unit.inputValue(), '', 'Choosing a level must not automatically assign its unit');
    await unit.selectOption('dsl-f2-w1-d1');
    await admin.panel.getByRole('button', { name: '학습 배정 저장', exact: true }).click();
    await admin.panel.getByText('저장 결과를 확인하지 못했어요.', { exact: false }).waitFor();
    assert.equal(await level.isDisabled(), true); assert.equal(await unit.isDisabled(), true);
    assert.equal(await admin.panel.getByRole('button', { name: '새로고침', exact: true }).isDisabled(), true);
    await admin.panel.getByRole('button', { name: '저장 결과 다시 확인', exact: true }).click();
    await admin.panel.getByText('이 방문의 학습 레벨과 교재를 저장했습니다.', { exact: true }).waitFor();
    assert.equal(admin.writes.length, 2); assert.deepEqual(admin.writes[0], admin.writes[1]);
    assert.equal(await level.isEnabled(), true);
    await level.selectOption('DR-F1');
    assert.equal(await unit.inputValue(), ''); assert.equal(await unit.isDisabled(), true);
    await admin.panel.getByRole('button', { name: '학습 배정 저장', exact: true }).click();
    await admin.panel.getByText('다른 변경이 있어요.', { exact: false }).waitFor();
    assert.equal(await level.inputValue(), 'DR-F1');
    assert.equal(await admin.panel.getByRole('button', { name: '학습 배정 저장', exact: true }).isDisabled(), true);
    await admin.panel.getByRole('button', { name: '새로고침', exact: true }).click();
    await admin.panel.getByText('DSL-T1', { exact: true }).first().waitFor();
    assert.equal(await level.inputValue(), 'DR-F1', 'Conflict refresh must preserve the editor draft');
    await admin.panel.getByRole('button', { name: '학습 배정 저장', exact: true }).click();
    await admin.panel.getByText('이 방문의 학습 레벨과 교재를 저장했습니다.', { exact: true }).waitFor();
    assert.equal(admin.writes.length, 4);
    await admin.panel.locator('summary').filter({ hasText: '방문별 변경 이력' }).click();
    await admin.panel.getByText('Another Admin', { exact: false }).waitFor();
    await admin.page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await admin.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await admin.page.screenshot({ path: 'artifacts/learning/staff-learning-assignment-mobile.png', fullPage: true });
    await admin.context.close();
    console.log('PASS: selected visit opens; admin assigns explicitly; uncertain retry reuses ID/payload; 409 preserves draft and rebases only after refresh; history/mobile');

    const teacher = await scenario({ admin: false });
    assert.equal(teacher.reads.length, 0);
    await teacher.summary.first().click();
    await teacher.panel.getByText('Your Korean coordinator manages learning assignments.', { exact: true }).waitFor();
    assert.equal(await teacher.panel.locator('select').count(), 0);
    assert.equal(await teacher.panel.locator('form').count(), 0);
    assert.equal(teacher.writes.length, 0);
    await teacher.context.close();
    const unavailable = await scenario({ selected: true, readFailure: true });
    await unavailable.panel.getByRole('alert').waitFor();
    assert.equal(await unavailable.panel.getByText('아직 배정하지 않았습니다', { exact: true }).count(), 0);
    assert.equal(await unavailable.panel.locator('form').count(), 0);
    await unavailable.context.close();
    assert.deepEqual(errors, []);
    console.log('PASS: local teacher English read-only, failed lookup never claims unassigned, no page errors; all writes mocked');
  } catch (error) {
    if (activePage && !activePage.isClosed()) {
      console.error(await activePage.locator('body').innerText());
      await activePage.screenshot({ path: 'artifacts/learning/staff-learning-assignment-failure.png', fullPage: true }).catch(() => {});
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
