const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
const page=await browser.newPage({viewport:{width:1440,height:1000}});
let submitted;
await page.route('**/api/booking3',async route=>{submitted=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'LEVEL-UI-TEST'})});});
await page.goto((process.env.TEST_BASE||'http://localhost:4187')+'/booking3',{waitUntil:'networkidle'});
const level=page.getByRole('combobox',{name:'영어 수준 · 레벨'});
for(const [value,label] of [['zero','제로베이스'],['beginner','비기너'],['intermediate','미디엄'],['advanced','어드밴스']]){await level.selectOption(value);assert.equal(await level.inputValue(),value);assert.match(await level.locator('option:checked').innerText(),new RegExp(label));}
await level.selectOption('beginner');
await page.getByLabel('학생 한글 이름').fill('레벨 확인');await page.getByLabel('학생 영문 이름').fill('Level Test');await page.getByLabel('출생연도').fill('2018');await page.getByLabel('보호자 이름').fill('테스트');await page.getByLabel('보호자 연락처').fill('01000000000');
await page.getByRole('button',{name:'다음 단계'}).click();await page.getByLabel('희망 시작일').fill('2027-03-02');await page.getByRole('button',{name:'다음 단계'}).click();
assert.match(await page.locator('dl').first().innerText(),/비기너/);
await page.getByRole('button',{name:'이전',exact:true}).click();await page.getByRole('button',{name:'이전',exact:true}).click();assert.equal(await level.inputValue(),'beginner');
await page.getByRole('button',{name:'다음 단계'}).click();await page.getByRole('button',{name:'다음 단계'}).click();
await page.getByLabel('수업 운영·취소·환불 규정을 확인했습니다.').check();await page.getByLabel('개인정보 수집·이용에 동의합니다.').check();await page.getByRole('button',{name:'화상영어 신청 접수',exact:true}).click();await page.getByText('LEVEL-UI-TEST',{exact:true}).waitFor();assert.equal(submitted.form.level,'beginner');
console.log('PASS: four level choices, review label, back navigation, canonical submitted level (request intercepted; no real application created)');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
