// UI fixtures only: no student data or authentication records are written.
const { chromium } = require('C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.LEARNING_TEST_URL || 'http://localhost:3118';
const origin = new URL(base).origin;
const artifacts = 'artifacts/learning-home';
const publicEnv = fs.existsSync('.env.local') ? require('dotenv').parse(fs.readFileSync('.env.local')) : {};
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || publicEnv.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const authChannel = `sb-${projectRef}-auth-token`;
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
const fixture = {
  children: [
    { learnerId: firstChild, nameKr: '테스트 별이', nameEn: 'Test Star', visits: [
      { visitId: currentVisit, startDate: '2026-09-01', endDate: '2026-09-30', assignment },
      { visitId: pastVisit, startDate: '2025-07-01', endDate: '2025-07-31', assignment: { ...assignment, levelCode: 'DR-F1', unitId: null, unitTitle: null, href: null, published: false } },
    ] },
    { learnerId: secondChild, nameKr: '테스트 달이', nameEn: 'Test Moon', visits: [
      { visitId: secondVisit, startDate: '2026-09-01', endDate: '2026-09-30', assignment: null },
    ] },
  ], pendingCount: 1,
};
const result = [];
let status = 401;
let body = { error: 'Fixture: parent login required' };
let holdNextRequest = false;
let releaseHeldResponse;
let notifyHeldRequest;

async function checkNoOverflow(page, label) {
  const size = await page.evaluate(() => ({ view: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(size.document <= size.view, `${label}: horizontal overflow ${JSON.stringify(size)}`);
}

(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/api/learning/children') {
      const response = { status, contentType: 'application/json', body: JSON.stringify(body) };
      if (holdNextRequest) {
        holdNextRequest = false;
        notifyHeldRequest();
        await new Promise(resolve => { releaseHeldResponse = resolve; });
      }
      return route.fulfill(response).catch(() => {});
    }
    return route.continue();
  });
  try {
    await page.goto(`${base}/learn`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.getByRole('button', { name: '드림이 만나기', exact: false }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    const videoBounds = await page.locator('video').boundingBox();
    const playBounds = await page.getByRole('button', { name: '드림이 만나기', exact: false }).boundingBox();
    assert.ok(videoBounds && playBounds && playBounds.y >= videoBounds.y + videoBounds.height, 'Mobile play button must sit below the character/video');
    await checkNoOverflow(page, 'mobile introduction');
    await page.screenshot({ path: `${artifacts}/intro-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    result.push('Mobile intro play button sits below the video without covering Dreamy');
    await page.getByRole('button', { name: '바로 시작하기', exact: false }).click();
    const login = page.getByRole('link', { name: '로그인하고 시작하기', exact: false });
    await login.waitFor();
    assert.equal(await login.getAttribute('href'), '/portal?returnTo=%2Flearn');
    assert.equal(await page.getByRole('link', { name: '학습 시작하기', exact: false }).count(), 0);
    result.push('401 prompts parent login with /learn return path');

    status = 503; body = { error: 'Fixture: database unavailable' };
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: '학습 정보를 불러오지 못했어요' }).waitFor();
    assert.equal(await page.getByRole('heading', { name: '연결된 아이가 아직 없어요' }).count(), 0);
    status = 200; body = { children: [], pendingCount: 0 };
    await page.getByRole('button', { name: '다시 불러오기', exact: true }).click();
    await page.getByRole('heading', { name: '연결된 아이가 아직 없어요' }).waitFor();
    result.push('503 is an error, retry distinguishes an empty account');

    body = { children: [], pendingCount: 2 };
    await page.getByRole('button', { name: '다시 확인하기', exact: true }).click();
    await page.getByRole('heading', { name: '연수 기록 확인이 필요해요' }).waitFor();
    assert.equal(await page.getByRole('button', { name: /테스트 별이/ }).count(), 0);
    result.push('Pending sources do not invent child identities or assignments');

    body = structuredClone(fixture);
    await page.getByRole('button', { name: '다시 확인하기', exact: true }).click();
    await page.getByRole('heading', { name: '학습할 아이를 선택해 주세요' }).waitFor();
    assert.equal(await page.getByRole('link', { name: '학습 시작하기', exact: false }).count(), 0);
    await page.getByRole('button', { name: /테스트 별이/ }).click();
    let start = page.getByRole('link', { name: '학습 시작하기', exact: false });
    await start.waitFor();
    let target = new URL(await start.getAttribute('href'), base);
    assert.equal(target.pathname, '/learn/tree-house');
    assert.equal(target.searchParams.get('learnerId'), firstChild);
    assert.equal(target.searchParams.get('visitId'), currentVisit);
    assert.equal(await page.getByRole('combobox', { name: '연수 기록 선택' }).inputValue(), currentVisit);
    result.push('Two children require selection; published unit carries exact child/current-visit IDs');

    await page.getByRole('combobox', { name: '연수 기록 선택' }).selectOption(pastVisit);
    await page.getByRole('heading', { name: '교재 배정을 기다리고 있어요' }).waitFor();
    assert.equal(await start.count(), 0);
    assert.ok((await page.locator('main').innerText()).includes('DR-F1'));
    await page.getByRole('combobox', { name: '연수 기록 선택' }).selectOption(currentVisit);
    await start.waitFor();
    result.push('Previous visit uses its own level and cannot fall back to the published first unit');

    await page.getByRole('button', { name: /테스트 달이/ }).click();
    await page.getByRole('heading', { name: '배울 내용을 준비하고 있어요' }).waitFor();
    assert.equal(await start.count(), 0);
    assert.equal(await page.getByRole('combobox', { name: '연수 기록 선택' }).count(), 0);
    result.push('Switching child removes the previous child lesson and visit selector');

    body.children[1].visits[0].assignment = { ...assignment, levelCode: 'DR-F1', unitId: 'not-published', unitTitle: null, href: null, published: false };
    await page.getByRole('button', { name: '아이의 학습 정보 새로고침' }).click();
    await page.getByRole('heading', { name: '교재를 준비하고 있어요' }).waitFor();
    assert.equal(await start.count(), 0);
    result.push('An unpublished assignment has no start link');

    await page.getByRole('button', { name: /테스트 별이/ }).click();
    await start.waitFor();
    await checkNoOverflow(page, 'desktop');
    await page.screenshot({ path: `${artifacts}/home-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await checkNoOverflow(page, '390px');
    await page.screenshot({ path: `${artifacts}/home-mobile.png`, fullPage: true });
    assert.doesNotMatch(await page.locator('main').innerText(), /\bBR[- ]?\d+/i);
    const preview = page.getByRole('link', { name: '로그인 없이 공개 체험 보기', exact: false });
    assert.equal(await preview.getAttribute('href'), '/learn/tree-house?preview=1');
    result.push('Desktop/mobile fit; only official level labels; public preview stays explicit');

    status = 503;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByRole('heading', { name: '학습 정보를 불러오지 못했어요' }).waitFor();
    assert.equal(await page.getByRole('button', { name: /테스트 별이/ }).count(), 0);
    status = 200;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await start.waitFor();
    result.push('Returning focus revalidates assignments and hides stale names during failure');

    const requestHeld = new Promise(resolve => { notifyHeldRequest = resolve; });
    holdNextRequest = true;
    await page.getByRole('button', { name: '아이의 학습 정보 새로고침' }).click();
    await requestHeld;
    status = 401;
    await page.evaluate(name => {
      const channel = new BroadcastChannel(name);
      channel.postMessage({ event: 'SIGNED_OUT', session: null });
      channel.close();
    }, authChannel);
    await login.waitFor();
    assert.equal(await page.getByRole('button', { name: /테스트 별이/ }).count(), 0);
    releaseHeldResponse();
    await page.waitForTimeout(100);
    assert.equal(await start.count(), 0);
    await login.waitFor();
    result.push('Cross-tab sign-out hides names immediately; late previous response cannot restore them');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await login.waitFor();
    assert.equal(await page.getByRole('button', { name: /테스트 별이/ }).count(), 0);
    assert.equal(await start.count(), 0);
    result.push('Expired login removes previously displayed student/assignment information');
    assert.deepEqual(errors, []);
    fs.writeFileSync(`${artifacts}/verification.json`, JSON.stringify({ pass: true, checks: result, browserErrors: errors }, null, 2));
    console.log(JSON.stringify({ pass: true, checks: result }, null, 2));
  } catch (error) {
    await page.screenshot({ path: `${artifacts}/failure.png`, fullPage: true }).catch(() => {});
    console.error({ url: page.url(), visibleText: (await page.locator('body').innerText().catch(() => '')).slice(0, 1200), errors });
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
