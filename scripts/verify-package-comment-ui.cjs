// Browser integration against the actual UI modules, with isolated API fixtures.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),base=process.env.BASE_URL||'http://localhost:4187';
const out=path.join(root,'public/staff-guides/2026-09/updates');
const part=(count,start)=>({count,start,days:['월','수','금'],times:{월:'19:00',수:'19:00',금:'19:00'}});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'});fs.mkdirSync(out,{recursive:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const bookings=[{id:'00000000-0000-0000-0000-000000000001',number:'예시 연수 A',from:'2026-11-01',to:'2026-11-29',weeks:4,basis:'학생 등록 주수',student:'예시 학생',english:'Example'}, {id:'00000000-0000-0000-0000-000000000002',number:'예시 연수 B',from:'2027-03-01',to:'2027-03-14',weeks:2,basis:'학생 등록 주수',student:'예시 학생',english:'Example'}];
 const meta={admin:false,bookings,sessions:[],holidays:[],snapshot:'fixture',bookingSnapshot:'fixture',enrollment:null,children:[{name:'예시 학생',english:'Example'}],existing:[],plan:{version:1,bookingIds:bookings.map(b=>b.id),total:18,manual:false,reason:'',pre:part(9,'2026-10-05'),post:part(9,'2027-03-15')}};
 let submitted;
 await page.route('**/api/online-class/package-plan*',route=>{if(route.request().method()==='POST'){submitted=route.request().postDataJSON();return route.fulfill({json:{ok:true,id:'fixture'}});}return route.fulfill({json:meta});});
 await page.goto(base+'/portal/online-class/apply');await page.getByLabel('수강 학생').selectOption('예시 학생');
 await page.getByLabel('총 제공 회차',{exact:true}).waitFor();assert.equal(await page.getByLabel('총 제공 회차',{exact:true}).inputValue(),'18');
 await page.locator('label').filter({hasText:'예시 연수 B'}).locator('input').uncheck();assert.equal(await page.getByLabel('총 제공 회차',{exact:true}).inputValue(),'12');
 assert.equal(await page.getByLabel('연수 후 회차',{exact:true}).inputValue(),'3');
 await page.getByLabel('연수 전 수요일',{exact:true}).click();assert.equal(await page.getByLabel('총 제공 회차',{exact:true}).inputValue(),'12');
 await page.getByLabel('연수 전 수요일',{exact:true}).click();await page.getByLabel('연수 후 시작일',{exact:true}).fill('2026-11-30');
 await page.getByRole('button',{name:'전부 연수 전',exact:true}).click();assert.equal(await page.getByLabel('연수 후 회차',{exact:true}).inputValue(),'0');
 await page.getByRole('button',{name:'전부 연수 후',exact:true}).click();assert.equal(await page.getByLabel('연수 전 회차',{exact:true}).inputValue(),'0');
 await page.getByLabel('연수 전 회차',{exact:true}).fill('9');assert.equal(await page.getByLabel('연수 후 회차',{exact:true}).inputValue(),'3');
 assert.deepEqual((await page.getByRole('alert').allTextContents()).map(x=>x.trim()).filter(Boolean),[]);
 await page.locator('fieldset').screenshot({path:path.join(out,'package-split.png')});
 await page.getByRole('checkbox').last().check();await page.getByRole('button',{name:'이 일정으로 신청하기',exact:true}).click();
 await page.getByRole('dialog').waitFor();assert.equal(submitted.package_plan.total,12);assert.equal(submitted.package_plan.pre.count,9);assert.equal(submitted.package_plan.post.count,3);await page.getByRole('button',{name:'확인 · 닫기'}).click();
 console.log('PASS parent: multiple bookings, fixed entitlement, all/split, submission and guide');
 // Load production comment/detail/media scripts into a fixture-only task.
 const staff=await browser.newPage({viewport:{width:1440,height:1080}});staff.on('pageerror',e=>errors.push(e.message));
 await staff.route('**/ui-comment-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body><div id="fixture"></div></body></html>'}));
 await staff.goto(base+'/ui-comment-fixture');
 for(const file of ['staff-workspace-task.css','staff-workspace-media.css'])if(fs.existsSync(path.join(root,'public',file)))await staff.addStyleTag({path:path.join(root,'public',file)});
 await staff.addStyleTag({content:'body{margin:0;background:#f5f6fb;color:#172238;font:16px Arial,sans-serif}button,input,textarea{font:inherit}#fixture{padding:24px}.swh-primary{background:#6049c8;color:white;border:0;border-radius:9px;padding:12px 20px}'});
 await staff.evaluate(()=>{
  window.CU={id:'example',name:'예시 직원'};window.tasks=[{id:'fixture',title:'사진으로 업무 결과 공유하기',createdBy:'example',assignee:'example',note:'진행 결과를 댓글과 사진으로 남겨주세요.',createdAt:'2026-09-15T10:00:00+09:00',files:[],checklist:[]}];window.taskComments={fixture:[]};
  window.isManagerCU=()=>false;window._staffAssigned=()=>true;window.taskVisible=()=>true;window.isDoneTask=()=>false;window.getP=()=>CU;window._staffSafe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));window._taskNoteHtml=t=>'<p>'+_staffSafe(t.note)+'</p>';window.todayStr=()=> '2026-09-15';window.renderTaskFiles=t=>_staffAttachmentHtml(t.files);window.fileKind=f=>f.type.startsWith('image/')?'image':'file';window.fmtFileSize=n=>Math.round(n/1024)+'KB';window.sv=()=>{};window.rowToTc=r=>({id:r.id,author:r.from_id,text:r.text,files:r.files||[],date:'2026. 9. 15. 오후 7:30'});window.createNotifMultiple=()=>{};
 });
 for(const file of ['staff-comment-photos.js','staff-workspace-task.js','staff-workspace-media.js'])await staff.addScriptTag({path:path.join(root,'public',file)});
 let counter=0,saved=null,fail=true;
 await staff.route('**/api/staff/comments/photos',r=>r.fulfill({json:{photo:{name:'예시 수업안내.png',url:base+'/booking3/class-guide-20260902.png',size:10000,type:'image/png'}}}));
 await staff.route('**/api/staff/comments',r=>{const p=r.request().postDataJSON(),method=r.request().method();if(method==='POST'&&fail){fail=false;return r.fulfill({status:503,json:{error:'테스트: 잠시 후 다시 시도'}});}if(method==='DELETE'){const comment=saved;saved=null;return r.fulfill({json:{deleted:true,comment}});}saved={id:p.id,task_id:p.taskId,from_id:'example',text:p.text,files:p.files};counter++;return r.fulfill({json:{comment:saved,deleted:false}});});
 await staff.evaluate(()=>_renderStaffTaskDetail('fixture','fixture'));
 const sample={name:'sample.png',mimeType:'image/png',buffer:fs.readFileSync(path.join(root,'public/booking3/class-guide-20260902.png'))};
 await staff.locator('input[type=file]').setInputFiles([sample,sample]);await staff.getByText('2장 첨부됨',{exact:false}).waitFor();
 await staff.locator('[data-remove-photo]').first().click();assert.equal(await staff.locator('.swt-photo-drafts figure').count(),1);
 await staff.getByRole('button',{name:'보고 등록',exact:true}).click();await staff.getByText('보고 등록 실패:',{exact:false}).waitFor();assert.equal(await staff.locator('.swt-photo-drafts figure').count(),1);
 await staff.getByRole('button',{name:'보고 등록',exact:true}).click();await staff.locator('.swt-comment').waitFor();assert.equal(saved.text,'');assert.equal(saved.files.length,1);
 await staff.locator('[data-staff-photo]').click();await staff.getByRole('dialog',{name:'사진 확대 보기'}).waitFor();await staff.getByRole('button',{name:'사진 보기 닫기'}).click();
 await staff.getByRole('button',{name:'수정',exact:true}).click();await staff.getByLabel('댓글 수정',{exact:true}).fill('변경한 화면을 사진으로 첨부합니다.');await staff.locator('.swt-comment-controls input[type=file]').setInputFiles(sample);await staff.locator('.swt-comment-controls').getByText('2장 첨부됨',{exact:false}).waitFor();await staff.getByRole('button',{name:'저장',exact:true}).click();await staff.getByText('댓글을 수정했습니다.',{exact:true}).waitFor();assert.equal(saved.files.length,2);
 await staff.locator('.swt-comment').screenshot({path:path.join(out,'comment-photos.png')});
 await staff.getByRole('button',{name:'수정',exact:true}).click();await staff.locator('[data-remove-photo]').first().click();await staff.getByRole('button',{name:'저장',exact:true}).click();await staff.waitForFunction(()=>taskComments.fixture[0].files.length===1);assert.equal(saved.files.length,1);
 await staff.getByRole('button',{name:'삭제',exact:true}).click();await staff.getByRole('button',{name:'삭제 확인',exact:true}).click();await staff.waitForFunction(()=>taskComments.fixture.length===0);assert.equal(saved,null);assert.equal(counter,3);
 assert.deepEqual(errors,[]);console.log('PASS comments: multiple photos, remove, failed save retains draft, photo-only submit, gallery, edit/add/remove/delete');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
