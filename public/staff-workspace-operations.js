/* Shared staff workflows. Existing REST contracts; no schema changes. */
var _staffProjectQueues={},_staffProjectDrafts={},_staffProjectPending={},_staffProjectToggling={},_staffProjectRequest=0;
var _staffGuideBusy=false,_guideLoadError='';
var _staffNoticeFilter='all',_staffNoticeQuery='',_staffNoticeReadBusy=false;
window.addEventListener('beforeunload',function(event){
  var unsaved=Object.values(_staffProjectDrafts).some(function(fields){return Object.values(fields).some(function(d){return d.actorId===(CU&&CU.id);});});
  if(unsaved){event.preventDefault();event.returnValue='';}
});
function _staffNoticeList(){
  var query=_staffNoticeQuery.trim().toLowerCase();
  return (notices||[]).filter(function(n){var unread=n.requireRead&&!n.done&&(noticeReads[n.id]||[]).indexOf(CU.id)<0;return (_staffNoticeFilter!=='unread'||unread)&&(!query||String(n.title||'').toLowerCase().includes(query)||_ntPlain(n).toLowerCase().includes(query));});
}
function _staffNoticeApply(filter){_staffNoticeFilter=filter;var search=document.getElementById('staffNoticeSearch');if(search)_staffNoticeQuery=search.value;renderAnnouncementsPage();}
function _staffProjectForView(id){
  var n=ptFindNode(id);if(!n)return null;
  var view=Object.assign({},n),drafts=_staffProjectDrafts[id]||{};
  Object.keys(drafts).forEach(function(field){if(drafts[field].actorId!==(CU&&CU.id))return;view[field]=drafts[field].value;if(field==='status')view.done=drafts[field].value==='done';});return view;
}
function _staffProjectSaveState(id){
  var host=document.getElementById('ptSaveState');if(!host||PT.sel!==id)return;
  if(_staffProjectPending[id]){host.textContent='변경 내용을 저장하는 중…';return;}
  if(Object.values(_staffProjectDrafts[id]||{}).some(function(d){return d.actorId===(CU&&CU.id);})){host.innerHTML='저장하지 못한 변경이 있습니다. 이 탭에서 초안을 보관 중입니다. <button class="tm-btn" onclick="_staffProjectRetry(\''+id+'\')">다시 저장</button>';return;}
  host.textContent='변경 내용이 저장되었습니다.';
}
function _staffProjectRetry(id){
  var drafts=_staffProjectDrafts[id]||{};
  return Promise.all(Object.keys(drafts).filter(function(field){return drafts[field].actorId===(CU&&CU.id);}).map(function(field){return _staffProjectSaveField(id,field,drafts[field].value);}));
}
function _staffProjectSaveField(id,field,val){
  var node=ptFindNode(id);if(!node||['title','body','status','due'].indexOf(field)<0)return Promise.resolve(false);
  if(field==='due'&&!val)val=null;
  var drafts=_staffProjectDrafts[id]||(_staffProjectDrafts[id]={});
  if(!drafts[field]&&node[field]===val)return Promise.resolve(true);
  var draft={value:val,actorId:CU&&CU.id},actor=CU;drafts[field]=draft;
  _staffProjectPending[id]=(_staffProjectPending[id]||0)+1;_staffProjectSaveState(id);
  var job=(_staffProjectQueues[id]||Promise.resolve()).then(async function(){
    if(CU!==actor)throw new Error('로그인 사용자가 바뀌었습니다.');
    var patch={updated_at:ptNow()};patch[field]=val;if(field==='status')patch.done=val==='done';
    var rows=await sbPatch('project_nodes','id=eq.'+encodeURIComponent(id),patch);
    if(!Array.isArray(rows)||!rows.some(function(r){return String(r.id)===String(id);}))throw new Error('저장 결과를 확인하지 못했습니다.');
    if(CU!==actor)return false;
    var current=ptFindNode(id);if(current)Object.assign(current,patch);
    if(drafts[field]===draft)delete drafts[field];
    _ptNotifyDebounced(id,({title:'제목 변경',body:'내용 수정',status:'상태 변경',due:'마감일 변경'})[field]);
    if(PT.cur===node.project_id&&['title','status','due'].indexOf(field)>=0)ptRenderTree(PT.cur);
    return true;
  }).catch(function(){if(CU===actor)toast('프로젝트 변경을 저장하지 못했습니다. 초안을 유지합니다.','#ef4444');return false;}).finally(function(){_staffProjectPending[id]--;if(CU===actor)_staffProjectSaveState(id);});
  _staffProjectQueues[id]=job;return job;
}
async function _staffProjectToggleDone(id){
  var n=ptFindNode(id);if(!n||_staffProjectToggling[id])return;
  _staffProjectToggling[id]=true;
  try{var ok=await _staffProjectSaveField(id,'status',n.done?'doing':'done');if(ok&&PT.sel===id)ptRenderDetail(id);}finally{delete _staffProjectToggling[id];}
}
var _staffApvBusy={},_staffApvSubmitting=false,_staffApvUploadCount=0,_staffApvDraft=0;
var _staffCalRequest=0,_staffCalLoading=false,_staffCalError='';
var _staffCalDay=null,_staffCalExpanded=false;
function _staffCalendarMonth(){
  if(_staffCalExpanded){renderMonthCal();var area=document.getElementById('calBody'),back=document.createElement('button');back.className='tm-btn';back.textContent='간결한 달력으로 보기';back.onclick=function(){_staffCalExpanded=false;renderCal();};area.prepend(back);return;}
  var year=calDate.getFullYear(),month=calDate.getMonth(),first=new Date(year,month,1),last=new Date(year,month+1,0),today=todayStr(),start=new Date(first);start.setDate(start.getDate()-start.getDay());
  if(!_staffCalDay||_staffCalDay.slice(0,7)!==localDateStr(first).slice(0,7))_staffCalDay=today.slice(0,7)===localDateStr(first).slice(0,7)?today:localDateStr(first);
  document.getElementById('calTitle').textContent=year+'년 '+(month+1)+'월';_renderCalStatsBar(year,month+1);updateCalSidePanel(year,month+1);
  var cells=Math.ceil((first.getDay()+last.getDate())/7)*7,types={task:'업무',recurring:'반복',checkin:'입실',checkout:'퇴실',pickup:'픽업',field:'필드트립',after:'수업',shuttle:'셔틀'},h='<div class="swcal"><div class="swcal-hint"><span>날짜를 선택하면 아래에서 일정 전체를 확인할 수 있습니다.</span><button class="tm-btn" id="staffCalExpand">전체 항목 펼침</button></div><div class="swcal-grid">';
  ['일','월','화','수','목','금','토'].forEach(function(d){h+='<div class="swcal-dayname">'+d+'</div>';});
  for(var i=0;i<cells;i++){var date=new Date(start);date.setDate(start.getDate()+i);var ds=localDateStr(date),events=_gatherEventsForDate(ds),counts={};events.forEach(function(e){counts[e.type]=(counts[e.type]||0)+1;});
    h+='<button class="swcal-day '+(date.getMonth()!==month?'outside ':'')+(ds===_staffCalDay?'selected ':'')+(ds===today?'today':'')+'" data-cal-day="'+ds+'" aria-label="'+ds+' 일정 '+events.length+'개"><span>'+date.getDate()+(ds===today?'<em>오늘</em>':'')+'</span>'+(CAL_HOLIDAYS[ds]?'<small class="swcal-holiday">'+_staffSafe(CAL_HOLIDAYS[ds])+'</small>':'')+'<div>'+Object.keys(counts).map(function(type){return '<small class="swcal-count '+type+'">'+_staffSafe(types[type]||'일정')+' '+counts[type]+'</small>';}).join('')+'</div></button>';
  }
  h+='</div><section class="swcal-agenda"><header><h2>'+_staffSafe(_staffCalDay)+' 일정</h2><span>'+_gatherEventsForDate(_staffCalDay).length+'개 항목</span></header><div id="staffCalDayList"></div></section></div>';
  var body=document.getElementById('calBody');body.innerHTML=h;
  body.querySelector('#staffCalExpand').onclick=function(){_staffCalExpanded=true;renderCal();};
  body.querySelectorAll('[data-cal-day]').forEach(function(button){button.onclick=function(){_staffCalDay=button.dataset.calDay;var selected=new Date(_staffCalDay+'T00:00:00');if(selected.getMonth()!==calDate.getMonth()){calDate=selected;loadStudentEvents(selected.getFullYear(),selected.getMonth()+1).then(renderCal);}renderCal();};});
  var list=body.querySelector('#staffCalDayList'),events=_gatherEventsForDate(_staffCalDay);
  if(!events.length)list.innerHTML='<p class="swo-empty">'+(_staffCalLoading?'일정을 불러오는 중입니다.':_staffCalError?'일부 일정을 확인하지 못했습니다. 다시 불러와주세요.':'등록된 일정이 없습니다.')+'</p>';
  events.forEach(function(event){var row=document.createElement('div');row.className='swcal-agenda-row';var label=document.createElement('span');label.textContent=types[event.type]||'일정';label.className='swcal-type';row.appendChild(label);_appendCalEvent(row,event);list.appendChild(row);});
}
var _staffWeeklySnapshot=null,_staffWeeklyDay=null,_staffWeeklyOnlyOpen=false,_staffWeeklyScope='all';
function _staffWeeklyWorkspace(dates,checks,bookings){
  _staffWeeklySnapshot={dates:dates,checks:checks,bookings:bookings};
  var today=_dailyToday(),days=['일','월','화','수','목','금','토'];
  if(_staffWeeklyDay!=='all'&&dates.indexOf(_staffWeeklyDay)<0)_staffWeeklyDay=dates.indexOf(today)>=0?today:dates[0];
  var entries=[];dates.forEach(function(date){CHECKLIST_ITEMS.forEach(function(it){if(it.kind==='weekly'&&Number(it.weekday)===new Date(date+'T00:00:00').getDay()&&_wkPeriodOk(it,date)&&(_staffWeeklyScope==='all'||_clHasEmp(it.assignee,CU&&CU.id)))entries.push({it:it,date:date,done:!!checks[date+'|'+it.id]});});});
  _staffWeeklySnapshot.entries=entries;
  var done=entries.filter(function(e){return e.done;}).length,pct=entries.length?Math.round(done/entries.length*100):0;
  var visible=entries.filter(function(e){return (_staffWeeklyDay==='all'||e.date===_staffWeeklyDay)&&(!_staffWeeklyOnlyOpen||!e.done);});
  var h='<section class="sww-workspace" id="staffWeeklyWorkspace"><header class="sww-heading"><div><p class="swo-eyebrow">TEAM OPERATIONS</p><h1>주간 업무 체크</h1><p>반복되는 일을 빠짐없이. 담당 업무와 고객별 진행 상황을 한곳에서 확인하세요.</p></div><div class="sww-heading-actions"><button class="tm-btn" data-week-action="person">담당자별 보기</button><button class="tm-btn tm-btn-pri" data-week-action="add">+ 반복 업무 등록</button></div></header>';
  h+='<div class="sww-overview"><section class="sww-progress-card"><span>이번 주 완료율</span><div><strong>'+pct+'<small>%</small></strong><p>'+done+' / '+entries.length+'개 완료</p></div><div class="sww-progress-track"><i style="width:'+pct+'%"></i></div></section><section class="sww-total-card"><span>남은 업무</span><strong>'+(entries.length-done)+'</strong><p>이번 주에 처리할 항목</p></section><section class="sww-today-card"><span>오늘의 체크</span><strong>'+entries.filter(function(e){return e.date===today&&!e.done;}).length+'</strong><p>미완료 항목 · 홈과 자동 연동</p></section></div>';
  h+='<div class="sww-main"><aside class="sww-days"><div class="sww-side-title"><strong>이번 주</strong><span>'+_staffSafe(dates[0].slice(5))+' — '+_staffSafe(dates[6].slice(5))+'</span></div><button data-week-day="all" class="'+(_staffWeeklyDay==='all'?'selected':'')+'"><span>한 주 전체 보기</span><b>'+entries.length+'</b></button>';
  dates.forEach(function(date){var d=new Date(date+'T00:00:00'),items=entries.filter(function(e){return e.date===date;}),remaining=items.filter(function(e){return !e.done;}).length;h+='<button data-week-day="'+date+'" class="'+(_staffWeeklyDay===date?'selected':'')+'"><div><strong>'+days[d.getDay()]+'요일 <small>'+d.getDate()+'일</small></strong>'+(date===today?'<em>오늘</em>':'')+'<p>'+(items.length?remaining+'개 남음 / 전체 '+items.length+'개':'등록된 업무 없음')+'</p></div><span class="sww-day-count">'+remaining+'</span></button>';});
  h+='</aside><main class="sww-list"><div class="sww-list-heading"><div><h2>'+(_staffWeeklyDay==='all'?'이번 주 전체 업무':_staffSafe(_staffWeeklyDay.slice(5))+' '+days[new Date(_staffWeeklyDay+'T00:00:00').getDay()]+'요일 업무')+'</h2><p>항목별 완료 상태와 담당자를 확인하세요.</p></div><div><button class="tm-btn" data-week-action="scope">'+(_staffWeeklyScope==='all'?'전체 담당자':'내 담당 + 공용')+'</button><button class="tm-btn '+(_staffWeeklyOnlyOpen?'tm-btn-pri':'')+'" data-week-action="open">미완료만 보기</button></div></div>';
  if(!visible.length)h+='<div class="sww-complete-state"><span>✓</span><h3>'+(_staffWeeklyOnlyOpen?'남은 업무가 없습니다.':'표시할 업무가 없습니다.')+'</h3><p>다른 요일이나 담당 범위를 선택해 확인할 수 있습니다.</p></div>';
  visible.forEach(function(e){var it=e.it,index=entries.indexOf(e);h+='<article class="sww-work-row '+(e.done?'is-complete':'')+'"><div class="sww-work-core"><label><input type="checkbox" data-week-check="'+index+'" '+(e.done?'checked':'')+'><span><strong>'+_staffSafe(it.content||'')+'</strong><small>'+_staffSafe(e.date)+(it.recurring?' · 매주 반복':' · 이번 회차')+'</small></span></label><div class="sww-assignees">'+_clBadge(it.assignee)+'</div><button class="sww-edit" data-week-edit="'+index+'" aria-label="'+_staffSafe(it.content||'')+' 수정">수정</button></div>';
    if(it.smart_key)h+='<div class="sww-customer-checks"><p>연결된 고객별 처리</p>'+_smartSubsHtml(it.id,e.date,_smartNames(it.smart_key,e.date,bookings),checks,{ml:'0',fs:'13px'})+'</div>';
    if(it.ref_label||it.start_date||it.end_date)h+='<div class="sww-meta">'+_wkMetaChips(it)+'</div>';h+='</article>';});
  return h+'</main></div></section>';
}
function _staffWeeklyRerender(){var root=document.getElementById('staffWeeklyWorkspace'),s=_staffWeeklySnapshot;if(root&&s)root.outerHTML=_staffWeeklyWorkspace(s.dates,s.checks,s.bookings);}
document.addEventListener('click',function(e){var button=e.target.closest('[data-week-day],[data-week-action],[data-week-edit]');if(!button)return;
  if(button.dataset.weekDay){_staffWeeklyDay=button.dataset.weekDay;_staffWeeklyRerender();}
  var action=button.dataset.weekAction;if(action==='add')openWeeklyForm();if(action==='person')setWkView('person');if(action==='scope'){_staffWeeklyScope=_staffWeeklyScope==='all'?'mine':'all';_staffWeeklyRerender();}if(action==='open'){_staffWeeklyOnlyOpen=!_staffWeeklyOnlyOpen;_staffWeeklyRerender();}
  if(button.dataset.weekEdit!==undefined){var entry=_staffWeeklySnapshot.entries[Number(button.dataset.weekEdit)];if(entry)openWeeklyEditById(entry.it.id);}
});
document.addEventListener('change',function(e){if(e.target.dataset.weekCheck!==undefined){var entry=_staffWeeklySnapshot.entries[Number(e.target.dataset.weekCheck)];if(entry)toggleWeeklyCheck(entry.it.id,entry.date,e.target);}});
function _staffApvRecipients(to){return to==='both'?['ceo']:to==='jun'?[]:[to];}
function _staffApvStatus(a){return a.status==='approve'?'approved':a.status==='reject'?'rejected':a.status||'pending';}
function _staffApvCanRead(a,user){return !!(user&&(a.from_id===user.id||_staffApvRecipients(a.to_id).indexOf(user.id)>=0));}
function _staffApvCanDecide(a,user){return !!(user&&user.id==='ceo'&&_staffApvRecipients(a.to_id).indexOf(user.id)>=0&&_staffApvStatus(a)==='pending');}
function _staffApvBindChecks(a){
  var box=document.getElementById('apvBodyHtml_'+a.id);if(!box)return;
  var inputs=Array.from(box.querySelectorAll('input[type="checkbox"]')),editable=CU&&a.from_id===CU.id&&_staffApvStatus(a)==='pending';
  inputs.forEach(function(inp){inp.disabled=!editable;inp.onchange=async function(){
    if(!editable||_staffApvBusy[a.id])return;var prior=!inp.checked;_staffApvBusy[a.id]=true;inputs.forEach(function(i){i.disabled=true;});
    if(inp.checked)inp.setAttribute('checked','');else inp.removeAttribute('checked');
    var body=box.innerHTML; // Disabled is a UI state, never persist it in the document.
    body=body.replace(/\sdisabled(?:="[^"]*")?/gi,'');
    try{var saved=await sbPatch('staff_approvals','id=eq.'+encodeURIComponent(a.id)+'&from_id=eq.'+encodeURIComponent(a.from_id)+'&status=eq.pending',{body:body});if(!saved.some(function(r){return String(r.id)===String(a.id);}))throw Error();a.body=body;toast('체크를 저장했습니다.');}
    catch(e){inp.checked=prior;if(prior)inp.setAttribute('checked','');else inp.removeAttribute('checked');toast('체크 저장 실패 · 기존 상태로 되돌렸습니다.','#ef4444');}
    finally{delete _staffApvBusy[a.id];inputs.forEach(function(i){i.disabled=!editable;});}
  };});
}
async function _staffReadPages(table,query){
  var rows=[],offset=0;
  while(true){var page=await sbGet(table,query+'&limit=100&offset='+offset);rows=rows.concat(page);if(page.length<100)return rows;offset+=page.length;}
}
async function _staffFetchCalendarRows(url,headers){
  var rows=[],offset=0;
  while(true){var response=await fetch(url+'&limit=100&offset='+offset,{headers:headers});if(!response.ok)throw Error('일정을 조회하지 못했습니다.');var page=await response.json();if(!Array.isArray(page))throw Error('일정 응답 형식을 확인할 수 없습니다.');rows=rows.concat(page);if(page.length<100)return rows;offset+=page.length;}
}
function _staffApvRefresh(){
  if(_apvCtx&&document.getElementById(_apvCtx.tid))renderApprovalPage(CU.id,_apvCtx.tid);
  if(typeof refreshApvPendingCount==='function')refreshApvPendingCount();
}
async function _staffProcessApproval(id,action){
  if(!CU||_staffApvBusy[id])return;
  if(['approve','reject'].indexOf(action)<0)return;
  var actor=CU,inp=document.getElementById('rr_'+id),reason=inp?inp.value.trim():'';
  if(action==='reject'&&!reason){if(inp)inp.focus();toast('반려 사유를 입력해주세요','#ef4444');return;}
  _staffApvBusy[id]=true;
  try{
    var query='id=eq.'+encodeURIComponent(id),rows=await sbGet('staff_approvals',query),a=rows[0];
    if(CU!==actor||!a||!_staffApvCanDecide(a,actor))throw Error('처리 권한이 없거나 이미 처리된 결재입니다.');
    var patch={status:action==='approve'?'approved':'rejected',reject_reason:action==='reject'?reason:''};
    var saved=await sbPatch('staff_approvals',query+'&status=eq.'+encodeURIComponent(a.status||'pending')+'&to_id=eq.'+encodeURIComponent(a.to_id),patch);
    if(!saved.some(function(r){return String(r.id)===String(id);}))throw Error('다른 담당자가 먼저 처리했거나 저장 권한이 없습니다. 새로 확인해주세요.');
    if(CU!==actor)return;
    createNotif(a.from_id,'approval',String(id),(action==='approve'?'결재 승인: ':'결재 반려: ')+(a.title||'')+(reason?' · '+reason:''));
    _apvTab='done';toast(action==='approve'?'승인했습니다.':'반려했습니다.');_staffApvRefresh();
  }catch(e){toast(e.message||'결재 처리 실패','#ef4444');}
  finally{delete _staffApvBusy[id];}
}
async function _staffSubmitApproval(empId){
  if(!CU||_staffApvSubmitting)return;
  if(_staffApvUploadCount){toast('첨부파일 업로드가 끝난 뒤 상신해주세요.','#ef4444');return;}
  var title=document.getElementById('apvTitle'),ed=document.getElementById('apvBodyEd'),plain=document.getElementById('apvBody');
  var to=document.querySelector('input[name="apvTo"]:checked'),recipient=to?to.value:'ceo';
  var body=ed?ed.innerHTML:plain?plain.value:'',content=ed?ed.textContent:body;
  if(!title||!title.value.trim()){toast('제목을 입력해주세요','#ef4444');return;}
  if(!(content||'').trim()&&!(ed&&ed.querySelector('input,img'))){toast('내용을 입력해주세요','#ef4444');return;}
  if(recipient!=='ceo'){toast('현재 결재 대상이 아닙니다. 수신자를 다시 선택해주세요.','#ef4444');return;}
  var actor=CU,modal=document.getElementById('apvFormOv'),subject=title.value.trim(),draft=_staffApvDraft;
  _staffApvSubmitting=true;if(modal)modal.inert=true;
  try{
    var saved=await sbPost('staff_approvals',{from_id:actor.id,to_id:recipient,title:subject,body:body,files:(_apvFiles||[]).slice(),status:'pending',ts:Date.now()});
    if(!saved.length||saved[0].id==null)throw Error('저장 응답을 확인하지 못했습니다. 목록을 확인한 뒤 다시 시도해주세요.');
    if(CU!==actor)return;
    createNotifMultiple(_staffApvRecipients(recipient),'approval',String(saved[0].id),actor.name+'님이 결재를 요청했습니다: '+subject);
    if(draft===_staffApvDraft){_apvFiles=[];if(modal)modal.remove();}
    _apvTab='mine';_apvSelId=String(saved[0].id);toast('결재를 상신했습니다.');_staffApvRefresh();
  }catch(e){toast('상신 실패 · 입력 내용은 유지됩니다. '+e.message,'#ef4444');}
  finally{_staffApvSubmitting=false;if(modal)modal.inert=false;}
}
async function _staffResubmitApproval(id){
  if(!CU||_staffApvBusy[id])return;
  var title=document.getElementById('resubTitle_'+id),body=document.getElementById('resubBody_'+id);
  var bodyValue=body?('value' in body?body.value:body.innerHTML):'',plain=body?('value' in body?body.value:body.textContent):'';
  if(!title||!title.value.trim()||!plain.trim()){toast('제목과 내용을 입력해주세요','#ef4444');return;}
  var subject=title.value.trim();
  _staffApvBusy[id]=true;var actor=CU;
  try{
    var query='id=eq.'+encodeURIComponent(id),rows=await sbGet('staff_approvals',query),a=rows[0];
    if(CU!==actor||!a||a.from_id!==actor.id||_staffApvStatus(a)!=='rejected')throw Error('본인이 상신한 반려 건만 다시 상신할 수 있습니다.');
    if(!_staffApvRecipients(a.to_id).length)throw Error('퇴사자가 수신자인 과거 결재입니다. 현재 수신자를 선택해 새로 상신해주세요.');
    var saved=await sbPatch('staff_approvals',query+'&from_id=eq.'+encodeURIComponent(actor.id)+'&status=eq.'+encodeURIComponent(a.status),{title:subject,body:bodyValue.trim(),status:'pending',reject_reason:''});
    if(!saved.some(function(r){return String(r.id)===String(id);}))throw Error('결재 상태가 변경되었거나 저장 권한이 없습니다.');
    if(CU!==actor)return;
    createNotifMultiple(_staffApvRecipients(a.to_id),'approval',String(id),actor.name+'님이 결재를 재상신했습니다: '+subject);
    _apvTab='mine';toast('재상신했습니다.');_staffApvRefresh();
  }catch(e){toast(e.message,'#ef4444');}finally{delete _staffApvBusy[id];}
}
async function _staffApvComment(id){
  var inp=document.getElementById('apvCmtInp_'+id);if(!CU||!inp||!inp.value.trim()||_staffApvBusy[id])return;
  var text=inp.value.trim(),actor=CU;_staffApvBusy[id]=true;inp.disabled=true;
  try{
    var query='id=eq.'+encodeURIComponent(id),rows=await sbGet('staff_approvals',query),a=rows[0];
    if(CU!==actor||!a||!_staffApvCanRead(a,actor))throw Error('댓글을 등록할 권한이 없습니다.');
    var cmts=Array.isArray(a.comments)?a.comments.slice():[];cmts.push({id:uid(),author:actor.id,text:text,ts:new Date().toISOString()});
    var saved=await sbPatch('staff_approvals',query,{comments:cmts});
    if(!saved.some(function(r){return String(r.id)===String(id);}))throw Error('저장 결과를 확인하지 못했습니다.');
    if(CU!==actor)return;
    if(inp.value.trim()===text)inp.value='';_apvLoadCmts(id);
    createNotifMultiple(Array.from(new Set([a.from_id].concat(_staffApvRecipients(a.to_id)))),'approval',String(id),actor.name+'님의 결재 댓글: '+text.slice(0,40));
  }catch(e){toast('댓글을 저장하지 못했습니다. '+e.message,'#ef4444');}finally{inp.disabled=false;delete _staffApvBusy[id];}
}
function _staffCalendarStatus(){
  var body=document.getElementById('calBody');if(!body)return;
  var old=document.getElementById('staffCalStatus');if(old)old.remove();
  if(!_staffCalLoading&&!_staffCalError)return;
  var message=document.createElement('div');message.id='staffCalStatus';message.className='swo-status';message.setAttribute('role','status');
  message.textContent=_staffCalLoading?'예약·픽업 일정을 불러오는 중입니다.':_staffCalError;
  if(!_staffCalLoading){var retry=document.createElement('button');retry.textContent='다시 불러오기';retry.className='tm-btn';retry.onclick=function(){loadStudentEvents(calDate.getFullYear(),calDate.getMonth()+1).then(renderCal);};message.appendChild(retry);}
  body.before(message);
}
function _staffPersonalCalendar(empId){
  var host=document.getElementById('empDetail');if(!host)return;
  var date=todayStr(),pool=tasks.filter(function(t){return _staffAssigned(t,empId)&&taskVisible(t)&&!_isArchivedTask(t.id)&&!isDoneTask(t)&&t.due;}).sort(function(a,b){return a.due.localeCompare(b.due);});
  var groups=[{title:'기한이 지난 업무',hint:'일정을 조정하거나 완료 내용을 확인하세요.',items:pool.filter(function(t){return t.due<date;})},{title:'오늘 마감',hint:'오늘 끝내야 하는 업무입니다.',items:pool.filter(function(t){return t.due===date;})},{title:'다가오는 일정',hint:'마감일 순으로 표시합니다.',items:pool.filter(function(t){return t.due>date;})}];
  host.innerHTML='<section class="swo-agenda"><header><div><p class="swo-eyebrow">MY SCHEDULE</p><h1>내 일정</h1><p>업무 기한을 확인하고, 상세 화면에서 진행 내용을 이어가세요.</p></div><button class="tm-btn" data-calendar>전체 운영 달력 보기</button></header>'+groups.map(function(g){return '<section class="swo-panel"><h2>'+g.title+' <span>'+g.items.length+'</span></h2><p>'+g.hint+'</p>'+(g.items.length?g.items.map(function(t){return '<button class="swo-agenda-row" data-task="'+_staffSafe(t.id)+'"><time>'+_staffSafe(t.due)+'</time><strong>'+_staffSafe(t.title)+'</strong><span>업무 열기 →</span></button>';}).join(''):'<div class="swo-empty">해당하는 업무가 없습니다.</div>')+'</section>';}).join('')+'<p class="swo-note">입·퇴실, 픽업, 필드트립, 셔틀 일정은 전체 운영 달력에서 확인할 수 있습니다. 기한 없는 업무는 내 업무 홈에 표시됩니다.</p></section>';
  host.querySelector('[data-calendar]').onclick=function(){showPage('calendar');};host.querySelectorAll('[data-task]').forEach(function(b){b.onclick=function(){selectEmpTask(b.dataset.task);};});
}
