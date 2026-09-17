const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const html=fs.readFileSync('public/team_manager3.html','utf8'),inline=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).join('\n');
function fixture(){
 const context=vm.createContext({CU:{id:'may'},_taskViews:{may:{read:'2026-09-15T09:00:00Z',comment:'2026-09-15T09:00:00Z'}},taskComments:{comment:[{author:'song',ts:Date.parse('2026-09-15T10:00:00Z')}]},isDoneTask:t=>!!t.done,console,Date});
 vm.runInContext(fs.readFileSync('public/staff-task-order.js','utf8'),context);return context;
}
function functions(context,names){const source=ts.createSourceFile('inline.js',inline,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);for(const name of names){const node=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text===name);assert.ok(node,name);vm.runInContext(node.getText(source),context);}}

test('NEW and NEW 댓글 describe distinct unread reasons and disappear after opening',()=>{
 const f=fixture();
 assert.match(f._staffTaskAttentionBadge({id:'new'}),/>NEW</);
 assert.doesNotMatch(f._staffTaskAttentionBadge({id:'new'}),/NEW 댓글/);
 assert.match(f._staffTaskAttentionBadge({id:'comment'}),/>NEW 댓글 1</);
 assert.doesNotMatch(f._staffTaskAttentionBadge({id:'comment'}),/>NEW</);
 delete f._taskViews.may.comment;
 const both=f._staffTaskAttentionBadge({id:'comment'});assert.match(both,/>NEW</);assert.match(both,/>NEW 댓글 1</);
 f._taskViews.may.comment='2026-09-16T00:00:00Z';assert.equal(f._staffTaskAttentionBadge({id:'comment'}),'');
});

test('navigation counts unread task rows, excludes projects/deleted/completed/private tasks and uses personal scope',()=>{
 const f=fixture(),elements={};
 Object.assign(f,{tasks:[{id:'new',assignee:'may'},{id:'comment',assignee:'may'},{id:'shared',shared:true},{id:'done',done:true,assignee:'may'},{id:'archived',assignee:'may'},{id:'private',secret:true,assignee:'song'}],_isArchivedTask:id=>id==='archived',isManagerCU:()=>false,isUnassignedTask:()=>false,myNotifs:[{type:'project'},{type:'task_comment',ref_id:'deleted'},{type:'task_comment',ref_id:'comment'},{type:'task_comment',ref_id:'comment'}],document:{getElementById:id=>/^badge-|^notif-dot-/.test(id)?elements[id]||(elements[id]={style:{}}):null}});
 functions(f,['taskVisible','_setNavBadge','updateNavBadges']);
 f.updateNavBadges();assert.equal(elements['badge-board'].textContent,'3');assert.equal(elements['badge-mywork'].textContent,'2');
 f._taskViews.may.comment='2026-09-16T00:00:00Z';f.updateNavBadges();assert.equal(elements['badge-board'].textContent,'2');assert.equal(elements['badge-mywork'].textContent,'1');
 f._taskViews.may.new='2026-09-16T00:00:00Z';f.updateNavBadges();assert.equal(elements['badge-mywork'].style.display,'none');
 f.taskComments.new=[{author:'song',ts:'2026-09-17T00:00:00Z'}];f.updateNavBadges();assert.equal(elements['badge-mywork'].textContent,'1');
});
test('personal unread and incoming comments precede checked urgent tasks; deterministic and non-mutating',()=>{
 const f=fixture(),rows=[{id:'read',priority:'high',due:'2026-09-01'},{id:'new',createdAt:'2026-09-15T08:00:00Z'},{id:'comment',createdAt:'2026-08-01'}];
 functions(f,['sortT']);assert.deepEqual(Array.from(f.sortT(rows),t=>t.id),['comment','new','read']);assert.equal(rows[0].id,'read');
 f._taskViews.may.comment='2026-09-15T11:00:00Z';assert.deepEqual(Array.from(f.sortT(rows),t=>t.id),['new','read','comment']);
 f.taskComments.comment.push({author:'song',ts:Date.parse('2026-09-15T12:00:00Z')});assert.equal(f.sortT(rows)[0].id,'comment');
 f._taskViews.song={read:'2026-09-15T13:00:00Z'};f.CU={id:'song'};assert.equal(f._staffTaskAttention(rows[0]).needed,false);assert.equal(f._staffTaskAttention(rows[2]).comments,0);
});
test('own messages and own created tasks do not reappear as unread; timestamp survives conversion',()=>{
 const f=fixture();functions(f,['rowToTc']);const ts=Date.parse('2026-09-15T12:00:00Z');const c=f.rowToTc({id:3,from_id:'may',ts,text:'own'});assert.equal(c.ts,ts);f.taskComments.read=[c];assert.equal(f._staffTaskAttention({id:'read'}).needed,false);assert.equal(f._staffTaskAttention({id:'own',createdBy:'may'}).needed,false);
});
test('table sections use my read state even if others have not read; new comments on old/stale tasks rise',()=>{
 const f=fixture();Object.assign(f,{tasks:[],_tablePool:()=>[{id:'read',priority:'high'},{id:'new',createdAt:'2026-09-15'},{id:'comment',createdAt:'2026-01-01'}],_isArchivedTask:()=>false,_boardEmpFilter:null,_boardCleanMode:false,boardFilter:'all',isUnassignedTask:()=>false,isStaleTask:t=>t.id==='comment',_btStrip:()=>'',_btCleanBanner:()=>'',_btFbar:()=>'',_btFilteredRows:()=>null,_btRow:t=>'<tr data-id="'+t.id+'"></tr>',parseLocalDate:s=>new Date(s)});functions(f,['_boardTableHtml']);const output=f._boardTableHtml();assert.ok(output.indexOf('data-id="new"')<output.indexOf('data-id="read"'));assert.ok(output.indexOf('data-id="comment"')<output.indexOf('data-id="read"'));assert.match(output,/확인한 업무 · 처리 중/);
});
test('opening one task acknowledges only its notifications and preserves other view records; failed saves restore state',async()=>{
 const f=fixture();const calls=[];Object.assign(f,{SB_URL:'https://test',SB_KEY:'test',loadBoardMeta:()=>Promise.resolve(),fetch:async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true};},sbPatch:async(table,query)=>calls.push({table,query}),myNotifs:[{ref_id:'read',type:'task_comment'},{ref_id:'comment',type:'task_comment'}],renderNotifBadges:()=>{},toast:()=>{}});functions(f,['_myViews','_saveMyViews','recordTaskView']);await f.recordTaskView('read');assert.equal(f.myNotifs.length,1);assert.equal(f.myNotifs[0].ref_id,'comment');assert.equal(calls[0].value.comment,'2026-09-15T09:00:00Z');assert.match(calls[1].query,/ref_id=eq.read/);const previous=f._taskViews.may.comment;f.fetch=async()=>({ok:false});await f.recordTaskView('comment');assert.equal(f._taskViews.may.comment,previous);
});
test('production scripts parse and task list navigation never clears all task comments',()=>{
 let count=0;for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){if(match[1].trim()){new vm.Script(match[1]);count++;}}assert.ok(count>0);assert.doesNotMatch(inline,/if\(p==='(?:board|mywork)'\)[^\n]*markNotifsRead\('task_comment'\)/);
});
test('returning from task details immediately refreshes the list order',()=>{
 const f=fixture();let refreshed=0;Object.assign(f,{_staffBoardDetailOpen:true,_boardSelTaskId:'read',_staffBoardReturnScroll:0,document:{getElementById:()=>null},window:{scrollTo:()=>{}},_boardUIMode:()=> 'table',renderBoardTable:()=>refreshed++,renderBoardSidebar:()=>refreshed++});functions(f,['closeBoardDrawer']);f.closeBoardDrawer();assert.equal(refreshed,1);assert.equal(f._staffBoardDetailOpen,false);f.closeBoardDrawer();assert.equal(refreshed,1);
});
