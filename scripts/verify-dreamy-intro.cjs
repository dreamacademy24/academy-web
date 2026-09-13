const {chromium}=require('C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.LEARNING_TEST_URL||'http://localhost:3118';
const expected=JSON.parse(fs.readFileSync('scripts/dreamy-intro-timeline.json','utf8')).durationSeconds;
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:950}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/learn');
  await page.getByRole('button',{name:'드림이 만나기',exact:true}).waitFor();
  const video=page.locator('video');await page.waitForFunction(()=>document.querySelector('video')?.readyState>=1);
  const before=await video.evaluate(v=>({paused:v.paused,time:v.currentTime,duration:v.duration,tracks:v.textTracks.length}));
  assert.equal(before.paused,true);assert.equal(before.time,0);assert.ok(before.duration>=expected-.3&&before.duration<expected+2);assert.equal(before.tracks,1);
  await page.screenshot({path:'artifacts/learning/intro-live-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'드림이 만나기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('video')?.currentTime>3);
  await video.evaluate(v=>v.pause());await page.screenshot({path:'artifacts/learning/intro-playing.png',fullPage:true});
  const stopped=await video.evaluate(v=>v.currentTime);await page.waitForTimeout(250);assert.ok(Math.abs((await video.evaluate(v=>v.currentTime))-stopped)<.1);
  await video.evaluate(v=>{v.currentTime=v.duration-.7;return v.play();});await page.getByRole('button',{name:'내 학습 시작하기',exact:true}).waitFor();
  await page.getByRole('button',{name:'한 번 더 보기',exact:true}).click();await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&!v.paused&&v.currentTime<3;});
  await page.getByRole('button',{name:'바로 시작하기',exact:false}).click();await page.getByRole('button',{name:'드림이 소개 다시 보기',exact:false}).waitFor();assert.ok(page.url().endsWith('/learn'));
  await page.reload();await page.getByRole('button',{name:'드림이 소개 다시 보기',exact:false}).waitFor();assert.equal(await page.locator('video').count(),0);
  await page.getByRole('button',{name:'드림이 소개 다시 보기',exact:false}).click();await page.getByRole('button',{name:'드림이 만나기',exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/learning/intro-live-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const failed=await context.newPage();await failed.route('**/dreamy-intro.mp4*',route=>route.abort());await failed.goto(base+'/learn');await failed.getByRole('button',{name:'드림이 소개 다시 보기',exact:false}).click();await failed.getByRole('button',{name:'바로 학습하기',exact:false}).waitFor();await failed.getByRole('button',{name:'바로 학습하기',exact:false}).click();assert.ok(failed.url().endsWith('/learn'));
  assert.deepEqual(errors,[]);const result={duration:before.duration,autoplay:false,captions:true,playPause:true,ended:true,replay:true,skip:true,seenPersists:true,mediaErrorRecovery:true,mobileOverflow:false,pageErrors:errors};fs.writeFileSync('artifacts/learning/intro-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
