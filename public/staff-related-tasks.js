/* Related work references use the existing note field and task visibility rules. */
function _staffRelatedTaskUrl(id){return '/admin/view?src='+encodeURIComponent('/staff?page=board&task='+encodeURIComponent(id));}
function _staffRelatedTaskId(href){
  try{var url=new URL(href,location.origin);if(url.origin!==location.origin||url.pathname!=='/admin/view')return null;var src=url.searchParams.get('src')||'';if(!src.startsWith('/staff?'))return null;return new URL(src,location.origin).searchParams.get('task');}catch(e){return null;}
}
function _staffRelatedTaskFind(id){return tasks.find(function(t){return String(t.id)===String(id)&&taskVisible(t);});}
function _staffRelatedTaskPreview(host,t){
  host.hidden=false;host.replaceChildren();
  var head=document.createElement('div');head.className='swt-reservation-head';
  var heading=document.createElement('h2');heading.textContent='관련 업무 함께 보기';
  var close=document.createElement('button');close.type='button';close.className='tm-btn';close.textContent='접기';close.onclick=function(){host.hidden=true;};head.append(heading,close);
  var title=document.createElement('strong');title.textContent=t.title||'제목 없음';
  var meta=document.createElement('p');meta.textContent=(isDoneTask(t)?'완료':'진행 중')+' · '+_staffRelatedTaskPeople(t);
  var note=document.createElement('div');note.className='swt-related-note';var plain=document.createElement('template');plain.innerHTML=String(t.note||'').replace(/<br\s*\/?\s*>|<\/(?:p|div|li|h[1-6])>/gi,'\n');plain.content.querySelectorAll('script,style').forEach(function(el){el.remove();});note.textContent=plain.content.textContent.trim()||'요청 내용이 없습니다.';
  var open=document.createElement('a');open.className='tm-btn';open.href=_staffRelatedTaskUrl(t.id);open.target='_blank';open.rel='noopener';open.textContent='전체 업무 상세 ↗';
  host.append(head,title,meta,note,open);
}
function _staffRelatedTaskPeople(t){return (t.assignees&&t.assignees.length?t.assignees:[t.assignee]).filter(Boolean).map(function(id){var p=getP(id);return p?p.name:id;}).join(', ')||'담당 미지정';}
function _staffRelatedTaskSetup(){
  var aside=document.querySelector('#taskModal .swt-editor-aside');if(!aside)return;
  var section=document.getElementById('swtRelatedTasks');
  if(!section){section=document.createElement('section');section.id='swtRelatedTasks';section.className='swt-booking-search';
    section.innerHTML='<h2>관련 직원업무 연결</h2><label for="swtTaskQuery">업무 제목 또는 담당자</label><div><input id="swtTaskQuery" placeholder="검색어 입력 · 비우면 최근 업무"><button type="button" id="swtTaskSearch">검색</button></div><div id="swtTaskResults" role="status"></div><p class="swt-help">업무를 선택하면 요청 내용에 링크가 추가됩니다. 오른쪽에서 내용을 보며 설명·조언을 작성하세요.</p>';
    aside.appendChild(section);document.getElementById('swtTaskSearch').onclick=_staffRelatedTaskSearch;document.getElementById('swtTaskQuery').onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();_staffRelatedTaskSearch();}};
    var preview=document.createElement('section');preview.id='swtEditorTaskPreview';preview.className='swt-reservation-preview';aside.prepend(preview);
  }
  document.getElementById('swtTaskQuery').value='';document.getElementById('swtTaskResults').replaceChildren();document.getElementById('swtEditorTaskPreview').hidden=true;
}
function _staffRelatedTaskSearch(){
  var query=document.getElementById('swtTaskQuery').value.trim().toLocaleLowerCase(),box=document.getElementById('swtTaskResults');box.replaceChildren();
  var matches=tasks.filter(function(t){return taskVisible(t)&&String(t.id)!==String(editTaskId)&&!_isArchivedTask(t.id)&&(String(t.title||'')+' '+_staffRelatedTaskPeople(t)).toLocaleLowerCase().includes(query);}).sort(function(a,b){return new Date(b.createdAt||0)-new Date(a.createdAt||0);});
  if(!matches.length){box.textContent='해당하는 업무가 없습니다.';return;}
  matches.slice(0,30).forEach(function(t){var button=document.createElement('button');button.type='button';button.className='swt-booking-result';button.textContent=(t.secret?'🔒 ':'')+(t.title||'제목 없음')+' · '+_staffRelatedTaskPeople(t)+' · '+(isDoneTask(t)?'완료':'진행 중');button.onclick=function(){
    var body=document.getElementById('tmNt'),duplicate=Array.from(body.querySelectorAll('a[href]')).some(function(a){return _staffRelatedTaskId(a.getAttribute('href'))===String(t.id);});
    if(!duplicate){var p=document.createElement('p'),a=document.createElement('a');a.href=_staffRelatedTaskUrl(t.id);a.target='_blank';a.rel='noopener';a.textContent='연결 업무: '+(t.secret?'비밀 업무 (권한 필요)':t.title||'제목 없음');p.appendChild(a);body.appendChild(p);_staffTaskPageDirty=true;}
    _staffRelatedTaskPreview(document.getElementById('swtEditorTaskPreview'),t);box.textContent=duplicate?'이미 연결한 업무입니다.':'업무 링크를 추가했습니다. 요청 내용에 설명을 이어서 적어주세요.';
  };box.appendChild(button);});
  if(matches.length>30){var more=document.createElement('p');more.textContent='최근 30건을 표시합니다. 검색어를 더 구체적으로 입력해주세요.';box.appendChild(more);}
}
function _staffRelatedTaskDetail(root){
  root.querySelectorAll('a[href]').forEach(function(a){var id=_staffRelatedTaskId(a.getAttribute('href'));if(!id)return;a.onclick=function(e){e.preventDefault();var t=_staffRelatedTaskFind(id);if(!t){toast('업무가 삭제되었거나 열람 권한이 없습니다.');return;}_homeGotoBoardTask(t.id);};});
}
function _staffRelatedTaskDeepLink(){
  var id=new URLSearchParams(location.search).get('task');if(!id)return;
  var t=_staffRelatedTaskFind(id);if(t)_homeGotoBoardTask(t.id);else toast('업무가 삭제되었거나 열람 권한이 없습니다.');
}
