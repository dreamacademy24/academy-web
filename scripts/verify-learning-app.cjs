// Local app smoke with synthetic children only. No production records or sign-in data are written.
const { chromium } = require('C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.LEARNING_TEST_URL || 'http://localhost:3118';
const origin = new URL(base).origin;
const artifacts = 'artifacts/learning-app';
const checks = [], errors = [], unexpectedWrites = [], viewportChecks = [], liveWorldChecks = [];
const firstChild = '11111111-1111-4111-8111-111111111111';
const secondChild = '22222222-2222-4222-8222-222222222222';
const currentVisit = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const pastVisit = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const secondVisit = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const assignment = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', levelCode: 'DSL-F2', unitId: 'dsl-f2-w1-d1',
  unitTitle: 'My Tree House', href: '/learn/tree-house', published: true,
  effectiveAt: '2026-09-01', createdAt: '2026-09-01T00:00:00Z', version: 1,
};
const fixture = { children: [
  { learnerId: firstChild, nameKr: '테스트 별이', nameEn: 'Test Star', visits: [
    { visitId: currentVisit, startDate: '2026-09-01', endDate: '2026-09-30', assignment },
    { visitId: pastVisit, startDate: '2025-07-01', endDate: '2025-07-31', assignment: { ...assignment, levelCode: 'DW-M', unitId: null, unitTitle: null, href: null, published: false } },
  ] },
  { learnerId: secondChild, nameKr: '테스트 달이', nameEn: 'Test Moon', visits: [
    { visitId: secondVisit, startDate: '2026-09-01', endDate: '2026-09-30', assignment: null },
  ] },
], pendingCount: 1 };

async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(size.document <= size.viewport, `${label}: horizontal overflow ${JSON.stringify(size)}`);
}
async function readyWorld(page, label) {
  const world = page.locator('[data-learning-world="ready"]').first();
  await world.waitFor({ timeout: 30000 });
  const surface = await world.locator('canvas').evaluate(canvas => ({ width: canvas.width, height: canvas.height, display: getComputedStyle(canvas).display, visibility: getComputedStyle(canvas).visibility }));
  assert.ok(surface.width > 0 && surface.height > 0 && surface.display !== 'none' && surface.visibility !== 'hidden', `${label}: live character canvas unavailable ${JSON.stringify(surface)}`);
  liveWorldChecks.push({ label, ...surface });
}
async function storyViewport(page, label) {
  const bounds = await page.evaluate(() => {
    const rect = element => { const box = element.getBoundingClientRect(); return { top: box.top, bottom: box.bottom }; };
    const main = document.querySelector('main');
    const footer = main.querySelector('footer');
    return { viewport: innerHeight, document: document.documentElement.scrollHeight, main: rect(main), footer: rect(footer) };
  });
  assert.ok(bounds.document <= bounds.viewport + 1 && bounds.main.top >= 0 && bounds.main.bottom <= bounds.viewport + 1 && bounds.footer.top >= 0 && bounds.footer.bottom <= bounds.viewport + 1, `${label}: story or footer cropped ${JSON.stringify(bounds)}`);
  viewportChecks.push({ label, ...bounds });
}
async function screenshot(page, name) {
  await noOverflow(page, name);
  if (/^(lesson-ready|story)-(desktop|mobile)$/.test(name)) await storyViewport(page, name);
  await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true });
}
async function button(page, name) { await page.getByRole('button', { name, exact: true }).click(); }
async function heading(page, name) { await page.getByRole('heading', { name, exact: true }).waitFor(); }
async function bodyExcludes(page, text) { assert.equal((await page.locator('body').innerText()).includes(text), false); }

async function verifyHome(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(`home: ${error.message}`));
  let status = 401, payload = { error: 'Fixture: parent login required' };
  let holdNext = false, releaseHeld, notifyHeld;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (!['GET', 'HEAD'].includes(route.request().method())) { unexpectedWrites.push(url.pathname); return route.abort(); }
    if (url.pathname === '/api/learning/children') {
      const response = { status, contentType: 'application/json', body: JSON.stringify(payload) };
      if (holdNext) { holdNext = false; notifyHeld(); await new Promise(resolve => { releaseHeld = resolve; }); }
      return route.fulfill(response).catch(() => {});
    }
    return route.continue();
  });
  try {
    await page.goto(`${base}/learn?intro=1`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    const login = page.getByRole('link', { name: '로그인하고 시작하기', exact: false });
    const start = page.getByRole('link', { name: '학습 시작하기', exact: true });
    const preview = page.getByRole('link', { name: '로그인 없이 공개 체험 보기', exact: true });
    await login.waitFor();
    assert.equal(await login.getAttribute('href'), '/portal?returnTo=%2Flearn');
    assert.equal(await preview.getAttribute('href'), '/learn/tree-house?preview=1');
    assert.equal(await page.locator('video').count(), 0);
    assert.equal(await page.getByRole('button', { name: '드림이 만나기', exact: false }).count(), 0);
    assert.equal(await start.count(), 0);
    await readyWorld(page, 'home desktop');
    await screenshot(page, 'home-guest-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await readyWorld(page, 'home mobile');
    await screenshot(page, 'home-guest-mobile');
    checks.push('Guest /learn opens the app world directly, with login/public preview and no standalone video, even with an old intro query');
    await page.setViewportSize({ width: 1280, height: 900 });

    status = 503; payload = { error: 'Fixture: unavailable' };
    await page.reload({ waitUntil: 'domcontentloaded' });
    await heading(page, '학습 정보를 불러오지 못했어요');
    assert.equal(await page.getByRole('heading', { name: '연결된 아이가 아직 없어요' }).count(), 0);
    status = 200; payload = { children: [], pendingCount: 0 };
    await button(page, '다시 불러오기'); await heading(page, '연결된 아이가 아직 없어요');
    payload = { children: [], pendingCount: 2 };
    await button(page, '다시 확인하기'); await heading(page, '연수 기록 확인이 필요해요');
    checks.push('Read failure, empty family and pending source records stay distinct; none creates a learner or lesson');

    payload = structuredClone(fixture);
    await button(page, '다시 확인하기');
    let picker = page.getByRole('dialog', { name: '학습할 아이를 선택해 주세요', exact: true });
    await picker.waitFor(); assert.equal(await start.count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await screenshot(page, 'child-picker-mobile');
    await picker.getByRole('button', { name: /테스트 별이/ }).click();
    await start.waitFor();
    const target = new URL(await start.getAttribute('href'), base);
    assert.equal(target.pathname, '/learn/tree-house');
    assert.equal(target.searchParams.get('learnerId'), firstChild);
    assert.equal(target.searchParams.get('visitId'), currentVisit);
    assert.equal(target.searchParams.has('preview'), false);
    await screenshot(page, 'home-assigned-mobile');
    await page.setViewportSize({ width: 1280, height: 900 });
    await screenshot(page, 'home-assigned-desktop');
    checks.push('Siblings require an explicit choice; the assigned lesson carries only the chosen child and visit');

    await page.getByRole('combobox', { name: '연수 기록 선택', exact: true }).selectOption(pastVisit);
    await heading(page, '교재 배정을 기다리고 있어요');
    assert.equal(await start.count(), 0);
    assert.match(await page.locator('main').innerText(), /DW-M/);
    await page.getByRole('combobox', { name: '연수 기록 선택', exact: true }).selectOption(currentVisit);
    await start.waitFor();
    await button(page, '테스트 별이 · 학습할 아이 바꾸기');
    picker = page.getByRole('dialog', { name: '학습할 아이를 선택해 주세요', exact: true });
    await picker.getByRole('button', { name: /테스트 달이/ }).click();
    await heading(page, '배울 내용을 준비하고 있어요');
    assert.equal(await start.count(), 0);
    assert.equal(await page.getByRole('combobox', { name: '연수 기록 선택', exact: true }).count(), 0);
    payload.children[1].visits[0].assignment = { ...assignment, levelCode: 'DSL-F1', unitId: 'not-published', unitTitle: null, href: null, published: false };
    await button(page, '아이의 학습 정보 새로고침'); await heading(page, '교재를 준비하고 있어요');
    assert.equal(await start.count(), 0);
    checks.push('Return visits, unassigned sibling and unpublished unit never inherit another lesson');

    await button(page, '테스트 달이 · 학습할 아이 바꾸기');
    await page.getByRole('dialog').getByRole('button', { name: /테스트 별이/ }).click();
    await start.waitFor();
    assert.doesNotMatch(await page.locator('main').innerText(), /\bBR[- ]?\d+/i);
    status = 503;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await heading(page, '학습 정보를 불러오지 못했어요');
    await bodyExcludes(page, '테스트 별이'); assert.equal(await start.count(), 0);
    status = 200;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await start.waitFor();
    checks.push('Focus revalidates the latest assignment and hides student data on failure');

    const held = new Promise(resolve => { notifyHeld = resolve; });
    holdNext = true;
    await button(page, '아이의 학습 정보 새로고침'); await held;
    status = 401;
    await page.evaluate(() => {
      const channel = new BroadcastChannel('sb-yiglafscjvjgkxpycevk-auth-token');
      channel.postMessage({ event: 'SIGNED_OUT', session: null }); channel.close();
    });
    await login.waitFor(); await bodyExcludes(page, '테스트 별이');
    releaseHeld();
    await page.waitForTimeout(150);
    assert.equal(await start.count(), 0); await login.waitFor();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await login.waitFor(); await bodyExcludes(page, '테스트 별이');
    checks.push('Cross-tab sign-out and expired sessions remove names; a late authorized response cannot restore them');
  } catch (error) {
    await page.screenshot({ path: `${artifacts}/home-failure.png`, fullPage: true }).catch(() => {});
    console.error({ phase: 'home', url: page.url(), visibleText: (await page.locator('body').innerText().catch(() => '')).slice(0, 1800) });
    throw error;
  } finally { releaseHeld?.(); await context.close(); }
}

async function verifyLesson(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true, permissions: ['microphone'], serviceWorkers: 'block' });
  await context.addInitScript(() => {
    window.__learningMedia = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      if (!window.__learningMedia.includes(this)) window.__learningMedia.push(this);
      return play.apply(this, args);
    };
  });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (!['GET', 'HEAD'].includes(request.method())) { unexpectedWrites.push(url.pathname); return route.abort(); }
    if (url.pathname === '/api/learning/children') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Fixture: not signed in' }) });
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(`lesson: ${error.message}`));
  try {
    await page.goto(`${base}/learn/tree-house?preview=1`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await heading(page, 'My Tree House');
    assert.equal(await page.locator('video').count(), 0);
    await readyWorld(page, 'lesson desktop');
    await screenshot(page, 'lesson-ready-desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await readyWorld(page, 'lesson mobile');
    await screenshot(page, 'lesson-ready-mobile');
    await button(page, '드림이와 시작');
    await page.waitForFunction(() => window.__learningMedia.some(audio => audio.currentSrc.includes('/intro-voice-01.wav') && audio.currentTime > 0 && !audio.paused));
    await button(page, '이야기 바로 시작');
    await heading(page, '저 위에 집이 있어!');
    await page.waitForFunction(() => window.__learningMedia.filter(audio => audio.currentSrc.includes('/intro-voice-')).every(audio => audio.paused));
    await page.waitForTimeout(150);
    assert.equal(await page.getByRole('button', { name: '드림이와 시작', exact: true }).count(), 0);
    checks.push('Dreamy speaks inside the lesson; skipping stops the actual guide audio and advances into the story');

    await button(page, '나무 위 집 찾기');
    await page.getByText('나무 위의 집을 찾았어요!', { exact: true }).waitFor();
    await button(page, 'tree 단어로 놀기');
    await heading(page, '이야기에서 만난 친구');
    assert.equal(await page.locator('.big-word').textContent(), 'tree');
    for (const name of ['그림 찾기', '짝 맞추기', '스펠링', '써봐요', '말해요']) assert.equal(await page.getByRole('button', { name, exact: true }).count(), 1);
    await button(page, '짝 맞추기');
    await page.locator('.story-match').getByRole('button', { name: 'tree', exact: true }).click();
    await button(page, '짝 맞추기 그림 1');
    await page.getByText('아직 짝이 아니에요. 소리와 그림을 다시 살펴봐요.', { exact: true }).waitFor();
    await button(page, '짝 맞추기 그림 2');
    await page.locator('.story-match').getByRole('button', { name: 'house', exact: true }).click(); await button(page, '짝 맞추기 그림 3');
    await page.locator('.story-match').getByRole('button', { name: 'ladder', exact: true }).click(); await button(page, '짝 맞추기 그림 1');
    await page.getByText('세 쌍 모두 찾았어요! 나무집의 친구들이 모였네요.', { exact: true }).waitFor();
    await screenshot(page, 'word-matching-mobile');
    const nextActivity = page.getByRole('button', { name: '다음 활동', exact: true });
    await nextActivity.scrollIntoViewIfNeeded();
    const nextBounds = await nextActivity.boundingBox();
    assert.ok(nextBounds && nextBounds.y >= 0 && nextBounds.y + nextBounds.height <= 845, 'The embedded activity footer must be reachable by scrolling');
    await nextActivity.click();
    await page.locator('#spelling').fill('wrong'); await button(page, '맞는지 볼까요?');
    await page.getByText('조금 달라요. 소리를 다시 듣고 천천히 해봐요.', { exact: true }).waitFor();
    await page.locator('#spelling').fill('TREE'); await button(page, '맞는지 볼까요?');
    await page.getByText('맞았어요! 글자들이 제자리를 찾았어요.', { exact: true }).waitFor();
    await screenshot(page, 'word-spelling-mobile');
    await button(page, '이야기로 돌아가기'); await heading(page, '저 위에 집이 있어!');
    assert.equal(await page.getByRole('button', { name: '나무 위 집 찾기', exact: true }).isDisabled(), true);
    await screenshot(page, 'story-mobile');
    checks.push('Story hotspot opens the relevant word, matching and spelling work, and returning keeps story progress');

    await page.setViewportSize({ width: 1280, height: 900 });
    await screenshot(page, 'story-desktop');
    await button(page, '이야기 계속하기');
    for (let count = 0; count < 3; count++) {
      assert.equal(await page.getByRole('button', { name: '이야기 계속하기', exact: true }).count(), 0);
      await button(page, `한 칸 올라가기 ${count}/3`);
    }
    await button(page, '이야기 계속하기');
    for (let count = 0; count < 3; count++) await button(page, `문 두드리기 ${count} / 3`);
    await button(page, '이야기 계속하기'); await button(page, '창문 열기');
    await button(page, '이야기 계속하기'); await button(page, '할아버지의 그림 붓 확인');
    await button(page, '이야기 계속하기'); await button(page, '이야기 책 펼치기');
    await button(page, '이야기 계속하기');
    await page.getByLabel('할아버지에게 남기는 나의 한 문장', { exact: true }).fill('My tree house has a window.');
    await button(page, '이야기 간직하기'); await heading(page, '또 놀러 올게요, 할아버지!');
    await button(page, '드림이와 마지막 미션'); await heading(page, '나무집을 찾아가요.');
    await screenshot(page, 'mission-desktop');
    await button(page, '미션 그림 1');
    assert.equal(await page.getByRole('button', { name: '한 걸음 더', exact: true }).count(), 0);
    await button(page, '미션 그림 2'); await button(page, '한 걸음 더');
    await button(page, '미션 그림 3'); await button(page, '다음 미션으로');
    await heading(page, '나무집 친구들을 이어줘요.');
    await button(page, 'ladder'); await button(page, '짝 맞추기 그림 2');
    await button(page, 'door'); await button(page, '짝 맞추기 그림 3');
    await button(page, 'window'); await button(page, '짝 맞추기 그림 1');
    await button(page, '다음 미션으로'); await heading(page, '추억책의 이름을 완성해요.');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#mission-spelling').fill('tree'); await button(page, '완성했어요'); await button(page, '한 걸음 더');
    await page.locator('#mission-spelling').fill('house'); await screenshot(page, 'mission-spelling-mobile');
    await button(page, '완성했어요'); await button(page, '추억책 열기');
    await heading(page, '우리의 추억책이 열렸어요!'); await screenshot(page, 'mission-complete-mobile');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await heading(page, '우리의 추억책이 열렸어요!');
    await button(page, 'tree 다시 연습하기'); await heading(page, '이야기에서 만난 친구');
    await button(page, '이야기로 돌아가기'); await heading(page, '우리의 추억책이 열렸어요!');
    checks.push('All story interactions lead into the final picture/matching/spelling mission; completion resumes and review returns correctly');
  } catch (error) {
    await page.screenshot({ path: `${artifacts}/lesson-failure.png`, fullPage: true }).catch(() => {});
    console.error({ phase: 'lesson', url: page.url(), visibleText: (await page.locator('body').innerText().catch(() => '')).slice(0, 1800) });
    throw error;
  } finally { await context.close(); }
}

(async () => {
  assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/, 'Only a local test server is allowed');
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  try {
    await verifyHome(browser);
    await verifyLesson(browser);
    assert.deepEqual(unexpectedWrites, []);
    assert.deepEqual(errors, []);
    const result = { pass: true, base, checks, liveWorldChecks, viewportChecks, browserErrors: errors, remoteStudentWrites: 0, checkedAt: new Date().toISOString() };
    fs.writeFileSync(`${artifacts}/verification.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
