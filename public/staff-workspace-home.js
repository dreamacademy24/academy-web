/* PC staff home. Existing task, notice and booking editors remain the source of writes. */
if(window.self!==window.top)document.documentElement.classList.add('staff-embedded');
function _staffTeamHomeMarkup(){
  var date=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Manila',month:'long',day:'numeric',weekday:'long'}).format(new Date());
  var cards=[['kOps1','확인 필요한 예약','누락 정보와 운영 요청'],['kOps2','오늘 체크리스트','팀이 함께 처리할 일'],['kOps3','오늘 체크인','도착 예정 가족'],['kOps4','오늘 픽드랍','예약된 이동 일정']];
  return '<div class="swh-team-heading"><div><p class="swo-eyebrow">TEAM WORKSPACE · '+_staffSafe(date)+'</p><h1>오늘의 운영</h1><p>예약 현황과 팀 체크리스트를 한곳에서 확인하세요.</p></div><div><button class="tm-btn" onclick="showPage(\'mywork\')">내 업무 보기</button> <button class="tm-btn tm-primary" onclick="openTaskModal()">＋ 업무 작성</button></div></div>'+
    '<div class="swh-team-metrics">'+cards.map(function(c){return '<section><span>'+c[1]+'</span><strong id="'+c[0]+'">—</strong><small>'+c[2]+'</small></section>';}).join('')+'</div>'+
    '<section class="hcard swh-team-daily"><div class="swh-team-section-heading"><div><h2>오늘 함께 처리할 일</h2><p>체크 상태는 주간 체크리스트와 연결됩니다.</p></div><button class="tm-btn" onclick="showPage(\'weeklycl\')">주간 체크 보기 →</button></div><div id="dailyCheckSection"></div></section>'+
    '<div class="swh-team-grid"><section class="hcard"><div id="homeIssuesBox"></div></section><section class="hcard"><div id="homeTutorBox"></div></section></div>'+
    '<section class="hcard"><div id="teacherSharedBox"></div></section>';
}
var _staffHomeFilter='focus';
var _staffBookingCache={};
function _staffAssigned(t,empId){return t.assignee===empId||(Array.isArray(t.assignees)&&t.assignees.indexOf(empId)>=0);}
function _staffHomeModel(taskRows,noticeRows,reads,empId,today){
  var active=(taskRows||[]).filter(function(t){return !isDoneTask(t)&&!_isArchivedTask(t.id);});
  var assigned=active.filter(function(t){return _staffAssigned(t,empId);});
  var overdue=assigned.filter(function(t){return t.due&&t.due.slice(0,10)<today;});
  var dueToday=assigned.filter(function(t){return (t.due||'').slice(0,10)===today;});
  var unread=(noticeRows||[]).filter(function(n){return n.requireRead&&!n.done&&((reads||{})[n.id]||[]).map(String).indexOf(String(empId))<0;});
  function rank(t){return t.due&&t.due.slice(0,10)<today?0:(t.due||'').slice(0,10)===today?1:(t.priority==='high'||t.priority==='urgent')?2:3;}
  assigned.sort(function(a,b){return rank(a)-rank(b)||(a.due||'9999').localeCompare(b.due||'9999')||(b.createdAt||'').localeCompare(a.createdAt||'');});
  return {assigned:assigned,overdue:overdue,today:dueToday,unread:unread,
    outgoing:active.filter(function(t){return t.createdBy===empId&&!_staffAssigned(t,empId);})};
}
function _staffSafe(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function _staffBookingFields(){return 'id,reservation_no,booker_name,status,payment_status,checkin_date,checkout_date,accom_type,booking_type,house_no,accom_room,students,adults,children,special_request,final_price,base_price,paid_amount,assignee,care_assignee,flight_in,flight_out,seg1_type,seg1_checkin,seg1_checkout,seg2_type,seg2_checkin,seg2_checkout';}
function _staffLoadMine(emp){
  var key=emp.id+'|'+emp.name+'|'+todayStr(),cached=_staffBookingCache[key];
  if(cached&&cached.rows&&Date.now()-cached.at<60000)return Promise.resolve(cached.rows);
  if(cached&&cached.pending)return cached.pending;
  var name=encodeURIComponent('"'+String(emp.name||emp.id).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"');
  var query='select='+_staffBookingFields()+'&or=(assignee.eq.'+name+',care_assignee.eq.'+name+')&checkout_date=gte.'+todayStr()+'&order=checkin_date.asc,id.asc';
  var entry={};_staffBookingCache[key]=entry;
  function page(offset,all){return sbGet('bookings',query+'&limit=100&offset='+offset).then(function(rows){
    all=all.concat(rows);return rows.length===100?page(offset+100,all):all;
  });}
  entry.pending=page(0,[]).then(function(rows){entry.rows=rows.filter(function(b){return String(b.status||'').indexOf('취소')<0;});entry.at=Date.now();return entry.rows;})
    .finally(function(){entry.pending=null;});
  return entry.pending;
}
function _staffHomeBookingOrder(rows,today){
  function rank(b){return b.checkout_date===today?0:b.checkin_date===today?1:b.checkin_date<=today?2:3;}
  return rows.slice().sort(function(a,b){return rank(a)-rank(b)||(a.checkin_date||'').localeCompare(b.checkin_date||'');});
}
function _staffOpenGuest(emp,id){
  var origin=document.getElementById('staffHomeRoot');
  _bsChip='mine';_bsQ='';_bsSelId=id||null;
  return _staffLoadMine(emp).then(function(rows){
    if(curEmpId!==emp.id||document.getElementById('staffHomeRoot')!==origin)return;
    setEmpTab('guest');
  }).catch(function(){toast('담당 예약을 불러오지 못했습니다. 다시 시도해주세요.','#dc2626');});
}
function _renderStaffHome(emp){
  var host=document.getElementById('empDetail');if(!host)return;
  var model=_staffHomeModel(tasks,notices,noticeReads,emp.id,todayStr());
  var date=new Date(todayStr()+'T12:00:00').toLocaleDateString('ko-KR',{month:'long',day:'numeric',weekday:'long'});
  host.innerHTML='<div class="swh" id="staffHomeRoot">'+
    '<header class="swh-header"><div><p class="swh-eyebrow">MY WORKSPACE · '+_staffSafe(date)+'</p><h1>'+_staffSafe(emp.name)+'님의 업무 홈</h1><p>오늘의 우선순위를 확인하고, 필요한 업무로 바로 이동하세요.</p></div><button class="swh-primary" data-action="create">＋ 업무 작성</button></header>'+
    '<div class="swh-metrics">'+
      '<button data-filter="today"><span>오늘 마감</span><strong>'+model.today.length+'<small>건</small></strong><em>오늘 처리할 업무 →</em></button>'+
      '<button class="swh-overdue" data-filter="overdue"><span>기한 초과</span><strong>'+model.overdue.length+'<small>건</small></strong><em>먼저 확인해주세요 →</em></button>'+
      '<button data-action="notices"><span>확인할 공지</span><strong>'+model.unread.length+'<small>건</small></strong><em>필수 공지 읽음 확인 →</em></button>'+
      '<button data-action="guests"><span>내 담당 예약</span><strong id="swhGuestCount">—</strong><em>체류 중 · 입실 예정 →</em></button></div>'+
    '<div class="swh-columns"><main class="swh-main">'+
      '<section class="swh-panel"><div class="swh-section-head"><div><h2>처리할 업무</h2><p>기한이 지난 업무부터 순서대로 보여드려요.</p></div><button class="swh-link" data-tab="board">보드 보기 ↗</button></div><div class="swh-filters" id="swhFilters"></div><div id="swhTasks"></div></section>'+
      '<section class="swh-panel"><div class="swh-section-head"><div><h2>내 담당 예약</h2><p>예약 준비 · 학생 케어 · 인계 코멘트</p></div><button class="swh-link" data-action="guests">전체 보기 ↗</button></div><div id="swhBookings" role="status" class="swh-loading">담당 예약을 불러오는 중입니다…</div></section>'+
      '<section class="swh-panel"><div class="swh-section-head"><div><h2>반복 체크</h2><p>내 담당 항목과 공용 체크를 확인하세요.</p></div><button class="swh-link" data-tab="checklist">체크리스트 열기 ↗</button></div><div id="empHomeDcl"></div></section>'+
    '</main><aside class="swh-aside"><section class="swh-panel" id="swhNoticePanel"><div class="swh-section-head"><h2>확인할 공지 <span class="swh-count">'+model.unread.length+'</span></h2><button class="swh-link" data-action="all-notices">전체</button></div><div id="swhNotices"></div></section>'+
      '<section class="swh-panel"><div class="swh-section-head"><h2>새 소식</h2></div><div id="swhActivity"></div></section>'+
      '<details class="swh-panel swh-timeline"><summary>하루 시간표 <span>펼치기</span></summary><div id="tlWidget"></div></details></aside></div></div>';
  var root=document.getElementById('staffHomeRoot');
  root.addEventListener('click',function(event){
    var b=event.target.closest('button');if(!b||!root.contains(b))return;
    if(b.dataset.filter){_staffHomeFilter=b.dataset.filter;renderTasks();return;}
    if(b.dataset.task){selectEmpTask(b.dataset.task);return;}
    if(b.dataset.booking){_staffOpenGuest(emp,b.dataset.booking);return;}
    if(b.dataset.notice){showPage('announcements');_ntOpen(b.dataset.notice);return;}
    if(b.dataset.tab){setEmpTab(b.dataset.tab);return;}
    if(b.dataset.activity){var n=(myNotifs||[]).find(function(x){return String(x.id)===b.dataset.activity;});if(n){window._empNotifList=[n];_empNotifGo(0);}return;}
    if(b.dataset.action==='create')openTaskModal(emp.id);
    if(b.dataset.action==='guests')_staffOpenGuest(emp);
    if(b.dataset.action==='all-notices')showPage('announcements');
    if(b.dataset.action==='notices')document.getElementById('swhNoticePanel').scrollIntoView({behavior:'smooth',block:'center'});
    if(b.dataset.action==='retry-guests')loadBookings();
  });
  function renderTasks(){
    var choices=[['focus','우선순위',model.assigned.length],['today','오늘',model.today.length],['overdue','기한 초과',model.overdue.length],['outgoing','내가 지시한 업무',model.outgoing.length]];
    document.getElementById('swhFilters').innerHTML=choices.map(function(c){return '<button data-filter="'+c[0]+'" aria-pressed="'+(_staffHomeFilter===c[0])+'">'+c[1]+' <span>'+c[2]+'</span></button>';}).join('');
    var rows=_staffHomeFilter==='today'?model.today:_staffHomeFilter==='overdue'?model.overdue:_staffHomeFilter==='outgoing'?model.outgoing:model.assigned;
    document.getElementById('swhTasks').innerHTML=rows.length?rows.slice(0,6).map(function(t){
      var due=(t.due||'').slice(0,10),late=due&&due<todayStr(),who=getP(t.assignee),author=getP(t.createdBy);
      var status=late?'기한 초과':due===todayStr()?'오늘 마감':due?due.slice(5).replace('-','/')+' 마감':'기한 없음';
      return '<button class="swh-task" data-task="'+_staffSafe(t.id)+'"><span class="swh-task-icon" aria-hidden="true">↗</span><span class="swh-task-text"><b>'+_staffSafe(t.title||'제목 없음')+'</b><small>'+_staffSafe(_staffHomeFilter==='outgoing'?'담당 '+(who?who.name:t.assignee||'미배정'):'지시자 '+(author?author.name:t.createdBy||'미지정'))+(t.files&&t.files.length?' · 첨부 '+t.files.length:'')+'</small></span><span class="swh-pill '+(late?'is-late':due===todayStr()?'is-today':'')+'">'+status+'</span></button>';
    }).join('')+(rows.length>6?'<button class="swh-more" data-tab="board">보드에서 '+rows.length+'건 모두 보기 →</button>':''):'<div class="swh-empty">해당하는 미완료 업무가 없습니다.</div>';
  }
  renderTasks();
  document.getElementById('swhNotices').innerHTML=model.unread.length?model.unread.slice(0,5).map(function(n){return '<button class="swh-notice" data-notice="'+_staffSafe(n.id)+'"><span class="swh-pill is-notice">확인 필요</span><b>'+_staffSafe(n.title||_ntPlain(n).slice(0,70)||'공지')+'</b><small>'+_staffSafe(n.date||'')+' · 내용 보기 →</small></button>';}).join('')+(model.unread.length>5?'<button class="swh-more" data-action="all-notices">공지 전체 보기 →</button>':''):'<div class="swh-empty">필수 공지를 모두 확인했습니다.</div>';
  _staffHomeActivity();
  renderMyTimeline(emp.id);
  loadDailyCheck('empHomeDcl');
  function loadBookings(){
    var box=document.getElementById('swhBookings');if(!box)return;
    box.innerHTML='<div class="swh-loading">담당 예약을 불러오는 중입니다…</div>';
    _staffLoadMine(emp).then(function(rows){
      if(document.getElementById('staffHomeRoot')!==root)return;
      document.getElementById('swhGuestCount').innerHTML=rows.length+'<small>건</small>';
      box.classList.remove('swh-loading');
      box.innerHTML=rows.length?_staffHomeBookingOrder(rows,todayStr()).slice(0,5).map(function(b){
        var today=todayStr(),label=b.checkout_date===today?'오늘 퇴실':b.checkin_date===today?'오늘 입실':b.checkin_date<=today?'체류 중':'입실 예정';
        return '<button class="swh-booking" data-booking="'+_staffSafe(b.id)+'"><span class="swh-avatar" aria-hidden="true">'+_staffSafe((b.booker_name||'?').slice(0,1))+'</span><span class="swh-task-text"><b>'+_staffSafe(b.booker_name||'이름 없음')+'</b><small>'+_staffSafe(b.house_no||b.accom_room||_bsAccomShort(b))+' · '+_staffSafe((b.checkin_date||'').slice(5))+' ~ '+_staffSafe((b.checkout_date||'').slice(5))+'</small></span><span class="swh-pill">'+label+'</span><span aria-hidden="true">→</span></button>';
      }).join(''):'<div class="swh-empty">현재 배정된 체류·입실 예정 예약이 없습니다.</div>';
    }).catch(function(){if(document.getElementById('staffHomeRoot')===root){box.innerHTML='<div class="swh-empty">담당 예약을 불러오지 못했습니다.<br><button class="swh-link" data-action="retry-guests">다시 불러오기</button></div>';document.getElementById('swhGuestCount').textContent='—';}});
  }
  loadBookings();
}
function _staffHomeActivity(){
  var box=document.getElementById('swhActivity');if(!box)return;
  var rows=(myNotifs||[]).filter(function(n){return !n.is_read&&n.type!=='notice';});
  box.innerHTML=rows.length?rows.slice(0,5).map(function(n){return '<button class="swh-activity" data-activity="'+_staffSafe(n.id)+'"><span class="swh-dot" aria-hidden="true"></span><span>'+_staffSafe(n.message||'새 소식')+'<small>'+_staffSafe(_actWhen(n.created_at))+'</small></span></button>';}).join(''):'<div class="swh-empty">새로운 댓글이나 요청이 없습니다.</div>';
}
