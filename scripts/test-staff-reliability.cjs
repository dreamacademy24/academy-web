// Runs selected real page functions with fake DOM/network only. Never boots the app.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');

const html = fs.readFileSync(path.join(__dirname, '../public/team_manager3.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m => !/\bsrc\s*=|application\/ld\+json/i.test(m[1])).map(m => m[2]);
scripts.push(fs.readFileSync(path.join(__dirname, '../public/staff-workspace-home.js'), 'utf8'));
scripts.push(fs.readFileSync(path.join(__dirname, '../public/staff-workspace-task.js'), 'utf8'));
scripts.push(fs.readFileSync(path.join(__dirname, '../public/staff-workspace-operations.js'), 'utf8'));
scripts.push(fs.readFileSync(path.join(__dirname, '../public/staff-workspace-media.js'), 'utf8'));
const functions = new Map();
for (const [i, code] of scripts.entries()) {
  new vm.Script(code, { filename: `staff-inline-${i}.js` });
  const source = ts.createSourceFile('staff.js', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) functions.set(statement.name.text, statement.getText(source));
  }
}
const quiet = { log() {}, warn() {}, error() {} };
test('staff entry uses the unified account, never the old employee selection session',()=>{
  const employee={id:'song',name:'Song'},data={adminToken:'da-admin-session',adminInfo:JSON.stringify({staffId:'admin-song'}),tm_session:JSON.stringify({id:'ceo'})};
  const c=context(['_staffSessionEmployee'],{ALL:[employee,{id:'ceo'}],localStorage:{getItem:key=>data[key]||null}});
  assert.equal(c._staffSessionEmployee(),employee);
  delete data.adminToken;assert.equal(c._staffSessionEmployee(),null);
  data.adminToken='da-admin-session';data.adminInfo='invalid';assert.equal(c._staffSessionEmployee(),null);
  data.adminInfo=JSON.stringify({staffId:'admin-jun'});assert.equal(c._staffSessionEmployee(),null);
});
test('missing session routes the whole frame to unified login without employee buttons',()=>{
  const destinations=[];const c=context(['buildLogin','_staffRequireLogin'],{top:{location:{replace:url=>destinations.push(url)}}});
  c.buildLogin();assert.deepEqual(destinations,['/login']);
});
test('approval first entry initializes its tab state without relying on preview fixtures',()=>{
  const declarations=[];
  for(const code of scripts){const ast=ts.createSourceFile('staff.js',code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);for(const n of ast.statements){if(ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)==='_apvTab'))declarations.push(n.getText(ast));}}
  const state={};vm.runInNewContext(declarations.join('\n'),state);assert.equal(state._apvTab,null);
});
function context(names, overrides = {}) {
  const ctx = vm.createContext({ console: quiet, URL, encodeURIComponent, ...overrides });
  ctx.window = ctx;
  for (const name of names) {
    assert.ok(functions.has(name), `Missing actual function ${name}`);
    vm.runInContext(functions.get(name), ctx);
  }
  return ctx;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
function projectContext(overrides={}){
  return context(['_staffProjectSaveField','_staffProjectForView','_staffProjectRetry','ptFindNode','ptNow','ptLoadAll','ptDescendants','ptChildren','ptPath'],{
    CU:{id:'song'},PT:{nodes:[{id:'p',kind:'project'},{id:'n',kind:'task',project_id:'p',title:'Saved',status:'todo',done:false}],cur:'p',sel:'n'},
    _staffProjectQueues:{},_staffProjectDrafts:{},_staffProjectPending:{},_staffProjectRequest:0,
    _staffProjectSaveState(){},_ptNotifyDebounced(){},ptRenderTree(){},toast(){},...overrides
  });
}

test('notice filters intersect unread-required state with title or body search',()=>{
  const ctx=context(['_staffNoticeList'],{CU:{id:'song'},_staffNoticeFilter:'unread',_staffNoticeQuery:'pickup',_ntPlain:n=>n.text||'',noticeReads:{read:['song']},notices:[{id:'new',title:'Pickup',requireRead:true},{id:'read',title:'Pickup',requireRead:true},{id:'done',title:'Pickup',requireRead:true,done:true},{id:'general',title:'Pickup'},{id:'body',title:'Trip',text:'Pickup time',requireRead:true}]});
  assert.deepEqual(Array.from(ctx._staffNoticeList(),n=>n.id),['new','body']);
});

test('notice read confirmation merges latest readers and is acknowledged only after persistence',async()=>{
  const write=deferred();let posted;
  const ctx=context(['markRead'],{CU:{id:'song'},_staffNoticeReadBusy:false,noticeReads:{},sbGet:async()=>[{value:{n:['jun'],other:['ceo']}}],_saveNoticeReadsSB:next=>{posted=next;return write.promise;},sv(){},renderNotices(){},document:{getElementById:()=>null},toast(){}});
  const pending=ctx.markRead('n');await tick();assert.equal(ctx.noticeReads.n,undefined);assert.deepEqual(Array.from(posted.n),['jun','song']);
  write.reject(Error('offline'));assert.equal(await pending,false);assert.equal(ctx.noticeReads.n,undefined);assert.equal(ctx._staffNoticeReadBusy,false);
  ctx._saveNoticeReadsSB=async()=>{};assert.equal(await ctx.markRead('n'),true);assert.deepEqual(Array.from(ctx.noticeReads.n),['jun','song']);assert.deepEqual(Array.from(ctx.noticeReads.other),['ceo']);
});

test('project save failure preserves the persisted record and keeps a retryable draft without notification',async()=>{
  let notified=0;
  const ctx=projectContext({sbPatch:async()=>{throw Error('offline');},_ptNotifyDebounced:()=>notified++});
  assert.equal(await ctx._staffProjectSaveField('n','title','Draft'),false);
  assert.equal(ctx.ptFindNode('n').title,'Saved');assert.equal(ctx._staffProjectForView('n').title,'Draft');assert.equal(notified,0);
  ctx.sbPatch=async()=>[{id:'n'}];await ctx._staffProjectRetry('n');
  assert.equal(ctx.ptFindNode('n').title,'Draft');assert.equal(Object.keys(ctx._staffProjectDrafts.n).length,0);assert.equal(notified,1);
});

test('project rapid edits are serialized and an earlier acknowledgement cannot erase a later draft',async()=>{
  const first=deferred(),calls=[];
  const ctx=projectContext({sbPatch:(table,query,patch)=>{calls.push(patch.title);return calls.length===1?first.promise:Promise.resolve([{id:'n'}]);}});
  const a=ctx._staffProjectSaveField('n','title','First');const b=ctx._staffProjectSaveField('n','title','Second');
  await tick();assert.deepEqual(calls,['First']);assert.equal(ctx._staffProjectForView('n').title,'Second');
  first.resolve([{id:'n'}]);await Promise.all([a,b]);assert.deepEqual(calls,['First','Second']);assert.equal(ctx.ptFindNode('n').title,'Second');
});

test('project draft is not exposed or retried under another logged in user',async()=>{
  const ctx=projectContext({sbPatch:async()=>{throw Error('offline');}});
  await ctx._staffProjectSaveField('n','title','Private draft');ctx.CU={id:'jun'};
  assert.equal(ctx._staffProjectForView('n').title,'Saved');ctx.sbPatch=()=>assert.fail('Another user draft was retried');await ctx._staffProjectRetry('n');
});

test('failed project load preserves existing nodes; old requests cannot replace a newer load',async()=>{
  const slow=deferred();let calls=0;
  const ctx=projectContext({_staffReadPages:()=>++calls===1?slow.promise:Promise.resolve([{id:'new',origin:'team'}])});
  const pending=ctx.ptLoadAll();await ctx.ptLoadAll();slow.resolve([{id:'old'}]);await pending;
  assert.equal(ctx.PT.nodes[0].id,'new');ctx._staffReadPages=async()=>{throw Error('offline');};await assert.rejects(ctx.ptLoadAll());assert.equal(ctx.PT.nodes[0].id,'new');
});

test('project paths and descendants terminate on a malformed parent cycle',()=>{
  const ctx=projectContext();ctx.PT.nodes=[{id:'a',parent_id:'b',project_id:'p',kind:'folder'},{id:'b',parent_id:'a',project_id:'p',kind:'folder'}];
  assert.equal(ctx.ptDescendants('a','p').length,1);assert.equal(ctx.ptPath('a').length,2);
});

test('guide load respects an empty server table and never reseeds deleted categories',async()=>{
  const ctx=context(['loadGuideMsgs'],{GUIDE_DATA:{Info:[{id:'seed',content:'old'}]},_guideCat:'Info',_guideLoadError:'',_staffReadPages:async()=>[],document:{getElementById:()=>null},sbPost:()=>assert.fail('Read must not write')});
  await ctx.loadGuideMsgs();assert.equal(ctx.GUIDE_DATA.Info.length,0);
  ctx.GUIDE_DATA.Info=[{id:1}];ctx._staffReadPages=async()=>{throw Error('offline');};await ctx.loadGuideMsgs();assert.equal(ctx.GUIDE_DATA.Info.length,1);assert.match(ctx._guideLoadError,/불러오지/);
});

test('failed guide save or delete preserves the record and the open editor',async()=>{
  let closes=0;const fields={guideMsgTitleInput:{value:'Changed'},guideMsgContentInput:{value:'Draft'}};
  const ctx=context(['saveGuideMsg','deleteGuideMsg'],{CU:{id:'song'},_staffGuideBusy:false,_guideLoadError:'',_guideCat:'Info',_guideEditId:1,GUIDE_DATA:{Info:[{id:1,title:'Saved',content:'Saved'}]},document:{getElementById:id=>fields[id]},closeGuideMsgModal:()=>closes++,renderGuideMsgs(){},toast(){},confirm:()=>true,sbPatch:async()=>[],sbDel:async()=>{throw Error('offline');}});
  await ctx.saveGuideMsg();assert.equal(ctx.GUIDE_DATA.Info[0].title,'Saved');assert.equal(closes,0);assert.equal(fields.guideMsgContentInput.value,'Draft');
  await ctx.deleteGuideMsg(1);assert.equal(ctx.GUIDE_DATA.Info.length,1);assert.equal(ctx._staffGuideBusy,false);
});

test('photo upload retries only failures without uploading successful files twice',async()=>{
  const calls=[],host={appendChild(){}},input={files:[{name:'ok.jpg'},{name:'retry.jpg'}],value:'selected'};let fail=true;
  const ctx=context(['_staffTaskUpload'],{_staffMediaBusy:false,_staffTaskSaving:false,_staffMediaDraft:1,_staffMediaFailures:[],MAX_FILES:10,mFiles:[],_staffMediaFormHint(){},_validateFile:()=>true,_staffOptimizeUploadFile:async f=>f,renderTMFL(){},toast(){},document:{getElementById:id=>id==='staffMediaStatus'?host:{checked:false},createElement:()=>({})},_taskFilesUpload:async files=>{calls.push(files[0].name);if(fail&&files[0].name==='retry.jpg')throw Error('offline');return [{name:files[0].name,url:'/stored'}];}});
  await ctx._staffTaskUpload({target:input});assert.equal(ctx.mFiles.length,1);assert.equal(ctx._staffMediaFailures.length,1);assert.equal(ctx._staffMediaBusy,false);
  fail=false;await ctx._staffTaskUpload(null,true);assert.deepEqual(calls,['ok.jpg','retry.jpg','retry.jpg']);assert.equal(ctx.mFiles.length,2);assert.equal(ctx._staffMediaFailures.length,0);
});
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const crud = ['sbRequireOk', 'sbGet', 'sbPost', 'sbPatch', 'sbDel'];

test('all inline scripts parse without executing login, seeding or network', () => {
  assert.ok(scripts.length > 0);
  assert.ok(functions.size > 100);
});

test('rich task notes retain formatting after baseline reconciliation', () => {
  const ctx = context(['cleanNote', '_taskNoteHtml'], { _apvSafeHtml: x => x, esc: x => x });
  assert.match(ctx._taskNoteHtml({ note: '<p><strong>완료 조건</strong></p>' }), /<strong>완료 조건<\/strong>/);
});

for (const status of [401, 403, 500]) test(`CRUD rejects HTTP ${status}`, async () => {
  const ctx = context(crud, { sbFetch: async () => response({ message: 'failure' }, status) });
  for (const [fn, args] of [['sbGet', ['test', '']], ['sbPost', ['test', {}]], ['sbPatch', ['test', '', {}]], ['sbDel', ['test', '']]]) {
    await assert.rejects(ctx[fn](...args), new RegExp(String(status)));
  }
});

test('a valid empty list differs from an invalid or failed response; DELETE 204 succeeds', async () => {
  const ctx = context(crud, { sbFetch: async () => response([]) });
  assert.equal((await ctx.sbGet('test', '')).length, 0);
  ctx.sbFetch = async () => response({ error: 'bad format' });
  await assert.rejects(ctx.sbGet('test', ''), /목록 응답/);
  ctx.sbFetch = async () => response(null, 204);
  assert.equal((await ctx.sbDel('test', '')).status, 204);
});

test('customer uncheck sends the full key including #, &, + and Korean text', async () => {
  const requests = [];
  const ctx = context(['sbRequireOk', 'sbDel', '_subKey', 'toggleSmartSub'], {
    CU: { name: 'Tester' }, sbFetch: async (p) => { requests.push(p); return response(null, 204); },
    sbGet: async () => [], toast() {},
  });
  const el = { checked: false, disabled: false };
  await ctx.toggleSmartSub('task-1', '2026-09-10', '09/12 가상 가족 & A+B', ['09/12 가상 가족 & A+B'], el);
  const url = new URL('https://example.invalid/' + requests[0]);
  assert.equal(url.hash, '');
  assert.equal(url.searchParams.get('item_key'), 'eq.task-1#09/12 가상 가족 & A+B');
  assert.equal(url.searchParams.get('check_date'), 'eq.2026-09-10');
  assert.equal(el.disabled, false);
});

test('failed uncheck restores the checkbox, unlocks it, and reports failure', async () => {
  let notices = 0, reads = 0;
  const ctx = context(['sbRequireOk', 'sbDel', '_subKey', 'toggleSmartSub'], {
    CU: {}, sbFetch: async () => response({}, 403), sbGet: async () => { reads++; return []; }, toast() { notices++; },
  });
  const el = { checked: false, disabled: false };
  await ctx.toggleSmartSub('task', '2026-09-10', 'Family', ['Family'], el);
  assert.equal(el.checked, true);
  assert.equal(el.disabled, false);
  assert.equal(notices, 1);
  assert.equal(reads, 0);
});

test('server empty lists clear cached records without resurrecting saved records', async () => {
  const unexpectedWrite = () => assert.fail('Read must not upload cached records');
  const ctx = context(['loadTasksFromSB', 'loadProjectsFromSB', 'loadNoticesFromSB', 'loadThreadsFromSB', 'loadTaskCommentsFromSB', '_mergeLocalOnlyTc'], {
    sbGet: async () => [], tasks: [{ id: 1 }], projects: [{ id: 1 }], notices: [{ id: 1 }],
    threads: { p: [{ id: 1 }] }, taskComments: { t: [{ id: 1 }] },
    rowToTask: x => x, taskVisible: () => true, rowToProj: x => x, rowToNt: x => x,
    rebuildIdx() {}, sv() {}, refreshAll() {}, syncAllTasks: unexpectedWrite, syncProjToSB: unexpectedWrite,
    syncNtToSB: unexpectedWrite, syncThToSB: unexpectedWrite, syncTcToSB: unexpectedWrite,
  });
  await Promise.all(['loadTasksFromSB', 'loadProjectsFromSB', 'loadNoticesFromSB', 'loadThreadsFromSB', 'loadTaskCommentsFromSB'].map(n => ctx[n]()));
  assert.equal(ctx.tasks.length + ctx.projects.length + ctx.notices.length, 0);
  assert.equal(Object.keys(ctx.threads).length + Object.keys(ctx.taskComments).length, 0);
});

test('network failure keeps the cached task list and performs no upload', async () => {
  const original = [{ id: 'cached' }];
  const ctx = context(['loadTasksFromSB'], { tasks: original, sbGet: async () => { throw Error('offline'); }, syncAllTasks: () => assert.fail('unexpected upload') });
  await ctx.loadTasksFromSB();
  assert.equal(ctx.tasks, original);
});

function guestContext() {
  const nodes = {}, pending = [];
  const detail = {};
  Object.defineProperty(detail, 'innerHTML', { set() {
    for (const id of ['bsApps', 'empStuBox', 'bsCmtList']) nodes[id] = { innerHTML: '' };
  } });
  nodes.bsDetail = detail;
  const ctx = context(['_bsSelect'], {
    document: { getElementById: id => nodes[id] || null },
    _bsRows: ['A', 'B'].map(id => ({ id, booker_name: 'Test ' + id })), _bsEmpId: 'tester',
    _bsRenderList() {}, _bsStudents: () => [], esc: x => String(x || ''), isAdmin: () => false,
    _bsPayBadge: () => '', _bsAccomShort: () => '', _bsSegLine: () => '', _bsIsMine: () => true,
    _bsCmtLoad() {}, todayStr: () => '2026-09-10', _stuRender() {},
    sbGet(table, query) { const p = deferred(); pending.push({ table, query, ...p }); return p.promise; },
  });
  function complete(batch, id, failed = false) {
    for (const req of batch) {
      if (failed && req.table === 'student_daily_logs') req.reject(Error('offline'));
      else req.resolve(req.table === 'student_daily_logs' ? [{ booking_id: id, student_idx: 0, note: id }] : []);
    }
  }
  return { ctx, nodes, pending, complete };
}

test('late A responses cannot overwrite B booking applications or care records', async () => {
  const { ctx, nodes, pending, complete } = guestContext();
  ctx._bsSelect('A'); const a = pending.splice(0);
  ctx._bsSelect('B'); const b = pending.splice(0);
  complete(b, 'B'); await tick();
  const apps = nodes.bsApps.innerHTML;
  complete(a, 'A'); await tick();
  assert.equal(ctx._stuBookings[0].id, 'B');
  assert.equal(ctx._stuLogMap.B_0.note, 'B');
  assert.equal(nodes.bsApps.innerHTML, apps);
});

test('A → B → A rejects responses from the first A screen', async () => {
  const { ctx, pending, complete } = guestContext();
  ctx._bsSelect('A'); const old = pending.splice(0);
  ctx._bsSelect('B'); const b = pending.splice(0);
  ctx._bsSelect('A'); const fresh = pending.splice(0);
  complete(fresh, 'A'); await tick();
  complete(old, 'old-A'); complete(b, 'B'); await tick();
  assert.equal(ctx._stuLogMap.A_0.note, 'A');
  assert.equal(ctx._stuLogMap['old-A_0'], undefined);
});

test('care load failure shows an error instead of editable empty records', async () => {
  const { ctx, nodes, pending, complete } = guestContext();
  ctx._bsSelect('A'); complete(pending.splice(0), 'A', true); await tick();
  assert.match(nodes.empStuBox.innerHTML, /불러오지 못했습니다/);
  assert.equal(ctx._stuBookings, undefined);
});

test('late comments cannot overwrite another booking or a newer same-booking refresh', async () => {
  const nodes = { bsCmtList: { innerHTML: 'B content' } }, pending = [];
  const ctx = context(['sbRequireOk', '_bsCmtLoad'], {
    document: { getElementById: id => nodes[id] }, _bsSelId: 'A', CU: {},
    fetch() { const p = deferred(); pending.push(p); return p.promise; },
  });
  const a = ctx._bsCmtLoad('A');
  ctx._bsSelId = 'B'; nodes.bsCmtList = { innerHTML: 'B content' };
  pending.shift().resolve(response({ comments: [] })); await a;
  assert.equal(nodes.bsCmtList.innerHTML, 'B content');
  const older = ctx._bsCmtLoad('B'), newer = ctx._bsCmtLoad('B');
  pending[1].resolve(response({ comments: [] })); await newer;
  const latest = nodes.bsCmtList.innerHTML;
  pending[0].resolve(response({}, 500)); await older;
  assert.equal(nodes.bsCmtList.innerHTML, latest);
});

function pollContext() {
  let rows = [[{ id: '1', title: 'Before' }], [], [], [], []], calls = 0;
  const ctx = context(['jsonHash', '_pollEditing', 'pollForUpdates'], {
    CU: {}, _pollInFlight: false, _pollHash: {},
    document: { activeElement: null, querySelector: () => null },
    tasks: [], projects: [], taskComments: {}, threads: {}, notices: [],
    sbGet: async () => rows[(calls++) % 5],
    rowToTask: x => x, taskVisible: () => true, rowToProj: x => x, rowToTc: x => x, rowToTh: x => x, rowToNt: x => x,
    rebuildIdx() {}, sv() {}, _mergeLocalOnlyTc() {}, refreshAll() {}, showSyncBadge() {},
    loadMyNotifs() {}, refreshUnreadCounts() {}, refreshApvPendingCount() {}, updateNavBadges() {},
  });
  return { ctx, setRows: v => { rows = v; }, calls: () => calls };
}

test('poll detects same-length edits and deletion of the last record', async () => {
  const { ctx, setRows } = pollContext();
  await ctx.pollForUpdates(); assert.equal(ctx.tasks[0].title, 'Before');
  setRows([[{ id: '1', title: 'Edited' }], [], [], [], []]);
  await ctx.pollForUpdates(); assert.equal(ctx.tasks[0].title, 'Edited');
  setRows([[], [], [], [], []]);
  await ctx.pollForUpdates(); assert.equal(ctx.tasks.length, 0);
});

test('poll waits while typing or editing a modal', async () => {
  const { ctx, calls } = pollContext();
  ctx.document.activeElement = { tagName: 'TEXTAREA' };
  await ctx.pollForUpdates(); assert.equal(calls(), 0);
  ctx.document.activeElement = null;
  ctx.document.querySelector = () => ({});
  await ctx.pollForUpdates(); assert.equal(calls(), 0);
});

test('poll responses from a previous login cannot replace current user data', async () => {
  const { ctx } = pollContext();
  const p = deferred(); ctx.sbGet = () => p.promise;
  const running = ctx.pollForUpdates();
  ctx.CU = { id: 'new-user' };
  p.resolve([{ id: 'old-user-task' }]); await running;
  assert.equal(ctx.tasks.length, 0);
  assert.equal(ctx._pollInFlight, false);
});

test('home separates assigned tasks from outgoing instructions, excluding done and archived tasks', () => {
  const ctx = context(['_staffAssigned', '_staffHomeModel'], { isDoneTask: t => t.done, _isArchivedTask: id => id === 'archived' });
  const model = ctx._staffHomeModel([
    { id: 'mine', assignee: 'song', due: '2026-09-10' },
    { id: 'coassigned', assignees: ['song'], due: '2026-09-09' },
    { id: 'outgoing', createdBy: 'song', assignee: 'other' },
    { id: 'done', assignee: 'song', done: true }, { id: 'archived', assignee: 'song' },
    { id: 'other', assignee: 'other' },
  ], [], {}, 'song', '2026-09-10');
  assert.deepEqual(Array.from(model.assigned, t => t.id), ['coassigned', 'mine']);
  assert.equal(model.today.length, 1); assert.equal(model.overdue.length, 1);
  assert.deepEqual(Array.from(model.outgoing, t => t.id), ['outgoing']);
});

test('old required notices remain visible until read, but finished and already-read notices do not', () => {
  const ctx = context(['_staffAssigned', '_staffHomeModel'], { isDoneTask: () => false, _isArchivedTask: () => false });
  const model = ctx._staffHomeModel([], [
    { id: 'old', requireRead: true, date: '2025-01-01' },
    { id: 'read', requireRead: true }, { id: 'closed', requireRead: true, done: true }, { id: 'optional' },
  ], { read: ['song'] }, 'song', '2026-09-10');
  assert.deepEqual(Array.from(model.unread, n => n.id), ['old']);
});

test('guest search intersects the selected scope instead of leaking other assignees', () => {
  const ctx = context(['_bsFiltered', '_bsIsMine', '_bsStudents'], {
    _bsQ: 'Sample', _bsChip: 'mine', _bsMyName: 'Song', todayStr: () => '2026-09-10', localDateStr: () => '2026-09-10',
    _bsRows: [
      { id: 'mine', booker_name: 'Sample A', assignee: 'Song', checkout_date: '2026-09-15' },
      { id: 'other', booker_name: 'Sample B', assignee: 'Other', checkout_date: '2026-09-15' },
      { id: 'cancelled', booker_name: 'Sample C', assignee: 'Song', checkout_date: '2026-09-15', status: '취소' },
    ],
  });
  assert.deepEqual(Array.from(ctx._bsFiltered(), b => b.id), ['mine']);
  ctx._bsChip = 'all'; assert.equal(ctx._bsFiltered().length, 3);
});

test('mine loader paginates past 100 and shares simultaneous requests', async () => {
  let calls = 0;
  const first = deferred();
  const ctx = context(['_staffBookingFields', '_staffLoadMine'], {
    _staffBookingCache: {}, todayStr: () => '2026-09-10',
    sbGet(table, query) {
      assert.equal(table, 'bookings');
      const params = new URL('https://example.invalid/?' + query).searchParams;
      assert.match(params.get('or'), /assignee.eq."Song, Test"/);
      calls++;
      return calls === 1 ? first.promise : Promise.resolve([{ id: '101' }]);
    },
  });
  const emp = { id: 'song', name: 'Song, Test' };
  const a = ctx._staffLoadMine(emp), b = ctx._staffLoadMine(emp);
  assert.equal(calls, 1);
  first.resolve(Array.from({ length: 100 }, (_, i) => ({ id: String(i) })));
  assert.equal((await a).length, 101); assert.equal((await b).length, 101); assert.equal(calls, 2);
  await ctx._staffLoadMine(emp); assert.equal(calls, 2);
});

test('home content escapes markup in user-entered titles and identifiers', () => {
  const ctx = context(['_staffSafe']);
  assert.equal(ctx._staffSafe('<img src=x onerror="bad">'), '&lt;img src=x onerror=&quot;bad&quot;&gt;');
});

test('booking priority puts today checkout and checkin before future arrivals without mutating cache', () => {
  const ctx = context(['_staffHomeBookingOrder']);
  const rows = [
    { id: 'future', checkin_date: '2026-09-20', checkout_date: '2026-09-30' },
    { id: 'stay', checkin_date: '2026-09-01', checkout_date: '2026-09-30' },
    { id: 'in', checkin_date: '2026-09-10', checkout_date: '2026-09-30' },
    { id: 'out', checkin_date: '2026-09-01', checkout_date: '2026-09-10' },
  ];
  assert.deepEqual(Array.from(ctx._staffHomeBookingOrder(rows, '2026-09-10'), b => b.id), ['out', 'in', 'stay', 'future']);
  assert.equal(rows[0].id, 'future');
});

test('personal daily checklist includes assigned and shared items, retaining the team view', () => {
  const ctx = context(['_dailyCheckHtml', '_clHasEmp', '_clAssignees'], {
    CHECKLIST_ITEMS: [
      { id: 'mine', kind: 'daily', content: 'My daily', assignee: 'song' },
      { id: 'shared', kind: 'daily', content: 'Shared daily', assignee: 'all' },
      { id: 'other', kind: 'daily', content: 'Other daily', assignee: 'other' },
      { id: 'my-week', kind: 'weekly', weekday: 4, content: 'My weekly', assignee: 'song,other' },
      { id: 'other-week', kind: 'weekly', weekday: 4, content: 'Other weekly', assignee: 'other' },
    ], document: { getElementById: () => null }, esc: x => x, _clBadge: () => '', _wkPeriodOk: () => true,
    _wkMetaChips: () => '', _assChipsHtml: () => '',
  });
  const own = ctx._dailyCheckHtml({}, '2026-09-10', [], 'song');
  assert.match(own, /My daily/); assert.match(own, /Shared daily/); assert.match(own, /My weekly/);
  assert.doesNotMatch(own, /Other daily|Other weekly|newDailyContent/);
  assert.match(ctx._dailyCheckHtml({}, '2026-09-10', []), /Other weekly/);
});

test('strict checklist load does not replace a failed request with editable defaults', async () => {
  const original = [{ id: 'existing' }];
  const ctx = context(['loadChecklistItems'], { CHECKLIST_ITEMS: original, sbGet: async () => { throw Error('offline'); } });
  await assert.rejects(ctx.loadChecklistItems(true), /offline/);
  assert.equal(ctx.CHECKLIST_ITEMS, original);
});

test('instruction edits preserve creator, creation date and subtask metadata without mutating the original', () => {
  const ctx = context(['_staffTaskCandidate']);
  const previous = { id: 't1', createdBy: 'ceo', createdAt: '2026-01-01', done: true, progress: 100, sortIdx: 4 };
  const form = { title: 'Updated', assignees: ['song', 'candice'], due: '2026-09-12', note: '<p>Request</p>', files: [], checklist: { _sub: true, items: [{ title: 'Check', done: false, note: 'Keep', assignee: 'song' }] }, secret: true, shared: true };
  const next = ctx._staffTaskCandidate(previous, form, 'ignored', 'song', '2026-09-10');
  assert.equal(next.createdBy, 'ceo'); assert.equal(next.createdAt, '2026-01-01'); assert.equal(next.sortIdx, 4);
  assert.equal(next.checklist.items[0].note, 'Keep'); assert.equal(next.shared, false); assert.equal(next.secret, true);
  assert.equal(next.done, false); assert.equal(previous.done, true);
  next.checklist.items[0].note = 'changed'; assert.equal(form.checklist.items[0].note, 'Keep');
});

function instructionContext() {
  const errors = [], events = [], inner = {}, fields = {
    tmTit: { value: 'Verify arrivals', focus() {} }, tmDue: { value: '2026-09-12' }, tmSubToggle: { checked: false },
    tmShare: { checked: false }, tmSecret: { checked: false }, tmUrgent: { checked: false }, tmSaveBtn: {},
  };
  const ctx = context(['_staffTaskCandidate', '_staffSaveInstruction'], {
    document: { getElementById: id => fields[id], querySelector: selector => selector.includes('tmDM') ? { value: 'date' } : inner },
    _staffTaskSaving: false, _staffTaskDraftId: null, editTaskId: null, tasks: [], CU: { id: 'ceo' },
    _assignSelected: new Set(['song']), mFiles: [], tmChecklist: [{ id: 'c1', text: 'Confirm', done: false }], tmSubtasks: [], tmProjId: null, curProjId: null,
    _tmNtGet: () => '<p>Instructions</p>', uid: () => 'new-task', taskToRow: t => t, clearTaskErr() {}, showTaskErr: msg => errors.push(msg),
    _staffTaskCanEdit: () => true, sbUpsert: async () => [{ id: 'new-task' }],
    rebuildIdx() {}, svTasks() { events.push('cache'); }, createNotifMultiple(ids) { events.push('notify:' + ids.join(',')); },
    closeM() { events.push('close'); }, refreshAll() {}, toast() {}, _staffTaskFormSummary() {},
  });
  return { ctx, fields, errors, events, inner };
}

test('failed instruction save keeps form data and sends no notifications or cached task', async () => {
  const { ctx, fields, events, errors, inner } = instructionContext();
  ctx.sbUpsert = async () => { throw Error('server unavailable'); };
  await ctx._staffSaveInstruction();
  assert.equal(ctx.tasks.length, 0); assert.equal(fields.tmTit.value, 'Verify arrivals');
  assert.deepEqual(events, []); assert.match(errors[0], /입력한 내용은 유지/);
  assert.equal(fields.tmSaveBtn.disabled, false); assert.equal(inner.inert, false);
});

test('duplicate save clicks share one write and notify only after persistence succeeds', async () => {
  const { ctx, events } = instructionContext(); const pending = deferred(); let calls = 0;
  ctx.sbUpsert = () => { calls++; return pending.promise; };
  const running = ctx._staffSaveInstruction(); await ctx._staffSaveInstruction();
  assert.equal(calls, 1); assert.equal(events.length, 0); assert.equal(ctx.tasks.length, 0);
  pending.resolve([{ id: 'new-task' }]); await running;
  assert.equal(ctx.tasks.length, 1); assert.deepEqual(events, ['cache', 'notify:song', 'close']);
});

test('selected date with no date value is rejected before any write', async () => {
  const { ctx, fields, errors } = instructionContext(); fields.tmDue.value = '';
  ctx.sbUpsert = () => assert.fail('Invalid form reached storage');
  await ctx._staffSaveInstruction(); assert.match(errors[0], /완료 기한/);
});

test('checkbox patch preserves subtask notes and reopens a completed task on uncheck', () => {
  const ctx = context(['_staffTaskCheckPatch']);
  const t = { done: true, checklist: { _sub: true, items: [{ done: true, note: 'retain', due: '2026-09-12' }] } };
  const patch = ctx._staffTaskCheckPatch(t, 0);
  assert.equal(patch.done, false); assert.equal(patch.progress, 0); assert.equal(patch.checklist.items[0].note, 'retain');
  assert.equal(t.checklist.items[0].done, true);
});

test('task patch sends changed fields only and leaves local state intact on HTTP failure or no matching row', async () => {
  const task = { id: 't1', note: 'Keep note', done: false };
  const ctx = context(['_staffTaskPersistPatch'], {
    _staffTaskCanEdit: () => true, tasks: [task], rebuildIdx() {}, svTasks() {},
    sbPatch: async (table, query, body) => { assert.deepEqual(Object.keys(body), ['done']); throw Error('403'); },
  });
  await assert.rejects(ctx._staffTaskPersistPatch(task, { done: true }), /403/); assert.equal(task.done, false);
  ctx.sbPatch = async () => []; await assert.rejects(ctx._staffTaskPersistPatch(task, { done: true }), /저장 결과/);
  ctx.sbPatch = async () => [{ id: 't1' }]; await ctx._staffTaskPersistPatch(task, { done: true });
  assert.equal(task.done, true); assert.equal(task.note, 'Keep note');
});

test('retired Jun cannot receive or decide new approvals; historical both retains CEO access', () => {
  const ctx=context(['_staffApvRecipients','_staffApvStatus','_staffApvCanRead','_staffApvCanDecide']);
  const a={from_id:'song',to_id:'jun',status:'pending'};
  assert.equal(ctx._staffApvCanDecide(a,{id:'ceo'}),false);
  assert.equal(ctx._staffApvCanDecide(a,{id:'jun'}),false);
  assert.equal(ctx._staffApvRecipients('jun').length,0);
  assert.equal(ctx._staffApvCanRead(a,{id:'candice'}),false);
  assert.equal(ctx._staffApvCanRead(a,{id:'song'}),true);
  a.to_id='both';assert.equal(ctx._staffApvCanDecide(a,{id:'ceo'}),true);
  a.status='approved';assert.equal(ctx._staffApvCanDecide(a,{id:'ceo'}),false);
});

function approvalContext(overrides={}){
  const events=[];const fields={rr_1:{value:'자료 보완'},apvTitle:{value:'준비물 구매'},apvBody:{value:'내용'},apvCmtInp_1:{value:'확인 부탁드립니다'}};
  const actor={id:'ceo',name:'CEO'};
  const ctx=context(['_staffApvRecipients','_staffApvStatus','_staffApvCanRead','_staffApvCanDecide','_staffProcessApproval','_staffSubmitApproval','_staffApvComment','_staffResubmitApproval'],{
    CU:actor,_staffApvBusy:{},_staffApvSubmitting:false,_staffApvUploadCount:0,_staffApvDraft:1,_apvFiles:[],_apvTab:null,_apvSelId:null,
    document:{getElementById:id=>fields[id]||null,querySelector:()=>({value:'ceo'})},uid:()=> 'comment-1',
    sbGet:async()=>[{id:1,from_id:'song',to_id:'ceo',title:'요청',status:'pending',comments:[]}],
    sbPatch:async()=>[{id:1}],sbPost:async()=>[{id:9}],
    toast:msg=>events.push(msg),createNotif:()=>events.push('notify'),createNotifMultiple:(ids,type,id)=>events.push({ids:Array.from(ids),id}),
    _staffApvRefresh:()=>events.push('refresh'),_apvLoadCmts:()=>events.push('comments'),...overrides
  });return {ctx,events,fields};
}

test('approval decision uses a pending-state condition and never notifies on zero updated rows',async()=>{
  let query;const {ctx,events}=approvalContext({sbPatch:async(t,q)=>{query=q;return [];}});
  await ctx._staffProcessApproval(1,'approve');
  assert.match(query,/status=eq.pending/);assert.match(query,/to_id=eq.ceo/);
  assert.equal(events.includes('notify'),false);assert.equal(events.includes('refresh'),false);
  assert.equal(Object.keys(ctx._staffApvBusy).length,0);
});

test('approval decision rejects unrelated approvers and blocks double clicks',async()=>{
  const a=approvalContext({sbGet:async()=>[{id:1,to_id:'jun',status:'pending'}],sbPatch:()=>assert.fail('Unauthorized patch')});
  await a.ctx._staffProcessApproval(1,'approve');assert.equal(a.events.includes('notify'),false);
  const pending=deferred();let writes=0;const b=approvalContext({sbPatch:()=>{writes++;return pending.promise;}});
  const run=b.ctx._staffProcessApproval(1,'approve');await tick();await b.ctx._staffProcessApproval(1,'reject');
  assert.equal(writes,1);pending.resolve([{id:1}]);await run;assert.equal(b.events.filter(e=>e==='notify').length,1);
});

test('new approval submission uses the current recipient and returns the saved reference',async()=>{
  let body;const {ctx,events}=approvalContext({sbPost:async(t,b)=>{body=b;return [{id:9}];}});
  await ctx._staffSubmitApproval('ceo');assert.equal(body.body,'내용');
  assert.deepEqual(events.find(e=>typeof e==='object'),{ids:['ceo'],id:'9'});
});

test('obsolete Jun and both submission options cannot create a new approval',async()=>{
  for(const recipient of ['jun','both']){const {ctx}=approvalContext({sbPost:()=>assert.fail('Retired recipient submitted')});ctx.document.querySelector=()=>({value:recipient});await ctx._staffSubmitApproval('song');}
});

for(const actor of ['song','ceo'])test(actor+' completes ordinary work without an approval step and it leaves active selection',async()=>{
  const task={id:'t',assignee:actor,createdBy:'ceo',title:'Work',done:false,progress:0};let writes=0,refreshes=0;
  const ctx=context(['_staffToggleTaskCompletion','_staffTaskPersistPatch','isDoneTask'],{CU:{id:actor},tasks:[task],_staffTaskWrites:{},_staffTaskCanEdit:()=>true,_empSelTaskId:'t',_boardSelTaskId:'t',sbPatch:async(table,q,body)=>{assert.equal(table,'staff_tasks');assert.equal(body.done,true);writes++;return [{id:'t'}];},rebuildIdx(){},svTasks(){},createNotif(){},refreshAll:()=>refreshes++,toast(){}});
  assert.equal(await ctx._staffToggleTaskCompletion('t'),true);assert.equal(writes,1);assert.equal(refreshes,1);assert.equal(task.done,true);assert.equal(ctx._empSelTaskId,null);assert.equal(ctx._boardSelTaskId,null);
});

test('failed completion keeps the work visible and sends no completion notification',async()=>{
  const task={id:'t',createdBy:'ceo',title:'Work',done:false};const ctx=context(['_staffToggleTaskCompletion','_staffTaskPersistPatch','isDoneTask'],{CU:{id:'song'},tasks:[task],_staffTaskWrites:{},_staffTaskCanEdit:()=>true,_empSelTaskId:'t',_boardSelTaskId:null,sbPatch:async()=>{throw Error('offline');},rebuildIdx(){},svTasks(){},createNotif:()=>assert.fail('Failed write notified'),refreshAll:()=>assert.fail('Failed write hidden'),toast(){}});
  assert.equal(await ctx._staffToggleTaskCompletion('t'),false);assert.equal(task.done,false);assert.equal(ctx._empSelTaskId,'t');
});

test('retired employee cannot log in through the legacy entry or receive notifications',()=>{
  const ctx=context(['doLogin','createNotif'],{CU:null,toast(){},sbPost:()=>assert.fail('Retired employee notification'),localStorage:{setItem:()=>assert.fail('Retired login created')}});
  ctx.doLogin({id:'jun'});assert.equal(ctx.CU,null);ctx.createNotif('jun','task','t','hello');ctx.createNotif('admin-jun','task','t','hello');
});

test('staff account loader excludes retired Jun even if an old API response still calls the account active',async()=>{
  const ctx=context(['loadStaffAccounts'],{EMPS:[{id:'fallback'}],CEO:{id:'ceo'},ALL:[],setTimeout(){},fetch:async()=>({ok:true,json:async()=>({staff:[{username:'admin-jun',name:'Jun'},{username:'admin-ceo',name:'CEO'},{username:'admin-song',name:'Song'}]})})});
  await ctx.loadStaffAccounts();assert.deepEqual(Array.from(ctx.ALL,p=>p.id),['song','ceo']);
});

test('approval failed submission and pending upload keep the draft and send no notification',async()=>{
  const {ctx,events,fields}=approvalContext({sbPost:async()=>{throw Error('HTTP 500');}});
  await ctx._staffSubmitApproval('ceo');assert.equal(fields.apvTitle.value,'준비물 구매');
  assert.equal(events.some(e=>typeof e==='object'),false);assert.equal(ctx._staffApvSubmitting,false);
  ctx._staffApvUploadCount=1;ctx.sbPost=()=>assert.fail('Submitted while uploading');await ctx._staffSubmitApproval('ceo');
});

test('approval comment failure preserves input and unlocks it',async()=>{
  const {ctx,fields,events}=approvalContext({sbPatch:async()=>{throw Error('HTTP 500');}});
  await ctx._staffApvComment(1);assert.equal(fields.apvCmtInp_1.value,'확인 부탁드립니다');
  assert.equal(fields.apvCmtInp_1.disabled,false);assert.equal(events.includes('comments'),false);
});

test('approval pagination reads every page rather than truncating at the server limit',async()=>{
  const offsets=[];const ctx=context(['_staffReadPages'],{sbGet:async(t,q)=>{const n=Number(new URLSearchParams(q).get('offset'));offsets.push(n);return Array.from({length:n?2:100},(_,i)=>({id:n+i}));}});
  const rows=await ctx._staffReadPages('staff_approvals','order=created_at.desc');assert.equal(rows.length,102);assert.deepEqual(offsets,[0,100]);
});

function calendarContext(overrides={}){
  return context(['loadStudentEvents','_staffFetchCalendarRows'],{CU:{id:'song'},SB_URL:'https://example.invalid',SB_KEY:'test',_staffCalRequest:0,_staffCalLoading:false,_staffCalError:'',_studentEvents:[],_shuttleAppCounts:{},_staffCalendarStatus(){},localDateStr:d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),...overrides});
}
test('calendar rejects HTTP failure instead of reporting an empty successful schedule',async()=>{
  const ctx=calendarContext({fetch:async()=>response({message:'denied'},403)});await ctx.loadStudentEvents(2026,9);
  assert.match(ctx._staffCalError,/조회/);assert.equal(ctx._staffCalLoading,false);
});
test('calendar ignores stale month responses, excludes canceled bookings and fetches month-boundary days',async()=>{
  const slow=deferred(),urls=[];
  const ctx=calendarContext({fetch:async url=>{urls.push(url);if(url==='/api/admin/pickups')return response({pickups:[]});if(url.includes('shuttle_applications'))return response([]);if(url.includes('2026-08-30'))return slow.promise;return response([{checkin_date:'2026-10-02',booker_name:'Current',status:'confirmed'},{checkin_date:'2026-10-03',booker_name:'Canceled',status:'cancelled'}]);}});
  const old=ctx.loadStudentEvents(2026,9);await tick();await ctx.loadStudentEvents(2026,10);
  slow.resolve(response([{checkin_date:'2026-09-01',booker_name:'Old'}]));await old;
  assert.equal(ctx._studentEvents.some(e=>e.title.includes('Old')||e.title.includes('Canceled')),false);
  assert.equal(ctx._studentEvents.some(e=>e.title.includes('Current')),true);
  assert.ok(urls.some(u=>u.includes('2026-08-30')&&u.includes('2026-10-03')));
});

test('calendar shared task pool excludes archived and secret-inaccessible tasks',()=>{
  const ctx=context(['calVis'],{tasks:[{id:'ok',shared:true},{id:'arch',shared:true},{id:'secret',shared:true},{id:'private'}],taskVisible:t=>t.id!=='secret',_isArchivedTask:id=>id==='arch'});
  assert.deepEqual(Array.from(ctx.calVis(),t=>t.id),['ok']);
});

test('weekly workspace scopes entries by date, effective period and mine/shared assignments',()=>{
  const ctx=context(['_staffWeeklyWorkspace','_wkPeriodOk','_clHasEmp','_clAssignees','_staffSafe'],{
    CU:{id:'song'},_staffWeeklyDay:'2026-09-10',_staffWeeklyScope:'mine',_staffWeeklyOnlyOpen:true,_dailyToday:()=> '2026-09-10',
    _clBadge:id=>id,_wkMetaChips:()=>'',CHECKLIST_ITEMS:[
      {id:'a',kind:'weekly',weekday:4,content:'My task',assignee:'song'},
      {id:'b',kind:'weekly',weekday:4,content:'Other task',assignee:'candice'},
      {id:'c',kind:'weekly',weekday:4,content:'Completed task',assignee:'all'},
      {id:'d',kind:'weekly',weekday:4,content:'Expired task',assignee:'song',end_date:'2026-09-09'}]
  });
  const h=ctx._staffWeeklyWorkspace(['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11','2026-09-12','2026-09-13'],{'2026-09-10|c':{checked:true}},[]);
  assert.match(h,/My task/);assert.doesNotMatch(h,/Other task|Completed task|Expired task/);
  assert.equal(ctx._staffWeeklySnapshot.entries.length,2);
});

test('failed weekly load does not present a false unchecked list or no-customer result',async()=>{
  const sec={innerHTML:'previous'},actor={id:'song'};
  const ctx=context(['loadWeeklyCheck'],{CU:actor,document:{getElementById:()=>sec},_ymdLocal:d=>d.toISOString().slice(0,10),loadChecklistItems:async strict=>{assert.equal(strict,true);return [];},sbGet:async()=>[],_staffReadPages:async()=>{throw Error('offline');},_weeklyHtml:()=>assert.fail('False empty list')});
  await ctx.loadWeeklyCheck();assert.match(sec.innerHTML,/불러오지 못했습니다/);
});

test('attachment gallery escapes names, retains ZIP and legacy PDF downloads, rejects script URLs',()=>{
  const ctx=context(['_staffMediaUrl','_staffAttachmentHtml','_staffSafe','fileKind','fmtFileSize'],{location:{href:'https://example.invalid/team'}});
  assert.equal(ctx._staffMediaUrl('javascript:alert(1)'),'');
  assert.equal(ctx._staffMediaUrl('  '),'');
  assert.equal(ctx._staffMediaUrl('data:text/html;base64,PHNjcmlwdD4='),'');
  assert.match(ctx._staffMediaUrl('data:application/pdf;base64,JVBERg=='),/^data:application\/pdf/);
  const h=ctx._staffAttachmentHtml([{name:'<script>.png',url:'/photo.png',type:'image/png'},{name:'사진.zip',url:'/photos.zip'}]);
  assert.match(h,/data-staff-photo/);assert.match(h,/loading="lazy"/);assert.match(h,/ZIP 내려받기/);assert.doesNotMatch(h,/<script>/);
});

test('image optimization keeps unsupported/small images and falls back to original if decode fails',async()=>{
  const ctx=context(['_staffOptimizeUploadFile'],{createImageBitmap:async()=>{throw Error('decode');}});
  for(const file of [{name:'a.gif',type:'image/gif',size:2000000},{name:'a.png',type:'image/png',size:1000},{name:'a.jpg',type:'image/jpeg',size:2000000}])assert.equal(await ctx._staffOptimizeUploadFile(file),file);
});

test('image optimization limits dimensions and only uses an output meaningfully smaller than original',async()=>{
  let dimensions,closed=false;
  const bitmap={width:6000,height:4000,close:()=>{closed=true;}};
  const canvas={getContext:()=>({drawImage:(b,x,y,w,h)=>{dimensions=[w,h];}}),toBlob:cb=>cb({size:100000,type:'image/webp'})};
  const ctx=context(['_staffOptimizeUploadFile'],{createImageBitmap:async()=>bitmap,document:{createElement:()=>canvas},File:class{constructor(parts,name,opts){this.name=name;this.type=opts.type;}}});
  const out=await ctx._staffOptimizeUploadFile({name:'photo.jpg',size:3000000,type:'image/jpeg'});
  assert.equal(out.name,'photo.webp');assert.deepEqual(dimensions,[2560,1707]);assert.equal(closed,true);
});

test('task detail actually renders its stored photo attachments through the shared gallery',()=>{
  let html='';const stop=Error('render captured'),host={set innerHTML(value){html=value;throw stop;}};
  const ctx=context(['_renderStaffTaskDetail','renderTaskFiles','_staffAttachmentHtml','_staffMediaUrl','fileKind','fmtFileSize','_staffSafe','_staffTaskItems','_staffTaskCreatedLabel'],{
    document:{getElementById:()=>host},tasks:[{id:'t',title:'Photos',files:[{name:'photo.jpg',type:'image/jpeg',url:'/photo.jpg'}]}],CU:{id:'song'},taskComments:{},_staffTaskCanEdit:()=>true,taskVisible:()=>true,isDoneTask:()=>false,getP:()=>null,todayStr:()=> '2026-09-10',location:{href:'https://example.invalid/team'}
  });
  assert.throws(()=>ctx._renderStaffTaskDetail('t','host'),e=>e===stop);assert.match(html,/data-staff-photo="https:\/\/example.invalid\/photo.jpg"/);
});
