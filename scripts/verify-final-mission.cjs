const { chromium } = require('C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.LEARNING_TEST_URL || 'http://localhost:3118';
const DB = 'dream-learning-preview-v1';
const MISSION = 'treehouse-final-mission-v1';
const ADVENTURE = 'treehouse-adventure-v1';
const artifacts = 'artifacts/learning';

async function stored(page, key) {
  return page.evaluate(({ dbName, key }) => new Promise((resolve, reject) => {
    const opening = indexedDB.open(dbName, 1);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const tx = db.transaction('drafts', 'readonly');
      const read = tx.objectStore('drafts').get(key);
      tx.oncomplete = () => { db.close(); resolve(read.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }), { dbName: DB, key });
}

async function waitStored(page, key, predicate) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const value = await stored(page, key);
    if (predicate(value)) return value;
    await page.waitForTimeout(100);
  }
  throw new Error(`Stored state did not settle: ${key}`);
}

async function preservedRecords(page) {
  return page.evaluate(async ({ dbName, missionKey }) => {
    const db = await new Promise((resolve, reject) => {
      const opening = indexedDB.open(dbName, 1);
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
    });
    const result = {};
    for (const name of ['drafts', 'audio']) {
      const records = await new Promise((resolve, reject) => {
        const tx = db.transaction(name, 'readonly');
        const store = tx.objectStore(name);
        const keys = store.getAllKeys();
        const values = store.getAll();
        tx.oncomplete = () => resolve(keys.result.map((key, i) => [key, values.result[i]]));
        tx.onerror = () => reject(tx.error);
      });
      result[name] = [];
      for (const [key, value] of records) {
        if (key === missionKey) continue;
        if (value.blob) {
          const digest = await crypto.subtle.digest('SHA-256', await value.blob.arrayBuffer());
          result[name].push([key, { ...value, blob: { size: value.blob.size, type: value.blob.type, digest: Array.from(new Uint8Array(digest)) } }]);
        } else result[name].push([key, value]);
      }
    }
    db.close();
    return result;
  }, { dbName: DB, missionKey: MISSION });
}

async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(size.document <= size.width, `${label} overflows: ${JSON.stringify(size)}`);
}

async function solvePictures(page) {
  await page.getByRole('button', { name: '미션 그림 2', exact: true }).click();
  await page.getByRole('button', { name: '한 걸음 더', exact: true }).click();
  await page.getByRole('button', { name: '미션 그림 3', exact: true }).click();
  await page.getByRole('button', { name: '다음 미션으로', exact: true }).click();
  await page.getByRole('heading', { name: '나무집 친구들을 이어줘요.', exact: true }).waitFor();
}

(async () => {
  assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/, 'Only a local test server is allowed');
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, permissions: ['microphone'], hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(15000);
  try {
    await page.goto(`${base}/learn/tree-house`);
    await page.getByRole('heading', { name: '나무집 창문 너머에는?', exact: true }).waitFor();
    await page.getByText('체험 모드 · 이 기기에만 저장', { exact: true }).waitFor();
    assert.equal(await page.getByRole('img', { name: '손을 흔드는 망고 드림이' }).count(), 1);
    await page.getByRole('button', { name: '이야기 속으로', exact: true }).click();
    await page.getByRole('button', { name: '나무 위 집 찾기', exact: true }).click();
    await page.getByRole('button', { name: '이야기 계속하기', exact: true }).click();
    for (let i = 0; i < 3; i++) {
      assert.equal(await page.getByRole('button', { name: '이야기 계속하기', exact: true }).count(), 0);
      await page.getByRole('button', { name: `한 칸 올라가기 ${i}/3`, exact: true }).click();
    }
    await page.getByRole('button', { name: '이야기 계속하기', exact: true }).click();
    for (let i = 0; i < 3; i++) {
      assert.equal(await page.getByRole('button', { name: '이야기 계속하기', exact: true }).count(), 0);
      await page.getByRole('button', { name: `문 두드리기 ${i} / 3`, exact: true }).click();
    }
    await page.getByRole('button', { name: '이야기 계속하기', exact: true }).click();
    await page.getByRole('button', { name: '창문 열기', exact: true }).click();
    await page.getByRole('button', { name: '이야기 계속하기', exact: true }).click();
    await page.getByRole('button', { name: '할아버지의 그림 붓 확인', exact: true }).click();
    await page.getByRole('button', { name: '이야기 계속하기', exact: true }).click();
    await page.getByRole('button', { name: '이야기 책 펼치기', exact: true }).click();
    await page.getByRole('button', { name: '이야기 계속하기', exact: true }).click();
    await page.getByLabel('할아버지에게 남기는 나의 한 문장').fill('My tree house has a window.');
    const ink = page.getByRole('img', { name: '나무집 추억 손글씨 쓰기판', exact: true });
    await ink.scrollIntoViewIfNeeded();
    const box = await ink.boundingBox();
    assert.ok(box);
    await page.mouse.move(box.x + 30, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 130, box.y + 110, { steps: 10 });
    await page.mouse.up();
    assert.equal(await page.getByRole('button', { name: '한 획 지우기', exact: true }).isEnabled(), true);
    await page.getByRole('button', { name: '녹음 시작', exact: true }).click();
    await page.getByRole('button', { name: '녹음 정지', exact: true }).waitFor();
    await page.waitForTimeout(1800);
    await page.getByRole('button', { name: '녹음 정지', exact: true }).click();
    await page.locator('audio').waitFor();
    await page.getByRole('button', { name: '이야기 간직하기', exact: true }).click();
    await page.getByRole('heading', { name: '또 놀러 올게요, 할아버지!', exact: true }).waitFor();
    await page.getByRole('button', { name: '드림이와 마지막 미션', exact: true }).click();
    await page.getByRole('heading', { name: '나무집을 찾아가요.', exact: true }).waitFor();
    await page.screenshot({ path: `${artifacts}/final-mission-picture-desktop.png`, fullPage: true });
    await page.screenshot({ path: `${artifacts}/mission-desktop.png`, fullPage: true });
    console.log('PASS: all nine story scenes, three climbs/knocks, window/book, original sentence/ink/audio, final mission entry');

    assert.equal(await page.getByRole('button', { name: '한 걸음 더', exact: true }).count(), 0);
    await page.getByRole('button', { name: '미션 그림 1', exact: true }).click();
    await page.getByText('괜찮아. 다시 듣고 그림을 천천히 살펴보자.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '한 걸음 더', exact: true }).count(), 0);
    await solvePictures(page);
    await page.getByRole('button', { name: 'ladder', exact: true }).click();
    await page.getByRole('button', { name: '짝 맞추기 그림 1', exact: true }).click();
    await page.getByText('아직 짝이 아니에요. 소리와 그림을 다시 살펴봐요.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '다음 미션으로', exact: true }).count(), 0);
    await page.getByRole('button', { name: '짝 맞추기 그림 2', exact: true }).click();
    await waitStored(page, MISSION, value => value?.checkpoint === 1 && value.matched.length === 1);
    await page.reload();
    await page.getByRole('heading', { name: '나무집 친구들을 이어줘요.', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '✓ ladder', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: '짝 맞추기 그림 2', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: '다음 미션으로', exact: true }).count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page, 'matching at 390px');
    await page.screenshot({ path: `${artifacts}/final-mission-match-mobile.png`, fullPage: true });
    await page.screenshot({ path: `${artifacts}/mission-mobile.png`, fullPage: true });
    await page.getByRole('button', { name: 'door', exact: true }).click();
    await page.getByRole('button', { name: '짝 맞추기 그림 3', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: '다음 미션으로', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'window', exact: true }).click();
    await page.getByRole('button', { name: '짝 맞추기 그림 1', exact: true }).click();
    await page.getByRole('button', { name: '다음 미션으로', exact: true }).click();
    console.log('PASS: picture mistakes gate progress, two picture rounds, matching mistakes, partial matching resumes after reload');

    await page.getByRole('heading', { name: '추억책의 이름을 완성해요.', exact: true }).waitFor();
    await page.locator('#mission-spelling').fill('wrong');
    await page.getByRole('button', { name: '완성했어요', exact: true }).click();
    await page.getByText('조금 달라. 한 글자씩 다시 살펴보자.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '한 걸음 더', exact: true }).count(), 0);
    await page.locator('#mission-spelling').fill('  TrEe ');
    await page.getByRole('button', { name: '완성했어요', exact: true }).click();
    await page.getByRole('button', { name: '한 걸음 더', exact: true }).click();
    await page.getByRole('button', { name: '글자 도움', exact: true }).tap();
    await page.getByText('천천히 보고 써봐요.', { exact: false }).waitFor();
    await page.getByRole('button', { name: '도움 닫기', exact: true }).tap();
    for (const [letter, position] of [['h', 3], ['o', 5], ['u', 1], ['s', 4], ['e', 2]]) {
      const tile = page.getByRole('button', { name: `${letter} 글자 넣기 ${position}`, exact: true });
      await tile.tap();
      assert.equal(await tile.isDisabled(), true);
    }
    assert.equal(await page.locator('#mission-spelling').inputValue(), 'house');
    await noOverflow(page, 'spelling at 390px');
    await page.screenshot({ path: `${artifacts}/final-mission-spelling-mobile.png`, fullPage: true });
    await page.getByRole('button', { name: '완성했어요', exact: true }).tap();
    assert.equal(await page.getByRole('heading', { name: '우리의 추억책이 열렸어요!', exact: true }).count(), 0);
    await page.getByRole('button', { name: '추억책 열기', exact: true }).tap();
    await page.getByRole('heading', { name: '우리의 추억책이 열렸어요!', exact: true }).waitFor();
    await page.getByText('글자 도움으로 완성한 단어: house', { exact: true }).waitFor();
    const completed = await waitStored(page, MISSION, value => value?.checkpoint === 3);
    assert.deepEqual(completed.reviewWords, [0, 3]);
    assert.deepEqual(completed.supportedWords, [1]);
    assert.ok(completed.completedAt);
    await noOverflow(page, 'completion at 390px');
    await page.screenshot({ path: `${artifacts}/final-mission-complete-mobile.png`, fullPage: true });
    console.log('PASS: spelling wrong/right, whitespace/case normalization, touchscreen letter tiles and hints, completion records review/support words');

    await page.getByRole('button', { name: 'tree 다시 연습하기', exact: true }).tap();
    await page.getByRole('heading', { name: '이야기에서 만난 친구', exact: true }).waitFor();
    assert.equal(await page.locator('.big-word').textContent(), 'tree');
    for (const name of ['그림 찾기', '짝 맞추기', '스펠링', '써봐요', '말해요']) assert.equal(await page.getByRole('button', { name, exact: true }).count(), 1);
    await page.getByRole('button', { name: '이야기로 돌아가기', exact: true }).click();
    await page.getByRole('heading', { name: '우리의 추억책이 열렸어요!', exact: true }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: '우리의 추억책이 열렸어요!', exact: true }).waitFor();
    assert.equal((await stored(page, MISSION)).completedAt, completed.completedAt);
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.screenshot({ path: `${artifacts}/final-mission-complete-desktop.png`, fullPage: true });
    await page.screenshot({ path: `${artifacts}/mission-complete.png`, fullPage: true });
    const before = await preservedRecords(page);
    assert.equal(before.audio.length, 1);
    assert.ok(before.audio[0][1].blob.size > 100);
    const adventure = before.drafts.find(([key]) => key === ADVENTURE)[1];
    assert.equal(adventure.sentence, 'My tree house has a window.');
    assert.ok(adventure.ink.length > 0);
    await page.getByRole('button', { name: '미션 다시 놀기', exact: true }).click();
    await page.getByRole('heading', { name: '나무집을 찾아가요.', exact: true }).waitFor();
    await waitStored(page, MISSION, value => value?.checkpoint === 0 && value.round === 0 && value.completedAt === null);
    assert.deepEqual(await preservedRecords(page), before);
    console.log('PASS: review opens existing Player and returns to completion; reload retains result; mission replay preserves story, writing, practice and audio bytes');

    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page, 'picture game at 390px');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.getByRole('heading', { name: '나무집을 찾아가요.', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '움직임 꺼짐', exact: true }).getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('main').evaluate(main => Array.from(main.querySelectorAll('*')).every(element => {
      const style = getComputedStyle(element);
      return style.animationName === 'none' && style.transitionDuration.split(',').every(value => Number.parseFloat(value) === 0);
    })), true);
    await page.getByRole('button', { name: '이야기로 돌아가기', exact: true }).click();
    await page.getByRole('heading', { name: '또 놀러 올게요, 할아버지!', exact: true }).waitFor();
    await page.getByRole('button', { name: '드림이와 마지막 미션', exact: true }).click();
    await page.getByRole('heading', { name: '나무집을 찾아가요.', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '움직임 꺼짐', exact: true }).count(), 1);
    await noOverflow(page, 'reduced-motion mission at 390px');
    assert.deepEqual(errors, []);
    console.log('PASS: 390px picture/matching/spelling/completion without horizontal overflow; reduced motion; story return/re-entry; no page errors');
  } catch (error) {
    await page.screenshot({ path: `${artifacts}/final-mission-failure.png`, fullPage: true }).catch(() => {});
    console.error('Current URL:', page.url());
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
