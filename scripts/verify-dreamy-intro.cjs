const {chromium}=require('C:/Users/desko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.LEARNING_TEST_URL||'http://localhost:3118';
const expected=JSON.parse(fs.readFileSync('scripts/dreamy-intro-timeline.json','utf8')).durationSeconds;
const seconds=value=>value.split(':').reduce((total,part)=>total*60+Number(part),0);
const cues=[...fs.readFileSync('public/learning/tree-house/dreamy-intro.ko.vtt','utf8').matchAll(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})\r?\n([^\r\n]+)/g)].map(match=>({start:seconds(match[1]),end:seconds(match[2]),text:match[3]}));
assert.equal(cues.length,5,'The approved introduction has five dialogue cues.');
async function seekPaused(page,video,time){
 await video.evaluate((v,target)=>{v.pause();v.currentTime=target;},time);
 await page.waitForFunction(target=>{const v=document.querySelector('video');return v&&!v.seeking&&v.paused&&Math.abs(v.currentTime-target)<.05;},time);
}
async function assertDialogue(page,text){
 const bubble=page.getByTestId('dreamy-dialogue');
 await bubble.waitFor({state:'visible'});
 await page.waitForFunction(expected=>document.querySelector('[data-testid="dreamy-dialogue"]')?.textContent?.includes(expected),text);
 assert.ok((await bubble.innerText()).includes(text));
 return bubble;
}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:950}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/learn');
  await page.getByRole('button',{name:'드림이 만나기',exact:true}).waitFor();
  const video=page.locator('video');await page.waitForFunction(()=>document.querySelector('video')?.readyState>=1);
  const before=await video.evaluate(v=>({paused:v.paused,time:v.currentTime,duration:v.duration,tracks:v.textTracks.length}));
  assert.equal(before.paused,true);assert.equal(before.time,0);assert.ok(before.duration>=expected-.3&&before.duration<expected+2);assert.equal(before.tracks,1);
  await page.waitForFunction(()=>document.querySelector('video')?.textTracks[0]?.cues?.length===5);
  assert.equal(await video.evaluate(v=>v.textTracks[0].mode),'hidden');
  await page.getByTestId('dreamy-dialogue').waitFor({state:'hidden'});
  await page.screenshot({path:'artifacts/learning/intro-live-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'드림이 만나기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('video')?.currentTime>3);
  await video.evaluate(v=>v.pause());await page.screenshot({path:'artifacts/learning/intro-playing.png',fullPage:true});
  const stopped=await video.evaluate(v=>v.currentTime);await page.waitForTimeout(250);assert.ok(Math.abs((await video.evaluate(v=>v.currentTime))-stopped)<.1);
  for(const cue of cues){
   await seekPaused(page,video,(cue.start+cue.end)/2);
   await assertDialogue(page,cue.text);
  }
  await page.screenshot({path:'artifacts/learning/intro-bubble-desktop.png',fullPage:true});
  await seekPaused(page,video,(cues[0].end+cues[1].start)/2);
  await page.getByTestId('dreamy-dialogue').waitFor({state:'hidden'});
  await seekPaused(page,video,(cues[0].start+cues[0].end)/2);
  await assertDialogue(page,cues[0].text);
  await video.evaluate(v=>{v.textTracks[0].mode='showing';});
  await page.getByTestId('dreamy-dialogue').waitFor({state:'hidden'});
  await video.evaluate(v=>{v.textTracks[0].mode='hidden';});
  await assertDialogue(page,cues[0].text);
  await video.evaluate(v=>{v.currentTime=v.duration-.7;return v.play();});await page.getByRole('button',{name:'내 학습 시작하기',exact:true}).waitFor();
  await page.getByTestId('dreamy-dialogue').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'한 번 더 보기',exact:true}).click();await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&!v.paused&&v.currentTime>.1&&v.currentTime<2;});
  await video.evaluate(v=>v.pause());await assertDialogue(page,cues[0].text);
  await page.getByRole('button',{name:'바로 시작하기',exact:false}).click();await page.getByRole('button',{name:'드림이 소개 다시 보기',exact:false}).waitFor();assert.ok(page.url().endsWith('/learn'));
  await page.reload();await page.getByRole('button',{name:'드림이 소개 다시 보기',exact:false}).waitFor();assert.equal(await page.locator('video').count(),0);
  await page.getByRole('button',{name:'드림이 소개 다시 보기',exact:false}).click();await page.getByRole('button',{name:'드림이 만나기',exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/learning/intro-live-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('button',{name:'드림이 만나기',exact:true}).click();
  const longest=cues.reduce((a,b)=>a.text.length>b.text.length?a:b);
  await seekPaused(page,video,(longest.start+longest.end)/2);
  const mobileBubble=await assertDialogue(page,longest.text);
  const videoBounds=await video.boundingBox(),bubbleBounds=await mobileBubble.boundingBox();
  assert.ok(videoBounds&&bubbleBounds);
  assert.ok(bubbleBounds.y>=videoBounds.y+videoBounds.height-.5,'Mobile dialogue must remain below the video and its controls.');
  assert.ok(bubbleBounds.x>=0&&bubbleBounds.x+bubbleBounds.width<=390.5,'Mobile dialogue must fit the viewport.');
  assert.ok(await mobileBubble.evaluate(el=>el.scrollWidth<=el.clientWidth),'Mobile dialogue text must fit the bubble.');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'artifacts/learning/intro-bubble-mobile.png',fullPage:true});
  const failed=await context.newPage();await failed.route('**/dreamy-intro.mp4*',route=>route.abort());await failed.goto(base+'/learn');await failed.getByRole('button',{name:'드림이 소개 다시 보기',exact:false}).click();await failed.getByRole('button',{name:'바로 학습하기',exact:false}).waitFor();await failed.getByRole('button',{name:'바로 학습하기',exact:false}).click();assert.ok(failed.url().endsWith('/learn'));
  assert.deepEqual(errors,[]);const result={duration:before.duration,autoplay:false,captions:true,playPause:true,ended:true,replay:true,skip:true,seenPersists:true,mediaErrorRecovery:true,mobileOverflow:false,speechBubbleCues:5,speechBubbleSeek:true,speechBubbleGapClears:true,speechBubbleEndedClears:true,speechBubbleReplay:true,nativeCaptionsDoNotDuplicate:true,mobileSpeechBubbleBelowVideo:true,pageErrors:errors};fs.writeFileSync('artifacts/learning/intro-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
