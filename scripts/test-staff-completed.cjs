const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'public/team_manager3.html'),'utf8');
const codes=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
for(const file of ['staff-workspace-home.js','staff-workspace-task.js','staff-task-order.js'])codes.push(fs.readFileSync(path.join(root,'public',file),'utf8'));
const functions=new Map();for(const code of codes){new vm.Script(code);for(const n of ts.createSourceFile('s.js',code,99,true,1).statements)if(ts.isFunctionDeclaration(n)&&n.name)functions.set(n.name.text,n.getText());}
function context(names,extra={}){const c=vm.createContext({console,...extra});for(const n of names)vm.runInContext(functions.get(n),c);return c;}
const done=Array.from({length:27},(_,i)=>({id:'done-'+i,title:'Completed '+i,done:i%2===0,progress:100,assignee:'ceo',assignees:[],createdAt:'2026-09-16'}));
const active={id:'active',title:'Active',done:false,progress:0,assignee:'ceo',assignees:[]};
const archived=id=>id==='done-26';
test('home excludes done tasks and related notifications without marking notifications read',()=>{
 const box={innerHTML:''},tasks=[active,...done];
 const myNotifs=[{id:'d',type:'task_comment',ref_id:'done-0',message:'Completed comment'},{id:'a',type:'task_assigned',ref_id:'active',message:'Active assignment'},{id:'m',type:'task',ref_id:'deleted',message:'Deleted'},{id:'p',type:'approval',message:'Approval'}];
 const c=context(['isDoneTask','_staffAssigned','_staffHomeModel','_staffActiveTaskNotification','_staffHomeActivity','_staffSafe'],{tasks,myNotifs,_isArchivedTask:archived,_staffTaskCompare:()=>0,document:{getElementById:()=>box},_actWhen:()=>''});
 assert.deepEqual(Array.from(c._staffHomeModel(tasks,[],{},'ceo','2026-09-16').assigned,t=>t.id),['active']);
 c._staffHomeActivity();assert.match(box.innerHTML,/Active assignment/);assert.match(box.innerHTML,/Approval/);assert.doesNotMatch(box.innerHTML,/Completed comment|Deleted/);assert.ok(myNotifs.every(n=>n.is_read===undefined));
 active.done=true;c._staffHomeActivity();assert.doesNotMatch(box.innerHTML,/Active assignment/);active.done=false;c._staffHomeActivity();assert.match(box.innerHTML,/Active assignment/);
});
test('completed table and master-detail retain all 27 rows including archived completions',()=>{
 const c=context(['isDoneTask','_boardFiltered','_boardTableHtml','_btFilteredRows'],{tasks:[active,...done],CU:{id:'ceo'},isManagerCU:()=>true,boardFilter:'done',_boardSearch:'',_boardEmpFilter:null,_boardCleanMode:false,_isArchivedTask:archived,_tablePool:()=>[active,...done],isUnassignedTask:()=>false,isStaleTask:()=>false,parseLocalDate:x=>new Date(x),_btStrip:()=>'',_btCleanBanner:()=>'',_btFbar:()=>'',_staffTaskCompare:()=>0,_staffTaskTime:x=>Date.parse(x),_staffTaskAttention:()=>({needed:false}),_btRow:t=>'<tr data-id="'+t.id+'"></tr>'});
 assert.equal(c._boardFiltered().length,27);let result=c._boardTableHtml();assert.equal((result.match(/data-id="done-/g)||[]).length,27);assert.doesNotMatch(result,/data-id="active"/);
 c.boardFilter='all';result=c._boardTableHtml();assert.equal((result.match(/data-id="done-/g)||[]).length,0);assert.match(result,/data-id="active"/);
 assert.deepEqual(Array.from(c._boardFiltered(),t=>t.id),['active']);
});
test('home sidebar hides completed titles and board sidebar displays them',()=>{
 const box={innerHTML:''},emp={id:'ceo',name:'CEO',color:'#333',initial:'C'};
 const c=context(['isDoneTask','renderEmpSidebar'],{tasks:[active,...done],CU:emp,getP:()=>emp,isAdmin:()=>true,_empTab:'home',document:{getElementById:()=>box},esc:x=>x,_isUrgentEmpTask:()=>false,_renderEmpSection:(_l,rows)=>rows.map(t=>t.title).join('|')});
 c.renderEmpSidebar('ceo');assert.match(box.innerHTML,/Active/);assert.doesNotMatch(box.innerHTML,/Completed/);c._empTab='board';c.renderEmpSidebar('ceo');assert.match(box.innerHTML,/Completed 26/);
});
test('completed navigation resets filters and retired bulk delete performs no writes',()=>{
 const pages=[],tasks=[...done];const c=context(['_staffOpenCompleted','bulkDeleteDoneTasks'],{tasks,boardFilter:'urgent',_boardEmpFilter:'song',_boardSearch:'old',_boardSelTaskId:'old',showPage:p=>pages.push(p),renderBoard(){},toast(){},sbDel(){throw Error('must not delete');}});
 c.bulkDeleteDoneTasks();assert.equal(c.boardFilter,'done');assert.equal(c._boardSearch,'');assert.equal(c._boardEmpFilter,null);assert.equal(tasks.length,27);assert.deepEqual(pages,['board']);assert.doesNotMatch(html,/onclick="bulkDeleteDoneTasks\(\)"/);
});
test('unread comments never return a completed task to pending, and remain unread in completed',()=>{
 const pending={id:'pending',title:'Pending',assignee:'ceo',createdBy:'other',progress:0};
 const finished={id:'finished',title:'Finished',assignee:'ceo',progress:'100'};
 const taskComments={finished:[{author:'other',ts:'2026-09-17T01:00:00Z'}]},views={ceo:{pending:'2026-09-16T00:00:00Z'}};
 const before=JSON.stringify({taskComments,views});
 const c=context(['isDoneTask','_staffTaskTime','_staffTaskAttention','_staffTaskCompare','_boardFiltered','_boardTableHtml','_btFilteredRows','_renderBoardTaskList'],{tasks:[finished,pending],taskComments,_taskViews:views,CU:{id:'ceo'},isManagerCU:()=>true,boardFilter:'all',_boardSearch:'',_boardEmpFilter:null,_boardCleanMode:false,_isArchivedTask:()=>false,_tablePool:()=>[finished,pending],isUnassignedTask:()=>false,isStaleTask:()=>false,parseLocalDate:x=>new Date(x),_btStrip:()=>'',_btCleanBanner:()=>'',_btFbar:()=>'',_btRow:t=>'<tr data-id="'+t.id+'"></tr>',_renderBoardTaskItem:t=>'<div data-id="'+t.id+'"></div>',sortT:rows=>rows});
 assert.equal(c._staffTaskAttention(finished).comments,1);
 assert.ok(c._staffTaskCompare(pending,finished)<0);
 for(const render of [()=>c._boardTableHtml(),()=>c._renderBoardTaskList()]){assert.doesNotMatch(render(),/data-id="finished"/);assert.match(render(),/data-id="pending"/);}
 c.boardFilter='done';for(const render of [()=>c._boardTableHtml(),()=>c._renderBoardTaskList()]){assert.match(render(),/data-id="finished"/);assert.doesNotMatch(render(),/확인할 업무 · 새 댓글|data-id="pending"/);}
 finished.progress=0;c.boardFilter='all';assert.match(c._boardTableHtml(),/data-id="finished"/);
 assert.equal(JSON.stringify({taskComments,views}),before);
});
test('successful completion refreshes lists immediately; failed save preserves its previous state',async()=>{
 const task={id:'transition',progress:0,checklist:[]};let refreshes=0,fail=false;
 const c=context(['isDoneTask','_staffTaskCompletionPatch','_staffToggleTaskCompletion'],{tasks:[task],_staffTaskWrites:{},_staffTaskPersistPatch:async(t,patch)=>{if(fail)throw Error('save failed');Object.assign(t,patch);},refreshAll(){refreshes++;},toast(){},console});
 assert.equal(await c._staffToggleTaskCompletion(task.id),true);assert.equal(task.done,true);assert.equal(refreshes,1);
 fail=true;assert.equal(await c._staffToggleTaskCompletion(task.id),false);assert.equal(task.done,true);assert.equal(refreshes,1);
});
