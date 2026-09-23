/* Staff instruction editor/detail. Keeps staff_tasks/checklist and comment contracts. */
var _staffTaskSaving=false,_staffTaskDraftId=null,_staffTaskWrites={};
var _staffTaskPageOpen=false,_staffTaskPageDirty=false,_staffTaskReturnScroll=0;
function _staffTaskOpenPage(){
  var page=document.getElementById('taskModal'),main=document.querySelector('.main-area');if(!page||!main)return;
  _staffTaskReturnScroll=window.scrollY;_staffTaskPageOpen=true;_staffTaskPageDirty=false;
  page.classList.remove('overlay');page.classList.add('swt-page');page.setAttribute('role','region');page.removeAttribute('aria-modal');
  main.appendChild(page);document.body.classList.add('staff-task-page-open');window.scrollTo(0,0);
}
function _staffTaskClosePage(){
  if(_staffTaskPageDirty&&!_staffTaskSaving&&!confirm('작성한 내용을 저장하지 않고 돌아갈까요?'))return false;
  _staffTaskPageOpen=false;_staffTaskPageDirty=false;document.body.classList.remove('staff-task-page-open');window.scrollTo(0,_staffTaskReturnScroll);return true;
}
window.addEventListener('beforeunload',function(e){if(_staffTaskPageOpen&&_staffTaskPageDirty){e.preventDefault();e.returnValue='';}});
async function _staffReservationPreview(host,id){
  if(!host)return;var request=(host._request||0)+1;host._request=request;host.hidden=false;
  host.innerHTML='<p role="status">손님 내역을 불러오는 중입니다…</p>';if(host.parentElement)host.parentElement.scrollTop=0;
  try{
    var rows=await sbGet('bookings','select='+_staffBookingFields()+'&id=eq.'+encodeURIComponent(id)),b=rows[0];
    if(!host.isConnected||host._request!==request)return;if(!b)throw Error('예약을 찾을 수 없습니다.');
    var students=[];try{students=typeof b.students==='string'?JSON.parse(b.students):b.students||[];}catch(e){}
    var names=Array.isArray(students)?students.map(function(s){return s.korName||s.name_kr||s.name||'학생';}).join(', '):'';
    host.innerHTML='<div class="swt-reservation-head"><h2>손님 내역 함께 보기</h2><button type="button" class="tm-btn" data-close>접기</button></div><strong class="swt-reservation-name">'+_staffSafe(b.booker_name||'이름 미등록')+'</strong><p>'+_staffSafe(b.reservation_no||'')+'</p><dl><dt>체류 기간</dt><dd>'+_staffSafe(b.checkin_date||'미정')+' → '+_staffSafe(b.checkout_date||'미정')+'</dd><dt>숙소 · 객실</dt><dd>'+_staffSafe([b.accom_type,b.house_no||b.accom_room].filter(Boolean).join(' · ')||'미정')+'</dd><dt>학생</dt><dd>'+_staffSafe(names||'등록 정보 없음')+'</dd><dt>예약 상태</dt><dd>'+_staffSafe(b.status||'확인 필요')+'</dd><dt>주담당 · 케어담당</dt><dd>'+_staffSafe([b.assignee,b.care_assignee].filter(Boolean).join(' · ')||'미배정')+'</dd></dl><a class="tm-btn" href="/admin/bookings/'+encodeURIComponent(b.id)+'" target="_blank" rel="noopener">전체 예약 상세 ↗</a><p class="swt-help">현재 예약 정보의 조회용 요약입니다. 변경은 예약 상세에서 진행하세요.</p>';
    host.querySelector('[data-close]').onclick=function(){host.hidden=true;host._request++;};
  }catch(e){if(host.isConnected&&host._request===request)host.innerHTML='<p role="alert">손님 내역을 불러오지 못했습니다. 예약을 다시 선택해주세요.</p>';}
}
function _staffTaskCanEdit(t){return !!(CU&&(isManagerCU()||t.createdBy===CU.id||_staffAssigned(t,CU.id)));}
function _staffWebsiteTaskTitle(title){return /^\s*(?:\[\s*홈페이지\s*수정\s*\]|홈페이지\s*수정(?:\s*[:：-]|\s*$))/.test(title||'');}
function _staffTaskTitleWithCategory(title,category){
  var clean=String(title||'').replace(/^\s*\[\s*홈페이지\s*수정\s*\]\s*/, '').trim();
  return category==='website'?'[홈페이지 수정] '+clean:clean;
}
function _staffTaskCompletionPatch(t,done){
  var checklist=JSON.parse(JSON.stringify(t.checklist||[])),items=Array.isArray(checklist)?checklist:checklist.items||[];
  items.forEach(function(item){item.done=done;});
  return {done:done,progress:done?100:0,checklist:checklist};
}
function _staffTaskItems(t){return Array.isArray(t.checklist)?t.checklist:(t.checklist&&Array.isArray(t.checklist.items)?t.checklist.items:[]);}
async function _staffToggleTaskCompletion(id){
  var t=tasks.find(function(x){return String(x.id)===String(id);});if(!t||_staffTaskWrites[id])return false;
  var multi=_staffCompletionPeople(t).length>1;var done=multi?!_staffOwnCompleted(t):!isDoneTask(t);_staffTaskWrites[id]=true;
  try{
    if(multi){await _staffCompleteMine(t,done);done=isDoneTask(t);}else await _staffTaskPersistPatch(t,_staffTaskCompletionPatch(t,done));
    if(done){if(typeof _empSelTaskId!=='undefined'&&String(_empSelTaskId)===String(id))_empSelTaskId=null;if(typeof _boardSelTaskId!=='undefined'&&String(_boardSelTaskId)===String(id))_boardSelTaskId=null;}
    try{if(done&&t.createdBy&&CU&&t.createdBy!==CU.id)createNotif(t.createdBy,'task',t.id,(CU.name||CU.id)+'님이 업무를 완료했습니다: '+t.title);}catch(e){}
    refreshAll();return true;
  }catch(e){toast('완료 상태를 저장하지 못했습니다. 기존 업무를 유지합니다.','#ef4444');return false;}
  finally{delete _staffTaskWrites[id];}
}
function _staffTaskCompletedView(hostId){
  if(hostId==='empDetail'){_empSelTaskId=null;setEmpTab('home');}
  else{if(typeof _staffBoardDetailOpen!=='undefined'&&_staffBoardDetailOpen)closeBoardDrawer();_boardSelTaskId=null;renderBoard();}
  toast('완료했습니다. 완료 목록에서 다시 확인할 수 있습니다.');
}
function _staffTaskCreatedLabel(value){
  if(value==null||value==='')return '미지정';
  var plain=String(value),day=plain.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(day)return Number(day[1])+'년 '+Number(day[2])+'월 '+Number(day[3])+'일';
  if(/^\d{4}년\s*\d{1,2}월\s*\d{1,2}일$/.test(plain))return plain;
  var date=new Date(value);if(isNaN(date.getTime()))return '미지정';
  var options={year:'numeric',month:'long',day:'numeric'};
  if(typeof value==='number'||/\d{1,2}:\d{2}/.test(plain)){options.hour='2-digit';options.minute='2-digit';}
  return date.toLocaleString('ko-KR',options);
}
function _staffTaskPrepareForm(){
  if(typeof _staffMediaDraft!=='undefined'){_staffMediaDraft++;_staffMediaFailures=[];var hint=document.getElementById('staffMediaHint');if(hint)hint.remove();_staffMediaFormHint();}
  var modal=document.getElementById('taskModal');if(!modal)return;
  if(!editTaskId)_staffTaskDraftId=null;
  if(!modal.classList.contains('swt-editor')){
    modal.classList.add('swt-editor');modal.setAttribute('aria-labelledby','swtFormHeading');
    var inner=modal.querySelector('.tm-ed-inner'),main=document.createElement('div'),aside=document.createElement('aside');
    main.className='swt-editor-main';aside.className='swt-editor-aside';
    while(inner.firstChild)main.appendChild(inner.firstChild);
    inner.append(main,aside);
    var intro=document.createElement('header');intro.className='swt-form-intro';
    intro.innerHTML='<p class="swt-eyebrow">TASK INSTRUCTION</p><h1 id="swtFormHeading">업무 지시 작성</h1><p>무엇을 해야 하는지, 어떤 결과가 필요한지 명확하게 전달하세요.</p>';
    main.prepend(intro);
    var title=document.getElementById('tmTit');title.placeholder='예: 이번 주 입실 가족 항공편 확인 및 픽업팀 전달';
    title.setAttribute('aria-label','업무 제목');
    document.getElementById('tmDue').setAttribute('aria-label','완료 기한');
    var assign=document.getElementById('tmAssWrap');assign.tabIndex=0;assign.setAttribute('role','button');assign.setAttribute('aria-label','담당자 선택');
    assign.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleAssignPicker();}});
    var label=document.createElement('label');label.className='swt-field-label';label.htmlFor='tmTit';label.textContent='업무 제목';title.before(label);
    var category=document.createElement('div');category.className='swt-category';
    category.innerHTML='<label class="swt-field-label" for="swtCategory">업무 분류</label><select id="swtCategory" class="tm-input"><option value="general">일반 업무</option><option value="website">홈페이지 수정</option></select><p class="swt-help">홈페이지 수정을 선택하면 제목에 [홈페이지 수정] 말머리가 붙습니다. 담당자도 함께 지정해주세요.</p>';
    label.before(category);
    var body=document.getElementById('tmNt');body.setAttribute('role','textbox');body.setAttribute('aria-label','업무 요청 내용');body.setAttribute('aria-multiline','true');
    body.dataset.ph='요청 배경, 해야 할 일, 전달 방법을 적어주세요.';
    var bodyHead=document.createElement('div');bodyHead.className='swt-body-head';
    bodyHead.innerHTML='<span class="swt-field-label">요청 내용</span><button type="button" data-swt-template>작성 가이드 넣기</button>';
    body.previousElementSibling.before(bodyHead);
    bodyHead.querySelector('button').onclick=function(){
      if(body.textContent.trim()){body.focus();return;}
      body.innerHTML=document.getElementById('swtCategory').value==='website'?'<h3>수정할 화면 주소</h3><p><br></p><h3>현재 문제와 재현 방법</h3><p><br></p><h3>원하는 결과 · 직원이 직접 처리해야 할 기능</h3><p><br></p><h3>확인 방법</h3><p>실제 홈페이지에서 검증 후 이 업무에 결과를 댓글로 남겨주세요.</p>':'<h3>요청 배경</h3><p><br></p><h3>해야 할 일</h3><ul><li><br></li></ul><h3>결과 전달 방법</h3><p><br></p>';_staffTaskPageDirty=true;body.focus();
    };
    var checklist=document.getElementById('tmClSection').parentElement;
    checklist.querySelector('.tm-ed-section-title').textContent='완료 조건 · 체크리스트';
    document.getElementById('tmClInp').placeholder='예: 항공편 확인 후 픽업팀에 전달하고 확인받기';
    var tip=document.createElement('p');tip.className='swt-help';tip.textContent='업무가 끝났다고 판단할 수 있는 결과를 한 항목씩 추가하세요.';checklist.prepend(tip);
    aside.innerHTML='<div class="swt-route"><span>업무 전달</span><strong id="swtRoute"></strong><p id="swtDueSummary"></p></div><h2>담당자와 기한</h2>';
    aside.appendChild(main.querySelector('.tm-ed-meta'));
    var options=document.createElement('section');options.className='swt-options';options.innerHTML='<h2>우선순위 · 공개 범위</h2>';
    ['tmUrgent','tmShare','tmSecret'].forEach(function(id){options.appendChild(document.getElementById(id).closest('label'));});aside.appendChild(options);
    var linked=document.createElement('section');linked.className='swt-booking-search';
    linked.innerHTML='<h2>관련 예약 연결</h2><label for="swtBookingQuery">예약자명 또는 예약번호</label><div><input id="swtBookingQuery" placeholder="두 글자 이상 입력"><button type="button" id="swtBookingSearch">검색</button></div><div id="swtBookingResults" role="status"></div><p class="swt-help">선택한 예약의 상세 링크가 요청 내용에 추가됩니다.</p>';
    aside.appendChild(linked);document.getElementById('swtBookingSearch').onclick=_staffTaskSearchBooking;
    document.getElementById('swtBookingQuery').onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();_staffTaskSearchBooking();}};
    modal.addEventListener('input',function(){_staffTaskPageDirty=true;_staffTaskFormSummary();});modal.addEventListener('change',function(){_staffTaskPageDirty=true;});
    modal.addEventListener('change',function(e){if(e.target.id==='tmSecret'&&e.target.checked)document.getElementById('tmShare').checked=false;if(e.target.id==='tmShare'&&e.target.checked)document.getElementById('tmSecret').checked=false;_staffTaskFormSummary();});
    document.getElementById('tmErr').setAttribute('role','alert');
  }
  document.getElementById('swtFormHeading').textContent=editTaskId?'업무 지시 수정':'업무 지시 작성';
  document.getElementById('swtBookingQuery').value='';document.getElementById('swtBookingResults').innerHTML='';
  var results=document.getElementById('swtBookingResults');results._version=(results._version||0)+1;
  var existing=editTaskId?tasks.find(function(t){return String(t.id)===String(editTaskId);}):null;
  document.getElementById('swtCategory').value=existing&&_staffWebsiteTaskTitle(existing.title)?'website':'general';
  if(existing)document.getElementById('tmTit').value=existing.title.replace(/^\s*\[\s*홈페이지\s*수정\s*\]\s*/, '');
  document.getElementById('tmCreated').textContent=_staffTaskCreatedLabel(existing&&existing.createdAt||Date.now());
  document.getElementById('tmAssPicker').style.display='none';
  var preview=document.getElementById('swtEditorReservation');if(!preview){preview=document.createElement('section');preview.id='swtEditorReservation';preview.className='swt-reservation-preview';modal.querySelector('.swt-editor-aside').prepend(preview);}preview.hidden=true;preview._request=(preview._request||0)+1;
  _staffRelatedTaskSetup();
  _staffTaskOpenPage();
  _staffTaskFormSummary();
}
function _staffTaskFormSummary(){
  var route=document.getElementById('swtRoute');if(!route)return;
  var t=editTaskId?tasks.find(function(x){return String(x.id)===String(editTaskId);}):null;
  var from=getP(t&&t.createdBy||CU&&CU.id),ids=Array.from(_assignSelected).filter(Boolean);
  var names=ids.map(function(id){var p=getP(id);return p?p.name:id;});
  route.textContent=(from?from.name:'작성자')+' → '+(names.join(', ')||'담당자 미지정');
  var radio=document.querySelector('input[name="tmDM"]:checked'),due=document.getElementById('tmDue').value;
  document.getElementById('swtDueSummary').textContent=radio&&radio.value==='date'?(due?due+'까지 완료':'완료 기한을 선택해주세요'):'완료 기한 없음';
  var button=document.getElementById('tmSaveBtn');if(button&&!_staffTaskSaving)button.textContent=editTaskId?'변경사항 저장':'업무 등록';
}
function _staffTaskSearchBooking(){
  var input=document.getElementById('swtBookingQuery'),box=document.getElementById('swtBookingResults');
  var query=input.value.trim();if(query.length<2){box.textContent='검색어를 두 글자 이상 입력해주세요.';return Promise.resolve();}
  var version=box._version=(box._version||0)+1;
  var term=encodeURIComponent('"*'+query.replace(/[*,%]/g,'').replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'*"');
  box.textContent='예약을 찾는 중입니다…';
  return sbGet('bookings','select=id,booker_name,reservation_no,checkin_date,checkout_date,status&or=(booker_name.ilike.'+term+',reservation_no.ilike.'+term+')&order=checkin_date.desc&limit=20').then(function(rows){
    if(box._version!==version||input.value.trim()!==query)return;
    box.innerHTML='';rows=rows.filter(function(b){return String(b.status||'').indexOf('취소')<0;});
    if(!rows.length){box.textContent='해당하는 예약이 없습니다.';return;}
    rows.forEach(function(b){var btn=document.createElement('button');btn.type='button';btn.className='swt-booking-result';btn.textContent=(b.booker_name||'이름 없음')+' · '+(b.checkin_date||'')+' · '+(b.reservation_no||'');
      btn.onclick=function(){var p=document.createElement('p'),a=document.createElement('a');a.href='/admin/bookings/'+encodeURIComponent(b.id);a.textContent='연결 예약: '+btn.textContent;a.target='_blank';a.rel='noopener';p.appendChild(a);document.getElementById('tmNt').appendChild(p);box.textContent='요청 내용에 예약 링크를 추가했습니다.';_staffTaskPageDirty=true;_staffReservationPreview(document.getElementById('swtEditorReservation'),b.id);};box.appendChild(btn);});
  }).catch(function(){if(box._version===version)box.textContent='예약 검색에 실패했습니다. 다시 시도해주세요.';});
}
function _staffTaskCandidate(previous,form,id,actor,now){
  var checklist=JSON.parse(JSON.stringify(form.checklist));
  var items=Array.isArray(checklist)?checklist:checklist.items||[];
  var progress=items.length?Math.round(items.filter(function(c){return c.done;}).length/items.length*100):(previous?previous.progress||0:0);
  return Object.assign({},previous||{id:id,done:false,createdAt:now,createdBy:actor},{
    title:form.title,assignee:form.assignees[0]||'',assignees:form.assignees.slice(),due:form.due,note:form.note,
    files:JSON.parse(JSON.stringify(form.files)),checklist:checklist,progress:progress,projId:form.projId||null,
    shared:form.secret?false:form.shared,secret:form.secret,priority:form.priority,
    done:items.length?progress===100:!!(previous&&previous.done),
  });
}
async function _staffSaveInstruction(){
  if(typeof _staffMediaBusy!=='undefined'&&_staffMediaBusy){showTaskErr('사진 업로드가 끝난 뒤 저장해주세요.');return;}
  if(_staffTaskSaving)return;
  clearTaskErr();
  var previous=editTaskId?tasks.find(function(t){return String(t.id)===String(editTaskId);}):null;
  if(editTaskId&&!previous){showTaskErr('업무를 찾을 수 없습니다. 목록을 새로 불러와주세요.');return;}
  if(previous&&!_staffTaskCanEdit(previous)){showTaskErr('이 업무를 수정할 권한이 없습니다.');return;}
  var title=document.getElementById('tmTit').value.trim(),dateMode=document.querySelector('input[name="tmDM"]:checked');
  var due=dateMode&&dateMode.value==='date'?document.getElementById('tmDue').value:'';
  if(!title){showTaskErr('업무 제목을 입력해주세요.');document.getElementById('tmTit').focus();return;}
  title=_staffTaskTitleWithCategory(title,document.getElementById('swtCategory').value);
  if(dateMode&&dateMode.value==='date'&&!due){showTaskErr('완료 기한을 선택하거나 기한 없음을 선택해주세요.');return;}
  var ids=Array.from(_assignSelected).filter(Boolean),sub=document.getElementById('tmSubToggle').checked;
  var form={title:title,assignees:ids,due:due,note:_tmNtGet(),files:mFiles,checklist:sub?{_sub:true,items:tmSubtasks}:tmChecklist,projId:tmProjId,
    shared:document.getElementById('tmShare').checked,secret:document.getElementById('tmSecret').checked,priority:document.getElementById('tmUrgent').checked?'high':'normal'};
  var candidate=_staffTaskCandidate(previous,form,previous?previous.id:(_staffTaskDraftId||(_staffTaskDraftId=uid())),CU&&CU.id,new Date().toISOString());
  var button=document.getElementById('tmSaveBtn'),inner=document.querySelector('#taskModal .tm-ed-inner');
  _staffTaskSaving=true;if(button){button.disabled=true;button.textContent='저장 중…';}if(inner)inner.inert=true;
  try{
    var result=await sbUpsert('staff_tasks',taskToRow(candidate));
    if(!Array.isArray(result)||!result.some(function(r){return String(r.id)===String(candidate.id);}))throw new Error('저장 결과를 확인하지 못했습니다. 다시 시도해주세요.');
    if(window._staffChatBeforeTaskSaved)await window._staffChatBeforeTaskSaved(candidate);
    var index=tasks.findIndex(function(t){return String(t.id)===String(candidate.id);});
    if(index>=0)tasks[index]=candidate;else tasks.unshift(candidate);
    rebuildIdx();svTasks();
    // Notify only once persistence has succeeded; editing notifies newly added assignees only.
    var oldIds=previous?[previous.assignee].concat(previous.assignees||[]):[];
    var notifyIds=!previous&&!ids.length?ALL.map(function(p){return p.id;}).filter(function(id){return id!==(CU&&CU.id);}):ids.filter(function(id){return id!==(CU&&CU.id)&&oldIds.indexOf(id)<0;});
    try{if(notifyIds.length)createNotifMultiple(notifyIds,ids.length?'task_assigned':'unassigned_task',candidate.id,'새 업무: '+candidate.title.slice(0,50));}catch(e){console.warn('업무 저장 후 알림 처리 실패');}
    closeM('taskModal');_staffTaskDraftId=null;
    try{refreshAll();if(curProjId)renderProjDetail(curProjId);}catch(uiError){console.warn('업무 저장 완료, 화면 갱신 필요');}
    toast(previous?'변경사항을 저장했습니다.':'업무를 등록했습니다.');
  }catch(e){showTaskErr('저장하지 못했습니다. 입력한 내용은 유지됩니다. '+(e&&e.message||''));}
  finally{_staffTaskSaving=false;if(button)button.disabled=false;if(inner)inner.inert=false;_staffTaskFormSummary();}
}
function _staffTaskPersistPatch(t,patch){
  if(!_staffTaskCanEdit(t))return Promise.reject(new Error('수정 권한이 없습니다.'));
  var body=Object.assign({},patch);if(Object.prototype.hasOwnProperty.call(body,'checklist'))body.checklist=JSON.stringify(body.checklist);
  return sbPatch('staff_tasks','id=eq.'+encodeURIComponent(t.id),body).then(function(rows){
    if(!Array.isArray(rows)||!rows.some(function(r){return String(r.id)===String(t.id);}))throw new Error('저장 결과를 확인하지 못했습니다.');
    var current=tasks.find(function(x){return String(x.id)===String(t.id);});if(current)Object.assign(current,rowToTask(rows.find(function(r){return String(r.id)===String(t.id);})));
    rebuildIdx();svTasks();if(String(t.id).indexOf('class-application:')===0){if(typeof _loadClassApplications==='function')void _loadClassApplications();try{window.top.postMessage({type:'class-applications-changed'},location.origin);}catch(e){}}return current;
  });
}
function _staffTaskCheckPatch(t,index){
  var checklist=JSON.parse(JSON.stringify(t.checklist)),items=Array.isArray(checklist)?checklist:checklist.items;
  if(!items||!items[index])throw new Error('체크 항목을 찾을 수 없습니다.');
  items[index].done=!items[index].done;
  var progress=Math.round(items.filter(function(c){return c.done;}).length/items.length*100);
  return _staffCompletionPeople(t).length>1?{checklist:checklist}:{checklist:checklist,progress:progress,done:progress===100};
}
function _staffOwnComment(c){return !!(CU&&c&&c.id!=null&&c.id!==''&&String(c.author)===String(CU.id));}
function _staffCommentHtml(c,index){
  var person=getP(c.author);
  return '<div class="swt-comment" data-comment-index="'+index+'"><div class="swt-comment-head"><div><b>'+_staffSafe(person?person.name:c.author||'직원')+'</b><small>'+_staffSafe(c.date||'')+'</small></div>'+(_staffOwnComment(c)?'<div class="swt-comment-actions"><button type="button" data-act="comment-edit">수정</button><button type="button" data-act="comment-delete">삭제</button></div>':'')+'</div><p>'+_staffSafe(c.text||'')+'</p><div class="swt-comment-photos">'+(typeof _staffAttachmentHtml==='function'?_staffAttachmentHtml(c.files||[]):'')+'</div><div class="swt-comment-controls"></div></div>';
}
async function _staffMutateComment(taskId,c,text,deleting,files){
  if(!_staffOwnComment(c))throw new Error('본인이 작성한 댓글만 수정·삭제할 수 있습니다.');
  var author=CU.id;
  if(!deleting&&!text.trim()&&!(files||c.files||[]).length)throw new Error('댓글 내용 또는 사진을 입력해주세요.');
  var response=await fetch('/api/staff/comments',{method:deleting?'DELETE':'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:String(c.id),taskId:String(taskId),originalText:c.text||'',originalFiles:c.files||[],text:text,files:files===undefined?c.files||[]:files})});
  var data=await response.json();
  if(!response.ok){var failure=new Error(data.error||'댓글 저장에 실패했습니다.');failure.status=response.status;throw failure;}
  if(!data.comment||String(data.comment.id)!==String(c.id)||String(data.comment.task_id)!==String(taskId)||data.deleted!==deleting)throw new Error('저장 결과를 확인하지 못했습니다.');
  if(CU&&CU.id===author){
    var list=taskComments[taskId]||[],index=list.findIndex(function(row){return String(row.id)===String(c.id);});
    if(index>=0){if(deleting)list.splice(index,1);else list[index]=rowToTc(data.comment);}
    sv('tm_tc',taskComments);
  }
  return data.comment;
}
async function _staffCommentReauthenticate(password){
  if(!password)throw new Error('비밀번호를 입력해주세요.');
  var author=CU&&CU.id,info;
  try{info=JSON.parse(localStorage.getItem('adminInfo')||'{}');}catch(e){info={};}
  var username=info.staffId||('admin-'+author);
  if(!author||username.replace(/^admin-/,'')!==String(author))throw new Error('현재 직원 계정을 확인할 수 없습니다.');
  var response=await fetch('/api/admin/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:username,password:password})});
  var data=await response.json();
  if(!response.ok||!data.success)throw new Error(data.message||'로그인을 확인하지 못했습니다.');
  if(data.role!=='korean_admin'||!data.staff||data.staff.username!==username||!CU||CU.id!==author)throw new Error('같은 직원 계정으로 다시 확인해주세요.');
}
function _staffCommentAuthPrompt(controls,taskId){
  if(controls.querySelector('.swt-comment-auth'))return;
  var box=document.createElement('form');box.className='swt-comment-auth';
  box.innerHTML='<b>로그인 다시 확인</b><p>수정 내용은 그대로 유지됩니다. 현재 직원 계정의 비밀번호를 확인한 뒤 저장을 다시 눌러주세요.</p><label>비밀번호<input type="password" name="password" autocomplete="current-password" required></label><button type="submit">로그인 확인</button><div role="status"></div>';
  controls.appendChild(box);
  box.addEventListener('submit',async function(e){
    e.preventDefault();if(_staffTaskWrites[taskId])return;
    var input=box.querySelector('input'),button=box.querySelector('button'),message=box.querySelector('[role="status"]');
    _staffTaskWrites[taskId]=true;button.disabled=true;input.disabled=true;message.textContent='확인 중…';
    try{await _staffCommentReauthenticate(input.value);input.value='';if(box.isConnected){box.remove();controls.querySelector('[role="status"]').textContent='로그인을 확인했습니다. 저장 또는 삭제 확인을 다시 눌러주세요.';}}
    catch(err){input.value='';if(box.isConnected)message.textContent=err.message;}
    finally{delete _staffTaskWrites[taskId];button.disabled=false;input.disabled=false;}
  });
}
function _renderStaffTaskDetail(taskId,hostId){
  var host=document.getElementById(hostId),t=tasks.find(function(x){return String(x.id)===String(taskId);});if(!host||!t)return;
  var canEdit=_staffTaskCanEdit(t),canComment=!!CU&&taskVisible(t),items=_staffTaskItems(t),done=isDoneTask(t),creator=getP(t.createdBy),ids=[t.assignee].concat(t.assignees||[]).filter(function(id,i,a){return id&&a.indexOf(id)===i;});
  var people=ids.map(function(id){var p=getP(id);return p?p.name:id;}).join(', ')||'미배정';
  var comments=(taskComments[t.id]||[]).slice();
  host.innerHTML='<article class="swt-detail"><div class="swt-detail-nav"><button data-act="back">← 목록으로</button><span>업무 상세</span></div><header class="swt-detail-header"><div><span class="swt-badge '+(done?'is-done':'')+'">'+(done?'완료':'진행 중')+'</span>'+(t.priority==='high'?'<span class="swt-badge is-urgent">긴급</span>':'')+'<h1>'+_staffSafe(t.title)+'</h1><p>'+_staffSafe(creator?creator.name:t.createdBy||'작성자 미지정')+' → '+_staffSafe(people)+'</p></div>'+(canEdit?'<button class="swh-primary" data-act="edit">업무 수정</button>':'<span>읽기 전용</span>')+'</header>'+
    '<div class="swt-detail-grid"><main><section class="swt-card"><div class="swt-request-heading"><h2>요청 내용</h2><span class="swt-created-at">작성 · '+_staffSafe(_staffTaskCreatedLabel(t.createdAt))+'</span></div>'+(t.note?_taskNoteHtml(t):'<p class="swt-help">등록된 요청 내용이 없습니다.</p>')+'</section>'+
    '<section class="swt-card"><div class="swt-section-head"><h2>'+(t.checklist&&t.checklist._sub?'하위 업무':'완료 조건')+'</h2><span>'+items.filter(function(c){return c.done;}).length+' / '+items.length+'</span></div><p class="swt-help">'+(_staffCompletionPeople(t).length>1?'각 담당자가 내 업무 완료를 눌러야 합니다. 마지막 담당자가 완료하면 최종 완료됩니다.':(items.length?'모든 항목을 체크하면 업무가 완료됩니다.':'결과를 아래에 남긴 뒤 완료 처리하세요.'))+'</p><div class="swt-checks">'+items.map(function(c,i){return '<label><input type="checkbox" data-check="'+i+'" '+(c.done?'checked ':'')+(!canEdit?'disabled':'')+'><span><b>'+_staffSafe(c.text||c.title||'항목')+'</b>'+(c.note?'<small>'+_staffSafe(c.note)+'</small>':'')+'</span>'+((c.dueDate||c.due)?'<small>'+_staffSafe(c.dueDate||c.due)+'</small>':'')+'</label>';}).join('')+'</div></section>'+
    '<section class="swt-card"><h2>참고 자료 · 첨부 '+(t.files||[]).length+'</h2><div class="swt-files">'+((t.files||[]).length?renderTaskFiles(t):'<p class="swt-help">첨부된 파일이 없습니다.</p>')+'</div>'+(canEdit?'<button class="swt-text-btn" data-act="edit">사진·파일 추가 →</button>':'')+'</section>'+
    '<section class="swt-card"><h2>진행 상황 · 결과 보고 <span data-comment-count>'+comments.length+'</span></h2><div class="swt-comments">'+comments.map(_staffCommentHtml).join('')+'</div>'+(canComment?'<label class="swt-field-label" for="swtReply">진행한 내용과 확인이 필요한 사항을 남겨주세요.</label><textarea id="swtReply" placeholder="예: 항공편 확인 후 픽업팀에 전달했습니다. 회신 대기 중입니다."></textarea><div class="swt-reply-actions"><span>등록한 내용은 업무 관계자가 확인할 수 있습니다.</span><button class="swh-primary" data-act="comment">보고 등록</button></div>':'')+'</section></main>'+
    '<aside><section class="swt-card"><h2>업무 정보</h2><dl><dt>지시자</dt><dd>'+_staffSafe(creator?creator.name:t.createdBy||'미지정')+'</dd><dt>담당자</dt><dd>'+_staffSafe(people)+'</dd><dt>완료 기한</dt><dd class="'+(t.due&&t.due<todayStr()&&!done?'swt-late':'')+'">'+_staffSafe(t.due||'기한 없음')+'</dd><dt>진행률</dt><dd>'+_staffSafe(t.progress||0)+'%</dd><dt>작성 일시</dt><dd>'+_staffSafe(_staffTaskCreatedLabel(t.createdAt))+'</dd><dt>공개 범위</dt><dd>'+_staffSafe(t.secret?'지시자·담당자':t.shared?'팀 공유':'기존 업무 권한 적용')+'</dd></dl>'+_staffCompletionStatus(t)+( (_staffCompletionPeople(t).length>1?_staffCompletionPeople(t).includes(CU.id):canEdit)?'<button class="swt-complete" data-act="complete">'+(_staffCompletionPeople(t).length>1?(_staffOwnCompleted(t)?'내 완료 취소':'내 업무 완료'):(done?'완료 취소':'업무 완료'))+'</button>':'')+'<p class="swt-help">진행·결과 보고는 댓글로 남고, 완료 여부는 업무에 함께 저장됩니다.</p></section><div class="swt-feedback" role="status" id="swtFeedback"></div></aside></div></article>';
  var root=host.firstElementChild,feedback=root.querySelector('#swtFeedback');
  _staffRelatedTaskDetail(root);
  if(window._staffChatTaskContext)window._staffChatTaskContext(root.querySelector('.swt-detail-grid>main'),t);
  var replyDraft=_staffCommentDraft(t.id),reply=root.querySelector('#swtReply');
  if(reply){reply.value=replyDraft.text||'';reply.addEventListener('input',function(){replyDraft.text=reply.value;});var photoHost=document.createElement('div');photoHost.className='swt-comment-photo-picker';reply.after(photoHost);_staffCommentPhotoPicker(photoHost,t.id,replyDraft);}
  var reservationLinks=root.querySelectorAll('a[href*="/admin/bookings/"]');
  if(reservationLinks.length){
    var reservation=document.createElement('section');reservation.className='swt-reservation-preview';reservation.hidden=true;root.querySelector('.swt-detail-grid>aside').prepend(reservation);
    reservationLinks.forEach(function(link){var parsed=new URL(link.getAttribute('href'),location.origin);if(parsed.origin!==location.origin)return;var id=parsed.pathname.split('/')[3];if(!id)return;
      var view=document.createElement('button');view.type='button';view.className='tm-btn swt-booking-side';view.textContent='손님 내역 옆에서 보기';link.after(view);view.onclick=function(){root.classList.add('swt-with-reservation');_staffReservationPreview(reservation,decodeURIComponent(id));};
    });
  }
  function status(message){if(root.isConnected)feedback.textContent=message;}
  function rerender(){if(host.firstElementChild===root){var draft=root.querySelector('#swtReply');var text=draft?draft.value:'';_renderStaffTaskDetail(t.id,hostId);var next=host.querySelector('#swtReply');if(next&&text)next.value=text;}}
  async function update(patch){
    if(_staffTaskWrites[t.id])return;_staffTaskWrites[t.id]=true;root.setAttribute('aria-busy','true');
    root.querySelectorAll('input,button,textarea').forEach(function(el){el.disabled=true;});
    try{await _staffTaskPersistPatch(t,patch);if(isDoneTask(t)&&host.firstElementChild===root)_staffTaskCompletedView(hostId);else rerender();}
    catch(e){status('저장 실패: '+e.message);root.querySelectorAll('input[data-check]').forEach(function(el){el.checked=!!items[Number(el.dataset.check)].done;});}
    finally{delete _staffTaskWrites[t.id];root.removeAttribute('aria-busy');root.querySelectorAll('input,button,textarea').forEach(function(el){el.disabled=false;});}
  }
  root.addEventListener('change',function(e){if(e.target.dataset.check!==undefined){if(root.querySelector('[data-comment-editing]')){e.target.checked=!e.target.checked;status('댓글 수정·삭제를 저장하거나 취소한 뒤 진행해주세요.');return;}var current=tasks.find(function(x){return String(x.id)===String(t.id);});update(_staffTaskCheckPatch(current,Number(e.target.dataset.check)));}});
  root.addEventListener('click',async function(e){var button=e.target.closest('button[data-act]');if(!button)return;var act=button.dataset.act;
    if(_staffTaskWrites[t.id])return;
    if(act.indexOf('comment-')===0){
      var card=button.closest('[data-comment-index]'),index=card?Number(card.dataset.commentIndex):-1,c=comments[index];
      if(!card||!_staffOwnComment(c))return;
      var controls=card.querySelector('.swt-comment-controls'),paragraph=card.querySelector('p');
      if(act==='comment-cancel'){if(card._photoDraft&&card._photoDraft.busy)return;controls.innerHTML='';paragraph.hidden=false;card.querySelector('.swt-comment-photos').hidden=false;card.removeAttribute('data-comment-editing');card.querySelector('.swt-comment-actions').hidden=false;return;}
      if(act==='comment-edit'||act==='comment-delete'){
        if(root.querySelector('[data-comment-editing]')){status('열려 있는 댓글 수정을 저장하거나 취소해주세요.');return;}
        card.setAttribute('data-comment-editing','true');card.querySelector('.swt-comment-actions').hidden=true;
        if(act==='comment-edit'){
          paragraph.hidden=true;controls.innerHTML='<label>댓글 수정<textarea class="swt-comment-editor" aria-label="댓글 수정"></textarea></label><div class="swt-comment-actions"><button type="button" data-act="comment-save">저장</button><button type="button" data-act="comment-cancel">취소</button></div><div role="status"></div>';
          controls.querySelector('textarea').value=c.text||'';controls.querySelector('textarea').focus();
          card.querySelector('.swt-comment-photos').hidden=true;card._photoDraft={files:(c.files||[]).slice(),busy:false};var editPhotos=document.createElement('div');controls.querySelector('label').after(editPhotos);_staffCommentPhotoPicker(editPhotos,t.id,card._photoDraft);
        }else controls.innerHTML='<p>이 댓글을 삭제할까요? 삭제하면 되돌릴 수 없습니다.</p><div class="swt-comment-actions"><button type="button" class="swt-comment-danger" data-act="comment-remove">삭제 확인</button><button type="button" data-act="comment-cancel">취소</button></div><div role="status"></div>';
        return;
      }
      if(act==='comment-save'||act==='comment-remove'){
        var deleting=act==='comment-remove',editor=controls.querySelector('textarea'),value=editor?editor.value.trim():'',message=controls.querySelector('[role="status"]');
        if(card._photoDraft&&card._photoDraft.busy){message.textContent='사진 업로드가 끝난 뒤 저장해주세요.';return;}
        if(!deleting&&!value&&!(card._photoDraft&&card._photoDraft.files.length)){message.textContent='댓글 내용 또는 사진을 입력해주세요.';editor.focus();return;}
        _staffTaskWrites[t.id]=true;root.inert=true;message.textContent=deleting?'삭제 중…':'저장 중…';
        try{
          var saved=await _staffMutateComment(t.id,c,value,deleting,card._photoDraft?card._photoDraft.files:undefined);
          if(root.isConnected){
            if(deleting){card.remove();root.querySelector('[data-comment-count]').textContent=(taskComments[t.id]||[]).length;}
            else{comments[index]=rowToTc(saved);var wrapper=document.createElement('div');wrapper.innerHTML=_staffCommentHtml(comments[index],index);card.replaceWith(wrapper.firstElementChild);}
            status(deleting?'댓글을 삭제했습니다.':'댓글을 수정했습니다.');
          }
        }catch(err){if(root.isConnected){message.textContent=err.message+' 입력 내용은 유지됩니다.';if(err.status===401)_staffCommentAuthPrompt(controls,t.id);}}
        finally{delete _staffTaskWrites[t.id];root.inert=false;}
        return;
      }
    }
    if(root.querySelector('[data-comment-editing]')){status('댓글 수정·삭제를 저장하거나 취소한 뒤 진행해주세요.');return;}
    if(act==='back'){if(hostId==='empDetail'){_empSelTaskId=null;setEmpTab('home');}else renderBoardDetailEmpty();return;}
    if(act==='edit'){openTaskEdit(t.id);return;}
    if(act==='complete'){
      if(_staffCompletionPeople(t).length>1){button.disabled=true;var ok=await _staffToggleTaskCompletion(t.id);if(ok&&isDoneTask(t))_staffTaskCompletedView(hostId);else rerender();return;}
      if(!done&&items.some(function(c){return !c.done;})&&!confirm('남아 있는 완료 조건까지 모두 확인하고 이 업무를 완료할까요?'))return;
      var patch=_staffTaskCompletionPatch(t,!done);
      await update(patch);return;
    }
    if(act==='comment'){
      var input=root.querySelector('#swtReply'),text=input.value.trim();if((!text&&!replyDraft.files.length)||button.disabled)return;if(replyDraft.busy){status('사진 업로드가 끝난 뒤 등록해주세요.');return;}
      input.disabled=true;button.disabled=true;root.inert=true;_staffTaskWrites[t.id]=true;var comment={author:CU.id,text:text,ts:Date.now()};
      try{var response=await fetch('/api/staff/comments',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:replyDraft.id,taskId:String(t.id),text:text,files:replyDraft.files})});var data=await response.json();if(!response.ok){var failure=new Error(data.error||'보고 등록 실패');failure.status=response.status;throw failure;}var rows=[data.comment];if(!rows[0]||rows[0].id==null)throw new Error('등록 결과를 확인하지 못했습니다.');
        if(!taskComments[t.id])taskComments[t.id]=[];taskComments[t.id].push(rowToTc(rows[0]));sv('tm_tc',taskComments);
        try{createNotifMultiple([t.createdBy].concat(ids).filter(function(id,i,a){return id&&id!==CU.id&&a.indexOf(id)===i;}),'task_comment',t.id,'진행·결과 보고: '+t.title.slice(0,40));}catch(err){}
        replyDraft.files=[];replyDraft.text='';replyDraft.id=crypto.randomUUID();input.value='';rerender();
      }catch(err){status('보고 등록 실패: 입력 내용과 사진은 유지됩니다. '+err.message);if(err.status===401)_staffCommentAuthPrompt(photoHost,t.id);}finally{delete _staffTaskWrites[t.id];root.inert=false;input.disabled=false;button.disabled=false;}
    }
  });
}

function _staffCompletionPeople(t){
  var others=t.assignees||[];if(typeof others==='string'){try{others=JSON.parse(others);}catch(e){others=[];}}
  return [t.assignee].concat(Array.isArray(others)?others:[]).filter(function(id,i,a){return id&&id!=='all'&&a.indexOf(id)===i;});
}
function _staffOwnCompleted(t){return !!(CU&&t.completionBy&&t.completionBy[CU.id]);}
function _staffCompletionStatus(t){
  var ids=_staffCompletionPeople(t);if(ids.length<2)return '';
  function group(done){return ids.filter(function(id){return !!(t.completionBy||{})[id]===done;}).map(function(id){
    var p=getP(id)||{},color=/^#[0-9a-f]{6}$/i.test(p.color||'')?p.color:'#6366f1';
    return '<span style="display:inline-flex;align-items:center;gap:4px" title="'+_staffSafe(p.name||id)+'"><span style="display:inline-flex;align-items:center;justify-content:center;border-radius:50%;width:25px;height:25px;background:'+color+';color:white;font-size:12px">'+_staffSafe(p.initial||(p.name||id).slice(0,1).toUpperCase())+'</span><span>'+_staffSafe(p.name||id)+'</span></span>';
  }).join(' ')||'없음';}
  return '<span class="staff-completion-status" style="display:flex;flex-wrap:wrap;gap:8px 16px;margin:8px 0;font-size:12px;font-weight:500"><span style="display:inline-flex;align-items:center;gap:6px;color:#16734a">완: '+group(true)+'</span><span style="display:inline-flex;align-items:center;gap:6px;color:#9a5900">미완: '+group(false)+'</span></span>';
}
async function _staffCompleteMine(t,completed){
  var response=await fetch('/api/staff/task-completion',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({taskId:String(t.id),completed:completed})});
  var data=await response.json();if(!response.ok||!data.task)throw new Error(data.error||'완료 저장 실패');
  Object.assign(t,rowToTask(data.task));rebuildIdx();svTasks();
}
function _staffInstallIndividualCompletion(){
  var convert=rowToTask;rowToTask=function(r){var t=convert(r);t.completionBy=r.completion_by||{};return t;};
  var wasDone=isDoneTask;isDoneTask=function(t){var ids=_staffCompletionPeople(t);return ids.length>1&&t.completionBy?ids.every(function(id){return !!t.completionBy[id];}):wasDone(t);};
  var badge=_staffTaskAttentionBadge;_staffTaskAttentionBadge=function(t){return badge(t)+_staffCompletionStatus(t);};
  var directives=_homeDirectivesHtml;
  _homeDirectivesHtml=function(){
    var original=directives(),grouped=_homeVisibleTasks().filter(function(t){return taskVisible(t)&&!isDoneTask(t)&&!_isArchivedTask(t.id)&&_staffCompletionPeople(t).length>1;});
    if(!grouped.length)return original;
    return original+'<section style="margin:16px 0"><h3>함께 맡은 업무 · 담당자별 완료 현황</h3>'+grouped.map(function(t){return '<button type="button" data-personal-task="'+_staffSafe(t.id)+'" style="display:block;text-align:left;width:100%;padding:12px;margin:6px 0;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text)"><b>'+_staffSafe(t.title)+'</b>'+_staffCompletionStatus(t)+'</button>';}).join('')+'</section>';
  };
  document.addEventListener('click',function(e){var b=e.target.closest('[data-personal-task]');if(b)_homeGotoBoardTask(b.dataset.personalTask);});
  var renderProfile=renderSettingsTab5;
  renderSettingsTab5=function(){
    renderProfile();var panel=document.getElementById('sp5');if(!panel)return;
    var me=getP(CU.id)||{},initial=me.initial||({may:'M',ceo:'M',song:'S',vivace:'V'}[CU.id])||(me.name||CU.id).slice(0,1).toUpperCase();
    var box=document.createElement('div');box.style.cssText='margin:12px 0;padding:14px;border:1px solid var(--border);border-radius:10px';
    box.innerHTML='<b>내 직원 아이콘</b><p style="font-size:12px">이니셜(예: M · S · V) 또는 아래 캐릭터를 선택하세요. 업무 담당자와 완료·미완 목록에 표시됩니다.</p><label>이니셜 <input id="profInitial" maxlength="2" aria-label="직원 아이콘 이니셜" style="width:70px;padding:8px"></label><div id="profEmoji" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px"></div><span id="profAvatarPreview" style="display:inline-block;margin-top:8px"></span>';
    panel.prepend(box);var input=box.querySelector('#profInitial');input.value=initial;
    function preview(){box.querySelector('#profAvatarPreview').textContent='내 아이콘: '+input.value;}
    input.oninput=function(){input.value=input.value.toUpperCase();preview();};
    ['😀','😊','😎','🐱','🐶','🐻','🐰','🦊','🐼','🦁','🐯','🐨','🦄','🌸','🌻','⭐','🍀','🌈'].forEach(function(emoji){var b=document.createElement('button');b.type='button';b.textContent=emoji;b.style.cssText='font-size:23px;padding:5px;border:1px solid var(--border);border-radius:8px;background:var(--surface)';b.onclick=function(){input.value=emoji;preview();};box.querySelector('#profEmoji').append(b);});preview();
  };
  saveMyProfile=async function(){
    var input=document.getElementById('profInitial');if(!input)return;
    var color=document.getElementById('profColor').value,signature=document.getElementById('profSig').value;
    try{var response=await fetch('/api/staff/profile',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({initial:input.value.trim().toUpperCase(),color:color,signature:signature})});
      var data=await response.json();if(!response.ok)throw new Error(data.error||'저장 실패');
      var me=getP(CU.id);if(me){me.initial=data.profile.initial;me.color=data.profile.color;}CU.initial=data.profile.initial;CU.color=data.profile.color;
      refreshAll();toast('직원 아이콘과 프로필을 저장했습니다.');
    }catch(e){alert('프로필 저장 실패: '+e.message);}
  };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',_staffInstallIndividualCompletion);else _staffInstallIndividualCompletion();
